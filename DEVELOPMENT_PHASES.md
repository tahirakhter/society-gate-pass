# Society Gate Pass Development Phases

## Phase 1: Gate Pass App Foundation

Phase 1 established the core Society Gate Pass application for residents, admins, and security users.

Completed work:

- Set up the NestJS backend and Next.js frontend.
- Added JWT-based authentication with access and refresh tokens.
- Added role-based access control for:
  - `ADMIN`
  - `OWNER`
  - `SECURITY`
- Added user management for admins.
- Added house creation and owner assignment.
- Added owner house lookup for logged-in owners.
- Added protected frontend routes and session handling.
- Built the initial mobile-first visitor pass UI shell.
- Added profile and account session screens.

## Phase 2: Visitor Pass Creation and AI Assistance

Phase 2 added real visitor pass workflows and AI-assisted pass creation.

Completed work:

- Added visitor token creation through `POST /visit-tokens`.
- Added owner visitor pass listing through `GET /visit-tokens/my`.
- Added pass status handling:
  - active
  - used
  - revoked
  - expired
- Added pass deactivation for owners.
- Added QR payload generation for visitor passes.
- Added QR display and QR download in the frontend.
- Added manual visitor pass creation from the frontend.
- Added AI-assisted visitor pass creation through `POST /ai/visitor-pass/assistant`.
- Updated AI pass creation to use the logged-in owner instead of a hardcoded owner id.
- Added multi-step AI assistant support for missing visitor fields.
- Added admin visibility over all visitor passes.
- Added admin pass deactivation.
- Added admin pass validation support.
- Added admin user and home management pages.
- Added paginated pass tables for owner/admin pass lists.

## Current Notes

- The app now supports the main owner workflow for creating, viewing, downloading, and deactivating visitor passes.
- Admins can create users, create homes against owners, view users, view homes, view all passes, deactivate passes, and validate pass tokens.
- Security validation exists through the visit token validation endpoint, with admin validation also allowed by the role guard.

## Phase 3: AI Visitor Search Agent

Phase 3 added a separate AI-powered visitor search endpoint for owners.

Completed work:

- Added `POST /ai/visitor-search`.
- Added `VisitorSearchAgentDto`.
- Added `VisitorSearchFilters` extraction type.
- Added Gemini structured JSON extraction for natural language visitor search.
- Added dynamic server-date prompt support for date phrases such as:
  - today
  - yesterday
  - last week
  - this month
- Added DD-MM-YYYY numeric date handling:
  - `10-06-2026` is treated as 10 June 2026
  - `fromDate` becomes `2026-06-10`
  - `toDate` becomes `2026-06-10`
- Added owner-scoped house matching with normalized house numbers.
- Added visitor token search by:
  - visitor name
  - CNIC
  - house number
  - created date range
- Added support for latest/current pass queries:
  - latest / newest / most recent
  - not expired / active / valid / current
- Added `HOUSE_NOT_FOUND` response when an owner asks for a house that is not assigned to them.
- Limited visitor search results to 50 records ordered by newest first.
- Added AI card search mode in the frontend.
- Added paginated AI search results in the frontend.
- Added expired / not expired labels on searched pass results.
- Added pass status labels on searched pass results.

Phase 3 is now connected to the existing AI Assistant card through a separate search mode.

## Phase 4: Unified AI Agent Router and Role-Specific Workflows

Phase 4 unified the AI experience behind one agent endpoint and tightened role-based behavior across owner, admin, and security screens.

Completed work:

- Added unified AI endpoint:
  - `POST /ai/agent`
- Kept legacy AI endpoints for testing and debugging:
  - `POST /ai/visitor-pass/assistant`
  - `POST /ai/visitor-search`
  - `POST /ai/agent`
- Added agent intent classification for:
  - `CREATE_PASS`
  - `SEARCH_VISITORS`
  - `ENTRY_LOGS`
  - `DEACTIVATE_PASS`
  - `UNKNOWN`
- Added confidence handling:
  - low-confidence intent results return `UNKNOWN_INTENT`
  - low-confidence requests do not execute actions
- Added response metadata for frontend display:
  - `action`
  - `agentIntent`
  - `confidence`
- Routed agent actions to existing implementation methods:
  - pass creation uses the smart visitor pass assistant
  - visitor search uses the visitor search agent
  - entry log search uses the entry log agent
  - pass deactivation uses the existing visit token deactivation flow
- Added conversational continuation for pass creation:
  - if required fields are missing, the assistant keeps the conversation id
  - follow-up messages continue the same pass creation flow
- Added lightweight AI context for follow-up actions:
  - follow-ups like "deactivate it" can reference the last searched pass
  - vague record prompts can fall back to visitor/pass search when appropriate
