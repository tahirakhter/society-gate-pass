export interface ToolExecutionResult {
  success: boolean;
  status: string;
  message: string;
  data?: unknown;
  errorCode?: string;
  requiresConfirmation?: boolean;
  confirmationToken?: string;
}
