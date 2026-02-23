import Storage from 'expo-sqlite/kv-store';

// const API_BASE_URL = 'http://192.168.1.77:8000/api/v1';
const API_BASE_URL = 'http://10.226.147.19:8000/api/v1';
// const API_BASE_URL = 'http://localhost:8000/api/v1';

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  authenticated?: boolean;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, authenticated = false } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  if (authenticated) {
    const apiKey = Storage.getItemSync('api_key');
    const teamId = Storage.getItemSync('team_id');
    if (apiKey) {headers['X-API-KEY'] = apiKey};
    if (teamId) headers['X-TEAM-ID'] = teamId;
  }
  

  const res = await fetch(`${API_BASE_URL}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  
  // console.log(res);
  const json = await res.json();
  console.log('Réponse API: ', json);
  

  if (!res.ok || json.success === false) {
    throw new ApiError(res.status, json.message ?? 'Erreur réseau');
  }

  return json;
}

export const api = {
  get: <T>(endpoint: string) => request<T>(endpoint, { authenticated: true }),
  post: <T>(endpoint: string, body: unknown, authenticated = true) =>
    request<T>(endpoint, { method: 'POST', body, authenticated }),
  put: <T>(endpoint: string, body: unknown) =>
    request<T>(endpoint, { method: 'PUT', body, authenticated: true }),
  delete: <T>(endpoint: string) =>
    request<T>(endpoint, { method: 'DELETE', authenticated: true }),
};
