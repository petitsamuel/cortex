export type StepStatus = 'CORTEX_STEP_STATUS_DONE' | 'CORTEX_STEP_STATUS_ERROR' | 'CORTEX_STEP_STATUS_GENERATING' | 'CORTEX_STEP_STATUS_PENDING' | 'CORTEX_STEP_STATUS_RUNNING';

export type StepType = 
  | 'CORTEX_STEP_TYPE_USER_INPUT'
  | 'CORTEX_STEP_TYPE_PLANNER_RESPONSE'
  | 'CORTEX_STEP_TYPE_TASK_BOUNDARY'
  | 'CORTEX_STEP_TYPE_FILE_CHANGE'
  | 'CORTEX_STEP_TYPE_LIST_DIRECTORY'
  | 'CORTEX_STEP_TYPE_CHECKPOINT'
  | 'CORTEX_STEP_TYPE_COMPILE_APPLET'
  | 'CORTEX_STEP_TYPE_INSTALL_APPLET_DEPENDENCIES';

export interface DiffLine {
  text: string;
  type: 'UNIFIED_DIFF_LINE_TYPE_INSERT' | 'UNIFIED_DIFF_LINE_TYPE_DELETE' | 'UNIFIED_DIFF_LINE_TYPE_UNCHANGED' | 'UNIFIED_DIFF_LINE_TYPE_HUNK_HEADER';
}

export interface FileChange {
  absolute_path_uri: string;
  file_change_type: string;
  replacement_chunks?: Array<{ target_content: string; replacement_content: string }>;
  diff?: {
    unified_diff?: {
      lines: DiffLine[];
    };
  };
}

export interface ToolCall {
  id: string;
  name: string;
  arguments_json: string;
}

export interface PlannerResponse {
  response: string;
  thinking?: string;
  tool_calls?: ToolCall[];
}

export interface TaskBoundary {
  task_name: string;
  task_status: string;
  task_summary?: string;
}

export interface ErrorDetails {
  short_error: string;
  full_error: string;
}

export interface LogStep {
  type: StepType;
  status: StepStatus;
  metadata: {
    created_at: string;
    completed_at?: string;
    step_generation_version?: number;
    [key: string]: any;
  };
  user_input?: {
    user_response: string;
  };
  planner_response?: PlannerResponse;
  file_change?: FileChange;
  task_boundary?: TaskBoundary;
  error?: ErrorDetails;
  [key: string]: any; 
}

export interface ParsedStep {
  index: number;
  raw: string;
  data: LogStep | null;
  error?: string;
  durationFromPrevious?: string;
}