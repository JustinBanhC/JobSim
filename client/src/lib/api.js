import { supabase } from './supabase';

const BASE = '/api';

async function getAuthHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  if (supabase) {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }
  } else {
    headers['Authorization'] = 'Bearer dev-local-token';
  }
  return headers;
}

async function request(path, options = {}) {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BASE}${path}`, { headers, ...options });
  if (res.status === 204) return null;
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

export const api = {
  applications: {
    list: (params) => {
      const qs = new URLSearchParams(params).toString();
      return request(`/applications${qs ? `?${qs}` : ''}`);
    },
    get: (id) => request(`/applications/${id}`),
    create: (data) => request('/applications', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => request(`/applications/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    move: (id, data) => request(`/applications/${id}/move`, { method: 'PUT', body: JSON.stringify(data) }),
    addActivity: (id, data) => request(`/applications/${id}/activity`, { method: 'POST', body: JSON.stringify(data) }),
    delete: (id) => request(`/applications/${id}`, { method: 'DELETE' }),
  },
  contacts: {
    list: () => request('/contacts'),
    get: (id) => request(`/contacts/${id}`),
    create: (data) => request('/contacts', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => request(`/contacts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    addInteraction: (id, data) => request(`/contacts/${id}/interactions`, { method: 'POST', body: JSON.stringify(data) }),
    delete: (id) => request(`/contacts/${id}`, { method: 'DELETE' }),
  },
  skills: {
    list: () => request('/skills'),
    get: (id) => request(`/skills/${id}`),
    create: (data) => request('/skills', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => request(`/skills/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    addLearningLog: (id, data) => request(`/skills/${id}/learning-logs`, { method: 'POST', body: JSON.stringify(data) }),
    delete: (id) => request(`/skills/${id}`, { method: 'DELETE' }),
  },
  agent: {
    chat: (messages, onEvent) => {
      const controller = new AbortController();
      const promise = (async () => {
        const headers = await getAuthHeaders();
        const res = await fetch(`${BASE}/agent/chat`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ messages }),
          signal: controller.signal,
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: res.statusText }));
          throw new Error(err.error || 'Agent request failed');
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          let eventType = null;
          for (const line of lines) {
            if (line.startsWith('event: ')) {
              eventType = line.slice(7).trim();
            } else if (line.startsWith('data: ') && eventType) {
              try {
                const data = JSON.parse(line.slice(6));
                onEvent(eventType, data);
              } catch { /* skip malformed */ }
              eventType = null;
            }
          }
        }
      })();
      return { promise, abort: () => controller.abort() };
    },
  },
};
