export const TOOL_NAMES = {
  CREATE_VISITOR_PASS: 'create_visitor_pass',
  SEARCH_VISITORS: 'search_visitors',
  CHECK_PASS_STATUS: 'check_pass_status',
  SHOW_PASS_DETAILS: 'show_pass_details',
  REVOKE_PASS: 'revoke_pass',
  GET_ENTRY_LOGS: 'get_entry_logs',
  GET_SECURITY_ANALYTICS: 'get_security_analytics',
  GET_WEATHER: 'get_weather',
} as const;

export type ToolName = (typeof TOOL_NAMES)[keyof typeof TOOL_NAMES];