- Added role-specific AI permissions:
  - `OWNER` can create passes, search their own generated passes, and deactivate active passes
  - `ADMIN` can search all visitor/pass data and review entry logs
  - `ADMIN` cannot create visitor passes through AI
  - `SECURITY` cannot access the AI assistant
- Added `ACTION_NOT_ALLOWED` responses for valid intents that are not allowed for the current role.
- Added stricter pass deactivation rules:
  - active, unused, unexpired passes can be deactivated
  - used passes return "already processed"
  - expired passes return "already expired"
  - revoked passes return "already revoked"
- Ensured revoked, used, and expired passes cannot be viewed as QR gate passes in the frontend.
- Ensured revoked, used, and expired passes cannot validate successfully at the gate.
- Updated frontend AI assistant:
  - one AI input instead of separate create/search modes
  - owner assistant focuses on creating, searching own passes, and deactivation
  - admin assistant focuses on visitor/pass search and entry logs
  - security users do not see the assistant
- Added role-specific navigation and dashboards:
  - owners see AI, recent passes, manual entry, and their assigned houses
  - admins see admin controls plus AI search/log assistant
  - security users see recent passes and profile only
- Added `GET /visit-tokens/recent` for security users to view recent passes read-only.
- Updated pass status presentation:
  - active
  - used
  - revoked
  - expired
  - revoked is displayed with a yellow status label

Phase 4 now provides a single AI agent entry point while preserving older endpoints for debugging and keeping role permissions explicit.

## Phase 5: Expanded AI Agent Capabilities

Phase 5 extended the unified AI assistant with deeper conversational analysis, security analytics, and pass detail workflows.

Completed work:

- Added new agent intents for:
  - `SECURITY_ANALYTICS`
  - `CHECK_PASS_STATUS`
  - `SHOW_PASS_DETAILS`
- Added security analytics support for suspicious activity, repeated visitors, failed scan summaries, and high-traffic house reports.
- Added pass status queries for natural language checks such as active, expired, valid, and usable passes.
- Added conversational pass detail retrieval for vague references like first/second/last pass and "what about that visitor".
- Added frontend handling for security analytics summaries, pass status responses, and detailed pass display.
- Added agent fallback heuristics for ambiguous analytics and pass detail requests.

## Phase 6: Native OpenAI Tool Calling

Phase 6 introduces a gradual migration from intent classification and `switch`-based routing to native OpenAI Responses API tool calling. The existing AI router remains available while application capabilities are converted into isolated, validated tools.

Completed foundation:

- Added a shared injectable OpenAI client used by the existing AI service and the native tool-calling agent.
- Added centralized settings for:
  - enabling native tool calling
  - selecting the OpenAI tool-calling model
  - limiting tool rounds and calls
  - application timezone fallback
  - tool and weather request timeouts
- Added a role-aware tool registry with:
  - exact tool-name resolution
  - duplicate-name protection
  - backend-controlled role filtering
  - strict OpenAI tool definitions
- Added a dedicated tool executor that:
  - safely parses model arguments
  - validates arguments with Zod
  - enforces authorization independently of tool visibility
  - applies execution timeouts
  - normalizes expected and unexpected failures
  - prevents arbitrary dynamic method execution
- Added a bounded OpenAI Responses API loop:
  - automatic tool selection
  - sequential tool execution
  - `parallel_tool_calls: false`
  - maximum round and tool-call limits
  - stateless response handling with `store: false`
  - preservation of reasoning and function-call items between rounds
  - tool results returned through matching `function_call_output` items
- Added compact tool activity and conversation-context persistence using the existing `AiConversation` model.
- Preserved the existing AI router behind the native tool-calling feature flag.
- Limited native routing to registered capabilities so unfinished tools cannot break existing visitor-pass workflows.

Completed tool:

- Added `get_weather` as the first native tool.
- Added strict weather arguments, location parsing, Open-Meteo integration, request timeouts, normalized forecasts, and frontend weather responses.
- Added weather follow-up context so a short location reply can continue a previous weather question.

Conversation reliability improvements:

- Persisted the latest visitor-pass user message and assistant response.
- Preserved active conversation IDs after pass creation and ambiguous responses.
- Added deterministic recovery for missing CNIC, vehicle number, house number, and visitor-name replies.
- Prevented native weather routing from intercepting in-progress visitor-pass conversations.

Remaining Phase 6 work:

- Extract reusable visitor search, pass query, entry-log, and security analytics logic from the large AI service into domain-facing services.
- Add native tools for:
  - `search_visitors`
  - `check_pass_status`
  - `show_pass_details`
  - `create_visitor_pass`
  - `get_entry_logs`
  - `get_security_analytics`
  - `revoke_pass`
- Add backend-controlled, short-lived, single-use confirmation for pass revocation.
- Add mutation idempotency for pass creation and revocation.
- Replace the temporary mixed router only after all tool integrations and comparison tests are stable.
