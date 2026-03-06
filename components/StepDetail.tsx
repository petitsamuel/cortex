import React, { useState } from 'react';
import { LogStep } from '../types';
import { StatusIcon, StepIcon } from './StepIcon';
import { DiffViewer } from './DiffViewer';
import { ChevronDown, ChevronRight, Clock, Code, AlertOctagon, Brain, FileCode, Timer, Key, Info, Globe, ExternalLink } from 'lucide-react';
import Markdown from 'react-markdown';
import { formatDuration, formatTimeDiff } from '../utils';

interface StepDetailProps {
  step: LogStep;
  index: number;
  durationFromPrevious?: string;
}

const Collapsible: React.FC<{ title: string; children: React.ReactNode; defaultOpen?: boolean; icon?: React.ReactNode }> = ({ title, children, defaultOpen = true, icon }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="border border-gray-800 rounded-lg bg-gray-900/50 mb-4 overflow-hidden">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-3 bg-gray-800/50 hover:bg-gray-800 transition-colors"
      >
        <div className="flex items-center gap-2 font-semibold text-gray-200">
          {icon}
          {title}
        </div>
        {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      </button>
      {isOpen && <div className="p-4 border-t border-gray-800">{children}</div>}
    </div>
  );
};

export const StepDetail: React.FC<StepDetailProps> = ({ step, index, durationFromPrevious }) => {
  const { type, status, metadata, planner_response, file_change, task_boundary, user_input, define_new_env_variable, system_message, read_url_content, error, error_message } = step;

  const displayType = type ? type.replace('CORTEX_STEP_TYPE_', '').replace(/_/g, ' ') : 'Unknown Step';

  const activeError = error || error_message?.error;

  return (
    <div className="h-full overflow-y-auto p-4 md:p-8">
      {/* Header */}
      <div className="mb-8 border-b border-gray-800 pb-6">
        <div className="flex items-center gap-3 mb-2">
          <span className="bg-gray-800 text-gray-400 px-2 py-1 rounded text-xs font-mono">Step {index}</span>
          <StatusIcon status={status} />
          <span className="text-sm font-mono text-gray-500">{status}</span>
        </div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <StepIcon type={type} className="w-8 h-8" />
          {displayType}
        </h1>
        <div className="mt-2 text-gray-400 text-sm flex items-center gap-4 flex-wrap">
          {metadata?.created_at && (
            <div className="flex items-center gap-1">
              <Clock size={14} />
              <span className="text-gray-500 mr-1">Created:</span>
              {new Date(metadata.created_at).toLocaleString()}
            </div>
          )}
          {metadata?.viewable_at && (
            <div className="flex items-center gap-1">
              <Clock size={14} className="text-blue-400" />
              <span className="text-gray-500 mr-1">Viewable:</span>
              {new Date(metadata.viewable_at).toLocaleString()}
            </div>
          )}
          {metadata?.timestamp && (
            <div className="flex items-center gap-1">
              <Clock size={14} className="text-green-400" />
              <span className="text-gray-500 mr-1">Timestamp:</span>
              {new Date(metadata.timestamp).toLocaleString()}
            </div>
          )}
          {metadata?.completed_at && (
            <div className="flex items-center gap-1">
              <span>Duration:</span>
              <span className="text-gray-300 font-mono">{formatDuration(metadata.created_at, metadata.completed_at)}</span>
            </div>
          )}
          {durationFromPrevious && (
            <div className="flex items-center gap-1 text-indigo-300 bg-indigo-900/30 px-2 py-0.5 rounded-full border border-indigo-900/50">
                <Timer size={12} />
                <span className="font-mono text-xs">{durationFromPrevious}</span>
                <span className="text-indigo-400/50 text-[10px] ml-1">since last step</span>
            </div>
          )}
        </div>
      </div>

      {/* Status Transitions Timeline */}
      {metadata?.internal_metadata?.status_transitions && Array.isArray(metadata.internal_metadata.status_transitions) && (
        <Collapsible title="Status Transitions" icon={<Timer size={16} className="text-orange-400" />} defaultOpen={true}>
          <div className="relative pl-4 border-l-2 border-gray-800 space-y-4 py-2">
            {metadata.internal_metadata.status_transitions.map((t, i) => {
              const prev = i > 0 ? metadata.internal_metadata!.status_transitions![i-1] : null;
              let diffStr = '';
              if (prev && prev.timestamp && t.timestamp) {
                const diff = new Date(t.timestamp as string).getTime() - new Date(prev.timestamp as string).getTime();
                if (diff >= 0) {
                  diffStr = formatTimeDiff(diff);
                }
              }
              
              return (
                <div key={i} className="relative">
                  <div className="absolute -left-[21px] top-1.5 w-3 h-3 rounded-full bg-gray-800 border-2 border-gray-950" />
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <StatusIcon status={t.updated_status} className="w-3 h-3" />
                      <span className="text-sm font-mono text-gray-300">{t.updated_status}</span>
                      {diffStr && (
                        <span className="text-[10px] font-mono text-orange-400/70 bg-orange-950/20 px-1 rounded border border-orange-900/30">
                          {diffStr}
                        </span>
                      )}
                    </div>
                    <div className="text-xs font-mono text-gray-500">
                      {t.timestamp ? new Date(t.timestamp as string).toLocaleString() : 'N/A'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Collapsible>
      )}

      {/* Error Display */}
      {activeError && (
        <div className="bg-red-950/30 border border-red-900/50 rounded-lg p-4 mb-6 text-red-200">
          <div className="flex items-center gap-2 font-bold mb-2 text-red-400">
            <AlertOctagon size={20} />
            Execution Error
          </div>
          {activeError.user_error_message && (
            <div className="mb-3 p-2 bg-red-900/20 rounded border border-red-800/30">
              <div className="text-[10px] uppercase tracking-wider text-red-400 font-bold mb-1">User Error Message</div>
              <p className="text-sm font-medium">{activeError.user_error_message}</p>
            </div>
          )}
          <div className="mb-2">
            <div className="text-[10px] uppercase tracking-wider text-red-400/60 font-bold mb-1">Short Error</div>
            <p className="font-mono text-sm whitespace-pre-wrap">{activeError.short_error}</p>
          </div>
          {activeError.full_error && activeError.full_error !== activeError.short_error && (
             <details className="mt-2">
               <summary className="cursor-pointer text-xs opacity-70 hover:opacity-100">Full Stack Trace</summary>
               <pre className="mt-2 text-xs opacity-60 overflow-x-auto whitespace-pre-wrap font-mono">{activeError.full_error}</pre>
             </details>
          )}
        </div>
      )}

      {/* Error Message */}
      {error_message && (
        <div className={`border rounded-lg p-6 mb-6 ${error_message.is_benign ? 'bg-amber-950/10 border-amber-900/30' : 'bg-red-950/20 border-red-900/50'}`}>
          <div className={`flex items-center gap-2 font-bold mb-4 ${error_message.is_benign ? 'text-amber-400' : 'text-red-400'}`}>
            <AlertOctagon size={20} />
            System Error Message {error_message.is_benign && <span className="text-[10px] bg-amber-400/20 px-2 py-0.5 rounded ml-2 uppercase tracking-widest">Benign</span>}
          </div>
          
          {error_message.error.user_error_message && (
            <div className="mb-4 p-3 bg-black/30 rounded border border-white/5">
              <p className="text-sm font-medium text-gray-200">{error_message.error.user_error_message}</p>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-1">Short Error</div>
              <p className="font-mono text-sm text-gray-300 whitespace-pre-wrap">{error_message.error.short_error}</p>
            </div>

            {error_message.model_error_message && (
              <div>
                <div className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-1">Model Error Message</div>
                <p className="text-sm text-gray-400 italic">"{error_message.model_error_message}"</p>
              </div>
            )}

            {error_message.error.full_error && error_message.error.full_error !== error_message.error.short_error && (
              <details className="mt-2">
                <summary className="cursor-pointer text-xs text-gray-500 hover:text-gray-300 transition-colors">Full Stack Trace</summary>
                <pre className="mt-2 text-[10px] text-gray-600 overflow-x-auto whitespace-pre-wrap font-mono bg-black/20 p-3 rounded leading-relaxed">
                  {error_message.error.full_error}
                </pre>
              </details>
            )}
          </div>
        </div>
      )}

      {/* User Input */}
      {user_input && (
        <Collapsible title="User Request" icon={<span className="text-blue-400">👤</span>}>
          <p className="text-lg text-white whitespace-pre-wrap leading-relaxed">{user_input.user_response}</p>
        </Collapsible>
      )}

      {/* Planner Response */}
      {planner_response && (
        <>
          {planner_response.thinking && (
            <Collapsible title="Thinking Process" defaultOpen={false} icon={<Brain size={16} className="text-purple-400" />}>
              <div className="prose prose-invert max-w-none text-gray-300 whitespace-pre-wrap font-mono text-sm bg-gray-950 p-4 rounded-md">
                {planner_response.thinking}
              </div>
            </Collapsible>
          )}
          
          <Collapsible title="Response" icon={<span className="text-green-400">💬</span>}>
            <div className="prose prose-invert max-w-none text-gray-200 whitespace-pre-wrap">
              {planner_response.response}
            </div>
            {planner_response.stop_reason && (
              <div className="mt-4 pt-4 border-t border-gray-800 flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">Stop Reason:</span>
                <span className="text-xs font-mono text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded">{planner_response.stop_reason}</span>
              </div>
            )}
          </Collapsible>

          {planner_response.tool_calls && planner_response.tool_calls.length > 0 && (
            <Collapsible title="Tool Calls" icon={<Code size={16} className="text-yellow-400" />}>
              <div className="space-y-4">
                {planner_response.tool_calls.map((tool) => (
                  <div key={tool.id} className="bg-gray-950 rounded border border-gray-800 p-3">
                    <div className="flex justify-between items-center mb-2 border-b border-gray-800 pb-2">
                      <span className="font-bold text-yellow-500 font-mono text-sm">{tool.name}</span>
                      <span className="text-xs text-gray-600 font-mono">{tool.id}</span>
                    </div>
                    <pre className="text-xs text-green-300 overflow-x-auto whitespace-pre-wrap font-mono">
                      {tool.arguments_json.trim()}
                    </pre>
                  </div>
                ))}
              </div>
            </Collapsible>
          )}
        </>
      )}

      {/* Task Boundary */}
      {task_boundary && (
        <div className="bg-indigo-950/20 border border-indigo-900/50 rounded-lg p-6 mb-6">
          <h3 className="text-indigo-300 font-bold text-lg mb-1">{task_boundary.task_name}</h3>
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-0.5 rounded-full bg-indigo-900 text-indigo-200 text-xs font-mono">{task_boundary.mode}</span>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex gap-4">
              <span className="text-gray-500 w-20 shrink-0">Status:</span>
              <span className="text-gray-200">{task_boundary.task_status}</span>
            </div>
            {task_boundary.task_summary && (
              <div className="flex gap-4">
                <span className="text-gray-500 w-20 shrink-0">Summary:</span>
                <span className="text-gray-300 italic">{task_boundary.task_summary}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Define New Env Variable */}
      {define_new_env_variable && (
        <div className="bg-green-950/20 border border-green-900/50 rounded-lg p-6 mb-6">
          <div className="flex items-center gap-2 text-green-400 font-bold mb-4">
            <Key size={20} />
            Define New Environment Variable
          </div>
          <div className="flex items-center gap-3">
            <span className="text-gray-500 text-sm">Variable Name:</span>
            <code className="bg-gray-950 px-2 py-1 rounded border border-gray-800 text-green-300 font-mono text-sm">
              {define_new_env_variable.variable_name}
            </code>
          </div>
        </div>
      )}

      {/* System Message */}
      {system_message && (
        <div className="bg-blue-950/20 border border-blue-900/50 rounded-lg p-6 mb-6">
          <div className="flex items-center gap-2 text-blue-400 font-bold mb-4">
            <Info size={20} />
            System Message
          </div>
          <div className="text-gray-200 text-sm whitespace-pre-wrap italic">
            "{system_message.message}"
          </div>
        </div>
      )}

      {/* Read URL Content */}
      {read_url_content && (
        <div className="space-y-4 mb-6">
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-indigo-400 font-bold">
                <Globe size={20} />
                Web Content
              </div>
              <a 
                href={read_url_content.url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                <ExternalLink size={12} />
                Visit URL
              </a>
            </div>
            
            <div className="space-y-2">
              <div className="text-sm font-medium text-white">
                {read_url_content.web_document?.title || 'Untitled Document'}
              </div>
              <div className="text-xs text-gray-500 font-mono">
                {read_url_content.url}
              </div>
            </div>
          </div>

          {read_url_content.web_document?.chunks?.map((chunk, i) => (
            <Collapsible 
              key={i} 
              title={`Content Chunk ${chunk.position !== undefined ? chunk.position : i}`}
              icon={<Code size={16} className="text-gray-400" />}
              defaultOpen={i === 0}
            >
              <div className="markdown-body prose prose-invert max-w-none text-sm leading-relaxed">
                <Markdown>{chunk.markdown_chunk?.text || ''}</Markdown>
              </div>
            </Collapsible>
          ))}
        </div>
      )}

      {/* File Change */}
      {file_change && (
        <Collapsible 
          title={`File Change: ${file_change.absolute_path_uri ? file_change.absolute_path_uri.replace('file:///', '') : 'Unknown File'}`} 
          icon={<FileCode size={16} className="text-cyan-400" />}
        >
          <div className="mb-4 text-sm text-gray-400 font-mono">
            Type: <span className="text-gray-200">{file_change.file_change_type}</span>
          </div>
          
          {file_change.diff?.unified_diff?.lines ? (
            <DiffViewer lines={file_change.diff.unified_diff.lines} />
          ) : (
            <div className="bg-gray-950 p-4 rounded text-sm text-gray-500 font-mono italic">
              No diff available (Entire file might be created or content not shown)
            </div>
          )}

          {file_change.replacement_chunks && (
             <div className="mt-4 space-y-4">
                <h4 className="text-xs uppercase tracking-wider text-gray-500 font-bold">Content Chunks</h4>
                {file_change.replacement_chunks.map((chunk, i) => (
                  <div key={i} className="grid grid-cols-1 gap-2">
                    {chunk.target_content && (
                      <div className="bg-red-950/10 border border-red-900/20 rounded p-2">
                        <div className="text-xs text-red-400 mb-1">Target</div>
                        <pre className="text-xs text-red-200 overflow-x-auto">{chunk.target_content}</pre>
                      </div>
                    )}
                    <div className="bg-green-950/10 border border-green-900/20 rounded p-2">
                      <div className="text-xs text-green-400 mb-1">Replacement</div>
                      <pre className="text-xs text-green-200 overflow-x-auto">{chunk.replacement_content}</pre>
                    </div>
                  </div>
                ))}
             </div>
          )}
        </Collapsible>
      )}

      {/* Raw JSON Debug */}
      <Collapsible title="Raw Data" defaultOpen={false} icon={<Code size={16} />}>
        <pre className="text-xs font-mono text-gray-500 overflow-x-auto">
          {JSON.stringify(step, null, 2)}
        </pre>
      </Collapsible>
    </div>
  );
};