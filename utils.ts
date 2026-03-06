import { ParsedStep, LogStep } from './types';

const fixTime = (obj: any): any => {
  if (!obj || typeof obj !== 'object') return obj;
  
  if (obj.seconds !== undefined && obj.nanos !== undefined) {
    const s = Number(obj.seconds);
    const n = Number(obj.nanos || 0);
    return new Date(s * 1000 + n / 1e6).toISOString();
  }

  if (Array.isArray(obj)) {
    return obj.map(fixTime);
  }

  const newObj: any = {};
  for (const key in obj) {
    newObj[key] = fixTime(obj[key]);
  }
  return newObj;
};

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
      
      let data = parseValue();
      
      if (data && typeof data === 'object') {
        // Normalization for specific fields to match LogStep interface expectations
        data = fixTime(data);
        
        if (data.viewable_at && !data.metadata?.viewable_at) {
            if (!data.metadata) data.metadata = {};
            data.metadata.viewable_at = data.viewable_at;
        }
        if (data.timestamp && !data.metadata?.timestamp) {
            if (!data.metadata) data.metadata = {};
            data.metadata.timestamp = data.timestamp;
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
        if (data.metadata?.internal_metadata?.status_transitions) {
            ensureArray(data.metadata.internal_metadata, 'status_transitions');
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
  if (!trimmed) return [];
  
  let steps: ParsedStep[] = [];
  
  // 1. Try to parse as a JSON array or object with steps array
  try {
    const data = JSON.parse(trimmed);
    if (Array.isArray(data)) {
      steps = data.map((d, i) => ({
        index: d.index ?? i,
        raw: JSON.stringify(d, null, 2),
        data: d as LogStep
      }));
    } else if (data.steps && Array.isArray(data.steps)) {
      steps = data.steps.map((d, i) => ({
        index: d.index ?? i,
        raw: JSON.stringify(d, null, 2),
        data: d as LogStep
      }));
    }
  } catch (e) {
    // Not a simple JSON
  }

  // 2. Try proto format if "steps" keyword is present anywhere
  if (steps.length === 0 && text.includes('steps')) {
    steps = parseProtoText(text);
  }

  // 3. Try legacy format (Step X followed by JSON)
  if (steps.length === 0) {
    steps = parseLegacyLog(text);
  }

  if (steps.length === 0) return [];

  // Sort first by index
  steps.sort((a, b) => a.index - b.index);

  // Calculate durations and interactions
  let lastInteractionStartTime = 0;
  if (steps[0]?.data?.metadata?.created_at) {
    lastInteractionStartTime = new Date(steps[0].data.metadata.created_at).getTime();
  }
  
  let currentInteractionSteps: ParsedStep[] = [];
  let interactionIdCounter = 0;

  for (let i = 0; i < steps.length; i++) {
    const curr = steps[i];
    const isUserInput = curr.data?.type === 'CORTEX_STEP_TYPE_USER_INPUT';
    
    if (isUserInput && i > 0) {
      // End of previous interaction
      const endTime = curr.data?.metadata?.created_at ? new Date(curr.data.metadata.created_at).getTime() : 0;
      if (lastInteractionStartTime && endTime) {
        const duration = formatTimeDiff(endTime - lastInteractionStartTime);
        if (currentInteractionSteps.length > 0) {
          currentInteractionSteps[0].interactionDuration = duration;
          currentInteractionSteps[0].isInteractionStart = true;
        }
      }
      lastInteractionStartTime = curr.data?.metadata?.created_at ? new Date(curr.data.metadata.created_at).getTime() : 0;
      currentInteractionSteps = [curr];
      interactionIdCounter++;
    } else {
      currentInteractionSteps.push(curr);
    }

    curr.interactionId = interactionIdCounter;

    // Calculate execution duration for the step itself
    if (curr.data?.metadata?.created_at) {
      const start = new Date(curr.data.metadata.created_at).getTime();
      let end = 0;
      
      if (curr.data.metadata.completed_at) {
        end = new Date(curr.data.metadata.completed_at).getTime();
      } else if (curr.data.metadata.internal_metadata?.status_transitions) {
        const transitions = curr.data.metadata.internal_metadata.status_transitions;
        if (transitions.length > 0) {
          const lastTransition = transitions[transitions.length - 1];
          if (lastTransition.timestamp) {
            end = new Date(lastTransition.timestamp as string).getTime();
          }
        }
      }

      if (end && end >= start) {
        const diff = end - start;
        curr.executionDuration = diff < 1000 ? `${Math.floor(diff)}ms` : `${(diff / 1000).toFixed(2)}s`;
      }
    }

    if (i > 0) {
      const prev = steps[i-1];
      const prevTime = prev.data?.metadata?.created_at ? new Date(prev.data.metadata.created_at).getTime() : 0;
      const currTime = curr.data?.metadata?.created_at ? new Date(curr.data.metadata.created_at).getTime() : 0;

      if (prevTime && currTime) {
        const diff = currTime - prevTime;
        if (diff >= 0) {
           steps[i].durationFromPrevious = formatTimeDiff(diff);
        }
      }
    }
  }

  // Handle the last interaction
  if (currentInteractionSteps.length > 0 && lastInteractionStartTime) {
    const lastStep = steps[steps.length - 1];
    const endTime = lastStep.data?.metadata?.completed_at ? new Date(lastStep.data.metadata.completed_at).getTime() : 
                    (lastStep.data?.metadata?.created_at ? new Date(lastStep.data.metadata.created_at).getTime() : 0);
    
    if (endTime && endTime > lastInteractionStartTime) {
      currentInteractionSteps[0].interactionDuration = formatTimeDiff(endTime - lastInteractionStartTime);
      currentInteractionSteps[0].isInteractionStart = true;
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
    case 'CORTEX_STEP_TYPE_DEFINE_NEW_ENV_VARIABLE': return 'Key';
    case 'CORTEX_STEP_TYPE_SYSTEM_MESSAGE': return 'Info';
    case 'CORTEX_STEP_TYPE_READ_URL_CONTENT': return 'Globe';
    case 'CORTEX_STEP_TYPE_ERROR_MESSAGE': return 'AlertOctagon';
    default: return 'Activity';
  }
};

export const prepareLogForAnalysis = (steps: ParsedStep[]): string => {
  return JSON.stringify(steps.map(s => {
    const d = s.data;
    if (!d) return null;
    
    // Create a simplified version of the step
    const simplified: any = {
      index: s.index,
      type: d.type,
      status: d.status,
    };

    if (d.error) simplified.error = d.error;
    if (d.error_message) simplified.error_message = d.error_message;
    
    if (d.user_input) simplified.user_input = d.user_input;
    
    if (d.planner_response) {
      simplified.planner_response = {
        thinking: d.planner_response.thinking, // Important for logic analysis
        response: d.planner_response.response,
        tool_calls: d.planner_response.tool_calls
      };
    }

    if (d.task_boundary) simplified.task_boundary = d.task_boundary;
    if (d.define_new_env_variable) simplified.define_new_env_variable = d.define_new_env_variable;
    if (d.system_message) simplified.system_message = d.system_message;
    if (d.read_url_content) simplified.read_url_content = { url: d.read_url_content.url, title: d.read_url_content.web_document?.title };
    if (d.error_message) simplified.error_message = d.error_message;

    if (d.file_change) {
      simplified.file_change = {
        path: d.file_change.absolute_path_uri,
        type: d.file_change.file_change_type,
        // Omit full diffs to save tokens, just knowing it changed is usually enough for high-level logic
      };
    }

    return simplified;
  }).filter(Boolean), null, 2);
};
