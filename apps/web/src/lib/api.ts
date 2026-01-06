const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  meta?: Record<string, unknown>;
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const url = `${API_BASE}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'An error occurred');
  }

  return data;
}

// Slates API
export const slatesApi = {
  getAll: (params?: { status?: string; limit?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set('status', params.status);
    if (params?.limit) searchParams.set('limit', String(params.limit));
    const query = searchParams.toString();
    return request<any[]>(`/slates${query ? `?${query}` : ''}`);
  },

  getById: (id: string) => request<any>(`/slates/${id}`),

  create: (data: { externalId: string; name: string; startTime?: string }) =>
    request<any>('/slates', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    request<void>(`/slates/${id}`, { method: 'DELETE' }),

  sync: (id: string) =>
    request<{ message: string }>(`/slates/${id}/sync`, { method: 'POST' }),
};

// Players API
export const playersApi = {
  getBySlate: (
    slateId: string,
    params?: {
      minProjection?: number;
      maxSalary?: number;
      minSalary?: number;
      positions?: string[];
      teams?: string[];
      search?: string;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    }
  ) => {
    const searchParams = new URLSearchParams();
    if (params?.minProjection)
      searchParams.set('minProjection', String(params.minProjection));
    if (params?.maxSalary)
      searchParams.set('maxSalary', String(params.maxSalary));
    if (params?.minSalary)
      searchParams.set('minSalary', String(params.minSalary));
    if (params?.positions)
      searchParams.set('positions', params.positions.join(','));
    if (params?.teams) searchParams.set('teams', params.teams.join(','));
    if (params?.search) searchParams.set('search', params.search);
    if (params?.sortBy) searchParams.set('sortBy', params.sortBy);
    if (params?.sortOrder) searchParams.set('sortOrder', params.sortOrder);
    const query = searchParams.toString();
    return request<any[]>(`/players/${slateId}${query ? `?${query}` : ''}`);
  },

  getDetail: (playerId: string) => request<any>(`/players/detail/${playerId}`),

  update: (playerId: string, data: { projectedPoints?: number; ownership?: number }) =>
    request<any>(`/players/${playerId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
};

// Optimizer API
export const optimizerApi = {
  optimize: (params: {
    slateId: string;
    mode?: 'CASH' | 'GPP';
    numLineups?: number;
    lockedPlayers?: string[];
    excludedPlayers?: string[];
    maxExposure?: number;
    minExposure?: number;
    enableStacking?: boolean;
    minStack?: number;
    maxStack?: number;
    diversityFactor?: number;
  }) =>
    request<{ lineups: any[]; exposureStats: any[]; meta: any }>('/optimizer/optimize', {
      method: 'POST',
      body: JSON.stringify(params),
    }),

  getLineups: (slateId: string) =>
    request<any[]>(`/optimizer/lineups/${slateId}`),

  saveLineup: (data: {
    slateId: string;
    name: string;
    mode?: string;
    players: Array<{ playerId: string; slot: string }>;
  }) =>
    request<any>('/optimizer/lineups', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  deleteLineup: (lineupId: string) =>
    request<void>(`/optimizer/lineups/${lineupId}`, { method: 'DELETE' }),
};

// Historical API
export const historicalApi = {
  getPlayerHistory: (
    playerName: string,
    params?: { season?: string; limit?: number; opponent?: string }
  ) => {
    const searchParams = new URLSearchParams();
    if (params?.season) searchParams.set('season', params.season);
    if (params?.limit) searchParams.set('limit', String(params.limit));
    if (params?.opponent) searchParams.set('opponent', params.opponent);
    const query = searchParams.toString();
    return request<any>(
      `/historical/player/${encodeURIComponent(playerName)}${query ? `?${query}` : ''}`
    );
  },

  getTeamDefense: (team?: string) =>
    request<any[]>(team ? `/historical/defense/${team}` : '/historical/defense'),

  getUsageBumps: (slateId: string, minBump?: number) => {
    const searchParams = new URLSearchParams();
    if (minBump) searchParams.set('minBump', String(minBump));
    const query = searchParams.toString();
    return request<any[]>(
      `/historical/usage-bumps/${slateId}${query ? `?${query}` : ''}`
    );
  },

  getMatchup: (player: string, opponent: string) => {
    const searchParams = new URLSearchParams();
    searchParams.set('player', player);
    searchParams.set('opponent', opponent);
    return request<any>(`/historical/matchup?${searchParams.toString()}`);
  },
};

// Chat API
export const chatApi = {
  getSessions: (params?: { slateId?: string; limit?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.slateId) searchParams.set('slateId', params.slateId);
    if (params?.limit) searchParams.set('limit', String(params.limit));
    const query = searchParams.toString();
    return request<any[]>(`/chat/sessions${query ? `?${query}` : ''}`);
  },

  getSession: (sessionId: string) =>
    request<any>(`/chat/sessions/${sessionId}`),

  createSession: (data?: { name?: string; slateId?: string }) =>
    request<any>('/chat/sessions', {
      method: 'POST',
      body: JSON.stringify(data || {}),
    }),

  sendMessage: (sessionId: string, content: string) =>
    request<{ userMessage: any; assistantMessage: any }>('/chat/messages', {
      method: 'POST',
      body: JSON.stringify({ sessionId, content }),
    }),

  deleteSession: (sessionId: string) =>
    request<void>(`/chat/sessions/${sessionId}`, { method: 'DELETE' }),
};
