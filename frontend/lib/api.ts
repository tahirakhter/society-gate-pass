export type UserRole = "OWNER" | "SECURITY" | "ADMIN";

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface HouseRecord {
  id: string;
  houseNumber: string;
  block?: string | null;
  ownerId: string;
  createdAt: string;
  owner?: AuthUser;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

export interface VisitorRecord {
  id: string;
  cnic: string;
  fullName: string;
  createdAt: string;
}

export type VisitTokenStatus = "ACTIVE" | "USED" | "REVOKED" | "EXPIRED";

export interface VisitTokenRecord {
  id: string;
  tokenCode: string;
  visitorId: string;
  houseId: string;
  carNumber: string;
  expiresAt: string;
  isUsed: boolean;
  isActive: boolean;
  revokedAt: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  qrPayload: string;
  status: VisitTokenStatus;
  visitor: VisitorRecord;
  house: HouseRecord;
}

export type ScanStatus = "SUCCESS" | "FAILED";

export interface EntryLogRecord {
  id: string;
  tokenId: string | null;
  scanStatus: ScanStatus;
  failureReason: string | null;
  scannedBy: string;
  scannedAt: string;
  scanner: AuthUser;
  token: VisitTokenRecord | null;
}

export interface VisitTokenValidationResult {
  approved: boolean;
  status: ScanStatus;
  failureReason: string | null;
  token: VisitTokenRecord | null;
}

export interface VisitorPassCollectedData {
  visitorName?: string;
  cnic?: string;
  carNumber?: string;
  visitDateTime?: string;
  houseNumber?: string;
}

export type AiVisitorPassAssistantStatus = "MISSING_FIELDS" | "COMPLETED";

export interface AiVisitorPassAssistantResponse {
  status: AiVisitorPassAssistantStatus;
  conversationId: string;
  collectedData?: VisitorPassCollectedData;
  missingFields?: string[];
  data?: VisitorPassCollectedData;
  gatePass?: VisitTokenRecord;
  message: string;
}

export type VisitorSearchStatus = "COMPLETED" | "HOUSE_NOT_FOUND";

export interface VisitorSearchFilters {
  intent: "VISITOR_SEARCH";
  visitorName?: string | null;
  cnic?: string | null;
  houseNumber?: string | null;
  fromDate?: string | null;
  toDate?: string | null;
  latestOnly?: boolean | null;
  notExpiredOnly?: boolean | null;
}

export interface VisitorSearchResponse {
  status: VisitorSearchStatus;
  filters: VisitorSearchFilters;
  count?: number;
  data?: VisitTokenRecord[];
  message?: string;
  conversationId?: string;
}

export interface AiAgentMetadata<TAction extends AiAgentIntent> {
  action: TAction;
  agentIntent: TAction;
  confidence: number;
  toolsUsed?: Array<{
    name: string;
    status: string;
  }>;
}

export type AiAgentIntent =
  | "CREATE_PASS"
  | "SEARCH_VISITORS"
  | "ENTRY_LOGS"
  | "SECURITY_ANALYTICS"
  | "CHECK_PASS_STATUS"
  | "SHOW_PASS_DETAILS"
  | "DEACTIVATE_PASS"
  | "GET_WEATHER"
  | "UNKNOWN";

export interface EntryLogAgentResponse {
  status: "COMPLETED";
  filters: {
    date: string | null;
    scanStatus: ScanStatus | null;
  };
  count: number;
  data: EntryLogRecord[];
  conversationId?: string;
}

export interface SecurityAnalyticsAgentResponse {
  status: "COMPLETED" | "HOUSE_NOT_FOUND";
  analyticsType?: string;
  summary?: string;
  riskLevel?: "LOW" | "MEDIUM" | "HIGH";
  count?: number;
  data?: unknown;
  signals?: unknown[];
  message?: string;
  conversationId?: string;
}

export interface UnknownAiAgentResponse {
  status: "UNKNOWN_INTENT";
  message: string;
  conversationId?: string;
}

export interface ActionNotAllowedAiAgentResponse {
  status: "ACTION_NOT_ALLOWED";
  message: string;
  conversationId?: string;
}

export interface DeactivatePassAgentResponse {
  status: "COMPLETED" | "NOT_FOUND";
  message: string;
  gatePass?: VisitTokenRecord;
  conversationId?: string;
}

export interface CheckPassStatusAgentResponse {
  status: "COMPLETED" | "CONTEXT_NOT_FOUND" | "PASS_NOT_FOUND";
  expired?: boolean;
  message: string;
  pass?: VisitTokenRecord;
  conversationId?: string;
}

export interface ShowPassDetailsAgentResponse {
  status: "COMPLETED" | "CONTEXT_NOT_FOUND" | "PASS_NOT_FOUND";
  message: string;
  pass?: VisitTokenRecord;
  conversationId?: string;
}

export interface WeatherAgentResponse {
  status:
    | "COMPLETED"
    | "MISSING_LOCATION"
    | "LOCATION_NOT_FOUND"
    | "WEATHER_FETCH_FAILED"
    | "TOOL_TIMEOUT"
    | "INVALID_TOOL_ARGUMENTS"
    | "TOOL_EXECUTION_FAILED";
  message: string;
  weather?: {
    location: {
      name: string;
      country: string;
      latitude: number;
      longitude: number;
      timezone: string;
    };
    period: "today" | "tomorrow" | "day_after_tomorrow" | "week";
  };
  conversationId?: string;
}

export interface FailedAiAgentResponse {
  status: "FAILED" | "TOOL_LIMIT_REACHED";
  message: string;
  conversationId?: string;
}

export type AiAgentResponse =
  | (AiVisitorPassAssistantResponse & AiAgentMetadata<"CREATE_PASS">)
  | (VisitorSearchResponse & AiAgentMetadata<"SEARCH_VISITORS">)
  | (EntryLogAgentResponse & AiAgentMetadata<"ENTRY_LOGS">)
  | (SecurityAnalyticsAgentResponse & AiAgentMetadata<"SECURITY_ANALYTICS">)
  | (CheckPassStatusAgentResponse & AiAgentMetadata<"CHECK_PASS_STATUS">)
  | (ShowPassDetailsAgentResponse & AiAgentMetadata<"SHOW_PASS_DETAILS">)
  | (DeactivatePassAgentResponse & AiAgentMetadata<"DEACTIVATE_PASS">)
  | (WeatherAgentResponse & AiAgentMetadata<"GET_WEATHER">)
  | (UnknownAiAgentResponse & AiAgentMetadata<"UNKNOWN">)
  | (FailedAiAgentResponse & AiAgentMetadata<"UNKNOWN">)
  | (ActionNotAllowedAiAgentResponse & AiAgentMetadata<AiAgentIntent>);

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "http://localhost:3001";
const ACCESS_TOKEN_KEY = "sgp_access_token";
const REFRESH_TOKEN_KEY = "sgp_refresh_token";
const USER_KEY = "sgp_user";

function isBrowser() {
  return typeof window !== "undefined";
}

export const sessionStorageApi = {
  loadTokens(): AuthTokens | null {
    if (!isBrowser()) return null;

    const accessToken = window.localStorage.getItem(ACCESS_TOKEN_KEY);
    const refreshToken = window.localStorage.getItem(REFRESH_TOKEN_KEY);

    if (!accessToken || !refreshToken) {
      return null;
    }

    return { accessToken, refreshToken };
  },
  loadUser(): AuthUser | null {
    if (!isBrowser()) return null;

    const rawUser = window.localStorage.getItem(USER_KEY);
    if (!rawUser) {
      return null;
    }

    try {
      return JSON.parse(rawUser) as AuthUser;
    } catch {
      return null;
    }
  },
  saveSession(session: AuthResponse) {
    if (!isBrowser()) return;

    window.localStorage.setItem(ACCESS_TOKEN_KEY, session.accessToken);
    window.localStorage.setItem(REFRESH_TOKEN_KEY, session.refreshToken);
    window.localStorage.setItem(USER_KEY, JSON.stringify(session.user));
  },
  updateAccessToken(accessToken: string) {
    if (!isBrowser()) return;
    window.localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  },
  updateUser(user: AuthUser) {
    if (!isBrowser()) return;
    window.localStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  clear() {
    if (!isBrowser()) return;

    window.localStorage.removeItem(ACCESS_TOKEN_KEY);
    window.localStorage.removeItem(REFRESH_TOKEN_KEY);
    window.localStorage.removeItem(USER_KEY);
  },
};

async function refreshAccessToken(): Promise<string | null> {
  const tokens = sessionStorageApi.loadTokens();

  if (!tokens?.refreshToken) {
    return null;
  }

  const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ refreshToken: tokens.refreshToken }),
  });

  if (!response.ok) {
    sessionStorageApi.clear();
    return null;
  }

  const data = (await response.json()) as { accessToken: string };
  sessionStorageApi.updateAccessToken(data.accessToken);
  return data.accessToken;
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  retryOnAuthFailure = true,
): Promise<T> {
  const tokens = sessionStorageApi.loadTokens();
  const headers = new Headers(init.headers);

  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }

  if (tokens?.accessToken) {
    headers.set("Authorization", `Bearer ${tokens.accessToken}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
  });

  if (response.status === 401 && retryOnAuthFailure) {
    const refreshedToken = await refreshAccessToken();

    if (refreshedToken) {
      return request<T>(path, init, false);
    }
  }

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => null)) as
      | { message?: string | string[] }
      | null;
    const message = Array.isArray(errorBody?.message)
      ? errorBody.message.join(", ")
      : errorBody?.message || "Request failed";

    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export const authApi = {
  login(payload: { email: string; password: string }) {
    return request<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  refreshProfile() {
    return request<AuthUser>("/users/me");
  },
  logout() {
    return request<{ message: string }>("/auth/logout", {
      method: "POST",
    });
  },
  getUsers() {
    return request<AuthUser[]>("/users");
  },
  createUser(payload: {
    email: string;
    password: string;
    fullName: string;
    role: UserRole;
  }) {
    return request<AuthUser>("/users", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  activateUser(id: string) {
    return request<AuthUser>(`/users/${id}/activate`, {
      method: "PATCH",
    });
  },
  deactivateUser(id: string) {
    return request<AuthUser>(`/users/${id}/deactivate`, {
      method: "PATCH",
    });
  },
  deleteUser(id: string) {
    return request<{ message: string }>(`/users/${id}`, {
      method: "DELETE",
    });
  },
  getMyHouses() {
    return request<HouseRecord[]>("/houses/my");
  },
  getAllHouses() {
    return request<HouseRecord[]>("/houses");
  },
  createHouse(payload: {
    houseNumber: string;
    block?: string;
    ownerId: string;
  }) {
    return request<HouseRecord>("/houses", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  deleteHouse(id: string) {
    return request<{ message: string }>(`/houses/${id}`, {
      method: "DELETE",
    });
  },
  getMyVisitTokens() {
    return request<VisitTokenRecord[]>("/visit-tokens/my");
  },
  getAllVisitTokens() {
    return request<VisitTokenRecord[]>("/visit-tokens");
  },
  getRecentVisitTokens() {
    return request<VisitTokenRecord[]>("/visit-tokens/recent");
  },
  createVisitToken(payload: {
    cnic: string;
    fullName: string;
    carNumber: string;
    houseId: string;
    expiryHours?: number;
    expiresAt?: string;
  }) {
    return request<VisitTokenRecord>("/visit-tokens", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  validateVisitToken(payload: { tokenCode: string }) {
    return request<VisitTokenValidationResult>("/visit-tokens/validate", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  continueVisitorPassAssistant(payload: { message: string; conversationId?: string }) {
    return request<AiVisitorPassAssistantResponse>("/ai/visitor-pass/assistant", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  sendAiAgent(payload: { message: string; conversationId?: string }) {
    return request<AiAgentResponse>("/ai/agent", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  searchVisitors(payload: { message: string }) {
    return request<VisitorSearchResponse>("/ai/visitor-search", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  deactivateVisitToken(id: string) {
    return request<VisitTokenRecord>(`/visit-tokens/${id}/deactivate`, {
      method: "PATCH",
    });
  },
  adminDeactivateVisitToken(id: string) {
    return request<VisitTokenRecord>(`/visit-tokens/${id}/admin-deactivate`, {
      method: "PATCH",
    });
  },
  getEntryLogs(params: { houseId?: string; date?: string } = {}) {
    const searchParams = new URLSearchParams();

    if (params.houseId) {
      searchParams.set("houseId", params.houseId);
    }

    if (params.date) {
      searchParams.set("date", params.date);
    }

    const queryString = searchParams.toString();
    return request<EntryLogRecord[]>(`/entry-logs${queryString ? `?${queryString}` : ""}`);
  },
};
