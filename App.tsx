import React, { useState, useMemo } from 'react';
import { parseLogData, prepareLogForAnalysis } from './utils';
import { ParsedStep, AnalysisData } from './types';
import { StepDetail } from './components/StepDetail';
import { StatusIcon, StepIcon } from './components/StepIcon';
import { AnalysisPanel } from './components/AnalysisPanel';
import { Search, Upload, Info, Sparkles, Timer, ChevronDown, ChevronRight, Zap, Clipboard, X as CloseIcon, Check } from 'lucide-react';
import { GoogleGenAI, Type } from "@google/genai";

declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    }
  }
}

const App: React.FC = () => {
  const [rawData, setRawData] = useState<string>('');
  const [appId, setAppId] = useState<string | null>(null);
  const [selectedStepIndex, setSelectedStepIndex] = useState<number>(0);
  const [filter, setFilter] = useState('');
  const [collapsedInteractions, setCollapsedInteractions] = useState<Set<number>>(new Set());
  
  // Analysis State
  const [isAnalysisOpen, setIsAnalysisOpen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isPasteModalOpen, setIsPasteModalOpen] = useState(false);
  const [pasteBuffer, setPasteBuffer] = useState('');
  const [analysisResult, setAnalysisResult] = useState<AnalysisData | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [focusPrompt, setFocusPrompt] = useState('');

  const steps = useMemo(() => parseLogData(rawData), [rawData]);

  const filteredSteps = useMemo(() => {
    if (!filter) return steps;
    const lower = filter.toLowerCase();
    return steps.filter(s => 
      (s.data?.type || '').toLowerCase().includes(lower) || 
      s.index.toString().includes(lower) ||
      (s.data?.task_boundary?.task_name || '').toLowerCase().includes(lower) ||
      (s.data?.file_change?.absolute_path_uri || '').toLowerCase().includes(lower) ||
      (s.data?.planner_response?.response || '').toLowerCase().includes(lower) ||
      (s.data?.planner_response?.thinking || '').toLowerCase().includes(lower) ||
      (s.data?.planner_response?.tool_calls?.some(tc => 
        tc.name.toLowerCase().includes(lower) || 
        tc.arguments_json.toLowerCase().includes(lower)
      ))
    );
  }, [steps, filter]);

  const activeStep = steps.find(s => s.index === selectedStepIndex);

  const toggleInteraction = (id: number | undefined) => {
    if (id === undefined) return;
    setCollapsedInteractions(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handlePasteApply = () => {
    if (!pasteBuffer.trim()) return;
    setRawData(pasteBuffer);
    setAppId('pasted-log-' + new Date().getTime().toString(16));
    setSelectedStepIndex(0);
    setAnalysisResult(null);
    setAnalysisError(null);
    setIsPasteModalOpen(false);
    setPasteBuffer('');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Extract app ID from filename
      const name = file.name;
      const match = name.match(/^([a-f0-9-]+)_trajectory/i);
      if (match) {
        setAppId(match[1]);
      } else {
        setAppId(name.replace(/\.[^/.]+$/, ""));
      }

      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target?.result as string;
        setRawData(text);
        setSelectedStepIndex(0);
        // Reset analysis when new file is loaded
        setAnalysisResult(null);
        setAnalysisError(null);
      };
      reader.readAsText(file);
    }
  };

  const handleAnalyze = async (forceRun = false) => {
    if (steps.length === 0) return;
    
    // If the panel is closed, just open it and return.
    if (!isAnalysisOpen) {
        setIsAnalysisOpen(true);
        return;
    }

    // If the panel is already open and we're not forcing a run, maybe toggle it closed?
    // But usually the user expects "Run Analysis" to be the trigger once open.
    if (!forceRun) {
        setIsAnalysisOpen(false);
        return;
    }

    setIsAnalyzing(true);
    setAnalysisError(null);

    try {
      // Use free model, no explicit key selection needed for this environment if using the proxy, 
      // but standard pattern requires a key. 
      // However, user explicitly requested NO openSelectKey and NO paid model.
      // We will use the standard environment variable if available or empty string which might work with proxy.
      
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
      // Using the requested model
      const model = "gemini-3-flash-preview"; 
      
      const logSummary = prepareLogForAnalysis(steps);
      
      let prompt = `
You are an expert software engineer analyzing a Cortex execution log.
Here is the simplified log data (chronological order):
\`\`\`json
${logSummary}
\`\`\`

Please analyze the trajectory and provide a structured JSON response with the following fields:
1. "summary": A brief overview of what happened.
2. "issues": An array of objects with "title", "description", and "severity" ("high", "medium", "low"). Identify core logic issues, circular dependencies, or repeated mistakes.
3. "trajectory": A concise analysis of how well the agent followed the plan.
4. "suggestions": An array of strings with actionable improvements.
5. "agent_patterns": An array of strings identifying "bad patterns" at the agent layer (e.g., redundant tool calls, getting stuck in loops, ignoring previous errors, inefficient file reading).
6. "remediation_task": A very detailed, contextual task description (Markdown formatted) that a coding agent could use to fix the identified issues or complete the work. This should include specific file paths, expected changes, and context from the log.
`;

      if (focusPrompt.trim()) {
          prompt += `
\nIMPORTANT: The user has requested you to specifically focus your analysis on the following:
"${focusPrompt.trim()}"
Please ensure your findings and suggestions address this specific focus area.
`;
      }

      prompt += `\nReturn ONLY the JSON object.`;

      const response = await ai.models.generateContent({
        model: model,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: { type: Type.STRING },
              issues: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    description: { type: Type.STRING },
                    severity: { type: Type.STRING }
                  },
                  required: ["title", "description", "severity"]
                }
              },
              trajectory: { type: Type.STRING },
              suggestions: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              },
              agent_patterns: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              },
              remediation_task: { type: Type.STRING }
            },
            required: ["summary", "issues", "trajectory", "suggestions"]
          }
        }
      });

      let text = response.text || "{}";
      // Clean up potential markdown wrapping if it somehow slipped through
      text = text.trim().replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();
      
      try {
        const parsed = JSON.parse(text) as AnalysisData;
        setAnalysisResult(parsed);
      } catch (parseErr) {
        console.error("JSON Parse Error. Raw text:", text);
        throw new Error("The AI returned an invalid JSON response. Please try again.");
      }
    } catch (err: any) {
      console.error("Analysis failed:", err);
      setAnalysisError(err.message || "Failed to analyze logs.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="flex h-screen w-screen bg-gray-950 text-gray-100 font-sans overflow-hidden">
      {/* Sidebar */}
      <div className="w-80 border-r border-gray-800 flex flex-col shrink-0 bg-gray-900">
        <div className="p-4 border-b border-gray-800">
          <h2 className="font-bold text-xl mb-1 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">Cortex Log Viewer</h2>
          {appId && (
            <div className="text-[10px] font-mono text-gray-500 mb-4 truncate" title={appId}>
              ID: {appId}
            </div>
          )}
          
          <div className="flex flex-col gap-2 mb-4">
             <div className="flex gap-2">
                <label className="flex-1 flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 text-xs px-3 py-2 rounded cursor-pointer transition-colors border border-gray-700">
                  <Upload size={14} />
                  <span>Load File</span>
                  <input type="file" className="hidden" onChange={handleFileUpload} />
                </label>
                <button 
                  onClick={() => setIsPasteModalOpen(true)}
                  className="flex-1 flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 text-xs px-3 py-2 rounded cursor-pointer transition-colors border border-gray-700 text-gray-300"
                >
                  <Clipboard size={14} />
                  <span>Paste Text</span>
                </button>
             </div>
             <button 
                onClick={() => handleAnalyze(false)}
                disabled={steps.length === 0}
                className={`flex items-center justify-center gap-2 text-xs px-3 py-2 rounded transition-colors font-medium ${steps.length === 0 ? 'bg-gray-800 text-gray-600 cursor-not-allowed' : isAnalysisOpen ? 'bg-indigo-900/50 text-indigo-300 border border-indigo-500/50' : 'bg-indigo-600 hover:bg-indigo-500 text-white'}`}
             >
               <Sparkles size={14} />
               {isAnalysisOpen ? 'Analysis Open' : 'AI Analysis'}
             </button>
          </div>

          <div className="relative">
            <Search className="absolute left-2 top-2.5 text-gray-500" size={14} />
            <input 
              type="text" 
              placeholder="Filter steps..." 
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full bg-gray-950 border border-gray-800 rounded pl-8 pr-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filteredSteps.length === 0 ? (
            <div className="p-8 text-center text-gray-600 text-sm">
              {steps.length === 0 ? "Load a log file to begin" : "No steps match your filter"}
            </div>
          ) : (
            filteredSteps.map((step) => {
              const isSelected = step.index === selectedStepIndex;
              const hasError = step.data?.status === 'CORTEX_STEP_STATUS_ERROR';
              const isCollapsed = step.interactionId !== undefined && collapsedInteractions.has(step.interactionId);
              
              return (
                <React.Fragment key={step.index}>
                  {step.isInteractionStart && (
                    <button 
                      onClick={() => toggleInteraction(step.interactionId)}
                      className="w-full px-4 py-2 bg-gray-800/80 border-y border-gray-700/50 flex justify-between items-center sticky top-0 z-10 backdrop-blur-sm hover:bg-gray-700 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        {isCollapsed ? <ChevronRight size={12} className="text-gray-500" /> : <ChevronDown size={12} className="text-gray-500" />}
                        <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Interaction</span>
                      </div>
                      <span className="text-[10px] font-mono text-gray-400 bg-gray-950 px-1.5 py-0.5 rounded border border-gray-800 flex items-center gap-1">
                        <Timer size={10} />
                        {step.interactionDuration}
                      </span>
                    </button>
                  )}
                  
                  {!isCollapsed && (
                    <button
                      onClick={() => setSelectedStepIndex(step.index)}
                      className={`w-full text-left p-3 border-b border-gray-800/50 hover:bg-gray-800 transition-all group relative ${isSelected ? 'bg-gray-800 border-l-4 border-l-indigo-500' : 'border-l-4 border-l-transparent'}`}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${isSelected ? 'bg-indigo-900/50 text-indigo-200' : 'bg-gray-800 text-gray-500'}`}>
                            #{step.index}
                          </span>
                          {step.data && <StatusIcon status={step.data.status} className="w-3 h-3" />}
                          {step.durationFromPrevious && (
                            <span className="text-[10px] font-mono text-gray-500 bg-gray-900/50 px-1 rounded">
                                {step.durationFromPrevious}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {step.executionDuration && (
                            <span className="text-[10px] font-mono text-indigo-400/70 flex items-center gap-0.5">
                              <Zap size={10} />
                              {step.executionDuration}
                            </span>
                          )}
                          {step.data?.type && <StepIcon type={step.data.type} className={`w-4 h-4 ${isSelected ? 'text-indigo-400' : 'text-gray-600 group-hover:text-gray-400'}`} />}
                        </div>
                      </div>
                      
                      <div className={`text-sm font-medium truncate ${hasError ? 'text-red-400' : 'text-gray-300'}`} title={step.data?.file_change?.absolute_path_uri || ''}>
                        {(() => {
                            if (step.data?.task_boundary?.task_name) return step.data.task_boundary.task_name;
                            
                            if (step.data?.file_change?.absolute_path_uri) {
                                const type = step.data.file_change.file_change_type
                                    ? step.data.file_change.file_change_type.replace('FILE_CHANGE_TYPE_', '')
                                    : 'CHANGE';
                                const path = step.data.file_change.absolute_path_uri.replace('file://', '');
                                return `${type} ${path}`;
                            }

                            if (step.data?.planner_response?.tool_calls?.length) {
                                 const tool = step.data.planner_response.tool_calls[0];
                                 let path = '';
                                 try {
                                     const args = JSON.parse(tool.arguments_json);
                                     path = args.TargetFile || args.AbsolutePath || args.path || args.filename || args.DirectoryPath || args.SourcePath || '';
                                 } catch (e) {}
                                 
                                 if (path) {
                                     return `${tool.name} ${path}`;
                                 }
                                 return `${tool.name}`;
                            }

                            if (step.data?.type) {
                                return step.data.type.replace('CORTEX_STEP_TYPE_', '').toLowerCase().replace(/_/g, ' ');
                            }
                            
                            return 'Unknown Step';
                        })()}
                      </div>
                      
                      {step.data?.planner_response?.tool_calls && (
                        <div className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                          <Code size={10} />
                          {step.data.planner_response.tool_calls.length} tool call(s)
                        </div>
                      )}
                    </button>
                  )}
              </React.Fragment>
            );
          })
        )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col bg-gray-950 overflow-hidden relative">
        {activeStep?.data ? (
          <StepDetail 
            step={activeStep.data} 
            index={activeStep.index} 
            durationFromPrevious={activeStep.durationFromPrevious} 
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-600 p-8 text-[20px]">
            <Info size={48} className="mb-4 opacity-20" />
            <p className="text-lg">Select a step to view details</p>
            {steps.length === 0 && (
              <p className="text-[25px] text-[#2461db] mt-2 max-w-md text-center">
                You can paste the log file content or use the "Load Log File" button in the sidebar to visualize the execution steps.
              </p>
            )}
            {steps.length === 0 && (
               <textarea 
                 className="mt-6 w-full max-w-2xl h-64 bg-gray-900 border border-gray-800 rounded p-4 text-xs font-mono text-gray-400 focus:border-indigo-500 outline-none"
                 placeholder="Paste log content here directly..."
                 onChange={(e) => setRawData(e.target.value)}
                 value={rawData}
               />
            )}
          </div>
        )}
      </div>

      {/* Analysis Panel - Side Layout */}
      <AnalysisPanel 
        isOpen={isAnalysisOpen}
        onClose={() => setIsAnalysisOpen(false)}
        isAnalyzing={isAnalyzing}
        analysisResult={analysisResult}
        error={analysisError}
        focusPrompt={focusPrompt}
        onFocusChange={setFocusPrompt}
        onAnalyze={() => handleAnalyze(true)}
      />

      {/* Paste Modal */}
      {isPasteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[80vh]">
            <div className="p-4 border-b border-gray-800 flex justify-between items-center">
              <div className="flex items-center gap-2 text-indigo-400">
                <Clipboard size={18} />
                <h2 className="font-bold text-sm text-white uppercase tracking-wider">Paste Log Content</h2>
              </div>
              <button 
                onClick={() => setIsPasteModalOpen(false)}
                className="p-1.5 hover:bg-gray-800 rounded-md text-gray-400 hover:text-white transition-colors"
              >
                <CloseIcon size={16} />
              </button>
            </div>
            <div className="p-4 flex-1 overflow-hidden flex flex-col">
              <p className="text-xs text-gray-500 mb-3">
                Paste the raw log content (Proto text, JSON array, or legacy format) below to visualize it.
              </p>
              <textarea 
                autoFocus
                className="flex-1 w-full bg-gray-950 border border-gray-800 rounded-lg p-4 text-xs font-mono text-gray-300 focus:border-indigo-500 outline-none resize-none"
                placeholder="Paste here..."
                value={pasteBuffer}
                onChange={(e) => setPasteBuffer(e.target.value)}
              />
            </div>
            <div className="p-4 border-t border-gray-800 flex justify-end gap-3">
              <button 
                onClick={() => setIsPasteModalOpen(false)}
                className="px-4 py-2 text-xs font-medium text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handlePasteApply}
                disabled={!pasteBuffer.trim()}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-800 disabled:text-gray-600 text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-2"
              >
                <Check size={14} />
                Apply Log
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Helper for the empty state
import { Code } from 'lucide-react';

export default App;