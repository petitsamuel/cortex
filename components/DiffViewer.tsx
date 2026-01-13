import React from 'react';
import { DiffLine } from '../types';

interface DiffViewerProps {
  lines: DiffLine[];
}

export const DiffViewer: React.FC<DiffViewerProps> = ({ lines }) => {
  return (
    <div className="font-mono text-xs md:text-sm bg-gray-950 rounded-md overflow-x-auto border border-gray-800">
      {lines.map((line, idx) => {
        let bgClass = '';
        let textClass = 'text-gray-300';
        let prefix = ' ';

        if (line.type === 'UNIFIED_DIFF_LINE_TYPE_INSERT') {
          bgClass = 'bg-green-900/30';
          textClass = 'text-green-200';
          prefix = '+';
        } else if (line.type === 'UNIFIED_DIFF_LINE_TYPE_DELETE') {
          bgClass = 'bg-red-900/30';
          textClass = 'text-red-200';
          prefix = '-';
        } else if (line.type === 'UNIFIED_DIFF_LINE_TYPE_HUNK_HEADER') {
          bgClass = 'bg-blue-900/30';
          textClass = 'text-blue-200';
          prefix = '@';
        }

        return (
          <div key={idx} className={`flex ${bgClass} px-2 py-0.5 min-w-full`}>
            <span className="w-6 shrink-0 select-none opacity-50 text-right mr-3">{idx + 1}</span>
            <span className={`select-none w-4 shrink-0 font-bold opacity-70 ${textClass}`}>{prefix}</span>
            <pre className={`whitespace-pre-wrap break-all ${textClass} m-0 font-mono`}>{line.text || ' '}</pre>
          </div>
        );
      })}
    </div>
  );
};