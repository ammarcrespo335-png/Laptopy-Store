export class ApiError extends Error {
  constructor(status, message, code, fields) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields ?? [];
  }
}

async function toApiError(res) {
  let body = null;
  try { body = await res.json(); } catch { /* not JSON */ }
  const e = body?.error;
  return new ApiError(res.status, e?.message ?? res.statusText ?? 'Request failed', e?.code, e?.fields);
}

async function request(path, { method = 'GET', body, signal } = {}) {
  const res = await fetch(path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'same-origin',
    signal,
  });
  if (!res.ok) throw await toApiError(res);
  return res.status === 204 ? null : res.json();
}

/** Sends a file (or bytes) as the raw request body and reads the JSON answer. */
async function rawRequest(path, body, contentType) {
  const res = await fetch(path, { method: 'POST', headers: { 'Content-Type': contentType }, body, credentials: 'same-origin' });
  if (!res.ok) throw await toApiError(res);
  return res.json();
}

export const api = {
  config: () => request('/api/config'),
  me: () => request('/api/auth/me'),
  googleLogin: (credential) => request('/api/auth/google', { method: 'POST', body: { credential } }),
  devLogin: (email) => request('/api/auth/dev-login', { method: 'POST', body: { email } }),
  logout: () => request('/api/auth/logout', { method: 'POST' }),
  laptops: ({ all = false } = {}) => request(`/api/laptops${all ? '?all=1' : ''}`),
  createLaptop: (data) => request('/api/laptops', { method: 'POST', body: data }),
  updateLaptop: (id, data) => request(`/api/laptops/${encodeURIComponent(id)}`, { method: 'PATCH', body: data }),
  deleteLaptop: (id) => request(`/api/laptops/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  uploadPhoto: (id, file) => rawRequest(`/api/laptops/${encodeURIComponent(id)}/images`, file, file.type || 'application/octet-stream'),
  removePhoto: (id, index) => request(`/api/laptops/${encodeURIComponent(id)}/images/${index}`, { method: 'DELETE' }),
  importLaptops: (data, { dryRun = false, replace = false } = {}) =>
    rawRequest(`/api/laptops/import?dryRun=${dryRun ? 1 : 0}&replace=${replace ? 1 : 0}`, data, 'application/octet-stream'),
  compare: (ids, lang = 'ar') => request('/api/compare', { method: 'POST', body: { ids, lang } }),
};

/** Chat with Robin. Calls onDelta(text) for each streamed chunk; resolves with {mode}. */
export async function streamChat(messages, { onDelta, signal }) {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
    credentials: 'same-origin',
    signal,
  });
  if (!res.ok) throw await toApiError(res);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let result = { mode: 'local' };

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let end;
    while ((end = buffer.indexOf('\n\n')) >= 0) {
      const block = buffer.slice(0, end);
      buffer = buffer.slice(end + 2);
      const event = /^event: (.+)$/m.exec(block)?.[1];
      const raw = /^data: (.+)$/m.exec(block)?.[1];
      if (!event || !raw) continue;
      const data = JSON.parse(raw);
      if (event === 'delta') onDelta(data.text);
      else if (event === 'done') result = data;
      else if (event === 'error') throw new Error(data.message);
    }
  }
  return result;
}
