// ===== Cálculos de KOING: periodos, deudas, disponible y alertas =====
const pad = (n) => String(n).padStart(2, '0');
export const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const today = () => iso(new Date());
const lastDay = (y, m) => new Date(y, m + 1, 0).getDate();
const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
export const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const r2 = (n) => Math.round(n * 100) / 100;

// ---- Monedas: todo se calcula en $ y se muestra también en Bs ----
export const tasaDe = (state) => Number(state.tasa?.valor) || 0;
// Monto de un movimiento/venta en $ (si fue en Bs, se usa la tasa de ese día)
export function usd(m, state) {
  if (!m) return 0;
  if (m.moneda === 'VES') { const t = Number(m.tasa) || tasaDe(state); return t ? r2(m.monto / t) : 0; }
  return m.monto || 0;
}
export const aBs = (n, state) => r2((n || 0) * tasaDe(state));
export function ingresoUSD(state) {
  const pf = state.perfil;
  if (pf.ingresoMoneda === 'VES') { const t = tasaDe(state); return t ? r2((pf.ingreso || 0) / t) : 0; }
  return pf.ingreso || 0;
}

export function fmtDate(s, withYear = false) {
  const d = parse(s);
  return `${d.getDate()} ${MESES[d.getMonth()]}` + (withYear ? ` ${d.getFullYear()}` : '');
}

// Siguiente fecha de pago (igual que en el servidor)
export function nextDate(s, freq) {
  const d = parse(s);
  const y = d.getFullYear(), m = d.getMonth(), day = d.getDate();
  if (freq === 'semanal') { d.setDate(day + 7); return iso(d); }
  if (freq === 'mensual') {
    const nm = new Date(y, m + 1, 1);
    nm.setDate(Math.min(day, lastDay(nm.getFullYear(), nm.getMonth())));
    return iso(nm);
  }
  if (day <= 15) return iso(new Date(y, m, Math.min(day + 15, lastDay(y, m))));
  const nm = new Date(y, m + 1, 1);
  nm.setDate(Math.min(Math.max(1, day - 15), lastDay(nm.getFullYear(), nm.getMonth())));
  return iso(nm);
}

// Periodo que contiene la fecha, según cómo cobra la persona
export function periodo(freq, ref = today()) {
  const d = parse(ref);
  const y = d.getFullYear(), m = d.getMonth();
  let start, end;
  if (freq === 'mensual') {
    start = iso(new Date(y, m, 1)); end = iso(new Date(y, m, lastDay(y, m)));
  } else if (freq === 'semanal') {
    const dow = (d.getDay() + 6) % 7; // lunes = 0
    start = addDays(ref, -dow); end = addDays(start, 6);
  } else {
    if (d.getDate() <= 15) { start = iso(new Date(y, m, 1)); end = iso(new Date(y, m, 15)); }
    else { start = iso(new Date(y, m, 16)); end = iso(new Date(y, m, lastDay(y, m))); }
  }
  const s = parse(start), e = parse(end);
  const label = s.getMonth() === e.getMonth()
    ? `${s.getDate()} – ${e.getDate()} ${MESES[e.getMonth()]}`
    : `${s.getDate()} ${MESES[s.getMonth()]} – ${e.getDate()} ${MESES[e.getMonth()]}`;
  return { start, end, label };
}
export const nextPeriodo = (freq, p) => periodo(freq, addDays(p.end, 1));
export const prevPeriodo = (freq, p) => periodo(freq, addDays(p.start, -1));
export function diasRestantes(p, ref = today()) {
  return Math.max(0, Math.round((parse(p.end) - parse(ref)) / 86400000) + 1);
}
// Cuántos periodos caben en un mes (para repartir gastos fijos mensuales)
export const periodosPorMes = (freq) => (freq === 'mensual' ? 1 : freq === 'semanal' ? 52 / 12 : 2);
export const nombrePeriodo = (freq) => (freq === 'mensual' ? 'mes' : freq === 'semanal' ? 'semana' : 'quincena');

