// GET /api/tasa → tasa oficial BCV (Bs por 1 $). Se guarda en Mongo y se refresca cada 3 horas.
// Si la fuente externa falla, devuelve la última tasa guardada.
const { getDb } = require('../lib/db');

const FUENTES = [
  // DolarAPI Venezuela: { promedio, fechaActualizacion }
  { url: 'https://ve.dolarapi.com/v1/dolares/oficial', leer: (j) => j.promedio ?? j.venta ?? j.compra, fecha: (j) => j.fechaActualizacion },
  // Respaldo: pyDolarVe
  { url: 'https://pydolarve.org/api/v2/dollar?page=bcv', leer: (j) => j?.monitors?.usd?.price, fecha: (j) => j?.monitors?.usd?.last_update }
];

async function traer() {
  for (const f of FUENTES) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 5000);
      const r = await fetch(f.url, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
      clearTimeout(t);
      if (!r.ok) continue;
      const j = await r.json();
      const v = Number(f.leer(j));
      if (Number.isFinite(v) && v > 0) return { valor: Math.round(v * 10000) / 10000, fechaFuente: f.fecha(j) || null };
    } catch (e) { /* probamos la siguiente fuente */ }
  }
  return null;
}

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido' });
  try {
    const db = await getDb();
    const C = db.collection('tasas');
    const cache = await C.findOne({ _id: 'bcv' });
    const fresca = cache && Date.now() - new Date(cache.actualizado).getTime() < 3 * 3600 * 1000;
    if (fresca && req.query.forzar !== '1') {
      return res.json({ valor: cache.valor, fecha: cache.fechaFuente, fuente: 'bcv' });
    }
    const nueva = await traer();
    if (nueva) {
      await C.updateOne({ _id: 'bcv' }, { $set: { ...nueva, actualizado: new Date() } }, { upsert: true });
      return res.json({ valor: nueva.valor, fecha: nueva.fechaFuente, fuente: 'bcv' });
    }
    if (cache) return res.json({ valor: cache.valor, fecha: cache.fechaFuente, fuente: 'bcv', vieja: true });
    return res.json({ valor: null, fuente: null });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'No pude obtener la tasa' });
  }
};
