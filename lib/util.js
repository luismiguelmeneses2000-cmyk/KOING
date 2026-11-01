// Limpieza de datos que llegan del navegador + utilidades de fechas
const num = (v, def = 0) => {
  const n = Number(String(v ?? '').replace(',', '.'));
  if (!Number.isFinite(n) || n < 0) return def;
  return Math.round(n * 100) / 100;
};
const tasaNum = (v) => { const n = Number(String(v ?? '').replace(',', '.')); return Number.isFinite(n) && n > 0 ? Math.round(n * 10000) / 10000 : null; };
const int = (v, def = 0) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n >= 0 ? Math.min(n, 1000) : def;
};
const str = (v, max = 80) => String(v ?? '').trim().slice(0, max);
const oneOf = (v, list, def) => (list.includes(v) ? v : def);
const bool = (v) => v === true || v === 'true' || v === 1;

const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => {
  // Hora de Venezuela (UTC-4) para que "hoy" no cambie a las 8 p. m.
  const d = new Date(Date.now() - 4 * 3600 * 1000);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
};
const date = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? String(v) : today());
const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const lastDay = (y, m) => new Date(y, m + 1, 0).getDate();

// Siguiente fecha de pago según frecuencia
function nextDate(s, freq) {
  const d = parse(s);
  const y = d.getFullYear(), m = d.getMonth(), day = d.getDate();
  if (freq === 'semanal') { d.setDate(day + 7); return iso(d); }
  if (freq === 'mensual') {
    const nm = new Date(y, m + 1, 1);
    nm.setDate(Math.min(day, lastDay(nm.getFullYear(), nm.getMonth())));
    return iso(nm);
  }
  // quincenal: 5 → 20 → 5 del mes siguiente
  if (day <= 15) return iso(new Date(y, m, Math.min(day + 15, lastDay(y, m))));
  const nm = new Date(y, m + 1, 1);
  nm.setDate(Math.min(Math.max(1, day - 15), lastDay(nm.getFullYear(), nm.getMonth())));
  return iso(nm);
}

const TIPOS_DEUDA = ['cuotas', 'tarjeta', 'prestamo', 'otro'];
const FRECUENCIAS = ['semanal', 'quincenal', 'mensual'];
const METODOS = ['debito', 'efectivo', 'pago_movil', 'credito', 'punto', 'zelle', 'transferencia'];
const CATEGORIAS = ['Comida', 'Mercado', 'Transporte', 'Servicios', 'Salud', 'Casa', 'Ropa', 'Tecnología', 'Ocio', 'Educación', 'Regalos', 'Otros',
  'Emprendimiento', 'Mercancía', 'Insumos', 'Alquiler', 'Nómina', 'Publicidad', 'Mantenimiento', 'Impuestos'];
const MONEDAS = ['USD', 'VES'];
const hora = (v) => (/^\d{2}:\d{2}$/.test(String(v || '')) ? String(v) : '12:00');

function cleanDeuda(b) {
  const tipo = oneOf(b.tipo, TIPOS_DEUDA, 'cuotas');
  const cuotasTotal = tipo === 'tarjeta' ? null : (b.cuotasTotal === null || b.cuotasTotal === '' || b.cuotasTotal === undefined ? null : int(b.cuotasTotal, null));
  const d = {
    nombre: str(b.nombre, 60) || 'Deuda',
    tipo,
    frecuencia: oneOf(b.frecuencia, FRECUENCIAS, 'quincenal'),
    cuota: num(b.cuota),
    cuotasTotal,
    cuotasPagadas: int(b.cuotasPagadas, 0),
    abonado: num(b.abonado),
    saldo: b.saldo === null || b.saldo === '' || b.saldo === undefined ? null : num(b.saldo),
    proximoPago: date(b.proximoPago),
    nota: str(b.nota, 140),
    activa: b.activa === undefined ? true : bool(b.activa)
  };
  if (d.cuotasTotal !== null && d.cuotasPagadas > d.cuotasTotal) d.cuotasPagadas = d.cuotasTotal;
  return d;
}

function cleanMovimiento(b) {
  return {
    tipo: oneOf(b.tipo, ['gasto', 'ingreso', 'pago', 'ahorro', 'retiro', 'pago_proveedor'], 'gasto'),
    espacio: oneOf(b.espacio, ['personal', 'negocio'], 'personal'),
    moneda: oneOf(b.moneda, MONEDAS, 'USD'),
    tasa: tasaNum(b.tasa),
    monto: num(b.monto),
    descripcion: str(b.descripcion, 60),
    categoria: oneOf(b.categoria, CATEGORIAS, 'Otros'),
    metodo: oneOf(b.metodo, METODOS, 'debito'),
    fecha: date(b.fecha),
    deudaId: b.deudaId ? str(b.deudaId, 30) : null,
    metaId: b.metaId ? str(b.metaId, 30) : null,
    proveedorId: b.proveedorId ? str(b.proveedorId, 30) : null
  };
}

