import React, { useState, useMemo } from 'react';
import { parseLogData } from './utils';
import { ParsedStep } from './types';
import { StepDetail } from './components/StepDetail';
import { StatusIcon, StepIcon } from './components/StepIcon';
import { Search, Upload, Info } from 'lucide-react';

const App: React.FC = () => {
  const [rawData, setRawData] = useState<string>('');
  const [selectedStepIndex, setSelectedStepIndex] = useState<number>(0);
  const [filter, setFilter] = useState('');

  const steps = useMemo(() => parseLogData(rawData), [rawData]);

  const filteredSteps = useMemo(() => {
    if (!filter) return steps;
    const lower = filter.toLowerCase();
    return steps.filter(s => 
      (s.data?.type || '').toLowerCase().includes(lower) || 
      s.index.toString().includes(lower) ||
      (s.data?.task_boundary?.task_name || '').toLowerCase().includes(lower) ||
      (s.data?.file_change?.absolute_path_uri || '').toLowerCase().includes(lower)
    );
  }, [steps, filter]);

  const activeStep = steps.find(s => s.index === selectedStepIndex);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target?.result as string;
        setRawData(text);
        setSelectedStepIndex(0);
      };
      reader.readAsText(file);
    }
  };

  const loadSample = () => {
    // This is a minimal subset of the log provided in the prompt to demonstrate functionality
    const sample = `
Step 0
--------------------------------------------------------------------------------
{
  "type": "CORTEX_STEP_TYPE_USER_INPUT",
  "status": "CORTEX_STEP_STATUS_DONE",
  "metadata": { "created_at": "2025-12-23T22:32:38.116Z" },
  "user_input": { "user_response": "can you make a blackjack game" }
}
================================================================================
Step 1
--------------------------------------------------------------------------------
{
  "type": "CORTEX_STEP_TYPE_PLANNER_RESPONSE",
  "status": "CORTEX_STEP_STATUS_DONE",
  "metadata": { "created_at": "2025-12-23T22:32:38.118Z" },
  "planner_response": {
    "thinking": "**Beginning Development**\\nI'm starting to build out the foundation for a blackjack game...",
    "response": "Of course. I will build a blackjack game for you...",
    "tool_calls": [
      {
        "id": "caff4fe6",
        "name": "edit_file",
        "arguments_json": "{\\"TargetFile\\":\\"/metadata.json\\",\\"Instruction\\":\\"Update name\\"}"
      }
    ]
  }
}
================================================================================
Step 12
--------------------------------------------------------------------------------
{
  "type": "CORTEX_STEP_TYPE_FILE_CHANGE",
  "status": "CORTEX_STEP_STATUS_DONE",
  "metadata": { "created_at": "2025-12-23T22:33:00.711Z" },
  "file_change": {
    "absolute_path_uri": "file:///src/App.tsx",
    "file_change_type": "FILE_CHANGE_TYPE_CREATE",
    "diff": {
      "unified_diff": {
        "lines": [
          { "text": "import React from 'react';", "type": "UNIFIED_DIFF_LINE_TYPE_INSERT" },
          { "text": "function App() {", "type": "UNIFIED_DIFF_LINE_TYPE_INSERT" },
          { "text": "  return <div>Blackjack</div>", "type": "UNIFIED_DIFF_LINE_TYPE_INSERT" }
        ]
      }
    }
  }
}
`;
    setRawData(sample);
    setSelectedStepIndex(0);
  };

  return (
    <div className="flex h-screen w-screen bg-gray-950 text-gray-100 font-sans">
      {/* Sidebar */}
      <div className="w-80 border-r border-gray-800 flex flex-col shrink-0 bg-gray-900">
        <div className="p-4 border-b border-gray-800">
          <h2 className="font-bold text-xl mb-4 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">Cortex Log Viewer</h2>
          
          <div className="flex gap-2 mb-4">
             <label className="flex-1 flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 text-xs px-3 py-2 rounded cursor-pointer transition-colors border border-gray-700">
               <Upload size={14} />
               <span>Load Log File</span>
               <input type="file" className="hidden" onChange={handleFileUpload} />
             </label>
             <button onClick={loadSample} className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-3 py-2 rounded transition-colors">
               Sample
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
              
              return (
                <button
                  key={step.index}
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
                    {step.data?.type && <StepIcon type={step.data.type} className={`w-4 h-4 ${isSelected ? 'text-indigo-400' : 'text-gray-600 group-hover:text-gray-400'}`} />}
                  </div>
                  
                  <div className={`text-sm font-medium truncate ${hasError ? 'text-red-400' : 'text-gray-300'}`}>
                    {step.data?.task_boundary?.task_name || 
                     step.data?.file_change?.absolute_path_uri?.split('/').pop() || 
                     (step.data?.type ? step.data.type.replace('CORTEX_STEP_TYPE_', '').toLowerCase().replace(/_/g, ' ') : 'Unknown Step')}
                  </div>
                  
                  {step.data?.planner_response?.tool_calls && (
                    <div className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                      <Code size={10} />
                      {step.data.planner_response.tool_calls.length} tool call(s)
                    </div>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col bg-gray-950 overflow-hidden">
        {activeStep?.data ? (
          <StepDetail 
            step={activeStep.data} 
            index={activeStep.index} 
            durationFromPrevious={activeStep.durationFromPrevious} 
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-600 p-8">
            <Info size={48} className="mb-4 opacity-20" />
            <p className="text-lg">Select a step to view details</p>
            {steps.length === 0 && (
              <p className="text-sm mt-2 max-w-md text-center text-gray-500">
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
    </div>
  );
};

// Helper for the empty state
import { Code } from 'lucide-react';

export default App;