const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1']);

const resolveRuntimeBaseUrl = (configuredUrl?: string, fallbackPort = '8000') => {
  const raw = (configuredUrl || '').trim();
  if (!raw) {
    if (typeof window === 'undefined') return `http://localhost:${fallbackPort}`;
    const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
    const host = window.location.hostname || 'localhost';
    return `${protocol}//${host}:${fallbackPort}`;
  }

  try {
    const url = new URL(raw);
    if (
      typeof window !== 'undefined'
      && LOOPBACK_HOSTS.has(url.hostname)
      && LOOPBACK_HOSTS.has(window.location.hostname)
      && url.hostname !== window.location.hostname
    ) {
      url.hostname = window.location.hostname;
    }
    return url.toString().replace(/\/$/, '');
  } catch {
    return raw.replace(/\/$/, '');
  }
};

const CONFIGURED_API_BASE_URL = resolveRuntimeBaseUrl(import.meta.env.VITE_API_URL, '8000');

const resolveRealtimeBaseUrl = (configuredUrl?: string, apiBaseUrl?: string) => {
  const raw = (configuredUrl || apiBaseUrl || '').trim();
  if (!raw) {
    return resolveRuntimeBaseUrl(undefined, '8000').replace(/^http/i, 'ws');
  }
  if (raw.startsWith('ws://') || raw.startsWith('wss://')) {
    return raw.replace(/\/$/, '');
  }
  return resolveRuntimeBaseUrl(raw, '8000').replace(/^http/i, 'ws');
};

let activeApiBaseUrl = CONFIGURED_API_BASE_URL;
let activeRealtimeBaseUrl = resolveRealtimeBaseUrl(
  (import.meta.env.VITE_WS_URL as string | undefined) || undefined,
  activeApiBaseUrl,
);

const buildApiBaseCandidates = () => {
  const values: string[] = [];
  const push = (value?: string) => {
    const normalized = (value || '').trim().replace(/\/$/, '');
    if (!normalized || values.includes(normalized)) return;
    values.push(normalized);
  };

  push(activeApiBaseUrl);
  push(CONFIGURED_API_BASE_URL);

  if (typeof window !== 'undefined') {
    const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
    const host = window.location.hostname || 'localhost';
    push(`${protocol}//${host}:8000`);
    if (LOOPBACK_HOSTS.has(host)) {
      push('http://localhost:8000');
      push('http://127.0.0.1:8000');
    }
  }

  return values;
};

const rememberWorkingApiBase = (baseUrl: string) => {
  activeApiBaseUrl = baseUrl.replace(/\/$/, '');
  if (!(import.meta.env.VITE_WS_URL as string | undefined)) {
    activeRealtimeBaseUrl = resolveRealtimeBaseUrl(undefined, activeApiBaseUrl);
  }
};

export const getApiBaseUrl = () => activeApiBaseUrl;
export const getRealtimeBaseUrl = () => activeRealtimeBaseUrl;
export const clearAuthTokens = () => {};

export interface SearchResponse {
  answer?: string;
  results: Array<{
    title?: string;
    url: string;
    snippet?: string;
    score?: number;
    domain?: string;
    favicon_url?: string | null;
  }>;
}

export interface SimulationConfig {
  idea: string;
  category: string;
  targetAudience: string[];
  country: string;
  city: string;
  placeName?: string;
  riskAppetite: number;
  ideaMaturity: 'concept' | 'prototype' | 'mvp' | 'launched';
  goals: string[];
  agentCount?: number;
  language?: 'ar' | 'en';
}

export interface SimulationResponse {
  simulation_id: string;
  status: 'initializing' | 'running' | 'paused' | 'completed' | 'error';
  status_reason?: 'running' | 'interrupted' | 'paused_manual' | 'error' | 'completed';
  current_phase_key?: string | null;
}

export interface SimulationResultResponse {
  simulation_id: string;
  status: 'running' | 'paused' | 'completed' | 'error';
  summary?: string | null;
  metrics?: {
    accepted: number;
    rejected: number;
    neutral: number;
    acceptance_rate: number;
    polarization?: number;
    total_agents?: number;
    iteration?: number;
    total_iterations?: number;
    per_category?: Record<string, number>;
  } | null;
}

