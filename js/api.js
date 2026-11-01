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

const esperar = (ms) => new Promise((ok) => setTimeout(ok, ms));

// Un intento con límite de tiempo
async function intento(path, opts, ms) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try { return await fetch(path, { ...opts, signal: ctrl.signal }); }
  finally { clearTimeout(t); }
}

export async function api(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const t = token.get();
  if (t) headers.Authorization = 'Bearer ' + t;
  const opts = { method, headers, body: body ? JSON.stringify(body) : undefined };
  // Se puede reintentar sin riesgo: lecturas y entrar/crear cuenta/recuperar clave
  const seguro = method === 'GET' || path.startsWith('/api/auth');
  const max = seguro ? 3 : 1;
  let res = null, ultimoError = null;
  for (let i = 0; i < max; i++) {
    try {
      res = await intento(path, opts, 20000);
      // El servidor a veces tarda al "despertar": reintentamos si responde 502/503/504
      if (seguro && [502, 503, 504].includes(res.status) && i < max - 1) { await esperar(800 * (i + 1)); continue; }
      break;
    } catch (e) {
      ultimoError = e;
      if (i < max - 1) await esperar(800 * (i + 1));
    }
  }
  if (!res) {
    if (!navigator.onLine) throw new ApiError('No tienes internet. Revisa tu conexión e intenta de nuevo.', 0);
    if (ultimoError && ultimoError.name === 'AbortError') throw new ApiError('El servidor tardó mucho en responder. Intenta de nuevo en un momento.', 0);
    throw new ApiError('No pude conectarme con KOING. Intenta de nuevo en un momento.', 0);
  }
  let data = {};
  try { data = await res.json(); } catch (e) {}
  if (!res.ok) {
    if (res.status === 401 && t) { token.clear(); }
    if (res.status >= 500 && !data.error) throw new ApiError('KOING tuvo un problema del lado del servidor. Intenta de nuevo en un momento.', res.status);
    throw new ApiError(data.error || 'Algo salió mal', res.status);
  }
  return data;
}