// ---- Deudas ----
export function cuotasRestantes(d) {
  if (!d.activa) return 0;
  if (d.cuotasTotal) return Math.max(0, d.cuotasTotal - (d.cuotasPagadas || 0));
  if (d.saldo !== null && d.saldo !== undefined && d.cuota > 0) return Math.ceil(d.saldo / d.cuota);
  return 24; // sin fecha de fin: proyectamos 24 pagos como máximo
}
export function restanteDeuda(d) {
  if (!d.activa) return 0;
  if (d.saldo !== null && d.saldo !== undefined) return d.saldo;
  return r2(cuotasRestantes(d) * d.cuota);
}
// Fechas futuras de pago de una deuda
export function calendario(d, max = 60) {
  const out = [];
  if (!d.activa || !d.cuota) return out;
  let n = Math.min(cuotasRestantes(d), max);
  let f = d.proximoPago;
  let saldo = d.saldo;
  let i = (d.cuotasPagadas || 0) + 1;
  while (n-- > 0) {
    const monto = saldo !== null && saldo !== undefined ? Math.min(d.cuota, saldo) : d.cuota;
    out.push({ fecha: f, monto: r2(monto), n: i, deuda: d });
    if (saldo !== null && saldo !== undefined) saldo = r2(saldo - monto);
    f = nextDate(f, d.frecuencia); i++;
  }
  return out;
}
export function fechaFin(d) {
  if (!d.cuotasTotal && (d.saldo === null || d.saldo === undefined)) return null;
  const c = calendario(d);
  return c.length ? c[c.length - 1].fecha : null;
}
const inP = (f, p) => f >= p.start && f <= p.end;

// Pagos (hechos + pendientes) de un periodo
export function pagosDelPeriodo(state, p) {
  const hechos = state.movimientos.filter((m) => m.tipo === 'pago' && inP(m.fecha, p))
    .map((m) => ({ fecha: m.fecha, monto: usd(m, state), nombre: m.descripcion, pagado: true, deudaId: m.deudaId }));
  const pend = [];
  if (p.end < today()) return hechos.sort((a, b) => a.fecha.localeCompare(b.fecha));
  for (const d of state.deudas) {
    for (const c of calendario(d)) {
      if (c.fecha > p.end) break;
      if (c.fecha >= p.start || (p.start <= today() && c.fecha < p.start && inP(today(), p))) {
        // las cuotas atrasadas se cuentan en el periodo actual
        pend.push({ fecha: c.fecha, monto: c.monto, nombre: d.nombre, pagado: false, deudaId: d.id, n: c.n, total: d.cuotasTotal, atrasada: c.fecha < p.start });
      }
    }
  }
  return [...hechos, ...pend].sort((a, b) => a.fecha.localeCompare(b.fecha));
}

// ---- Resumen del periodo ----
export function resumen(state, p = periodo(state.perfil.frecuencia)) {
  const pf = state.perfil;
  const movs = state.movimientos.filter((m) => inP(m.fecha, p));
  const sum = (arr) => r2(arr.reduce((a, m) => a + usd(m, state), 0));
  const extra = sum(movs.filter((m) => m.tipo === 'ingreso'));
  const deEmprendimiento = sum(movs.filter((m) => m.tipo === 'ingreso' && m.categoria === 'Emprendimiento'));
  const sueldo = ingresoUSD(state);
  const ingresos = r2(sueldo + extra);
  const gastosArr = movs.filter((m) => m.tipo === 'gasto' && m.metodo !== 'credito');
  const gastos = sum(gastosArr);
  const porMoneda = {
    usd: r2(gastosArr.filter((m) => m.moneda !== 'VES').reduce((a, m) => a + m.monto, 0)),
    ves: r2(gastosArr.filter((m) => m.moneda === 'VES').reduce((a, m) => a + m.monto, 0)),
    vesUsd: sum(gastosArr.filter((m) => m.moneda === 'VES'))
  };
  const ahorroReal = sum(movs.filter((m) => m.tipo === 'ahorro'));
  // Lo que planeas apartar cuenta desde ya (en periodos actuales o futuros)
  const plan = p.end >= today() ? (pf.apartar || 0) : 0;
  const ahorro = Math.max(plan, ahorroReal);
  const pagos = pagosDelPeriodo(state, p);
  const cuotas = r2(pagos.reduce((a, x) => a + x.monto, 0));
  const fijos = r2((pf.fijos || []).reduce((a, f) => a + f.monto, 0) / periodosPorMes(pf.frecuencia));
  const disponible = r2(ingresos - cuotas - fijos - gastos - ahorro);
  return { p, sueldo, ingresos, extra, deEmprendimiento, gastos, porMoneda, ahorro, ahorroReal, plan, cuotas, fijos, disponible, pagos, movs };
}

