const TOKEN_KEY = 'ahead_jwt_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> ?? {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(path, { ...options, headers });

  if (!res.ok) {
    let message = `Request failed: ${res.status}`;
    try {
      const body = await res.json() as { error?: string };
      if (body.error) message = body.error;
    } catch { /* ignore */ }
    throw new Error(message);
  }

  return res.json() as Promise<T>;
}

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  role: 'employee' | 'admin';
}

export interface AuthResponse {
  token: string;
  user: UserProfile;
}

// Auth
export const api = {
  auth: {
    register: (email: string, password: string, fullName: string) =>
      request<AuthResponse>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password, fullName }),
      }),
    login: (email: string, password: string) =>
      request<AuthResponse>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),
    me: () => request<UserProfile>('/api/auth/me'),
  },

  progress: {
    get: () => request<{ taskIds: string[] }>('/api/progress'),
    complete: (taskId: string) =>
      request<{ ok: boolean }>(`/api/progress/${taskId}`, { method: 'POST' }),
    incomplete: (taskId: string) =>
      request<{ ok: boolean }>(`/api/progress/${taskId}`, { method: 'DELETE' }),
    reset: () => request<{ ok: boolean }>('/api/progress', { method: 'DELETE' }),
  },

  tasks: {
    list: () => request<{ tasks: Task[] }>('/api/tasks'),
    listAll: () => request<{ tasks: Task[] }>('/api/tasks/all'),
    upsert: (id: string, task: Omit<Task, 'id'>) =>
      request<{ ok: boolean; task: Task }>(`/api/tasks/${id}`, {
        method: 'PUT',
        body: JSON.stringify(task),
      }),
    delete: (id: string) =>
      request<{ ok: boolean }>(`/api/tasks/${id}`, { method: 'DELETE' }),
  },

  chat: {
    send: (
      messages: { role: 'user' | 'assistant'; content: string }[],
      confluenceContent?: string | null
    ) =>
      request<{ content: string }>('/api/chat', {
        method: 'POST',
        body: JSON.stringify({ messages, confluenceContent }),
      }),
  },

  admin: {
    users: () =>
      request<{ users: (UserProfile & { completed_count: number })[] }>('/api/admin/users'),
    setRole: (email: string, role: 'employee' | 'admin') =>
      request<{ ok: boolean }>(`/api/admin/users/${encodeURIComponent(email)}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      }),
  },
};

export interface Task {
  id: string;
  title: string;
  description: string;
  priority: string;
  due_label: string;
  category: string;
  link_label?: string | null;
  link_url?: string | null;
  sort_order: number;
  active: boolean;
}
