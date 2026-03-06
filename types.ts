export type StepStatus = 'CORTEX_STEP_STATUS_DONE' | 'CORTEX_STEP_STATUS_ERROR' | 'CORTEX_STEP_STATUS_GENERATING' | 'CORTEX_STEP_STATUS_PENDING' | 'CORTEX_STEP_STATUS_RUNNING';

export type StepType = 
  | 'CORTEX_STEP_TYPE_USER_INPUT'
  | 'CORTEX_STEP_TYPE_PLANNER_RESPONSE'
  | 'CORTEX_STEP_TYPE_TASK_BOUNDARY'
  | 'CORTEX_STEP_TYPE_FILE_CHANGE'
  | 'CORTEX_STEP_TYPE_LIST_DIRECTORY'
  | 'CORTEX_STEP_TYPE_CHECKPOINT'
  | 'CORTEX_STEP_TYPE_COMPILE_APPLET'
  | 'CORTEX_STEP_TYPE_INSTALL_APPLET_DEPENDENCIES'
  | 'CORTEX_STEP_TYPE_DEFINE_NEW_ENV_VARIABLE'
  | 'CORTEX_STEP_TYPE_SYSTEM_MESSAGE'
  | 'CORTEX_STEP_TYPE_READ_URL_CONTENT'
  | 'CORTEX_STEP_TYPE_ERROR_MESSAGE';

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
  stop_reason?: string;
}

export interface TaskBoundary {
  task_name: string;
  task_status: string;
  task_summary?: string;
  mode?: string;
}

export interface DefineNewEnvVariable {
  variable_name: string;
}

export interface SystemMessage {
  message: string;
}

export interface ReadUrlContent {
  url: string;
  web_document?: {
    document_id: string;
    url: string;
    title?: string;
    timestamp?: string;
    chunks?: Array<{
      position?: number;
      markdown_chunk?: {
        text: string;
      };
    }>;
  };
}

export interface ErrorDetails {
  short_error: string;
  full_error: string;
  user_error_message?: string;
}

export interface ErrorMessage {
  error: ErrorDetails;
  is_benign?: boolean;
  structured_error_parts?: Array<{ text: string }>;
  model_error_message?: string;
  should_show_model?: boolean;
  should_show_user?: boolean;
}

export interface LogStep {
  type: StepType;
  status: StepStatus;
  metadata: {
    created_at: string;
    completed_at?: string;
    viewable_at?: string;
    timestamp?: string;
    internal_metadata?: {
      status_transitions?: Array<{
        updated_status: StepStatus;
        timestamp: string | { seconds: number; nanos: number };
      }>;
    };
    step_generation_version?: number;
    [key: string]: any;
  };
  user_input?: {
    user_response: string;
  };
  planner_response?: PlannerResponse;
  file_change?: FileChange;
  task_boundary?: TaskBoundary;
  define_new_env_variable?: DefineNewEnvVariable;
  system_message?: SystemMessage;
  read_url_content?: ReadUrlContent;
  error?: ErrorDetails;
  error_message?: ErrorMessage;
  [key: string]: any; 
}

export interface ParsedStep {
  index: number;
  raw: string;
  data: LogStep | null;
  error?: string;
  durationFromPrevious?: string;
  executionDuration?: string;
  interactionDuration?: string;
  interactionId?: number;
  isInteractionStart?: boolean;
}

export interface AnalysisIssue {
  title: string;
  description: string;
  severity: 'high' | 'medium' | 'low';
}

export interface AnalysisData {
  summary: string;
  issues: AnalysisIssue[];
  trajectory: string;
  suggestions: string[];
  agent_patterns?: string[];
  remediation_task?: string;
}