// Proyección de los próximos N periodos
export function proyeccion(state, n = 6) {
  const out = [];
  let p = periodo(state.perfil.frecuencia);
  const fijos = r2((state.perfil.fijos || []).reduce((a, f) => a + f.monto, 0) / periodosPorMes(state.perfil.frecuencia));
  for (let i = 0; i < n; i++) {
    const pagos = pagosDelPeriodo(state, p);
    const debo = r2(pagos.reduce((a, x) => a + x.monto, 0));
    out.push({ p, pagos, debo, fijos, apartar: state.perfil.apartar || 0, queda: r2(ingresoUSD(state) - debo - fijos - (state.perfil.apartar || 0)) });
    p = nextPeriodo(state.perfil.frecuencia, p);
  }
  return out;
}

// ---- Metas ----
export function metasOrdenadas(state, tipo) {
  return state.metas.filter((m) => (!tipo || m.tipo === tipo)).sort((a, b) => (a.completada - b.completada) || (a.prioridad - b.prioridad));
}
export function metaPrincipal(state) {
  const act = state.metas.filter((m) => !m.completada && m.precio > (m.apartado || 0));
  return metasOrdenadas({ metas: act.filter((m) => m.tipo === 'necesito') })[0]
      || metasOrdenadas({ metas: act })[0] || null;
}
// ¿Cuándo llego a cada meta apartando X por periodo? (en orden de prioridad)
export function etaMetas(state) {
  const apartar = state.perfil.apartar || 0;
  const freq = state.perfil.frecuencia;
  let acumulado = 0;
  const res = {};
  for (const m of [...metasOrdenadas(state, 'necesito'), ...metasOrdenadas(state, 'quiero')].filter((x) => !x.completada)) {
    const falta = Math.max(0, m.precio - (m.apartado || 0));
    if (falta === 0) { res[m.id] = 'Lista para comprar'; continue; }
    if (!apartar) { res[m.id] = null; continue; }
    acumulado += falta;
    const nPer = Math.ceil(acumulado / apartar);
    let p = periodo(freq);
    for (let i = 1; i < nPer; i++) p = nextPeriodo(freq, p);
    res[m.id] = '≈ ' + p.label;
  }
  return res;
}

