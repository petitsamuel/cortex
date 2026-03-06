import React from 'react';
import { X, Sparkles, AlertTriangle, CheckCircle, Loader2, AlertCircle, Info, Lightbulb, Play, Bug, ClipboardList } from 'lucide-react';
import { AnalysisData } from '../types';
import ReactMarkdown from 'react-markdown';

interface AnalysisPanelProps {
  isOpen: boolean;
  onClose: () => void;
  isAnalyzing: boolean;
  analysisResult: AnalysisData | null;
  error: string | null;
  focusPrompt: string;
  onFocusChange: (value: string) => void;
  onAnalyze: () => void;
}

export const AnalysisPanel: React.FC<AnalysisPanelProps> = ({ 
  isOpen, 
  onClose, 
  isAnalyzing, 
  analysisResult,
  error,
  focusPrompt,
  onFocusChange,
  onAnalyze
}) => {
  if (!isOpen) return null;

  return (
    <div className="w-96 bg-gray-900 border-l border-gray-800 flex flex-col shrink-0 transition-all duration-300 ease-in-out h-full">
      <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-900 sticky top-0 z-10">
        <div className="flex items-center gap-2 text-indigo-400">
          <Sparkles size={18} />
          <h2 className="font-bold text-sm text-white uppercase tracking-wider">AI Analysis</h2>
        </div>
        <button 
          onClick={onClose}
          className="p-1.5 hover:bg-gray-800 rounded-md text-gray-400 hover:text-white transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Focus Input Section */}
        <div className="bg-gray-800/30 p-3 rounded-lg border border-gray-800">
           <label className="block text-xs font-medium text-gray-400 mb-2">
             Analysis Focus (Optional)
           </label>
           <textarea 
             value={focusPrompt}
             onChange={(e) => onFocusChange(e.target.value)}
             placeholder="e.g., 'Check for infinite loops' or 'Why did the file edit fail?'"
             className="w-full bg-gray-950 border border-gray-700 rounded p-2 text-xs text-gray-200 focus:border-indigo-500 focus:outline-none resize-none h-20 mb-2"
           />
           <button 
             onClick={onAnalyze}
             disabled={isAnalyzing}
             className={`w-full flex items-center justify-center gap-2 py-1.5 rounded text-xs font-medium transition-colors ${isAnalyzing ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-500 text-white'}`}
           >
             {isAnalyzing ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
             {analysisResult ? 'Re-Analyze' : 'Run Analysis'}
           </button>
        </div>

        {isAnalyzing ? (
          <div className="flex flex-col items-center justify-center h-40 text-gray-400 space-y-4">
            <Loader2 size={32} className="animate-spin text-indigo-500" />
            <div className="text-center">
              <p className="text-sm font-medium text-gray-300">Analyzing Trajectory</p>
              <p className="text-xs text-gray-600 mt-1">Identifying patterns & errors...</p>
            </div>
          </div>
        ) : error ? (
          <div className="bg-red-950/20 border border-red-900/30 rounded-lg p-4 text-center">
            <AlertTriangle size={32} className="mx-auto text-red-400 mb-2" />
            <p className="text-sm font-medium text-red-300">Analysis Failed</p>
            <p className="text-xs text-red-400/70 mt-1">{error}</p>
          </div>
        ) : analysisResult ? (
          <>
            {/* Summary */}
            <div className="bg-indigo-950/20 border border-indigo-900/30 rounded-lg p-4">
              <h3 className="text-xs font-bold text-indigo-300 uppercase tracking-wider mb-2 flex items-center gap-2">
                <Info size={12} /> Summary
              </h3>
              <p className="text-sm text-gray-300 leading-relaxed">
                {analysisResult.summary}
              </p>
            </div>

            {/* Bad Patterns */}
            {analysisResult.agent_patterns && analysisResult.agent_patterns.length > 0 && (
              <div>
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Bug size={12} className="text-red-400" /> Agent Layer Patterns
                </h3>
                <ul className="space-y-2">
                  {analysisResult.agent_patterns.map((pattern, i) => (
                    <li key={i} className="flex gap-2 text-xs text-gray-400 bg-red-950/10 p-2 rounded border border-red-900/20">
                      <span className="text-red-500 font-bold">•</span>
                      <span>{pattern}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Issues */}
            {analysisResult.issues?.length > 0 && (
              <div>
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <AlertCircle size={12} /> Detected Issues
                </h3>
                <div className="space-y-3">
                  {analysisResult.issues.map((issue, i) => (
                    <div key={i} className={`rounded-lg p-3 border ${
                      issue.severity === 'high' ? 'bg-red-950/10 border-red-900/30' :
                      issue.severity === 'medium' ? 'bg-orange-950/10 border-orange-900/30' :
                      'bg-yellow-950/10 border-yellow-900/30'
                    }`}>
                      <div className="flex items-start gap-2 mb-1">
                        {issue.severity === 'high' ? <AlertTriangle size={14} className="text-red-400 mt-0.5 shrink-0" /> :
                         issue.severity === 'medium' ? <AlertCircle size={14} className="text-orange-400 mt-0.5 shrink-0" /> :
                         <Info size={14} className="text-yellow-400 mt-0.5 shrink-0" />}
                        <h4 className={`text-sm font-medium ${
                          issue.severity === 'high' ? 'text-red-300' :
                          issue.severity === 'medium' ? 'text-orange-300' :
                          'text-yellow-300'
                        }`}>{issue.title}</h4>
                      </div>
                      <p className="text-xs text-gray-400 ml-6 leading-relaxed">
                        {issue.description}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Trajectory */}
            <div>
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                <CheckCircle size={12} /> Trajectory
              </h3>
              <p className="text-sm text-gray-400 bg-gray-950/50 p-3 rounded border border-gray-800/50 leading-relaxed">
                {analysisResult.trajectory}
              </p>
            </div>

            {/* Remediation Task */}
            {analysisResult.remediation_task && (
              <div className="bg-gray-950 border border-indigo-900/30 rounded-lg overflow-hidden">
                <h3 className="text-xs font-bold text-indigo-300 uppercase tracking-wider p-3 bg-indigo-950/20 border-b border-indigo-900/30 flex items-center gap-2">
                  <ClipboardList size={12} /> Remediation Task
                </h3>
                <div className="p-4 prose prose-invert prose-xs max-w-none prose-p:leading-relaxed prose-pre:bg-gray-900 prose-pre:border prose-pre:border-gray-800">
                  <ReactMarkdown>{analysisResult.remediation_task}</ReactMarkdown>
                </div>
              </div>
            )}

            {/* Suggestions */}
            {analysisResult.suggestions?.length > 0 && (
              <div>
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Lightbulb size={12} /> Suggestions
                </h3>
                <ul className="space-y-2">
                  {analysisResult.suggestions.map((suggestion, i) => (
                    <li key={i} className="flex gap-2 text-sm text-gray-300 bg-gray-800/30 p-2 rounded border border-gray-800/50">
                      <span className="text-indigo-500 font-bold">•</span>
                      <span>{suggestion}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-64 text-gray-600 space-y-4">
            <Sparkles size={40} className="opacity-20" />
            <p className="text-sm">Ready to analyze</p>
            <p className="text-xs text-gray-500 max-w-[200px] text-center">Enter a focus area above or just click "Run Analysis"</p>
          </div>
        )}
      </div>
    </div>
  );
};
