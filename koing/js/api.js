// Llamadas al servidor con el token guardado
const KEY = 'koing_token';
export const token = {
  get: () => { try { return localStorage.getItem(KEY); } catch (e) { return null; } },
  set: (t) => { try { localStorage.setItem(KEY, t); } catch (e) {} },
  clear: () => { try { localStorage.removeItem(KEY); } catch (e) {} }
};

export class ApiError extends Error {
  constructor(msg, status) { super(msg); this.status = status; }
}

export async function api(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const t = token.get();
  if (t) headers.Authorization = 'Bearer ' + t;
  let res;
  try {
    res = await fetch(path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  } catch (e) {
    throw new ApiError('Sin conexión. Revisa tu internet e intenta de nuevo.', 0);
  }
  let data = {};
  try { data = await res.json(); } catch (e) {}
  if (!res.ok) {
    if (res.status === 401 && t) { token.clear(); }
    throw new ApiError(data.error || 'Algo salió mal', res.status);
  }
  return data;
}