// ---- Alerta antes de gastar ----
export function revisarGasto(state, monto, { credito = false, cuotas = 1 } = {}) {
  const r = resumen(state);
  const pf = state.perfil;
  const out = { mostrar: false, titulo: '', texto: '', filas: [], r };
  if (!pf.avisos || !(monto > 0)) return out;
  const impacto = credito ? r2(monto / Math.max(1, cuotas)) : monto;
  const libre = r2(r.disponible - impacto);
  const meta = metaPrincipal(state);
  const nom = nombrePeriodo(pf.frecuencia);
  const fmt = state.fmt;

  if (meta) {
    const falta = r2(meta.precio - (meta.apartado || 0));
    if (r.disponible >= falta && libre < falta) {
      out.mostrar = true;
      out.titulo = 'Ey, antes de guardar…';
      out.texto = `Si gastas <b>${fmt(monto)}</b> en esto, <b>no podrás comprar ${esc(meta.nombre)}</b> esta ${nom}.`;
    } else if (pf.apartar > 0 && impacto >= pf.apartar) {
      const n = Math.max(1, Math.round(impacto / pf.apartar));
      out.mostrar = true;
      out.titulo = 'Piénsalo un segundo';
      out.texto = `Este gasto equivale a <b>${n} ${n === 1 ? nom : nom === 'mes' ? 'meses' : nom + 's'}</b> de ahorro para <b>${esc(meta.nombre)}</b>.`;
    }
    if (out.mostrar) out.filas.push([`${meta.nombre} · ${meta.tipo === 'necesito' ? 'necesidad' : 'deseo'} #1`, `faltan ${fmt(falta)}`]);
  }
  if (libre < 0) {
    out.mostrar = true;
    out.titulo = 'Te pasarías del presupuesto';
    out.texto = `Con este gasto te pasas por <b>${fmt(-libre)}</b> esta ${nom}.` + (out.texto ? '<br>' + out.texto : '');
  } else if (!out.mostrar && r.disponible > 0 && impacto / r.disponible >= 0.5 && diasRestantes(r.p) > 3) {
    out.mostrar = true;
    out.titulo = 'Es más de la mitad de lo que te queda';
    out.texto = `Te quedarían <b>${fmt(libre)}</b> para ${diasRestantes(r.p)} días.`;
  }
  if (credito) out.filas.push(['Suma a tus cuotas', `${fmt(impacto)} × ${cuotas}`]);
  out.filas.push([`Libre después de este gasto`, fmt(libre), libre < 0 || (meta && libre < meta.precio - (meta.apartado || 0)) ? 'neg' : '']);
  return out;
}

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ===== Negocio / emprendimiento =====
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const normal = (t) => String(t || '').trim().toLowerCase().replace(/\s+/g, ' ');
export function statsNegocio(state, desde, hasta) {
  const ventas = state.ventas.filter((v) => v.fecha >= desde && v.fecha <= hasta);
  const movs = state.negMovs.filter((m) => m.fecha >= desde && m.fecha <= hasta);
  const vendido = r2(ventas.reduce((a, v) => a + usd(v, state), 0));
  const cobradoUSD = r2(ventas.filter((v) => v.moneda !== 'VES').reduce((a, v) => a + v.monto, 0));
  const cobradoVES = r2(ventas.filter((v) => v.moneda === 'VES').reduce((a, v) => a + v.monto, 0));
  const cobradoVESusd = r2(ventas.filter((v) => v.moneda === 'VES').reduce((a, v) => a + usd(v, state), 0));
  const gastos = r2(movs.filter((m) => m.tipo === 'gasto' || m.tipo === 'pago_proveedor').reduce((a, m) => a + usd(m, state), 0));
  const retiros = r2(movs.filter((m) => m.tipo === 'retiro').reduce((a, m) => a + usd(m, state), 0));
  // Por día
  const porDia = {};
  ventas.forEach((v) => { porDia[v.fecha] = r2((porDia[v.fecha] || 0) + usd(v, state)); });
  // Por día de la semana (promedio de los días que hubo ventas)
  const sem = Array.from({ length: 7 }, () => ({ total: 0, dias: new Set() }));
  ventas.forEach((v) => { const d = parse(v.fecha).getDay(); sem[d].total += usd(v, state); sem[d].dias.add(v.fecha); });
  const prom = sem.map((x, i) => ({ dia: DIAS[i], prom: x.dias.size ? r2(x.total / x.dias.size) : 0, n: x.dias.size })).filter((x) => x.n);
  const mejorDia = prom.length ? prom.reduce((a, b) => (b.prom > a.prom ? b : a)) : null;
  const peorDia = prom.length > 1 ? prom.reduce((a, b) => (b.prom < a.prom ? b : a)) : null;
  // Por franja de 2 horas
  const franjas = {};
  ventas.forEach((v) => { const h = parseInt(String(v.hora || '12').slice(0, 2), 10); const f = Math.floor(h / 2) * 2; franjas[f] = (franjas[f] || 0) + usd(v, state); });
  const fr = Object.entries(franjas).map(([h, t]) => ({ h: +h, t })).sort((a, b) => b.t - a.t);
  const mejorHora = fr.length && vendido ? { desde: fr[0].h, hasta: fr[0].h + 2, pct: Math.round((fr[0].t / vendido) * 100) } : null;
  // Productos estrella (por descripción)
  const prods = {};
  ventas.forEach((v) => {
    const k = normal(v.descripcion) || 'sin descripción';
    if (!prods[k]) prods[k] = { nombre: (v.descripcion || 'Sin descripción').trim(), n: 0, total: 0 };
    prods[k].n++; prods[k].total = r2(prods[k].total + usd(v, state));
  });
  const estrella = Object.values(prods).sort((a, b) => b.total - a.total).slice(0, 5);
  return { ventas, movs, vendido, cobradoUSD, cobradoVES, cobradoVESusd, gastos, retiros, ganancia: r2(vendido - gastos), porDia, mejorDia, peorDia, mejorHora, estrella };
}
// Sugerencias al escribir una venta: lo que más se ha vendido que empiece/contenga el texto
export function sugerencias(state, texto, max = 3) {
  const t = normal(texto);
  const cuenta = {};
  state.ventas.forEach((v) => { const k = normal(v.descripcion); if (!k) return; cuenta[k] = cuenta[k] || { nombre: v.descripcion.trim(), n: 0 }; cuenta[k].n++; });
  return Object.entries(cuenta).filter(([k]) => !t || k.includes(t)).sort((a, b) => (b[0].startsWith(t) - a[0].startsWith(t)) || b[1].n - a[1].n).slice(0, max).map(([, v]) => v);
}
export const DIAS_SEMANA = DIAS;
