import React from 'react';
import { 
  User, 
  Brain, 
  FileCode, 
  Flag, 
  Terminal, 
  Save, 
  Activity, 
  AlertTriangle, 
  CheckCircle2, 
  FolderSearch,
  Package,
  Key,
  Info,
  Globe,
  AlertOctagon
} from 'lucide-react';
import { StepType } from '../types';

export const StepIcon: React.FC<{ type: StepType; className?: string }> = ({ type, className }) => {
  const props = { className };
  switch (type) {
    case 'CORTEX_STEP_TYPE_USER_INPUT': return <User {...props} />;
    case 'CORTEX_STEP_TYPE_PLANNER_RESPONSE': return <Brain {...props} />;
    case 'CORTEX_STEP_TYPE_FILE_CHANGE': return <FileCode {...props} />;
    case 'CORTEX_STEP_TYPE_TASK_BOUNDARY': return <Flag {...props} />;
    case 'CORTEX_STEP_TYPE_COMPILE_APPLET': return <Terminal {...props} />;
    case 'CORTEX_STEP_TYPE_INSTALL_APPLET_DEPENDENCIES': return <Package {...props} />;
    case 'CORTEX_STEP_TYPE_CHECKPOINT': return <Save {...props} />;
    case 'CORTEX_STEP_TYPE_LIST_DIRECTORY': return <FolderSearch {...props} />;
    case 'CORTEX_STEP_TYPE_DEFINE_NEW_ENV_VARIABLE': return <Key {...props} />;
    case 'CORTEX_STEP_TYPE_SYSTEM_MESSAGE': return <Info {...props} />;
    case 'CORTEX_STEP_TYPE_READ_URL_CONTENT': return <Globe {...props} />;
    case 'CORTEX_STEP_TYPE_ERROR_MESSAGE': return <AlertOctagon {...props} />;
    default: return <Activity {...props} />;
  }
};

export const StatusIcon: React.FC<{ status: string; className?: string }> = ({ status, className }) => {
  if (status === 'CORTEX_STEP_STATUS_ERROR') return <AlertTriangle className={`text-red-500 ${className}`} />;
  if (status === 'CORTEX_STEP_STATUS_DONE') return <CheckCircle2 className={`text-green-500 ${className}`} />;
  return <Activity className={`text-blue-500 ${className}`} />;
};