function cleanVenta(b) {
  return {
    monto: num(b.monto),
    moneda: oneOf(b.moneda, MONEDAS, 'USD'),
    tasa: tasaNum(b.tasa),
    descripcion: str(b.descripcion, 60),
    metodo: oneOf(b.metodo, ['efectivo', 'pago_movil', 'punto', 'zelle', 'transferencia'], 'efectivo'),
    fecha: date(b.fecha),
    hora: hora(b.hora)
  };
}

function cleanProveedor(b) {
  const monto = num(b.monto);
  return {
    empresa: str(b.empresa, 60) || 'Proveedor',
    concepto: str(b.concepto, 80),
    monto,
    moneda: oneOf(b.moneda, MONEDAS, 'USD'),
    saldo: b.saldo === undefined || b.saldo === null || b.saldo === '' ? monto : num(b.saldo),
    vence: date(b.vence),
    pagado: bool(b.pagado)
  };
}

function cleanMeta(b) {
  return {
    nombre: str(b.nombre, 60) || 'Meta',
    precio: num(b.precio),
    apartado: num(b.apartado),
    tipo: oneOf(b.tipo, ['necesito', 'quiero'], 'necesito'),
    prioridad: int(b.prioridad, 0),
    completada: bool(b.completada)
  };
}

function cleanPerfil(b) {
  const fijos = Array.isArray(b.fijos) ? b.fijos.slice(0, 20).map((f) => ({ nombre: str(f.nombre, 40), monto: num(f.monto) })).filter((f) => f.nombre && f.monto > 0) : [];
  return {
    nombre: str(b.nombre, 40),
    frecuencia: oneOf(b.frecuencia, ['semanal', 'quincenal', 'mensual', 'variable'], 'quincenal'),
    ingreso: num(b.ingreso),
    moneda: '$',
    ingresoMoneda: oneOf(b.ingresoMoneda, MONEDAS, 'USD'),
    uso: oneOf(b.uso, ['personal', 'emprendimiento', 'negocio'], 'personal'),
    negocioNombre: str(b.negocioNombre, 50),
    tasaManual: b.tasaManual && tasaNum(b.tasaManual.valor) ? { valor: tasaNum(b.tasaManual.valor), fecha: date(b.tasaManual.fecha) } : null,
    fijos,
    apartar: num(b.apartar),
    avisos: b.avisos === undefined ? true : bool(b.avisos),
    onboarded: bool(b.onboarded)
  };
}

// ---- Caja de ahorro: números (múltiplos de 5) que suman exactamente la meta ----
const CAJA_METAS = { 500: 40, 1000: 64, 1500: 80, 5000: 192 };
function generarCaja(meta) {
  const n = CAJA_METAS[meta] || 40;
  const base = [5, 5, 5, 10, 10, 10, 15, 20, 20, 25, 30, 40, 50, 60, 75];
  const prom = meta / n;
  // Escalamos los valores para que el promedio quede cerca del necesario
  const esc = Math.max(0.5, prom / (base.reduce((a, b) => a + b, 0) / base.length));
  const nums = Array.from({ length: n }, () => Math.max(5, Math.round((base[Math.floor(Math.random() * base.length)] * esc) / 5) * 5));
  let diff = meta - nums.reduce((a, b) => a + b, 0);
  let guard = 0;
  while (diff !== 0 && guard++ < 100000) {
    const i = Math.floor(Math.random() * n);
    if (diff > 0 && nums[i] < 100) { nums[i] += 5; diff -= 5; }
    else if (diff < 0 && nums[i] > 5) { nums[i] -= 5; diff += 5; }
  }
  return nums;
}
function cleanCaja(b) {
  const meta = [500, 1000, 1500, 5000].includes(Number(b.meta)) ? Number(b.meta) : 500;
  const numeros = Array.isArray(b.numeros) ? b.numeros.slice(0, 300).map((x) => int(x, 5)) : [];
  const tachados = Array.isArray(b.tachados) ? [...new Set(b.tachados.map((x) => int(x, -1)).filter((x) => x >= 0 && x < numeros.length))] : [];
  return { nombre: str(b.nombre, 40) || 'Mi caja de ahorro', meta, numeros, tachados, completada: bool(b.completada) };
}

module.exports = { generarCaja, cleanCaja, num, int, str, oneOf, bool, date, today, nextDate, cleanDeuda, cleanMovimiento, cleanMeta, cleanPerfil, cleanVenta, cleanProveedor, tasaNum, CATEGORIAS };
