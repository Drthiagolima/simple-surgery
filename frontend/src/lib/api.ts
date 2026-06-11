export type DashboardOverview = {
  total_surgeries: number;
  surgeries_in_progress: number;
  surgeries_completed: number;
  avg_rpa_minutes: number;
  avg_room_minutes: number;
};

export type RoomSnapshot = {
  room_id: string;
  room_name: string;
  status: string;
  active_surgery_id: string | null;
  occupancy_minutes_today: number;
  idle_minutes_today: number;
};

export type DashboardRoomsResponse = {
  rooms: RoomSnapshot[];
};

export type Surgery = {
  id: string;
  patient_id: string;
  room_id: string;
  surgeon_name: string;
  procedure_name: string;
  scheduled_start: string | null;
  status: string;
  rpa_entry_at: string | null;
  rpa_exit_at: string | null;
  room_entry_at: string | null;
  room_exit_at: string | null;
  cc_exit_at: string | null;
  rpa_duration_minutes: number | null;
  room_duration_minutes: number | null;
  total_operational_minutes: number | null;
  created_at: string;
  updated_at: string;
};

export type DashboardPayload = {
  overview: DashboardOverview | null;
  rooms: RoomSnapshot[];
  surgeries: Surgery[];
  apiAvailable: boolean;
};

export type AuthUser = {
  id: string;
  email: string;
  full_name: string;
  role: string;
};

export type Patient = {
  id: string;
  full_name: string;
  birth_date: string | null;
  medical_record_number: string | null;
  created_at: string;
};

export type OperatingRoom = {
  id: string;
  name: string;
  status: string;
  created_at: string;
};

export type SurgeryTimelineItem = {
  event_type: string;
  occurred_at: string;
  payload: Record<string, unknown> | null;
};

export type SurgeryTimelineResponse = {
  surgery: Surgery;
  timeline: SurgeryTimelineItem[];
};

export type IdleTimeItem = {
  room_id: string;
  room_name: string;
  idle_minutes: number;
};

export type IdleTimeResponse = {
  total_idle_minutes: number;
  rooms: IdleTimeItem[];
};

export type LoginPayload = {
  email: string;
  password: string;
};

export type LoginResponse = {
  access_token: string;
  token_type: string;
  user: AuthUser;
};

export type SurgeryCreatePayload = {
  patient_id: string;
  room_id: string;
  surgeon_name: string;
  procedure_name: string;
  scheduled_start?: string | null;
};

export type EventCreatePayload = {
  surgery_id: string;
  event_type: string;
  occurred_at?: string | null;
  payload?: Record<string, unknown>;
};

export type AgentCallPayload = {
  paciente?: Record<string, unknown>;
  transcricao?: string;
  anamnese?: Record<string, unknown> | string;
  instrucoes?: string;
};

export type AgentCallResponse = {
  ok: boolean;
  agent: string;
  text?: string;
  data?: {
    validado?: boolean;
    feedback?: string;
    resumo_resposta?: string;
    pendencias?: string[];
    proxima_pergunta_sugerida?: string;
    _erro?: string;
  };
  outputs?: string[];
};

function resolveApiBaseUrl(): string {
  const configured = (process.env.NEXT_PUBLIC_API_BASE_URL || "").trim();
  if (configured) {
    return configured;
  }

  // On browser, prefer localhost only for local development access.
  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return "http://localhost:8010/api/v1";
    }

    return "https://api.simplesurgery.com.br/api/v1";
  }

  // During SSR/build, avoid baking localhost into production bundles.
  if (process.env.NODE_ENV === "development") {
    return "http://localhost:8010/api/v1";
  }

  return "https://api.simplesurgery.com.br/api/v1";
}

export const API_BASE_URL = resolveApiBaseUrl();

function resolveAgentsApiBaseUrl(): string {
  const configured = (process.env.NEXT_PUBLIC_AGENTS_API_BASE_URL || "").trim();
  if (configured) {
    return configured;
  }

  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return "http://localhost:8787";
    }
  }

  return "https://api.ortopguia.com.br";
}

export const AGENTS_API_BASE_URL = resolveAgentsApiBaseUrl();

async function safeFetchJson<T>(path: string, token?: string): Promise<T | null> {
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      next: { revalidate: 0 },
      headers: {
        Accept: "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export async function getDashboardPayload(token?: string): Promise<DashboardPayload> {
  const [overview, roomsResponse, surgeries] = await Promise.all([
    safeFetchJson<DashboardOverview>("/dashboard/overview", token),
    safeFetchJson<DashboardRoomsResponse>("/dashboard/rooms", token),
    safeFetchJson<Surgery[]>("/surgeries", token),
  ]);

  return {
    overview,
    rooms: roomsResponse?.rooms ?? [],
    surgeries: surgeries ?? [],
    apiAvailable: Boolean(overview || roomsResponse || surgeries),
  };
}

export async function loginRequest(payload: LoginPayload): Promise<LoginResponse> {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error("Falha no login. Verifique email e senha.");
  }

  return (await response.json()) as LoginResponse;
}

export async function getCurrentUser(token: string): Promise<AuthUser | null> {
  return safeFetchJson<AuthUser>("/auth/me", token);
}

export async function getPatients(token: string): Promise<Patient[]> {
  return (await safeFetchJson<Patient[]>("/patients", token)) ?? [];
}

export async function getOperatingRooms(token: string): Promise<OperatingRoom[]> {
  return (await safeFetchJson<OperatingRoom[]>("/operating-rooms", token)) ?? [];
}

async function postAuthorized<TResponse>(path: string, token: string, body: unknown): Promise<TResponse> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Falha na operação protegida.");
  }

  return (await response.json()) as TResponse;
}

export async function createSurgery(token: string, payload: SurgeryCreatePayload): Promise<Surgery> {
  return postAuthorized<Surgery>("/surgeries", token, payload);
}

export async function createOperationalEvent(token: string, payload: EventCreatePayload): Promise<void> {
  await postAuthorized("/events", token, payload);
}

export async function getSurgeryTimeline(token: string, surgeryId: string): Promise<SurgeryTimelineResponse | null> {
  return safeFetchJson<SurgeryTimelineResponse>(`/surgeries/${surgeryId}/timeline`, token);
}

export async function getIdleTimeAnalytics(token: string, filters?: { roomId?: string; periodDays?: number }): Promise<IdleTimeResponse | null> {
  const params = new URLSearchParams();
  if (filters?.roomId) params.set("room_id", filters.roomId);
  if (filters?.periodDays) params.set("period_days", String(filters.periodDays));
  const query = params.toString();
  const path = query ? `/analytics/idle-time?${query}` : "/analytics/idle-time";
  return safeFetchJson<IdleTimeResponse>(path, token);
}

async function callDocumentAgent(agentId: string, payload: AgentCallPayload): Promise<AgentCallResponse> {
  const response = await fetch(`${AGENTS_API_BASE_URL}/api/agents/${agentId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Falha ao executar assistente de documentos.");
  }

  return (await response.json()) as AgentCallResponse;
}

export async function validateNursingAudioResponse(payload: AgentCallPayload): Promise<AgentCallResponse> {
  return callDocumentAgent("enfermagem_validacao", payload);
}

export async function generateSurgicalDescription(payload: AgentCallPayload): Promise<AgentCallResponse> {
  return callDocumentAgent("descricao_cirurgica", payload);
}