export interface SimulationStateResponse {
  simulation_id: string;
  status: 'running' | 'paused' | 'completed' | 'error';
  status_reason?: 'running' | 'interrupted' | 'paused_manual' | 'error' | 'completed';
  pending_input?: boolean;
  pending_input_kind?: string | null;
  idea_context_type?: 'location_based' | 'general_non_location' | 'hybrid' | null;
  schema?: Record<string, unknown>;
  persona_source?: {
    mode?: string | null;
    resolved?: boolean;
    auto_selected?: boolean;
    notice?: string | null;
    selected_set_key?: string | null;
    selected_set_label?: string | null;
    options?: Array<{
      mode?: string;
      label?: string;
      recommended?: boolean;
    }>;
  } | null;
  pipeline?: {
    ready_for_simulation?: boolean;
    blockers?: string[];
    actively_blocked?: boolean;
    blocker_details?: Array<{
      code?: string;
      phase_key?: string | null;
      title?: string;
      message?: string;
      action?: string | null;
    }>;
    blocked_phase?: string | null;
    warnings?: string[];
    fatal_errors?: string[];
    steps?: Array<{
      key?: string;
      label?: {
        ar?: string;
        en?: string;
      } | null;
      status?: 'pending' | 'running' | 'completed' | 'blocked';
      detail?: string | null;
      started_at?: number | null;
      completed_at?: number | null;
    }>;
  } | null;
  policy_mode?: 'normal' | 'safety_guard_hard';
  policy_reason?: string | null;
  search_quality?: {
    usable_sources: number;
    domains: number;
    extraction_success_rate: number;
  } | null;
  current_phase_key?: string | null;
  phase_progress_pct?: number | null;
  event_seq?: number;
  summary_ready?: boolean;
  reasoning_started?: boolean;
  report_summary?: string | null;
  can_resume?: boolean;
  resume_reason?: string | null;
  metrics?: {
    accepted: number;
    rejected: number;
    neutral: number;
    acceptance_rate: number;
    polarization?: number;
    total_agents: number;
    iteration: number;
    total_iterations?: number;
    per_category?: Record<string, number>;
  } | null;
  agents?: Array<{
    agent_id: string;
    category_id: string;
    opinion: 'accept' | 'reject' | 'neutral';
    confidence?: number;
  }>;
  reasoning_feed?: Array<Record<string, unknown>>;
  chat_events?: Array<Record<string, unknown>>;
  summary?: string | null;
  final_report?: Record<string, unknown> | null;
}

type RequestOptions = {
  method?: 'GET' | 'POST';
  body?: unknown;
};

const requestJson = async <T>(path: string, options: RequestOptions = {}): Promise<T> => {
  let lastError: unknown = null;

  for (const baseUrl of buildApiBaseCandidates()) {
    try {
      const response = await fetch(`${baseUrl}${path}`, {
        method: options.method || 'GET',
        headers: options.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        const error = new Error(detail || `Request failed with status ${response.status}`) as Error & { status?: number };
        error.status = response.status;
        throw error;
      }

      rememberWorkingApiBase(baseUrl);
      return await response.json() as T;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Unable to reach backend');
};

export const apiService = {
  async startSimulation(config: SimulationConfig): Promise<SimulationResponse> {
    return requestJson<SimulationResponse>('/simulation/start', {
      method: 'POST',
      body: {
        idea: config.idea,
        category: config.category,
        targetAudience: config.targetAudience,
        country: config.country,
        city: config.city,
        place_name: config.placeName || '',
        riskAppetite: config.riskAppetite,
        ideaMaturity: config.ideaMaturity,
        goals: config.goals,
        agentCount: config.agentCount,
        language: config.language || 'en',
      },
    });
  },

  async getSimulationState(simulationId: string): Promise<SimulationStateResponse> {
    const encoded = encodeURIComponent(simulationId.trim());
    return requestJson<SimulationStateResponse>(`/simulation/state?simulation_id=${encoded}`);
  },

  async getSimulationResult(simulationId: string): Promise<SimulationResultResponse> {
    const encoded = encodeURIComponent(simulationId.trim());
    return requestJson<SimulationResultResponse>(`/simulation/result?simulation_id=${encoded}`);
  },

  async pauseSimulation(simulationId: string, reason?: string): Promise<SimulationResponse> {
    return requestJson<SimulationResponse>('/simulation/pause', {
      method: 'POST',
      body: {
        simulation_id: simulationId,
        reason,
      },
    });
  },

  async resumeSimulation(simulationId: string): Promise<SimulationResponse> {
    return requestJson<SimulationResponse>('/simulation/resume', {
      method: 'POST',
      body: {
        simulation_id: simulationId,
      },
    });
  },
};
