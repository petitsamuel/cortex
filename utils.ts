import { ParsedStep, LogStep } from './types';

const parseProtoText = (text: string): ParsedStep[] => {
  let cursor = 0;
  const len = text.length;
  const steps: ParsedStep[] = [];
  let stepIndex = 0;

  const skipWs = () => {
    while (cursor < len && /\s/.test(text[cursor])) cursor++;
  };

  const parseString = () => {
    if (text[cursor] !== '"') return '';
    cursor++; // skip open quote
    let result = '';
    while (cursor < len) {
      const char = text[cursor];
      if (char === '\\') {
        cursor++;
        if (cursor >= len) break;
        const esc = text[cursor];
        if (esc === 'n') result += '\n';
        else if (esc === 'r') result += '\r';
        else if (esc === 't') result += '\t';
        else if (esc === '"') result += '"';
        else if (esc === '\\') result += '\\';
        else result += esc;
      } else if (char === '"') {
        cursor++; // skip close quote
        return result;
      } else {
        result += char;
      }
      cursor++;
    }
    return result;
  };

  const parseValue = (): any => {
    skipWs();
    if (cursor >= len) return undefined;

    const char = text[cursor];
    if (char === '"') return parseString();
    if (char === '{') return parseBlock();

    const match = text.slice(cursor).match(/^[^:\s{}"]+/);
    if (!match) return undefined;
    
    cursor += match[0].length;
    const valStr = match[0];
    
    if (valStr === 'true') return true;
    if (valStr === 'false') return false;
    if (!isNaN(Number(valStr)) && !valStr.includes('_')) return Number(valStr);
    return valStr;
  };

  const parseBlock = (): any => {
    if (text[cursor] === '{') cursor++;
    const obj: any = {};

    while (cursor < len) {
      skipWs();
      if (cursor >= len) break;
      if (text[cursor] === '}') {
        cursor++;
        return obj;
      }

      const keyMatch = text.slice(cursor).match(/^[a-zA-Z0-9_]+/);
      if (!keyMatch) {
        cursor++; // recover
        continue;
      }
      
      const key = keyMatch[0];
      cursor += key.length;
      
      skipWs();
      if (text[cursor] === ':') cursor++;
      
      const value = parseValue();
      
      if (obj.hasOwnProperty(key)) {
        if (!Array.isArray(obj[key])) {
          obj[key] = [obj[key]];
        }
        obj[key].push(value);
      } else {
        obj[key] = value;
      }
    }
    return obj;
  };

  while (cursor < len) {
    skipWs();
    if (cursor >= len) break;

    // We look for 'steps' keyword at the top level
    if (text.startsWith('steps', cursor)) {
      cursor += 5;
      skipWs();
      if (text[cursor] === ':') cursor++;
      
      const data = parseValue();
      
      if (data && typeof data === 'object') {
        // Normalization for specific fields to match LogStep interface expectations
        
        // 1. Timestamps
        const fixTime = (t: any) => {
            if (t && typeof t === 'object' && t.seconds) {
                const s = Number(t.seconds);
                const n = Number(t.nanos || 0);
                return new Date(s * 1000 + n / 1e6).toISOString();
            }
            return t;
        };
        
        if (data.metadata) {
            if (data.metadata.created_at) data.metadata.created_at = fixTime(data.metadata.created_at);
            if (data.metadata.completed_at) data.metadata.completed_at = fixTime(data.metadata.completed_at);
        }

        // 2. Arrays that might be parsed as single objects if only one exists
        const ensureArray = (obj: any, key: string) => {
            if (obj && obj[key] && !Array.isArray(obj[key])) {
                obj[key] = [obj[key]];
            }
        };

        if (data.planner_response) {
            ensureArray(data.planner_response, 'tool_calls');
        }
        if (data.file_change) {
            ensureArray(data.file_change, 'replacement_chunks');
            if (data.file_change.diff?.unified_diff) {
                ensureArray(data.file_change.diff.unified_diff, 'lines');
            }
        }

        steps.push({
          index: stepIndex++,
          raw: JSON.stringify(data, null, 2),
          data: data as LogStep
        });
      }
    } else {
      cursor++;
    }
  }

  return steps;
};

const parseLegacyLog = (text: string): ParsedStep[] => {
  const steps: ParsedStep[] = [];
  const rawSegments = text.split(/={10,}/);

  rawSegments.forEach((segment) => {
    const trimmed = segment.trim();
    if (!trimmed) return;

    const stepMatch = trimmed.match(/^Step\s+(\d+)/);
    if (stepMatch) {
      const index = parseInt(stepMatch[1], 10);
      const firstBrace = trimmed.indexOf('{');
      const lastBrace = trimmed.lastIndexOf('}');

      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        const jsonString = trimmed.substring(firstBrace, lastBrace + 1);
        try {
          const data = JSON.parse(jsonString) as LogStep;
          steps.push({
            index,
            raw: trimmed,
            data
          });
        } catch (e) {
          console.error(`Failed to parse JSON for step ${index}`, e);
          steps.push({
            index,
            raw: trimmed,
            data: null,
            error: "Failed to parse JSON content"
          });
        }
      } else {
        steps.push({
          index,
          raw: trimmed,
          data: null,
          error: "No JSON content found"
        });
      }
    }
  });

  return steps;
};

export const formatTimeDiff = (ms: number) => {
  if (ms < 1000) return `+${Math.floor(ms)}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `+${seconds.toFixed(2)}s`;
  const mins = Math.floor(seconds / 60);
  const remSeconds = (seconds % 60).toFixed(0);
  return `+${mins}m ${remSeconds}s`;
};

export const parseLogData = (text: string): ParsedStep[] => {
  const trimmed = text.trim();
  let steps: ParsedStep[] = [];
  
  if (trimmed.startsWith('steps')) {
    steps = parseProtoText(text);
  } else {
    steps = parseLegacyLog(text);
  }

  // Sort first
  steps.sort((a, b) => a.index - b.index);

  // Calculate durations between steps
  for (let i = 1; i < steps.length; i++) {
    const prev = steps[i-1];
    const curr = steps[i];
    
    const prevTime = prev.data?.metadata?.created_at ? new Date(prev.data.metadata.created_at).getTime() : 0;
    const currTime = curr.data?.metadata?.created_at ? new Date(curr.data.metadata.created_at).getTime() : 0;

    if (prevTime && currTime) {
      const diff = currTime - prevTime;
      if (diff >= 0) {
         steps[i].durationFromPrevious = formatTimeDiff(diff);
      }
    }
  }

  return steps;
};

export const formatDuration = (start: string, end?: string) => {
  if (!end) return '';
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  const diff = e - s;
  return `${(diff / 1000).toFixed(2)}s`;
};

export const getStepIcon = (type: string) => {
  switch (type) {
    case 'CORTEX_STEP_TYPE_USER_INPUT': return 'User';
    case 'CORTEX_STEP_TYPE_PLANNER_RESPONSE': return 'Brain';
    case 'CORTEX_STEP_TYPE_FILE_CHANGE': return 'FileCode';
    case 'CORTEX_STEP_TYPE_TASK_BOUNDARY': return 'Flag';
    case 'CORTEX_STEP_TYPE_COMPILE_APPLET': return 'Terminal';
    case 'CORTEX_STEP_TYPE_CHECKPOINT': return 'Save';
    default: return 'Activity';
  }
};