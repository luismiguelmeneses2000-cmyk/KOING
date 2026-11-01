// ===== KOING · aplicación =====
import { api, token } from './api.js';
import { pig, shadow, icon } from './pig.js';
import * as K from './calc.js';
import * as INST from './instalar.js';

const { esc } = K;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const appEl = $('#app');
const tabEl = $('#tabbar-root');
const sheetEl = $('#sheet-root');
const r2 = (n) => Math.round(n * 100) / 100;

// ---------- Estado ----------
const S = { user: null, perfil: null, deudas: [], metas: [], movimientos: [], ventas: [], proveedores: [], negMovs: [], cajas: [], tasa: { valor: 0, fuente: null }, fmt: (n) => fmt(n) };
const UI = { espacio: 'personal', ver: '$', tab: 'inicio', stack: [], sheet: null, metaTipo: 'necesito', deudaFiltro: 'activas', movOffset: 0, histOpen: 0, ob: null };
const TABS = { inicio: 0, movimientos: 1, deudas: 3, metas: 4 };
const NTABS = { inicio: 0, ventas: 1, proveedores: 3, reportes: 4 };
const esNeg = () => UI.espacio === 'negocio';
const curTabs = () => (esNeg() ? NTABS : TABS);
const curViews = () => (esNeg() ? NTABVIEWS : TABVIEWS);

function fmt(n, { sign = false } = {}) {
  const sym = '$';
  const v = Math.abs(Number(n) || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const s = sym === 'Bs' ? `Bs ${v}` : `${sym}${v}`;
  if (n < 0) return '−' + s;
  return sign && n > 0 ? '+' + s : s;
}
function parseMoney(v) {
  let s = String(v ?? '').replace(/[^\d.,-]/g, '');
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(s);
  return Number.isFinite(n) && n > 0 ? r2(n) : 0;
}
// Bolívares
function fmtBs(n, { sign = false } = {}) {
  const v = Math.abs(Number(n) || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (n < 0) return '−Bs ' + v;
  return (sign && n > 0 ? '+' : '') + 'Bs ' + v;
}
// Monto en su moneda original
const fmtM = (monto, moneda, opts) => (moneda === 'VES' ? fmtBs(monto, opts) : fmt(monto, opts));
// Equivalente en la otra moneda (texto corto)
function equiv(monto, moneda, tasa) {
  const t = Number(tasa) || K.tasaDe(S);
  if (!t) return '';
  return moneda === 'VES' ? '≈ ' + fmt(monto / t) : '≈ ' + fmtBs(monto * t);
}
const moneyVal = (n) => (n ? String(n).replace('.', ',') : '');
const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} }
};
const nomP = () => K.nombrePeriodo(S.perfil?.frecuencia);

// ---------- Utilidades de interfaz ----------
function toast(msg, withPig = true) {
  $$('.toast').forEach((t) => t.remove());
  const t = document.createElement('div');
  t.className = 'toast'; t.setAttribute('role', 'status');
  t.innerHTML = (withPig ? pig({ size: 30, coin: 'none', label: '' }) : '') + `<span>${esc(msg)}</span>`;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2700);
}

function openSheet(html, { label = 'Opciones', onOpen } = {}) {
  sheetEl.innerHTML = `<div class="sheet-root"><div class="sheet-back" data-act="closeSheet"></div>
    <div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(label)}"><div class="grab"></div>${html}</div></div>`;
  UI.sheet = true;
  const first = $('.sheet input, .sheet button:not(.sheet-back)', sheetEl);
  setTimeout(() => first && first.focus({ preventScroll: true }), 320);
  onOpen && onOpen($('.sheet', sheetEl));
}
function closeSheet() {
  if (!UI.sheet) return Promise.resolve();
  UI.sheet = null;
  const sh = $('.sheet', sheetEl), bk = $('.sheet-back', sheetEl);
  if (!sh) { sheetEl.innerHTML = ''; return Promise.resolve(); }
  sh.classList.add('closing'); bk.classList.add('closing');
  return new Promise((ok) => setTimeout(() => { sheetEl.innerHTML = ''; ok(); }, 210));
}

function showSuccess({ titulo, texto = '', progFrom = null, progTo = null, izq = '', der = '', boton = 'Listo' }) {
  const el = document.createElement('div');
  el.className = 'success'; el.setAttribute('role', 'alertdialog'); el.setAttribute('aria-label', titulo);
  const spark = (x, y, d, c, s, round) => `<svg class="spark" style="left:${x}%;top:${y}px;animation-delay:${d}s" width="${s}" height="${s}" viewBox="0 0 24 24" aria-hidden="true">${round ? `<circle cx="12" cy="12" r="9" fill="${c}"/>` : `<path d="M12 2v20M2 12h20" stroke="${c}" stroke-width="3.5" stroke-linecap="round"/>`}</svg>`;
  el.innerHTML = `
    <div class="stage">
      ${spark(18, 150, 1, 'var(--sage)', 22)}${spark(76, 130, 1.05, 'var(--brand)', 26)}${spark(29, 95, 1.12, 'var(--sand)', 14, 1)}
      ${spark(68, 230, 1.18, 'var(--sage)', 16, 1)}${spark(13, 260, 1.22, 'var(--sand)', 18)}
      <div class="pigwrap">${pig({ size: 230, coin: 'drop', label: 'El cerdito guarda la moneda' })}</div>
    </div>
    <div class="body">
      <div class="check">${icon('check', 24, 3)}</div>
      <h1>${esc(titulo)}</h1>
      <p>${texto}</p>
      ${progTo !== null ? `<div class="prog"><div class="kv" style="border:0;min-height:0;margin-bottom:8px;font-size:14px;font-weight:700;color:var(--muted)"><span>${esc(izq)}</span><span>${esc(der)}</span></div>
        <div class="bar"><span style="--from:${progFrom}%;--to:${progTo}%;width:${progTo}%"></span></div></div>` : ''}
    </div>
    <div class="grow"></div>
    <div class="foot"><button class="btn block" data-close>${esc(boton)}</button></div>`;
  document.body.appendChild(el);
  if (navigator.vibrate) { try { navigator.vibrate([12, 60, 18]); } catch (e) {} }
  return new Promise((ok) => {
    const b = $('[data-close]', el);
    setTimeout(() => b.focus(), 1700);
    b.addEventListener('click', () => { el.style.animation = 'kFadeOut .2s ease both'; setTimeout(() => { el.remove(); ok(); }, 190); });
  });
}

function emptyState(text) {
  return `<div class="empty">${pig({ size: 64, label: '' })}<span>${text}</span></div>`;
}

// ---------- Carga de datos ----------
async function load() {
  const [d, t] = await Promise.all([api('/api/perfil'), api('/api/tasa').catch(() => ({ valor: null }))]);
  const movs = d.movimientos || [];
  Object.assign(S, {
    user: d.user, perfil: d.perfil, deudas: d.deudas, metas: d.metas,
    movimientos: movs.filter((m) => m.espacio !== 'negocio'),
    negMovs: movs.filter((m) => m.espacio === 'negocio'),
    ventas: d.ventas || [], proveedores: d.proveedores || [], cajas: d.cajas || []
  });
  aplicarTasa(t);
  const e = store.get('koing_espacio');
  UI.espacio = S.perfil && S.perfil.uso !== 'personal' && e === 'negocio' ? 'negocio' : 'personal';
  UI.ver = store.get('koing_ver') === 'Bs' ? 'Bs' : '$';
}
let tasaBCV = null;
function aplicarTasa(t) {
  if (t && t.valor) tasaBCV = { valor: t.valor, fecha: t.fecha, vieja: !!t.vieja };
  const man = S.perfil?.tasaManual;
  if (man && man.valor && (man.fecha === K.today() || !tasaBCV)) S.tasa = { valor: man.valor, fuente: 'manual', fecha: man.fecha };
  else if (tasaBCV) S.tasa = { valor: tasaBCV.valor, fuente: 'bcv', vieja: tasaBCV.vieja };
  else S.tasa = { valor: 0, fuente: null };
}
// Agrega un movimiento a la lista que le toca (personal o negocio)
function addMov(m) { (m.espacio === 'negocio' ? S.negMovs : S.movimientos).unshift(m); }
const upsert = (arr, item) => { const i = arr.findIndex((x) => x.id === item.id); if (i >= 0) arr[i] = item; else arr.unshift(item); };

// ---------- Arranque ----------
async function boot() {
  const resetTok = new URLSearchParams(location.search).get('reset');
  if (resetTok) return renderReset(resetTok);
  if (INST.necesitaInstalar()) { tabEl.innerHTML = ''; return INST.pantallaInstalar(appEl, () => boot()); }
  if (!token.get()) {
    return store.get('koing_intro') ? renderAuth() : renderIntro();
  }
  if (!$('#splash')) appEl.innerHTML = `<div class="loading">${pig({ size: 110, cls: 'pig-float' })}<span>Abriendo tu KOING…</span></div>`;
  try {
    await load();
    if (!S.perfil || !S.perfil.onboarded) return startOnboarding();
    renderApp('a-fade');
  } catch (e) {
    if (e.status === 401) return renderAuth();
    appEl.innerHTML = `<div class="loading">${pig({ size: 110 })}<span>${esc(e.message)}</span><button class="btn small" data-act="reload">Intentar de nuevo</button></div>`;
  }
}

// =====================================================
// INTRO
// =====================================================
const INTRO = [
  ['¡Hola! Soy KOING', 'Tu alcancía de bolsillo. Te digo cuánto puedes gastar de verdad cada quincena.'],
  ['Yo llevo tus deudas', 'Cuotas, tarjetas y préstamos: cuánto pagas cada quincena y hasta cuándo.'],
  ['Y te cuido lo importante', 'Si un gasto te deja sin lo que necesitas, te aviso antes de que lo hagas.'],
  ['¿Me ayudas a conocerte?', 'Son unas preguntas rápidas y armo tu KOING solito. Nada de cargar todo a mano.']
];
let introStep = 0;
function renderIntro(first = true) {
  tabEl.innerHTML = '';
  if (first) introStep = 0;
  const [h, p] = INTRO[introStep];
  const html = `
    <main class="intro">
      <button class="text-btn skip" data-act="introEnd">Saltar</button>
      <div class="pig-stage">
        <div class="${first ? 'pig-enter' : ''}"><div class="pig-float">${pig({ size: 220 })}</div></div>
        ${shadow()}
      </div>
      <div class="bubble a-bounce" aria-live="polite"><h1>${h}</h1><p class="a-fade" style="animation-delay:.12s">${p}</p></div>
      <div class="dots" aria-hidden="true">${INTRO.map((_, i) => `<span class="${i === introStep ? 'on' : ''}"></span>`).join('')}</div>
      <div class="grow"></div>
      <div class="row-actions">
        ${introStep > 0 ? `<button class="btn ghost" style="flex:0 0 54px;padding:0" aria-label="Anterior" data-act="introPrev">${icon('back', 22, 2.4)}</button>` : ''}
        ${introStep < 3 ? '<button class="btn" data-act="introNext">Siguiente</button>' : '<button class="btn" data-act="introEnd">Empezar</button>'}
      </div>
    </main>`;
  if (first) { appEl.innerHTML = html; return; }
  // Solo reemplazamos el globo y los botones para que el cerdito siga flotando
  const tmp = document.createElement('div'); tmp.innerHTML = html;
  ['.bubble', '.dots', '.row-actions'].forEach((s) => $(s, appEl).replaceWith($(s, tmp)));
}

// =====================================================
// ENTRAR / CREAR CUENTA
// =====================================================
let authMode = 'registro';
function renderAuth(err = '') {
  tabEl.innerHTML = '';
  const reg = authMode === 'registro';
  appEl.innerHTML = `
    <main class="intro a-fade">
      <div class="pig-stage" style="height:190px">
        <div class="pig-float">${pig({ size: 150 })}</div>${shadow(110)}
      </div>
      <h1 style="margin:18px 0 4px;font-size:28px;font-weight:800;text-align:center">${reg ? 'Crea tu KOING' : 'Entra a tu KOING'}</h1>
      <p style="margin:0 0 18px;text-align:center;color:var(--muted)">${reg ? 'Tus datos se guardan en tu cuenta y los ves desde cualquier teléfono.' : '¡Qué bueno verte de nuevo!'}</p>
      <div class="seg" role="radiogroup" aria-label="Modo">
        <button type="button" role="radio" aria-checked="${reg}" data-act="authMode" data-v="registro">Crear cuenta</button>
        <button type="button" role="radio" aria-checked="${!reg}" data-act="authMode" data-v="login">Ya tengo cuenta</button>
      </div>
      <form data-form="auth" novalidate>
        ${reg ? `<div class="field"><label for="a-nombre">¿Cómo te llamas?</label><input class="input" id="a-nombre" autocomplete="given-name" maxlength="40"></div>` : ''}
        <div class="field"><label for="a-email">Correo</label><input class="input" id="a-email" type="email" inputmode="email" autocomplete="email" required></div>
        <div class="field"><label for="a-pass">Clave</label><input class="input" id="a-pass" type="password" autocomplete="${reg ? 'new-password' : 'current-password'}" minlength="6" required>
          ${reg ? '<span class="hint">Mínimo 6 caracteres.</span>' : ''}</div>
        <div class="err" role="alert">${esc(err)}</div>
        <button class="btn block" style="margin-top:6px">${reg ? 'Crear cuenta' : 'Entrar'}</button>
        ${reg ? '' : '<button type="button" class="btn link block" data-act="forgot">¿Olvidaste tu clave?</button>'}
      </form>
    </main>`;
}

// =====================================================
// PREGUNTAS INICIALES (7)
// =====================================================
const FIJOS_COMUNES = ['Alquiler o condominio', 'Servicios (luz, agua, gas)', 'Internet y teléfono', 'Mercado', 'Transporte', 'Colegio o estudios', 'Seguro o salud'];
function startOnboarding() {
  const p = S.perfil || {};
  UI.ob = {
    step: 1, dir: 1,
    d: {
      nombre: p.nombre || S.user?.nombre || '', frecuencia: p.frecuencia || 'quincenal', ingreso: p.ingreso || 0, moneda: '$',
      ingresoMoneda: p.ingresoMoneda || 'USD', uso: p.uso || 'personal', negocioNombre: p.negocioNombre || '',
      tieneDeudas: null, deudas: [], fijos: p.fijos || [], metas: [], apartar: p.apartar || 0, avisos: p.avisos ?? true
    }
  };
  renderOnboarding();
}
function obPorPeriodo() { return K.nombrePeriodo(UI.ob.d.frecuencia); }
function renderOnboarding() {
  tabEl.innerHTML = '';
  const { step, dir, d } = UI.ob;
  const per = obPorPeriodo();
  const sym = '$';
  let body = '';
  if (step === 1) {
    const opts = [
      ['personal', 'Mis finanzas personales', 'Sueldo, gastos, deudas y metas'],
      ['emprendimiento', 'Personal + mi emprendimiento', 'Tengo mi sueldo y además vendo algo. Lo que gane se suma a mis ingresos'],
      ['negocio', 'Personal + mi negocio', 'Una empresa con ventas, gastos y proveedores, separada de lo mío']
    ];
    body = `<h1>¿Para qué vas a usar KOING?</h1><p class="lead">Si tienes emprendimiento o negocio, lo llevas aparte y cambias con un toque desde arriba de la pantalla.</p>
      <fieldset class="radio-list"><legend class="sr">Uso</legend>
      ${opts.map(([v, t, s]) => `<label style="align-items:flex-start;padding:14px 0"><input type="radio" name="uso" value="${v}" ${d.uso === v ? 'checked' : ''} data-act="obUso" style="margin-top:2px"><span style="display:flex;flex-direction:column;gap:2px"><span>${t}</span><small>${s}</small></span></label>`).join('')}</fieldset>
      <div class="field" id="ob-neg-box" ${d.uso === 'personal' ? 'hidden' : ''}><label for="ob-neg">¿Cómo se llama tu ${d.uso === 'negocio' ? 'negocio' : 'emprendimiento'}?</label>
        <input class="input" id="ob-neg" value="${esc(d.negocioNombre)}" maxlength="50" placeholder="Ej: Tortas de Mamá Luisa"></div>`;
  } else if (step === 2) {
    body = `<h1>¿Cómo te llamo?</h1><p class="lead">Así te saludo cada vez que abras la app.</p>
      <div class="field"><label for="ob-nombre">Tu nombre</label><input class="input" id="ob-nombre" value="${esc(d.nombre)}" maxlength="40" autocomplete="given-name"></div>`;
  } else if (step === 3) {
    const opts = [['semanal', 'Semanal', ''], ['quincenal', 'Quincenal', '15 y último'], ['mensual', 'Mensual', ''], ['variable', 'Variable / por proyecto', '']];
    body = `<h1>¿Cada cuánto cobras?</h1><p class="lead">Con esto calculo cuánto tienes disponible en cada periodo. Puedes cambiarlo luego en Ajustes.</p>
      <fieldset class="radio-list"><legend class="sr">Frecuencia de pago</legend>
      ${opts.map(([v, t, s]) => `<label><input type="radio" name="freq" value="${v}" ${d.frecuencia === v ? 'checked' : ''}><span>${t}</span>${s ? `<small>${s}</small>` : ''}</label>`).join('')}</fieldset>`;
  } else if (step === 4) {
    body = `<h1>¿Cuánto recibes por ${per}?</h1><p class="lead">Tu sueldo se suma solo cada ${per}; no tienes que anotarlo. Si recibes algo extra, lo agregas como ingreso.</p>
      <div class="field"><span class="lbl">¿En qué moneda te pagan?</span>${segHtml('ob-ing-moneda', [['USD', 'Dólares'], ['VES', 'Bolívares']], d.ingresoMoneda, 'Moneda del sueldo')}</div>
      <div class="field"><label for="ob-ingreso">Monto por ${per}</label>
        <div class="money"><span id="ob-ing-sym">${d.ingresoMoneda === 'VES' ? 'Bs' : '$'}</span><input id="ob-ingreso" inputmode="decimal" placeholder="0,00" value="${moneyVal(d.ingreso)}"></div>
        <span class="hint">${d.frecuencia === 'variable' ? 'Como varía, pon un promedio por quincena.' : 'Si varía, pon un promedio.'}</span></div>`;
  } else if (step === 5) {
    body = `<h1>¿Tienes deudas o compras a crédito?</h1><p class="lead">Cashea, tarjetas, préstamos, compras en cuotas… Te digo cuánto deberás cada ${per} y hasta cuándo.</p>
      <div class="seg" role="radiogroup" aria-label="¿Tienes deudas?">
        <button type="button" role="radio" aria-checked="${d.tieneDeudas === true}" data-act="obDeudas" data-v="si">Sí, tengo</button>
        <button type="button" role="radio" aria-checked="${d.tieneDeudas === false}" data-act="obDeudas" data-v="no">No tengo</button>
      </div>
      ${d.tieneDeudas ? `
        ${d.deudas.length ? `<p class="cap">Agregadas</p><ul class="list mini-list">${d.deudas.map((x, i) => `<li class="row"><div class="main"><div class="t">${esc(x.nombre)}</div><div class="s">${tipoDeuda(x.tipo)} · ${fmtSym(x.cuota, sym)} ${x.frecuencia}</div></div>
          <button class="icon-btn" aria-label="Quitar ${esc(x.nombre)}" data-act="obDelDeuda" data-i="${i}">${icon('x', 20)}</button></li>`).join('')}</ul>` : ''}
        <p class="cap">${d.deudas.length ? 'Agregar otra' : 'Agrega la primera'}</p>
        <div class="form-rows" style="margin-top:0">
          <div class="form-row"><label for="od-nombre">Nombre</label><input id="od-nombre" placeholder="Ej: Cashea nevera" maxlength="60"></div>
          <div class="form-row"><label for="od-tipo">Tipo</label><select id="od-tipo"><option value="cuotas">Compra en cuotas</option><option value="tarjeta">Tarjeta de crédito</option><option value="prestamo">Préstamo</option><option value="otro">Otro</option></select></div>
          <div class="form-row"><label for="od-cuota">Cuota</label><input id="od-cuota" inputmode="decimal" placeholder="${sym} 0,00"></div>
          <div class="form-row"><label for="od-freq">Se paga</label><select id="od-freq"><option value="quincenal">Cada quincena</option><option value="mensual">Cada mes</option><option value="semanal">Cada semana</option></select></div>
          <div class="form-row"><label for="od-faltan">Cuotas que faltan</label><input id="od-faltan" inputmode="numeric" placeholder="Ej: 4 (en tarjeta, déjalo vacío)"></div>
          <div class="form-row"><label for="od-saldo">Saldo</label><input id="od-saldo" inputmode="decimal" placeholder="Opcional · lo que debes hoy"></div>
          <div class="form-row"><label for="od-prox">Próximo pago</label><input id="od-prox" type="date" value="${K.today()}"></div>
        </div>
        <div class="err" id="od-err" role="alert"></div>
        <button type="button" class="btn ghost block" data-act="obAddDeuda">${icon('plus', 18, 2.6)} Agregar esta deuda</button>` : ''}`;
  } else if (step === 6) {
    const tiene = (n) => d.fijos.find((f) => f.nombre === n);
    const otros = d.fijos.filter((f) => !FIJOS_COMUNES.includes(f.nombre));
    body = `<h1>¿Qué pagas fijo cada mes?</h1><p class="lead">Marca lo que aplica y pon cuánto al mes. Lo reparto solo en cada ${per}, así no lo anotas cada vez.</p>
      <div class="check-list list">
      ${[...FIJOS_COMUNES, ...otros.map((o) => o.nombre)].map((n, i) => { const f = tiene(n); return `
        <label><input type="checkbox" data-fijo="${i}" ${f ? 'checked' : ''} data-act="obFijoToggle"><span>${esc(n)}</span>
          <span class="money" ${f ? '' : 'hidden'}><span>${sym}</span><input inputmode="decimal" aria-label="Monto al mes de ${esc(n)}" data-fijo-monto="${i}" data-nombre="${esc(n)}" value="${f ? moneyVal(f.monto) : ''}" placeholder="0,00"></span></label>`; }).join('')}
      </div>
      <div class="field"><label for="ob-otro">¿Otro gasto fijo?</label>
        <div style="display:flex;gap:8px"><input class="input" id="ob-otro" placeholder="Ej: Gimnasio" maxlength="40"><button type="button" class="btn small ghost" data-act="obAddFijo">Agregar</button></div></div>`;
  } else if (step === 7) {
    body = `<h1>¿Qué necesitas o quieres comprar?</h1><p class="lead">Pon primero lo más importante. Si un gasto pone en riesgo tu necesidad #1, te aviso antes.</p>
      ${d.metas.length ? `<ul class="list mini-list">${d.metas.map((m, i) => `<li class="row"><span style="width:22px;font-weight:800;color:var(--brand-strong)">${i + 1}</span><div class="main"><div class="t">${esc(m.nombre)}</div><div class="s">${m.tipo === 'necesito' ? 'Lo necesito' : 'Lo quiero'}</div></div><span class="amt">${fmtSym(m.precio, sym)}</span>
        <button class="icon-btn" aria-label="Quitar ${esc(m.nombre)}" data-act="obDelMeta" data-i="${i}">${icon('x', 20)}</button></li>`).join('')}</ul>` : ''}
      <div class="form-rows">
        <div class="form-row"><label for="om-nombre">¿Qué es?</label><input id="om-nombre" placeholder="Ej: Laptop para trabajar" maxlength="60"></div>
        <div class="form-row"><label for="om-precio">Precio</label><input id="om-precio" inputmode="decimal" placeholder="${sym} 0,00"></div>
        <div class="form-row"><label for="om-ya">Ya tengo</label><input id="om-ya" inputmode="decimal" placeholder="Opcional · ${sym} apartado"></div>
      </div>
      <div class="seg" role="radiogroup" aria-label="Tipo" style="margin-top:14px" id="om-tipo">
        <button type="button" role="radio" aria-checked="true" data-act="segPick" data-v="necesito">Lo necesito</button>
        <button type="button" role="radio" aria-checked="false" data-act="segPick" data-v="quiero">Lo quiero</button>
      </div>
      <div class="err" id="om-err" role="alert"></div>
      <button type="button" class="btn ghost block" data-act="obAddMeta">${icon('plus', 18, 2.6)} Agregar a mi lista</button>`;
  } else if (step === 8) {
    const tmp = { tasa: S.tasa, perfil: { ...d, onboarded: true }, deudas: d.deudas.map((x, i) => ({ ...x, id: 'ob' + i, activa: true, cuotasPagadas: x.cuotasPagadas || 0 })), metas: [], movimientos: [] };
    const r = K.resumen(tmp);
    body = `<h1>¿Cuánto quieres apartar?</h1><p class="lead">Lo que separas cada ${per} para tus metas. Con lo que me contaste, esto es lo que te quedaría:</p>
      <div class="kv"><span>Ingreso</span><b>${fmtSym(r.ingresos, sym)}</b></div>
      <div class="kv"><span>Cuotas de deudas esta ${per}</span><b>−${fmtSym(r.cuotas, sym)}</b></div>
      <div class="kv"><span>Gastos fijos</span><b>−${fmtSym(r.fijos, sym)}</b></div>
      <div class="field"><label for="ob-apartar">Apartar por ${per}</label>
        <div class="money"><span>${sym}</span><input id="ob-apartar" inputmode="decimal" placeholder="0,00" value="${moneyVal(d.apartar)}"></div>
        <span class="hint" id="ob-libre" data-base="${r.disponible}">Te quedarían ${fmtSym(r2(r.disponible - (d.apartar || 0)), sym)} libres para el día a día.</span></div>
      <label class="kv" style="min-height:64px;margin-top:14px;cursor:pointer"><span style="display:flex;flex-direction:column"><span>Avisarme antes de gastar</span><small style="color:var(--muted)">Si un gasto pone en riesgo tu meta #1</small></span>
        <span class="switch"><input type="checkbox" id="ob-avisos" role="switch" ${d.avisos ? 'checked' : ''}><i></i></span></label>`;
  }
  const html = `
    <main class="screen">
      <div class="q-head">
        <button class="icon-btn" aria-label="Atrás" data-act="obBack" ${step === 1 ? 'style="visibility:hidden"' : ''}>${icon('back', 24, 2.2)}</button>
        <div class="progress" role="progressbar" aria-valuemin="1" aria-valuemax="8" aria-valuenow="${step}"><span style="width:${(step / 8) * 100}%"></span></div>
        <span class="q-count">${step} de 8</span>
      </div>
      <div class="q-body ${dir > 0 ? 'a-inR' : 'a-inL'}">
        <div class="q-pig"><div class="pig-float">${pig({ size: 46, label: '' })}</div>Armemos tu KOING</div>
        ${body}
      </div>
      <div class="q-foot">
        <div class="err" id="ob-err" role="alert"></div>
        <button class="btn block" data-act="obNext">${step === 8 ? 'Listo, armar mi KOING' : 'Continuar'}</button>
        ${[5, 6, 7].includes(step) ? '<button class="btn link" data-act="obSkip">Omitir por ahora</button>' : ''}
      </div>
    </main>`;
  const prog = $('.progress span', appEl);
  appEl.innerHTML = html;
  if (prog) { const n = $('.progress span', appEl); n.style.width = prog.style.width; requestAnimationFrame(() => requestAnimationFrame(() => { n.style.width = `${(step / 8) * 100}%`; })); }
  const f = $('.q-body input:not([type=radio]):not([type=checkbox])', appEl);
  if (f && step <= 4) setTimeout(() => f.focus({ preventScroll: true }), 260);
}
const fmtSym = (n, sym) => (sym === 'Bs' ? 'Bs ' : sym) + (Number(n) || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const tipoDeuda = (t) => ({ cuotas: 'Compra en cuotas', tarjeta: 'Tarjeta de crédito', prestamo: 'Préstamo', otro: 'Otra deuda' }[t] || 'Deuda');

function obCollect() {
  const { step, d } = UI.ob;
  if (step === 1) { d.uso = ($('input[name=uso]:checked') || {}).value || 'personal'; d.negocioNombre = $('#ob-neg').value.trim(); }
  if (step === 2) { d.nombre = $('#ob-nombre').value.trim(); }
  if (step === 3) { d.frecuencia = ($('input[name=freq]:checked') || {}).value || 'quincenal'; }
  if (step === 4) { d.ingreso = parseMoney($('#ob-ingreso').value); d.ingresoMoneda = segVal('ob-ing-moneda') || 'USD'; }
  if (step === 6) {
    const all = [...FIJOS_COMUNES, ...d.fijos.filter((f) => !FIJOS_COMUNES.includes(f.nombre)).map((f) => f.nombre)];
    d.fijos = $$('[data-fijo]').map((cb) => {
      if (!cb.checked) return null;
      const i = cb.dataset.fijo; return { nombre: all[i], monto: parseMoney($(`[data-fijo-monto="${i}"]`).value) };
    }).filter(Boolean);
  }
  if (step === 8) { d.apartar = parseMoney($('#ob-apartar').value); d.avisos = $('#ob-avisos').checked; }
}
async function obNext(skip = false) {
  const ob = UI.ob;
  if (!skip) obCollect();
  const err = $('#ob-err');
  if (ob.step === 1 && ob.d.uso !== 'personal' && !ob.d.negocioNombre) { err.textContent = 'Ponle un nombre (lo puedes cambiar luego).'; $('#ob-neg').focus(); return; }
  if (ob.step === 4 && !ob.d.ingreso) { err.textContent = 'Pon cuánto recibes (aunque sea un aproximado).'; return; }
  if (ob.step === 5 && !skip && ob.d.tieneDeudas === null) { err.textContent = 'Elige una opción.'; return; }
  if (ob.step === 5 && !skip && ob.d.tieneDeudas && $('#od-nombre')?.value.trim()) { if (!obAddDeuda()) return; }
  if (ob.step === 7 && !skip && $('#om-nombre')?.value.trim()) { if (!obAddMeta()) return; }
  if (skip && ob.step === 6) ob.d.fijos = [];
  if (ob.step < 8) { ob.step++; ob.dir = 1; return renderOnboarding(); }
  // Guardar todo
  const btn = $('[data-act=obNext]'); btn.disabled = true; btn.textContent = 'Armando tu KOING…';
  try {
    const d = ob.d;
    await api('/api/perfil', {
      method: 'PUT',
      body: {
        perfil: { ...(S.perfil || {}), nombre: d.nombre, frecuencia: d.frecuencia, ingreso: d.ingreso, ingresoMoneda: d.ingresoMoneda, uso: d.uso, negocioNombre: d.negocioNombre, fijos: d.fijos, apartar: d.apartar, avisos: d.avisos, onboarded: true },
        deudas: d.tieneDeudas ? d.deudas : [],
        metas: d.metas
      }
    });
    await load();
    UI.ob = null;
    renderApp('a-fade');
    showSuccess({ titulo: '¡Tu KOING está listo!', texto: `Ya sé cuánto puedes gastar esta ${nomP()}. Cuando gastes, toca el botón <b>+</b> y lo anotas en segundos.`, boton: 'Ver mi KOING' });
  } catch (e) {
    btn.disabled = false; btn.textContent = 'Listo, armar mi KOING';
    err.textContent = e.message;
  }
}
function obAddDeuda() {
  const e = $('#od-err');
  const nombre = $('#od-nombre').value.trim(), cuota = parseMoney($('#od-cuota').value);
  const tipo = $('#od-tipo').value;
  const faltan = parseInt($('#od-faltan').value, 10);
  const saldo = parseMoney($('#od-saldo').value);
  if (!nombre) { e.textContent = 'Ponle un nombre a la deuda.'; $('#od-nombre').focus(); return false; }
  if (!cuota) { e.textContent = 'Pon cuánto pagas en cada cuota.'; $('#od-cuota').focus(); return false; }
  if (tipo !== 'tarjeta' && !(faltan > 0) && !saldo) { e.textContent = 'Dime cuántas cuotas faltan o el saldo.'; $('#od-faltan').focus(); return false; }
  UI.ob.d.deudas.push({
    nombre, tipo, cuota, frecuencia: $('#od-freq').value,
    cuotasTotal: tipo !== 'tarjeta' && faltan > 0 ? faltan : null, cuotasPagadas: 0,
    saldo: saldo || (tipo === 'tarjeta' ? null : null), proximoPago: $('#od-prox').value || K.today()
  });
  renderOnboarding();
  return true;
}
function obAddMeta() {
  const e = $('#om-err');
  const nombre = $('#om-nombre').value.trim(), precio = parseMoney($('#om-precio').value);
  if (!nombre) { e.textContent = 'Escribe qué es.'; $('#om-nombre').focus(); return false; }
  if (!precio) { e.textContent = 'Pon un precio aproximado.'; $('#om-precio').focus(); return false; }
  const tipo = $('#om-tipo [aria-checked=true]').dataset.v;
  UI.ob.d.metas.push({ nombre, precio, apartado: parseMoney($('#om-ya').value), tipo });
  renderOnboarding();
  return true;
}

// =====================================================
// APP PRINCIPAL
// =====================================================
function renderTabbar() {
  if (UI.stack.length) { tabEl.innerHTML = ''; return; }
  const t = UI.tab, idx = curTabs()[t] ?? 0;
  const b = (k, label, ic) => `<button data-act="tab" data-v="${k}" ${t === k ? 'aria-current="page"' : ''}>${icon(ic, 24, t === k ? 2.4 : 2)}${label}</button>`;
  tabEl.innerHTML = esNeg()
    ? `<div class="tabbar"><nav aria-label="Negocio">
    <span class="ind" style="left:${idx * 20 + 10}%"></span>
    ${b('inicio', 'Inicio', 'home')}${b('ventas', 'Ventas', 'bag')}
    <button class="fab" data-act="nuevo" aria-label="Registrar">${icon('plus', 28, 2.6)}</button>
    ${b('proveedores', 'Proveedores', 'store')}${b('reportes', 'Reportes', 'chart')}
  </nav></div>`
    : `<div class="tabbar"><nav aria-label="Principal">
    <span class="ind" style="left:${idx * 20 + 10}%"></span>
    ${b('inicio', 'Inicio', 'home')}${b('movimientos', 'Movimientos', 'list')}
    <button class="fab" data-act="nuevo" aria-label="Registrar">${icon('plus', 28, 2.6)}</button>
    ${b('deudas', 'Deudas', 'card')}${b('metas', 'Metas', 'goal')}
  </nav></div>`;
}
function renderApp(anim = '') {
  const top = UI.stack[UI.stack.length - 1];
  if (!top && !curViews()[UI.tab]) UI.tab = 'inicio';
  const html = top ? VIEWS[top.v](top) : curViews()[UI.tab]();
  appEl.innerHTML = `<div class="screen ${anim}">${html}</div>`;
  renderTabbar();
  window.scrollTo(0, 0);
  const after = top ? AFTER[top.v] : null;
  after && after(top);
}
function goTab(t) {
  if (t === UI.tab && !UI.stack.length) return;
  const T = curTabs();
  const dir = T[t] > T[UI.tab] ? 'a-inR' : 'a-inL';
  const ind = $('.tabbar .ind');
  UI.tab = t;
  if (ind) ind.style.left = `${T[t] * 20 + 10}%`;
  appEl.innerHTML = `<div class="screen ${dir}">${curViews()[t]()}</div>`;
  $$('.tabbar button[data-act=tab]').forEach((b) => {
    const on = b.dataset.v === t;
    b.toggleAttribute('aria-current', on); if (on) b.setAttribute('aria-current', 'page');
  });
  window.scrollTo(0, 0);
}
function push(v, params = {}) {
  UI.stack.push({ v, ...params });
  history.pushState({ koing: UI.stack.length }, '');
  renderApp('a-push');
}
function popView() {
  if (!UI.stack.length) return;
  UI.stack.pop();
  renderApp('a-pop');
}
const back = () => { if (!UI.stack.length) return; UI.expectPop = true; history.back(); };

window.addEventListener('popstate', () => {
  if (UI.expectPop) { UI.expectPop = false; popView(); return; }
  if (UI.sheet) {
    closeSheet();
    if (UI.stack.length) history.pushState({ koing: UI.stack.length }, '');
    return;
  }
  if ($('.success')) { $('.success [data-close]').click(); return; }
  popView();
});

// ---------- INICIO ----------
// ---------- Piezas compartidas: espacio, tasa, montos en $/Bs ----------
function espacioBar() {
  const pf = S.perfil;
  if (!pf || pf.uso === 'personal') return '';
  const neg = UI.espacio === 'negocio';
  return `<div class="seg" role="tablist" aria-label="Espacio" style="margin:14px 20px 0">
    <button role="tab" aria-selected="${!neg}" data-act="espacio" data-v="personal">Personal</button>
    <button role="tab" aria-selected="${neg}" data-act="espacio" data-v="negocio" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(pf.negocioNombre || (pf.uso === 'negocio' ? 'Mi negocio' : 'Mi emprendimiento'))}</button>
  </div>`;
}
function tasaLine() {
  const t = S.tasa;
  const txt = !t.valor ? '<span class="neg" style="font-weight:800">Sin tasa del día</span>'
    : `<span style="color:var(--muted)">${t.fuente === 'manual' ? 'Tasa que usas' : 'Tasa BCV'}${t.vieja ? ' (última conocida)' : ' hoy'} · <b style="color:var(--text)">${fmtBs(t.valor)}</b> por $</span>`;
  return `<button class="row" data-act="tasaSheet" style="margin:12px 20px 0;width:calc(100% - 40px);border-top:1px solid var(--line);min-height:44px;font-size:14px">
    <span class="main">${txt}</span><span style="font-weight:800;color:var(--brand-strong)">${t.valor ? 'Cambiar' : 'Ponerla'}</span></button>`;
}
// Fila del menú de Inicio (ícono + título + resumen de una línea)
function menuRow({ ic, t, s, act, v, id, bar = null }) {
  return `<li><button class="menu-row" data-act="${act}" data-v="${v || ''}" ${id ? `data-id="${id}"` : ''}>
    <span class="mi">${icon(ic, 22)}</span>
    <span class="main"><span class="t">${t}</span><span class="s">${s}</span>${bar !== null ? `<span class="bar" style="height:5px;margin-top:6px"><span style="width:${Math.min(100, bar)}%"></span></span>` : ''}</span>
    <span class="chev">${icon('chev', 18)}</span></button></li>`;
}
function tasaMini() {
  const t = S.tasa;
  return `<button class="tasa-mini" data-act="tasaSheet">${t.valor ? `${t.fuente === 'manual' ? 'Tu tasa' : 'BCV'} ${fmtBs(t.valor)}${t.vieja ? ' (última)' : ''}` : '<span class="neg">Poner tasa del día</span>'} ${icon('chev', 14, 2.4)}</button>`;
}
function verToggle() {
  if (!S.tasa.valor) return '';
  return `<div class="seg" role="radiogroup" aria-label="Ver montos en" style="width:96px;padding:2px">
    <button role="radio" aria-checked="${UI.ver === '$'}" data-act="ver" data-v="$" style="min-height:30px">$</button>
    <button role="radio" aria-checked="${UI.ver === 'Bs'}" data-act="ver" data-v="Bs" style="min-height:30px">Bs</button></div>`;
}
// Monto grande en la moneda elegida, con el equivalente debajo
function bigAmount(n, extra = '') {
  const t = K.tasaDe(S);
  const enBs = UI.ver === 'Bs' && t;
  const grande = enBs ? fmtBs(n * t) : fmt(n);
  const chico = t ? (enBs ? '≈ ' + fmt(n) : '≈ ' + fmtBs(n * t)) : '';
  return `<div class="big num ${n < 0 ? 'neg' : ''}" data-count="${enBs ? n * t : n}" data-modo="${enBs ? 'bs' : 'usd'}" style="${enBs ? 'font-size:36px' : ''}">${grande}</div>
    <div style="font-size:15px;color:var(--muted);font-weight:700">${[chico, extra].filter(Boolean).join(' · ')}</div>`;
}
// Bloque "en dólares / en bolívares"
function monedaSplit(titulo, usdOrig, vesOrig, vesUsd, etiquetas = ['En dólares', 'En bolívares']) {
  const tot = usdOrig + vesUsd;
  const pct = tot ? Math.round((usdOrig / tot) * 100) : 0;
  return `<h2 class="cap">${esc(titulo)}</h2>
    <div class="list">
      <div class="row"><span class="cur-tag usd">USD</span><span class="main">${etiquetas[0]}</span><b class="num">${fmt(usdOrig)}</b></div>
      <div class="row"><span class="cur-tag ves">VES</span><span class="main"><span style="display:block">${etiquetas[1]}</span><span class="s">≈ ${fmt(vesUsd)} a la tasa de cada día</span></span><b class="num">${fmtBs(vesOrig)}</b></div>
    </div>
    <div class="stack" aria-hidden="true" style="margin-top:12px"><span style="width:${pct}%;background:var(--brand-strong)"></span><span style="width:${tot ? 100 - pct : 0}%;background:var(--sand)"></span></div>
    <p class="s" style="margin:6px 0 0;font-size:13px;color:var(--muted)">${tot ? `${pct}% en dólares · ${100 - pct}% en bolívares` : ''}</p>`;
}
// Selector de moneda + equivalencia para formularios
const monedaSeg = (id, val = 'USD') => segHtml(id, [['USD', 'Dólares'], ['VES', 'Bolívares']], val, 'Moneda');
function sheetTasa() {
  const t = S.tasa;
  openSheet(`<h2>Tasa del día</h2>
    <p style="color:var(--muted)">Cuántos bolívares vale 1 dólar. Cada gasto o venta en Bs guarda la tasa de ese día.</p>
    ${tasaBCV ? `<div class="kv"><span>BCV oficial${tasaBCV.vieja ? ' (última conocida)' : ''}</span><b class="num">${fmtBs(tasaBCV.valor)}</b></div>` : '<p class="neg" style="font-weight:700">No pude traer la tasa BCV. Escríbela tú.</p>'}
    <div class="field"><label for="tasa-man">Usar otra tasa hoy</label><div class="money"><span>Bs</span><input id="tasa-man" inputmode="decimal" placeholder="0,00" value="${t.fuente === 'manual' ? moneyVal(t.valor) : ''}"></div>
      <span class="hint">Por ejemplo, si te pagan o cobras a otra tasa.</span></div>
    <div class="actions">
      <button class="btn" data-act="saveTasa">Usar esta tasa</button>
      ${tasaBCV ? '<button class="btn ghost" data-act="usarBCV">Usar la del BCV</button>' : ''}
      <button class="btn link" data-act="closeSheet">Cerrar</button>
    </div>`, { label: 'Tasa del día' });
}

const TABVIEWS = {
  inicio() {
    const r = K.resumen(S);
    const pf = S.perfil;
    const en30 = K.iso(new Date(Date.now() + 30 * 86400000));
    const prox = K.pagosDelPeriodo(S, { start: '0000-01-01', end: en30 }).filter((x) => !x.pagado).map((x) => ({ ...x, atrasada: x.fecha < K.today() }));
    const atras = prox.filter((x) => x.atrasada);
    const ult = S.movimientos[0];
    const meta = K.metaPrincipal(S);
    const dias = K.diasRestantes(r.p);
    const salio = r2(r.cuotas + r.fijos + r.gastos + r.ahorro);
    const p0 = prox[0];
    return `
    <header class="hello">
      <div class="pig-float">${pig({ size: 40, label: 'KOING' })}</div>
      <div class="who"><b>Hola${pf.nombre ? ', ' + esc(pf.nombre) : ''}</b><span>${nomP()[0].toUpperCase() + nomP().slice(1)} ${r.p.label} · ${dias === 1 ? 'último día' : `faltan ${dias} días`}</span></div>
      <button class="icon-btn" aria-label="Ajustes" data-act="push" data-v="ajustes">${icon('gear', 24)}</button>
    </header>
    ${espacioBar()}
    <section class="hero" aria-label="Resumen">
      <div style="display:flex;justify-content:space-between;align-items:center"><span class="lbl">Disponible para gastar</span>${verToggle()}</div>
      ${bigAmount(r.disponible)}
      ${tasaMini()}
    </section>
    <div class="scroll">
      <ul class="menu a-rows">
        ${menuRow({ ic: 'wallet', t: 'Cómo va tu ' + nomP(), s: `Entró ${fmt(r.ingresos)} · se va ${fmt(salio)}`, act: 'push', v: 'detPeriodo' })}
        ${menuRow({ ic: 'calendar', t: 'Próximos pagos', s: atras.length ? `<span class="neg" style="font-weight:800">${atras.length} atrasado${atras.length > 1 ? 's' : ''}</span> · ${esc(atras[0].nombre)} ${fmt(atras[0].monto)}` : p0 ? `${esc(p0.nombre)} · ${fmt(p0.monto)} el ${K.fmtDate(p0.fecha)}` : 'Nada por pagar en 30 días', act: 'push', v: 'detPagos' })}
        ${menuRow({ ic: 'goal', t: meta ? 'Tu meta: ' + esc(meta.nombre) : 'Tus metas', s: meta ? `${Math.round(((meta.apartado || 0) / meta.precio) * 100)}% · faltan ${fmt(meta.precio - (meta.apartado || 0))}` : 'Agrega lo que necesitas o quieres comprar', act: 'tab', v: 'metas', bar: meta ? ((meta.apartado || 0) / meta.precio) * 100 : null })}
        ${(() => { const c = S.cajas[0]; if (!c) return menuRow({ ic: 'box', t: 'Caja de ahorro', s: 'Reto de $500 a $5.000: tacha números y llénala', act: 'push', v: 'caja' }); const ah = cajaAhorrado(c); return menuRow({ ic: 'box', t: 'Caja de ahorro', s: c.completada ? `¡Llenaste tu caja de ${fmt(c.meta)}!` : `${fmt(ah)} de ${fmt(c.meta)} · ${c.numeros.length - c.tachados.length} casillas por tachar`, act: 'push', v: 'caja', bar: (ah / c.meta) * 100 }); })()}
        ${menuRow({ ic: 'list', t: 'Movimientos', s: ult ? `${esc(ult.descripcion || ult.categoria)} · ${fmtM((ult.tipo === 'ingreso' ? 1 : -1) * ult.monto, ult.moneda || 'USD', { sign: true })}` : 'Toca + para anotar tu primer gasto', act: 'tab', v: 'movimientos' })}
      </ul>
    </div>`;
  },

  // ---------- MOVIMIENTOS ----------
  movimientos() {
    const freq = S.perfil.frecuencia;
    let p = K.periodo(freq);
    for (let i = 0; i < -UI.movOffset; i++) p = K.prevPeriodo(freq, p);
    for (let i = 0; i < UI.movOffset; i++) p = K.nextPeriodo(freq, p);
    const r = K.resumen(S, p);
    const movs = r.movs;
    const byDay = {};
    movs.forEach((m) => { (byDay[m.fecha] = byDay[m.fecha] || []).push(m); });
    const dias = Object.keys(byDay).sort().reverse();
    const hoy = K.today();
    const ayer = K.iso(new Date(Date.now() - 86400000));
    const salidas = r2(movs.filter((m) => m.tipo !== 'ingreso').reduce((a, m) => a + (m.tipo === 'gasto' && m.metodo === 'credito' ? 0 : K.usd(m, S)), 0));
    return `
    <div class="page-title"><h1>Movimientos</h1>
      <button class="btn small" data-act="exportCsv" aria-label="Exportar a Excel">${icon('dl', 18, 2.4)} Excel</button></div>
    <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 8px 0">
      <button class="icon-btn" aria-label="Periodo anterior" data-act="movPer" data-v="-1">${icon('back', 22, 2.4)}</button>
      <b style="font-size:16px">${p.label}${UI.movOffset === 0 ? ' · actual' : ''}</b>
      <button class="icon-btn" aria-label="Periodo siguiente" data-act="movPer" data-v="1" ${UI.movOffset >= 0 ? 'disabled style="opacity:.3"' : ''}>${icon('chev', 22, 2.4)}</button>
    </div>
    <div class="scroll">
      <div class="split" style="margin-top:8px">
        <div><div class="lbl">Entró</div><div class="v num pos">${fmt(r.ingresos)}</div></div>
        <div><div class="lbl">Salió</div><div class="v num">${fmt(salidas)}</div></div>
      </div>
      ${dias.length ? dias.map((dd) => `<p class="cap">${dd === hoy ? 'Hoy' : dd === ayer ? 'Ayer' : K.fmtDate(dd)}</p><div class="list a-rows">${byDay[dd].map(movRow).join('')}</div>`).join('')
        : emptyState('No hay movimientos en este periodo. Tu sueldo se cuenta solo.')}
    </div>`;
  },

  // ---------- DEUDAS ----------
  deudas() {
    const r = K.resumen(S);
    const act = S.deudas.filter((d) => d.activa);
    const pag = S.deudas.filter((d) => !d.activa);
    const total = r2(act.reduce((a, d) => a + K.restanteDeuda(d), 0));
    const lista = UI.deudaFiltro === 'activas' ? act : pag;
    const grupos = ['cuotas', 'tarjeta', 'prestamo', 'otro'].map((t) => [t, lista.filter((d) => d.tipo === t)]).filter(([, l]) => l.length);
    const titulos = { cuotas: 'Compras en cuotas', tarjeta: 'Tarjetas de crédito', prestamo: 'Préstamos', otro: 'Otras deudas' };
    return `
    <div class="page-title"><h1>Deudas</h1><button class="btn small" data-act="push" data-v="formDeuda">${icon('plus', 18, 2.6)} Agregar</button></div>
    <div class="scroll">
      <div class="split">
        <div><div class="lbl">Pagas esta ${nomP()}</div><div class="v num" style="color:var(--brand-strong)">${fmt(r.cuotas)}</div></div>
        <div><div class="lbl">Debes en total</div><div class="v num">${fmt(total)}</div></div>
      </div>
      <div class="seg" role="tablist" aria-label="Estado" style="margin-top:18px">
        <button role="tab" aria-selected="${UI.deudaFiltro === 'activas'}" data-act="deudaFiltro" data-v="activas">Activas (${act.length})</button>
        <button role="tab" aria-selected="${UI.deudaFiltro === 'pagadas'}" data-act="deudaFiltro" data-v="pagadas">Pagadas (${pag.length})</button>
      </div>
      <div id="deudas-lista">${deudasLista(grupos, titulos)}</div>
      ${act.length ? `<a class="row" href="#" data-act="push" data-v="historial" style="margin-top:14px;border-bottom:0;font-weight:800">
        <span class="main">Ver lo que deberé por ${nomP()}</span><span class="chev">${icon('chev', 18, 2.4)}</span></a>` : ''}
    </div>`;
  },

  // ---------- METAS ----------
  metas() {
    const lista = K.metasOrdenadas(S, UI.metaTipo);
    const eta = K.etaMetas(S);
    const pf = S.perfil;
    return `
    <div class="page-title"><h1>Metas</h1><button class="btn small" data-act="push" data-v="formMeta">${icon('plus', 18, 2.6)} Agregar</button></div>
    <div class="scroll">
      <div class="seg" role="tablist" aria-label="Tipo" style="margin-top:18px">
        <button role="tab" aria-selected="${UI.metaTipo === 'necesito'}" data-act="metaTipo" data-v="necesito">Lo que necesito</button>
        <button role="tab" aria-selected="${UI.metaTipo === 'quiero'}" data-act="metaTipo" data-v="quiero">Lo que quiero</button>
      </div>
      <div id="metas-lista">${metasLista(lista, eta)}</div>
      <div class="list" style="margin-top:22px">
        <button class="row" data-act="apartarPlanSheet"><span class="main">Apartar cada ${nomP()}</span><b class="num">${fmt(pf.apartar || 0)}</b><span class="chev">${icon('chev', 18, 2.2)}</span></button>
        <label class="row" style="min-height:64px;cursor:pointer"><span class="main" style="display:flex;flex-direction:column"><span>Avisarme antes de gastar</span><span class="s">Si un gasto pone en riesgo la meta #1</span></span>
          <span class="switch"><input type="checkbox" role="switch" data-act="toggleAvisos" ${pf.avisos ? 'checked' : ''}><i></i></span></label>
      </div>
    </div>`;
  }
};

function deudasLista(grupos, titulos) {
  if (!grupos.length) return emptyState(UI.deudaFiltro === 'activas' ? '¡No tienes deudas activas! Cuando compres a crédito, aparecerán aquí.' : 'Aún no has terminado de pagar ninguna deuda.');
  return grupos.map(([t, l]) => `<h2 class="cap">${titulos[t]}</h2><div class="list a-rows">${l.map(deudaRow).join('')}</div>`).join('');
}
function deudaRow(d) {
  const fin = K.fechaFin(d);
  const pct = d.cuotasTotal ? Math.round(((d.cuotasPagadas || 0) / d.cuotasTotal) * 100) : null;
  const sub = !d.activa ? 'Pagada por completo'
    : [d.frecuencia === 'quincenal' ? 'Quincenal' : d.frecuencia === 'mensual' ? 'Mensual' : 'Semanal',
       d.tipo === 'tarjeta' ? (d.saldo !== null && d.saldo !== undefined ? `Saldo ${fmt(d.saldo)}` : 'Sin fecha fin') : fin ? `hasta ${K.fmtDate(fin)}` : '',
       `próx. ${K.fmtDate(d.proximoPago)}`, d.abonado ? `abonado ${fmt(d.abonado)}` : ''].filter(Boolean).join(' · ');
  return `<button class="row" data-act="deudaSheet" data-id="${d.id}" style="flex-direction:column;align-items:stretch;gap:8px;padding:12px 0">
    <span style="display:flex;gap:12px;align-items:flex-start">
      <span class="main"><span class="t" style="display:block;font-size:16px">${esc(d.nombre)}</span><span class="s">${sub}</span></span>
      <span class="amt num">${fmt(d.cuota)}<small>${d.tipo === 'tarjeta' ? 'pago mínimo' : 'por ' + (d.frecuencia === 'mensual' ? 'mes' : d.frecuencia === 'semanal' ? 'semana' : 'quincena')}</small></span>
    </span>
    ${pct !== null ? `<span style="display:flex;align-items:center;gap:10px"><span class="bar" style="flex:1;height:6px"><span style="width:${pct}%"></span></span><span class="s" style="font-weight:700">${d.cuotasPagadas || 0} de ${d.cuotasTotal} pagadas</span></span>` : ''}
  </button>`;
}
function metasLista(lista, eta) {
  if (!lista.length) return emptyState(UI.metaTipo === 'necesito' ? 'Agrega algo que necesites. Lo cuido cuando vayas a gastar.' : 'Agrega algo que quieras darte. Te digo cuándo llegas.');
  return `<p style="margin:16px 0 6px;font-size:14px;color:var(--muted)">Ordenadas por prioridad. La primera es la que KOING protege cuando vas a gastar.</p>
  <div class="list a-rows">${lista.map((m, i) => {
    const pct = m.precio ? Math.min(100, ((m.apartado || 0) / m.precio) * 100) : 0;
    const falta = Math.max(0, m.precio - (m.apartado || 0));
    return `<button class="meta-row ${m.completada ? 'done' : ''}" data-act="metaSheet" data-id="${m.id}">
      <span class="rank">${m.completada ? icon('check', 20, 3) : i + 1}</span>
      <span class="main"><span class="top"><span>${esc(m.nombre)}</span><span class="num">${fmt(m.precio)}</span></span>
        <span class="bar ${i === 0 ? '' : 'sage'}"><span style="width:${pct}%"></span></span>
        <span class="sub"><span>${m.completada ? 'Comprada' : m.apartado ? `${fmt(m.apartado)} apartados · faltan ${fmt(falta)}` : 'Sin apartar todavía'}</span><span style="font-weight:700">${m.completada ? '' : eta[m.id] || (S.perfil.apartar ? '' : 'Define cuánto apartar')}</span></span></span>
      <span class="chev">${icon('chev', 18, 2.2)}</span></button>`;
  }).join('')}</div>`;
}
const METODO_TXT = { debito: 'Débito', efectivo: 'Efectivo', pago_movil: 'Pago móvil', credito: 'A crédito', punto: 'Punto', zelle: 'Zelle', transferencia: 'Transferencia' };
function movRow(m) {
  const sign = m.tipo === 'ingreso' ? 1 : -1;
  const sub = m.tipo === 'ingreso' ? (m.categoria === 'Emprendimiento' ? 'Del emprendimiento' : 'Ingreso') : m.tipo === 'pago' ? 'Pago de deuda' : m.tipo === 'ahorro' ? 'Apartado para meta'
    : m.tipo === 'retiro' ? 'Pasado a lo personal' : m.tipo === 'pago_proveedor' ? 'Pago a proveedor'
    : `${m.categoria} · ${METODO_TXT[m.metodo] || ''}`;
  const mon = m.moneda || 'USD';
  return `<button class="row" data-act="movSheet" data-id="${m.id}">
    <span class="main"><span class="t" style="display:block">${esc(m.descripcion || m.categoria)}</span><span class="s">${K.fmtDate(m.fecha)} · ${sub}</span></span>
    <span class="amt num ${sign > 0 ? 'pos' : ''}">${fmtM(sign * m.monto, mon, { sign: true })}<small>${equiv(m.monto, mon, m.tasa)}</small></span></button>`;
}

// ---------- Vistas apiladas ----------
const head = (title, right = '') => `<header class="topbar"><div class="side"><button class="icon-btn" aria-label="Volver" data-act="back">${icon('back', 24, 2.2)}</button></div><h1>${title}</h1><div class="side r">${right}</div></header>`;
const segHtml = (id, opts, val, label) => `<div class="seg" role="radiogroup" aria-label="${label}" id="${id}">${opts.map(([v, t]) => `<button type="button" role="radio" aria-checked="${v === val}" data-act="segPick" data-v="${v}">${t}</button>`).join('')}</div>`;
const segVal = (id) => $(`#${id} [aria-checked=true]`)?.dataset.v;

const cajaAhorrado = (c) => c.tachados.reduce((a, i) => a + (c.numeros[i] || 0), 0);
const VIEWS = {
  caja() {
    const c = S.cajas[0];
    if (!c || UI.cajaNueva) {
      const opts = [[500, 'Reto $500', '40 casillas · ideal para empezar'], [1000, 'Reto $1.000', '64 casillas'], [1500, 'Reto $1.500', '80 casillas'], [5000, 'Reto $5.000', '192 casillas · el grande']];
      return `${head('Caja de ahorro')}
      <div class="scroll">
        <div style="display:flex;justify-content:center;margin-top:6px"><div class="pig-float">${pig({ size: 120, label: '' })}</div></div>
        <h1 style="margin:10px 0 6px;font-size:26px;font-weight:800;text-align:center">¿Cuánto quieres juntar?</h1>
        <p style="margin:0 0 14px;text-align:center;color:var(--muted)">Te armo una caja con números en dólares. Cada vez que guardes esa cantidad, la tachas. Cuando taches todas, juntaste tu meta.</p>
        <fieldset class="radio-list"><legend class="sr">Meta</legend>
          ${opts.map(([v, t, sub], i) => `<label><input type="radio" name="caja-meta" value="${v}" ${i === 0 ? 'checked' : ''}><span style="display:flex;flex-direction:column"><span>${t}</span><small>${sub}</small></span></label>`).join('')}
        </fieldset>
        <div class="err" id="caja-err" role="alert"></div>
        <button class="btn block" style="margin-top:10px" data-act="cajaCrear">Armar mi caja</button>
        ${c ? '<button class="btn link block" data-act="cajaCancelarNueva">Volver a mi caja</button>' : ''}
      </div>`;
    }
    const ah = cajaAhorrado(c);
    const cols = c.numeros.length > 100 ? 8 : 5;
    return `${head('Caja de ahorro', '<button class="text-btn" data-act="cajaNueva">Nueva</button>')}
    <div class="scroll">
      <div style="display:flex;align-items:flex-end;justify-content:space-between;margin-top:4px">
        <div><div class="lbl" style="font-size:14px;font-weight:700;color:var(--muted)">Llevas</div><div class="num" style="font-size:36px;font-weight:800;color:var(--brand-strong);line-height:1.1" id="caja-total">${fmt(ah)}</div></div>
        <div style="text-align:right"><div style="font-size:14px;color:var(--muted);font-weight:700">Meta</div><div class="num" style="font-size:20px;font-weight:800">${fmt(c.meta)}</div></div>
      </div>
      <div class="bar" style="height:12px;margin-top:10px"><span id="caja-bar" style="width:${(ah / c.meta) * 100}%"></span></div>
      <p style="margin:8px 0 0;font-size:14px;color:var(--muted)" id="caja-sub">${c.completada ? '¡Caja llena! Lo lograste.' : `${c.numeros.length - c.tachados.length} casillas por tachar · faltan ${fmt(c.meta - ah)}`}</p>
      <p style="margin:14px 0 8px;font-size:14px;color:var(--muted)">Toca un número cuando guardes esa cantidad en dólares.</p>
      <div class="caja" style="grid-template-columns:repeat(${cols},minmax(0,1fr))" role="group" aria-label="Casillas de la caja">
        ${c.numeros.map((n, i) => { const t = c.tachados.includes(i); return `<button class="celda ${t ? 'tachada' : ''}" data-act="cajaTachar" data-i="${i}" aria-pressed="${t}" aria-label="${n} dólares${t ? ', tachado' : ''}"><span>${n}</span></button>`; }).join('')}
      </div>
    </div>`;
  },
  detPeriodo() {
    const r = K.resumen(S);
    const pf = S.perfil;
    const base = Math.max(r.ingresos, r.cuotas + r.fijos + r.gastos + r.ahorro, 1);
    const w = (x) => `${Math.max(0, Math.min(100, (x / base) * 100)).toFixed(1)}%`;
    return `${head('Tu ' + nomP())}
    <div class="scroll">
      <p style="margin:4px 0 0;color:var(--muted)">${r.p.label} · disponible <b style="color:var(--text)">${fmt(r.disponible)}</b></p>
      <div class="stack" aria-hidden="true" style="margin-top:14px">
        <span style="width:${w(r.cuotas)};background:var(--brand-strong)"></span>
        <span style="width:${w(r.fijos + r.gastos)};background:var(--sage)"></span>
        <span style="width:${w(r.ahorro)};background:var(--sand)"></span>
      </div>
      <div class="legend"><span><i style="background:var(--brand-strong)"></i>Deudas</span><span><i style="background:var(--sage)"></i>Gastado</span>${r.ahorro ? '<span><i style="background:var(--sand)"></i>Apartado</span>' : ''}<span><i style="background:var(--track);outline:1px solid var(--line-strong)"></i>Libre</span></div>
      <h2 class="cap">Entró</h2>
      <div class="list a-rows">
        <div class="kv"><span>Sueldo${pf.ingresoMoneda === 'VES' ? ` <small style="color:var(--muted)">(${fmtBs(pf.ingreso)})</small>` : ''}</span><b class="num">${fmt(r.sueldo)}</b></div>
        ${r.deEmprendimiento ? `<div class="kv"><span>De ${esc(pf.negocioNombre || 'tu emprendimiento')}</span><b class="num pos">${fmt(r.deEmprendimiento, { sign: true })}</b></div>` : ''}
        ${r.extra - r.deEmprendimiento > 0.004 ? `<div class="kv"><span>Otros ingresos</span><b class="num pos">${fmt(r.extra - r.deEmprendimiento, { sign: true })}</b></div>` : ''}
      </div>
      <h2 class="cap">Se va</h2>
      <div class="list a-rows">
        <div class="kv"><span>Cuotas de deudas</span><b class="num">${fmt(-r.cuotas)}</b></div>
        ${r.fijos ? `<div class="kv"><span>Gastos fijos</span><b class="num">${fmt(-r.fijos)}</b></div>` : ''}
        <div class="kv"><span>Gastos</span><b class="num">${fmt(-r.gastos)}</b></div>
        ${r.ahorro ? `<div class="kv"><span>${r.ahorroReal >= r.plan ? 'Apartado para metas' : 'Por apartar para metas'}</span><b class="num">${fmt(-r.ahorro)}</b></div>` : ''}
        <div class="kv"><b>Te queda</b><b class="num ${r.disponible < 0 ? 'neg' : 'pos'}">${fmt(r.disponible)}</b></div>
      </div>
      ${r.gastos ? monedaSplit('Tus gastos por moneda', r.porMoneda.usd, r.porMoneda.ves, r.porMoneda.vesUsd) : ''}
    </div>`;
  },
  detPagos() {
    const en30 = K.iso(new Date(Date.now() + 30 * 86400000));
    const prox = K.pagosDelPeriodo(S, { start: '0000-01-01', end: en30 }).filter((x) => !x.pagado).map((x) => ({ ...x, atrasada: x.fecha < K.today() }));
    return `${head('Próximos pagos')}
    <div class="scroll">
      <p style="margin:4px 0 0;color:var(--muted)">Lo que vence en los próximos 30 días. Toca uno para pagarlo completo o abonar.</p>
      ${prox.length ? `<div class="list a-rows" style="margin-top:12px">${prox.map((x) => { const d = K.parse(x.fecha); return `
        <button class="row" data-act="deudaSheet" data-id="${x.deudaId}">
          <div class="date-badge"><b class="${x.atrasada ? 'neg' : ''}">${d.getDate()}</b><span>${K.MESES[d.getMonth()]}</span></div>
          <div class="main"><div class="t">${esc(x.nombre)}</div><div class="s">${x.atrasada ? '<span class="neg" style="font-weight:800">Atrasada · </span>' : ''}${x.total ? `Cuota ${x.n} de ${x.total}` : 'Pago'}</div></div>
          <span class="amt num">${fmt(x.monto)}</span></button>`; }).join('')}</div>`
        : emptyState(S.deudas.some((d) => d.activa) ? 'No tienes pagos en estos 30 días.' : '¡Sin deudas! Si compras algo a crédito, lo anoto aquí.')}
      <a class="row" href="#" data-act="push" data-v="historial" style="margin-top:14px;border-bottom:0;font-weight:800"><span class="main">Ver lo que deberé por ${nomP()}</span><span class="chev">${icon('chev', 18, 2.4)}</span></a>
    </div>`;
  },
  historial() {
    const pr = K.proyeccion(S, 6);
    return `${head('')}
    <div class="scroll">
      <h1 style="margin:0 0 4px;font-size:26px;font-weight:800">Lo que deberé por ${nomP()}</h1>
      <p style="margin:0 0 10px;color:var(--muted)">Con un ingreso de ${fmt(S.perfil.ingreso)}${S.perfil.fijos?.length ? ', tus gastos fijos' : ''}${S.perfil.apartar ? ` y ${fmt(S.perfil.apartar)} para metas` : ''}.</p>
      <table class="proj">
        <thead><tr><th scope="col" style="text-align:left">${nomP()[0].toUpperCase() + nomP().slice(1)}</th><th scope="col" class="r">Debo</th><th scope="col" class="r">Me queda</th></tr></thead>
        <tbody>${pr.map((x, i) => {
          const open = UI.histOpen === i;
          return `<tr class="${open ? 'cur' : ''}"><th scope="row"><button data-act="histOpen" data-i="${i}" aria-expanded="${open}">${x.p.label}${i === 0 ? ' <small style="color:var(--brand-strong)">· actual</small>' : ''}</button></th>
            <td class="r num" style="font-weight:800">${fmt(x.debo)}</td><td class="r num pos" style="font-weight:800">${fmt(x.queda)}</td></tr>
            ${open ? `<tr class="cur detail"><td colspan="3">${x.pagos.length ? x.pagos.map((pp) => `<div><span>${K.fmtDate(pp.fecha)} · ${esc(pp.nombre)}${pp.total ? ` (${pp.n}/${pp.total})` : ''}${pp.pagado ? ' · <b class="pos">pagado</b>' : ''}</span><span class="num">${fmt(pp.monto)}</span></div>`).join('') : '<div><span>Sin pagos de deudas</span></div>'}
              ${x.fijos ? `<div><span>Gastos fijos</span><span class="num">${fmt(x.fijos)}</span></div>` : ''}${x.apartar ? `<div><span>Para metas</span><span class="num">${fmt(x.apartar)}</span></div>` : ''}</td></tr>` : ''}`;
        }).join('')}</tbody>
      </table>
      <p style="margin:16px 0 0;font-size:14px;color:var(--muted);line-height:1.45">${finales()}</p>
      <button class="btn ghost block" style="margin-top:22px" data-act="exportProy">${icon('dl', 20, 2.2)} Exportar a Excel</button>
    </div>`;
  },

  ajustes() {
    const p = S.perfil;
    return `${head('Ajustes', '<button class="text-btn strong" data-act="saveAjustes">Guardar</button>')}
    <div class="scroll">
      <div class="field"><label for="aj-nombre">Tu nombre</label><input class="input" id="aj-nombre" value="${esc(p.nombre)}" maxlength="40"></div>
      <div class="field"><label for="aj-freq">Cobro</label><select class="input" id="aj-freq">
        ${[['semanal', 'Semanal'], ['quincenal', 'Quincenal'], ['mensual', 'Mensual'], ['variable', 'Variable']].map(([v, t]) => `<option value="${v}" ${p.frecuencia === v ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
      <div class="field"><span class="lbl">Te pagan en</span>${segHtml('aj-ing-moneda', [['USD', 'Dólares'], ['VES', 'Bolívares']], p.ingresoMoneda || 'USD', 'Moneda del sueldo')}</div>
      <div class="field"><label for="aj-ingreso">Sueldo por ${nomP()}</label><div class="money"><span id="aj-ing-sym">${p.ingresoMoneda === 'VES' ? 'Bs' : '$'}</span><input id="aj-ingreso" inputmode="decimal" value="${moneyVal(p.ingreso)}"></div></div>
      <div class="field"><label for="aj-apartar">Apartar para metas por ${nomP()}</label><div class="money"><span>${p.moneda}</span><input id="aj-apartar" inputmode="decimal" value="${moneyVal(p.apartar)}"></div></div>
      <h2 class="cap">Gastos fijos al mes</h2>
      <div class="list" id="aj-fijos">${(p.fijos || []).map((f) => fijoRow(f)).join('')}</div>
      <button class="btn link" data-act="addFijoRow">${icon('plus', 18, 2.6)} Agregar gasto fijo</button>
      <h2 class="cap">Emprendimiento o negocio</h2>
      <div class="field" style="margin-top:6px"><label for="aj-uso">¿Llevas también un emprendimiento o negocio?</label><select class="input" id="aj-uso">
        ${[['personal', 'No, solo lo personal'], ['emprendimiento', 'Sí, un emprendimiento'], ['negocio', 'Sí, un negocio']].map(([v, t]) => `<option value="${v}" ${p.uso === v ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
      <div class="field"><label for="aj-neg">Nombre</label><input class="input" id="aj-neg" value="${esc(p.negocioNombre || '')}" maxlength="50" placeholder="Ej: Tortas de Mamá Luisa"></div>
      <div class="err" id="aj-err" role="alert"></div>
      <h2 class="cap">Comparte KOING</h2>
      <div class="list">
        ${!INST.instalada() && (INST.puedeInstalar() || INST.esIOS) ? `<button class="row" data-act="instalarApp"><span class="main"><span class="t" style="display:block">Instalar KOING en este dispositivo</span><span class="s">Se abre como app, sin buscar el link</span></span><span class="chev">${icon('dl', 18)}</span></button>` : ''}<button class="row" data-act="invitar"><span class="main"><span class="t" style="display:block">Invitar a un amigo</span><span class="s">Por WhatsApp o copiando el enlace</span></span><span class="chev">${icon('chev', 18)}</span></button></div>
      <h2 class="cap">Tu cuenta</h2>
      <div class="list">
        <div class="row"><span class="main"><span class="t" style="display:block">${esc(S.user.email)}</span><span class="s">Sesión iniciada</span></span></div>
        <button class="row" data-act="verIntro"><span class="main">Ver la presentación otra vez</span><span class="chev">${icon('chev', 18)}</span></button>
        <button class="row" data-act="rehacerPreguntas"><span class="main">Responder las preguntas de nuevo</span><span class="chev">${icon('chev', 18)}</span></button>
        <button class="row" data-act="exportCsv"><span class="main">Exportar mis movimientos (Excel)</span><span class="chev">${icon('dl', 18)}</span></button>
        <button class="row" data-act="logout"><span class="main">Cerrar sesión</span></button>
        <button class="row" data-act="borrarCuenta"><span class="main neg">Eliminar mi cuenta y mis datos</span></button>
      </div>
    </div>`;
  },

  formGasto(v = {}) {
    const neg = v.espacio === 'negocio';
    const cats = neg ? ['Mercancía', 'Insumos', 'Alquiler', 'Servicios', 'Nómina', 'Transporte', 'Publicidad', 'Mantenimiento', 'Impuestos', 'Otros']
      : ['Comida', 'Mercado', 'Transporte', 'Servicios', 'Salud', 'Casa', 'Ropa', 'Tecnología', 'Ocio', 'Educación', 'Regalos', 'Otros'];
    const metodos = neg ? [['efectivo', 'Efectivo'], ['pago_movil', 'Pago móvil'], ['punto', 'Punto'], ['zelle', 'Zelle']]
      : [['debito', 'Débito'], ['efectivo', 'Efectivo'], ['pago_movil', 'Pago móvil'], ['credito', 'A crédito']];
    return `${head(neg ? 'Gasto del negocio' : 'Nuevo gasto', '<button class="text-btn strong" data-act="saveGasto">Guardar</button>')}
    <form class="scroll" data-form="gasto" novalidate>
      ${amountHero('g')}
      <div class="form-rows">
        <div class="form-row"><label for="g-desc">Descripción</label><input id="g-desc" placeholder="Ej: Audífonos" maxlength="60"></div>
        <div class="form-row"><label for="g-cat">Categoría</label><select id="g-cat">${cats.map((c) => `<option>${c}</option>`).join('')}</select></div>
        <div class="form-row"><label for="g-fecha">Fecha</label><input id="g-fecha" type="date" value="${K.today()}" max="${K.today()}"></div>
      </div>
      <div class="field"><span class="lbl">¿Cómo pagaste?</span>
        ${segHtml('g-metodo', metodos, metodos[0][0], 'Método de pago')}
      </div>
      <div id="g-credito" hidden>
        <div class="form-rows">
          <div class="form-row"><label for="g-cuotas">Cuotas</label><input id="g-cuotas" inputmode="numeric" value="4"></div>
          <div class="form-row"><label for="g-freq">Se paga</label><select id="g-freq"><option value="quincenal">Cada quincena</option><option value="mensual">Cada mes</option><option value="semanal">Cada semana</option></select></div>
          <div class="form-row"><label for="g-primer">Primer pago</label><input id="g-primer" type="date" value="${K.nextDate(K.today(), 'quincenal')}"></div>
        </div>
      </div>
      <p class="hint" id="g-hint" style="color:var(--muted);font-size:14px;margin:8px 0 0">${neg ? 'Sale de la caja del negocio, no de tu disponible personal.' : 'Si eliges «A crédito» te pido cuotas y lo anoto en Deudas.'}</p>
      <div class="err" id="g-err" role="alert"></div>
      <button class="btn block" style="margin-top:8px">Guardar gasto</button>
    </form>`;
  },

  formIngreso() {
    return `${head('Nuevo ingreso', '<button class="text-btn strong" data-act="saveIngreso">Guardar</button>')}
    <form class="scroll" data-form="ingreso" novalidate>
      ${amountHero('i')}
      <div class="form-rows">
        <div class="form-row"><label for="i-desc">Descripción</label><input id="i-desc" placeholder="Ej: Trabajo extra" maxlength="60"></div>
        <div class="form-row"><label for="i-fecha">Fecha</label><input id="i-fecha" type="date" value="${K.today()}"></div>
      </div>
      <p style="color:var(--muted);font-size:14px">Tu sueldo de ${fmtM(S.perfil.ingreso, S.perfil.ingresoMoneda)} ya se cuenta solo cada ${nomP()}. Aquí anotas lo extra.</p>
      <div class="err" id="i-err" role="alert"></div>
      <button class="btn block" style="margin-top:8px">Guardar ingreso</button>
    </form>`;
  },

  formPago(v) {
    const act = S.deudas.filter((d) => d.activa);
    const sel = v.id || act[0]?.id;
    const d = act.find((x) => x.id === sel);
    return `${head('Registrar pago')}
    <form class="scroll" data-form="pago" novalidate>
      ${act.length ? `
      <fieldset class="radio-list" style="margin-top:12px"><legend class="lbl" style="font-weight:700;margin-bottom:8px">¿Qué pagaste?</legend>
        ${act.map((x) => `<label><input type="radio" name="p-deuda" value="${x.id}" ${x.id === sel ? 'checked' : ''} data-act="pagoPick"><span>${esc(x.nombre)}${x.abonado ? `<small style="display:block;font-weight:600">abonado ${fmt(x.abonado)}</small>` : ''}</span><small class="num">${fmt(pendienteCuota(x))} · ${K.fmtDate(x.proximoPago)}</small></label>`).join('')}
      </fieldset>
      <div class="field"><span class="lbl">¿Cuánto vas a pagar?</span>${segHtml('p-tipo', [['completo', 'La cuota completa'], ['parcial', 'Un abono']], 'completo', 'Tipo de pago')}</div>
      <div class="field"><span class="lbl">¿En qué moneda pagaste?</span>${monedaSeg('p-moneda')}</div>
      <div class="field" data-amount="p"><label for="p-monto">Monto pagado</label><div class="money"><span id="p-sym">$</span><input id="p-monto" inputmode="decimal" value="${moneyVal(d ? pendienteCuota(d) : 0)}"></div><div class="conv" id="p-conv" style="text-align:left"></div>
        <p class="hint" id="p-hint" style="margin:4px 0 0;font-size:14px;font-weight:700;color:var(--brand-strong)"></p></div>
      <div class="field"><span class="lbl">¿Cómo pagaste?</span>${segHtml('p-metodo', [['debito', 'Débito'], ['efectivo', 'Efectivo'], ['pago_movil', 'Pago móvil']], 'pago_movil', 'Método de pago')}</div>
      <div class="field"><label for="p-fecha">Fecha</label><input class="input" id="p-fecha" type="date" value="${K.today()}"></div>
      <div class="err" id="p-err" role="alert"></div>
      <button class="btn block" style="margin-top:14px">Registrar pago</button>`
      : emptyState('No tienes deudas activas para pagar.')}
    </form>`;
  },

  formDeuda(v) {
    const d = v.id ? S.deudas.find((x) => x.id === v.id) : null;
    const x = d || { nombre: '', tipo: 'cuotas', frecuencia: 'quincenal', cuota: 0, cuotasTotal: null, cuotasPagadas: 0, saldo: null, proximoPago: K.today() };
    return `${head(d ? 'Editar deuda' : 'Nueva deuda', '<button class="text-btn strong" data-act="saveDeuda">Guardar</button>')}
    <form class="scroll" data-form="deuda" novalidate>
      <div class="field"><label for="d-nombre">Nombre</label><input class="input" id="d-nombre" value="${esc(x.nombre)}" placeholder="Ej: Cashea nevera" maxlength="60"></div>
      <div class="field"><span class="lbl">Tipo</span>${segHtml('d-tipo', [['cuotas', 'Cuotas'], ['tarjeta', 'Tarjeta'], ['prestamo', 'Préstamo'], ['otro', 'Otro']], x.tipo, 'Tipo de deuda')}</div>
      <div class="field"><label for="d-cuota" id="d-cuota-lbl">${x.tipo === 'tarjeta' ? 'Pago mínimo' : 'Cuota'}</label><div class="money"><span>${S.perfil.moneda}</span><input id="d-cuota" inputmode="decimal" value="${moneyVal(x.cuota)}"></div></div>
      <div class="field"><span class="lbl">¿Cada cuánto se paga?</span>${segHtml('d-freq', [['semanal', 'Semanal'], ['quincenal', 'Quincenal'], ['mensual', 'Mensual']], x.frecuencia, 'Frecuencia')}</div>
      <div id="d-cuotas-box" ${x.tipo === 'tarjeta' ? 'hidden' : ''}>
        <div class="form-rows">
          <div class="form-row"><label for="d-total">Cuotas totales</label><input id="d-total" inputmode="numeric" value="${x.cuotasTotal ?? ''}" placeholder="Ej: 6"></div>
          <div class="form-row"><label for="d-pagadas">Ya pagadas</label><input id="d-pagadas" inputmode="numeric" value="${x.cuotasPagadas || 0}"></div>
        </div>
      </div>
      <div class="field"><label for="d-saldo">${x.tipo === 'tarjeta' ? 'Saldo que debes hoy' : 'Saldo (opcional)'}</label><div class="money"><span>${S.perfil.moneda}</span><input id="d-saldo" inputmode="decimal" value="${x.saldo !== null && x.saldo !== undefined ? moneyVal(x.saldo) : ''}" placeholder="Opcional"></div></div>
      <div class="field"><label for="d-prox">Próximo pago</label><input class="input" id="d-prox" type="date" value="${x.proximoPago}"></div>
      <p class="hint" id="d-hint" style="color:var(--muted);font-size:14px;margin-top:12px"></p>
      <div class="err" id="d-err" role="alert"></div>
      <button class="btn block" style="margin-top:6px">${d ? 'Guardar cambios' : 'Agregar deuda'}</button>
    </form>`;
  },

  formMeta(v) {
    const m = v.id ? S.metas.find((x) => x.id === v.id) : null;
    const x = m || { nombre: '', precio: 0, apartado: 0, tipo: UI.metaTipo };
    return `${head(m ? 'Editar meta' : 'Nueva meta', '<button class="text-btn strong" data-act="saveMeta">Guardar</button>')}
    <form class="scroll" data-form="meta" novalidate>
      <div class="field"><label for="m-nombre">¿Qué es?</label><input class="input" id="m-nombre" value="${esc(x.nombre)}" placeholder="Ej: Laptop para trabajar" maxlength="60"></div>
      <div class="field"><label for="m-precio">Precio</label><div class="money"><span>${S.perfil.moneda}</span><input id="m-precio" inputmode="decimal" value="${moneyVal(x.precio)}"></div></div>
      <div class="field"><label for="m-ya">Ya tengo apartado</label><div class="money"><span>${S.perfil.moneda}</span><input id="m-ya" inputmode="decimal" value="${moneyVal(x.apartado)}" placeholder="0,00"></div></div>
      <div class="field"><span class="lbl">¿Lo necesitas o lo quieres?</span>${segHtml('m-tipo', [['necesito', 'Lo necesito'], ['quiero', 'Lo quiero']], x.tipo, 'Tipo')}</div>
      <div class="err" id="m-err" role="alert"></div>
      <button class="btn block" style="margin-top:18px">${m ? 'Guardar cambios' : 'Agregar meta'}</button>
    </form>`;
  }
};
// Monto grande con selector $/Bs y su equivalencia
function amountHero(px, mon = store.get('koing_mon') || 'USD') {
  return `<div style="display:flex;justify-content:center;margin-top:14px">${monedaSeg(px + '-moneda', mon)}</div>
    <div class="amount-hero" data-amount="${px}"><label for="${px}-monto">Monto</label>
      <div class="wrap"><span id="${px}-sym">${mon === 'VES' ? 'Bs' : '$'}</span><input id="${px}-monto" inputmode="decimal" placeholder="0,00" autocomplete="off"></div>
      <div class="conv" id="${px}-conv"></div></div>`;
}
// Lee un monto de un formulario: devuelve { monto (original), moneda, tasa, usd }
function leerMonto(px) {
  const moneda = segVal(px + '-moneda') || 'USD';
  const monto = parseMoney($(`#${px}-monto`).value);
  const tasa = K.tasaDe(S) || null;
  const usdV = moneda === 'VES' ? (tasa ? r2(monto / tasa) : 0) : monto;
  return { monto, moneda, tasa: moneda === 'VES' ? tasa : (tasa || null), usd: usdV };
}
function actualizarConv(px) {
  const conv = $(`#${px}-conv`); if (!conv) return;
  const { monto, moneda } = leerMonto(px);
  const sym = $(`#${px}-sym`); if (sym) sym.textContent = moneda === 'VES' ? 'Bs' : '$';
  const t = K.tasaDe(S);
  conv.textContent = !monto ? '' : !t ? (moneda === 'VES' ? 'Pon la tasa del día para convertir' : '') : (moneda === 'VES' ? `≈ ${fmt(monto / t)} · tasa ${fmtBs(t)}` : `≈ ${fmtBs(monto * t)} · tasa ${fmtBs(t)}`);
}
const pendienteCuota = (d) => r2(Math.max(0, d.cuota - (d.abonado || 0)));
// Explica qué hace el monto escrito: completa la cuota, queda como abono o adelanta cuotas
function pagoHint() {
  const h = $('#p-hint'); if (!h) return;
  const d = S.deudas.find((x) => x.id === $('input[name=p-deuda]:checked')?.value);
  const { usd: v } = leerMonto('p');
  if (!d || !v) { h.textContent = ''; return; }
  const total = r2((d.abonado || 0) + v);
  const k = d.cuota ? Math.floor((total + 0.009) / d.cuota) : 1;
  if (k === 0) h.textContent = `Queda como abono. Te faltarán ${fmt(d.cuota - total)} para completar la cuota.`;
  else if (k === 1 || d.tipo === 'tarjeta') h.textContent = total - d.cuota > 0.009 && d.tipo !== 'tarjeta' ? `Completa la cuota y abona ${fmt(total - d.cuota)} a la siguiente.` : 'Completa la cuota.';
  else h.textContent = `Cubre ${k} cuotas${total - k * d.cuota > 0.009 ? ` y abona ${fmt(total - k * d.cuota)} a la siguiente` : ''}.`;
}
function actualizarCaja(el, tachada) {
  const c = S.cajas[0]; const ah = cajaAhorrado(c);
  el.classList.toggle('tachada', tachada); el.setAttribute('aria-pressed', String(tachada));
  if (tachada) { el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); }
  $('#caja-total').textContent = fmt(ah);
  $('#caja-bar').style.width = `${(ah / c.meta) * 100}%`;
  const quedan = c.numeros.length - c.tachados.length;
  $('#caja-sub').textContent = quedan ? `${quedan} casillas por tachar · faltan ${fmt(c.meta - ah)}` : '¡Caja llena! Lo lograste.';
}
// Cerdito feliz con confeti
function celebrar(monto, total, meta, completa) {
  $$('.festejo').forEach((x) => x.remove());
  const el = document.createElement('div');
  el.className = 'festejo' + (completa ? ' grande' : '');
  el.setAttribute('role', 'status');
  const colores = ['#68754E', '#979E74', '#D3C4A7', '#7E8A57', '#E9C46A', '#4A5634', '#C9CDB0'];
  const n = completa ? 90 : 46;
  const piezas = Array.from({ length: n }, () => {
    const x = Math.random() * 100, d = Math.random() * 0.35, dur = 1.1 + Math.random() * 0.9, rot = Math.round(Math.random() * 720 - 360);
    const w = 6 + Math.random() * 6, h = Math.random() > 0.5 ? w : w * 0.45;
    return `<i style="left:${x}%;width:${w}px;height:${h}px;background:${colores[Math.floor(Math.random() * colores.length)]};animation-delay:${d}s;animation-duration:${dur}s;--r:${rot}deg;--x:${Math.round(Math.random() * 80 - 40)}px;${Math.random() > 0.7 ? 'border-radius:50%;' : ''}"></i>`;
  }).join('');
  el.innerHTML = `<div class="confeti" aria-hidden="true">${piezas}</div>
    <div class="festejo-card">
      <div class="festejo-pig">${pig({ size: completa ? 170 : 130, coin: 'none', feliz: true, label: 'Cerdito feliz' })}</div>
      <b>${completa ? '¡Llenaste tu caja!' : ['¡Bien hecho!', '¡Felicidades!', '¡Así se hace!', '¡Otro más!'][Math.floor(Math.random() * 4)]}</b>
      <span>${completa ? `Juntaste ${fmt(meta)}. Eres imparable.` : `+${fmt(monto)} · llevas ${fmt(total)} de ${fmt(meta)}`}</span>
    </div>`;
  document.body.appendChild(el);
  if (navigator.vibrate) { try { navigator.vibrate(completa ? [20, 60, 20, 60, 40] : 18); } catch (e) {} }
  const cerrar = () => { el.classList.add('out'); setTimeout(() => el.remove(), 250); };
  el.addEventListener('click', cerrar);
  setTimeout(cerrar, completa ? 3800 : 1700);
}
const fijoRow = (f = { nombre: '', monto: 0 }) => `<div class="row" data-fijo-row>
  <input class="input" style="flex:1;height:44px" aria-label="Nombre del gasto fijo" value="${esc(f.nombre)}" placeholder="Ej: Alquiler" maxlength="40">
  <div class="money" style="width:130px;height:44px"><span>${S.perfil.moneda}</span><input inputmode="decimal" aria-label="Monto al mes" value="${moneyVal(f.monto)}"></div>
  <button type="button" class="icon-btn" aria-label="Quitar" data-act="delFijoRow">${icon('x', 20)}</button></div>`;

function finales() {
  const act = S.deudas.filter((d) => d.activa);
  const msgs = act.map((d) => [d, K.fechaFin(d)]).filter(([, f]) => f).sort((a, b) => a[1].localeCompare(b[1])).slice(0, 3)
    .map(([d, f]) => `${esc(d.nombre)} termina el ${K.fmtDate(f)}`);
  const sinFin = act.filter((d) => !K.fechaFin(d)).map((d) => esc(d.nombre));
  return [msgs.join(', '), sinFin.length ? `${sinFin.join(', ')} no tiene${sinFin.length > 1 ? 'n' : ''} fecha de fin` : ''].filter(Boolean).join('. ') + (act.length ? '.' : 'No tienes deudas activas.');
}

// Comportamiento después de pintar vistas con formularios
const AFTER = {
  formPago() {
    actualizarConv('p'); pagoHint();
    const f = $('[data-form=pago]'); if (!f) return;
    f.addEventListener('input', pagoHint);
    f.addEventListener('seg', (e) => {
      if (e.target.id === 'p-tipo') {
        const d = S.deudas.find((x) => x.id === $('input[name=p-deuda]:checked')?.value);
        const t = K.tasaDe(S), enBs = segVal('p-moneda') === 'VES';
        if (segVal('p-tipo') === 'parcial') { $('#p-monto').value = ''; $('#p-monto').focus(); }
        else if (d) $('#p-monto').value = moneyVal(enBs && t ? r2(pendienteCuota(d) * t) : pendienteCuota(d));
        actualizarConv('p');
      }
      pagoHint();
    });
  },
  formGasto() {
    const upd = () => {
      const cred = segVal('g-metodo') === 'credito';
      $('#g-credito').hidden = !cred;
      if ((UI.stack[UI.stack.length - 1] || {}).espacio === 'negocio') return;
      const monto = leerMonto('g').usd, n = Math.max(1, parseInt($('#g-cuotas').value, 10) || 1);
      if (cred && monto) {
        const fake = { activa: true, cuota: r2(monto / n), cuotasTotal: n, cuotasPagadas: 0, saldo: monto, proximoPago: $('#g-primer').value || K.today(), frecuencia: $('#g-freq').value };
        $('#g-hint').textContent = `${n} cuota${n > 1 ? 's' : ''} de ${fmt(fake.cuota)} · terminas el ${K.fmtDate(K.fechaFin(fake), true)}`;
      } else $('#g-hint').textContent = cred ? 'Pon el monto total y en cuántas cuotas.' : 'Si eliges «A crédito» te pido cuotas y lo anoto en Deudas.';
    };
    $('[data-form=gasto]').addEventListener('input', upd);
    $('[data-form=gasto]').addEventListener('seg', upd);
    $('#g-freq').addEventListener('change', () => { $('#g-primer').value = K.nextDate(K.today(), $('#g-freq').value); upd(); });
    setTimeout(() => $('#g-monto').focus(), 320);
  },
  formIngreso() { setTimeout(() => $('#i-monto').focus(), 320); },
  formDeuda() {
    const upd = () => {
      const tipo = segVal('d-tipo');
      $('#d-cuotas-box').hidden = tipo === 'tarjeta';
      $('#d-cuota-lbl').textContent = tipo === 'tarjeta' ? 'Pago mínimo' : 'Cuota';
      const d = deudaFromForm();
      const fin = d.cuota ? K.fechaFin({ ...d, activa: true }) : null;
      $('#d-hint').textContent = fin ? `Terminas el ${K.fmtDate(fin, true)}. Restan ${fmt(K.restanteDeuda({ ...d, activa: true }))}.` : tipo === 'tarjeta' ? 'Las tarjetas no tienen fecha de fin: te muestro el pago mínimo cada periodo.' : '';
    };
    $('[data-form=deuda]').addEventListener('input', upd);
    $('[data-form=deuda]').addEventListener('seg', upd);
    upd();
  }
};
function deudaFromForm() {
  const tipo = segVal('d-tipo');
  const tot = parseInt($('#d-total').value, 10);
  const saldo = parseMoney($('#d-saldo').value);
  return {
    nombre: $('#d-nombre').value.trim(), tipo, frecuencia: segVal('d-freq'), cuota: parseMoney($('#d-cuota').value),
    cuotasTotal: tipo !== 'tarjeta' && tot > 0 ? tot : null, cuotasPagadas: tipo !== 'tarjeta' ? Math.max(0, parseInt($('#d-pagadas').value, 10) || 0) : 0,
    saldo: saldo || null, proximoPago: $('#d-prox').value || K.today()
  };
}

// ---------- Hojas ----------
function sheetNuevo() {
  $('.tabbar .fab')?.classList.add('open');
  openSheet(`<h2>¿Qué quieres anotar?</h2>
    <div class="list a-rows">
      <button class="row" data-act="sheetPush" data-v="formGasto"><span class="main"><span class="t" style="display:block">Un gasto</span><span class="s">Lo que compraste o pagaste hoy</span></span><span class="chev">${icon('chev', 18)}</span></button>
      <button class="row" data-act="sheetPush" data-v="formPago"><span class="main"><span class="t" style="display:block">Un pago de deuda</span><span class="s">Una cuota, la tarjeta o un préstamo</span></span><span class="chev">${icon('chev', 18)}</span></button>
      <button class="row" data-act="sheetPush" data-v="formIngreso"><span class="main"><span class="t" style="display:block">Un ingreso extra</span><span class="s">Tu sueldo ya se cuenta solo</span></span><span class="chev">${icon('chev', 18)}</span></button>
      <button class="row" data-act="sheetPush" data-v="formDeuda"><span class="main"><span class="t" style="display:block">Una deuda nueva</span><span class="s">Préstamo, tarjeta o compra en cuotas</span></span><span class="chev">${icon('chev', 18)}</span></button>
      <button class="row" data-act="sheetPush" data-v="formMeta"><span class="main"><span class="t" style="display:block">Algo que necesito o quiero</span><span class="s">Lo agrego a tus metas</span></span><span class="chev">${icon('chev', 18)}</span></button>
    </div>
    <div class="actions"><button class="btn ghost" data-act="closeSheet">Cancelar</button></div>`, { label: 'Registrar' });
}
function sheetDeuda(id) {
  const d = S.deudas.find((x) => x.id === id);
  if (!d) return;
  const fin = K.fechaFin(d);
  openSheet(`<h2>${esc(d.nombre)}</h2>
    <p style="color:var(--muted)">${tipoDeuda(d.tipo)}${d.activa ? '' : ' · pagada'}</p>
    <div class="list">
      <div class="kv"><span>${d.tipo === 'tarjeta' ? 'Pago mínimo' : 'Cuota'}</span><b class="num">${fmt(d.cuota)}</b></div>
      ${d.cuotasTotal ? `<div class="kv"><span>Cuotas</span><b>${d.cuotasPagadas || 0} de ${d.cuotasTotal} pagadas</b></div>` : ''}
      ${d.abonado ? `<div class="kv"><span>Abonado a la cuota actual</span><b class="num">${fmt(d.abonado)} · faltan ${fmt(pendienteCuota(d))}</b></div>` : ''}
      <div class="kv"><span>Te falta pagar</span><b class="num">${fmt(K.restanteDeuda(d))}</b></div>
      ${d.activa ? `<div class="kv"><span>Próximo pago</span><b>${K.fmtDate(d.proximoPago, true)}</b></div>` : ''}
      <div class="kv"><span>Terminas</span><b>${fin ? K.fmtDate(fin, true) : 'Sin fecha fin'}</b></div>
    </div>
    <div class="actions">
      ${d.activa ? `<button class="btn" data-act="sheetPush" data-v="formPago" data-id="${d.id}">Pagar cuota o abonar</button>` : ''}
      <button class="btn ghost" data-act="sheetPush" data-v="formDeuda" data-id="${d.id}">Editar</button>
      <button class="btn danger" data-act="confirmDel" data-col="deudas" data-id="${d.id}">Eliminar deuda</button>
    </div>`, { label: d.nombre });
}
function sheetMeta(id) {
  const m = S.metas.find((x) => x.id === id);
  if (!m) return;
  const lista = K.metasOrdenadas(S, m.tipo).filter((x) => !x.completada);
  const i = lista.findIndex((x) => x.id === id);
  const falta = Math.max(0, m.precio - (m.apartado || 0));
  openSheet(`<h2>${esc(m.nombre)}</h2>
    <div class="bar" style="height:10px;margin:10px 0"><span style="width:${m.precio ? Math.min(100, ((m.apartado || 0) / m.precio) * 100) : 0}%"></span></div>
    <div class="list">
      <div class="kv"><span>Precio</span><b class="num">${fmt(m.precio)}</b></div>
      <div class="kv"><span>Apartado</span><b class="num">${fmt(m.apartado || 0)}</b></div>
      <div class="kv"><span>Falta</span><b class="num">${fmt(falta)}</b></div>
    </div>
    ${!m.completada ? `<div class="field"><label for="ap-monto">Apartar ahora</label><div style="display:flex;gap:8px"><div class="money" style="flex:1"><span>${S.perfil.moneda}</span><input id="ap-monto" inputmode="decimal" value="${moneyVal(Math.min(falta, S.perfil.apartar || falta))}"></div><button class="btn small" data-act="apartar" data-id="${m.id}">Apartar</button></div>
      <span class="hint">Sale de tu disponible de esta ${nomP()}.</span></div>` : ''}
    <div class="actions">
      ${!m.completada && lista.length > 1 ? `<div class="row-actions">
        <button class="btn ghost" data-act="metaMove" data-id="${m.id}" data-v="-1" ${i <= 0 ? 'disabled' : ''}>${icon('up', 20, 2.4)} Subir</button>
        <button class="btn ghost" data-act="metaMove" data-id="${m.id}" data-v="1" ${i >= lista.length - 1 ? 'disabled' : ''}>${icon('down', 20, 2.4)} Bajar</button></div>` : ''}
      ${!m.completada ? `<button class="btn ghost" data-act="metaDone" data-id="${m.id}">${icon('check', 20, 2.6)} Ya lo compré</button>` : ''}
      <button class="btn ghost" data-act="sheetPush" data-v="formMeta" data-id="${m.id}">Editar</button>
      <button class="btn danger" data-act="confirmDel" data-col="metas" data-id="${m.id}">Eliminar</button>
    </div>`, { label: m.nombre });
}
function sheetMov(id) {
  const m = S.movimientos.find((x) => x.id === id) || S.negMovs.find((x) => x.id === id);
  if (!m) return;
  const tipo = { gasto: 'Gasto', ingreso: 'Ingreso', pago: 'Pago de deuda', ahorro: 'Apartado para meta', retiro: 'Pasado a lo personal', pago_proveedor: 'Pago a proveedor' }[m.tipo];
  const mon = m.moneda || 'USD';
  openSheet(`<h2>${esc(m.descripcion || m.categoria)}</h2>
    <div class="list" style="margin-top:8px">
      <div class="kv"><span>Monto</span><b class="num">${fmtM(m.monto, mon)}</b></div>
      ${mon === 'VES' && m.tasa ? `<div class="kv"><span>Tasa de ese día</span><b class="num">${fmtBs(m.tasa)} · ${equiv(m.monto, mon, m.tasa)}</b></div>` : ''}
      <div class="kv"><span>Tipo</span><b>${tipo}</b></div>
      ${m.tipo === 'gasto' ? `<div class="kv"><span>Categoría</span><b>${esc(m.categoria)}</b></div><div class="kv"><span>Pago</span><b>${METODO_TXT[m.metodo] || ''}</b></div>` : ''}
      <div class="kv"><span>Fecha</span><b>${K.fmtDate(m.fecha, true)}</b></div>
    </div>
    <p style="color:var(--muted);font-size:14px;margin-top:12px">${m.tipo === 'pago' ? 'Si lo borras, la cuota vuelve a quedar pendiente.' : m.creaDeuda ? 'Si lo borras, también se borra la deuda que creó.' : m.tipo === 'ahorro' ? 'Si lo borras, se descuenta de lo apartado en la meta.' : m.vinculoId ? 'Si lo borras, también se borra su pareja (la salida del negocio y la entrada en lo personal).' : m.tipo === 'pago_proveedor' ? 'Si lo borras, la deuda con el proveedor vuelve a como estaba.' : ''}</p>
    <div class="actions"><button class="btn danger" data-act="confirmDel" data-col="movimientos" data-id="${m.id}">Borrar movimiento</button>
    <button class="btn ghost" data-act="closeSheet">Cerrar</button></div>`, { label: 'Movimiento' });
}

// Alerta "si gastas esto…"
function sheetAlerta(rev) {
  return new Promise((resolve) => {
    openSheet(`
      <div style="display:flex;justify-content:center;margin:-4px 0 6px"><div class="pig-worry">${pig({ size: 90, coin: 'none', label: 'KOING te avisa' })}</div></div>
      <div class="alert-title"><span class="neg">${icon('warn', 28, 2.2)}</span><h2>${esc(rev.titulo)}</h2></div>
      <p style="font-size:17px;line-height:1.45;margin-top:10px">${rev.texto}</p>
      <div class="list">${rev.filas.map(([a, b, c]) => `<div class="kv"><span style="color:var(--muted)">${esc(a)}</span><b class="num ${c || ''}">${esc(b)}</b></div>`).join('')}</div>
      <div class="actions">
        <button class="btn" data-alert="no">Mejor no lo compro</button>
        <button class="btn ghost" data-alert="si">Registrar igual</button>
      </div>`, { label: rev.titulo });
    $$('[data-alert]', sheetEl).forEach((b) => b.addEventListener('click', async () => { await closeSheet(); resolve(b.dataset.alert === 'si'); }));
    $('.sheet-back', sheetEl).addEventListener('click', () => resolve(false), { once: true });
  });
}

function confirmar({ titulo, texto, ok = 'Eliminar' }) {
  return new Promise((resolve) => {
    openSheet(`<h2>${esc(titulo)}</h2><p style="color:var(--muted)">${texto}</p>
      <div class="actions"><button class="btn" style="background:var(--warn);color:#fff" data-c="1">${esc(ok)}</button><button class="btn ghost" data-c="0">Cancelar</button></div>`, { label: titulo });
    $$('[data-c]', sheetEl).forEach((b) => b.addEventListener('click', async () => { await closeSheet(); resolve(b.dataset.c === '1'); }));
    $('.sheet-back', sheetEl).addEventListener('click', () => resolve(false), { once: true });
  });
}

// ---------- Guardados ----------
function busy(btns, on) { $$(btns).forEach((b) => { b.disabled = on; }); }

async function saveGasto() {
  const err = $('#g-err');
  const top = UI.stack[UI.stack.length - 1] || {};
  const neg = top.espacio === 'negocio';
  const { monto, moneda, tasa, usd: montoUSD } = leerMonto('g');
  if (!monto) { err.textContent = 'Pon cuánto gastaste.'; $('#g-monto').focus(); return; }
  if (moneda === 'VES' && !tasa) { err.textContent = 'Primero pon la tasa del día (arriba en Inicio).'; return; }
  const metodo = segVal('g-metodo');
  const cred = metodo === 'credito';
  const cuotas = Math.max(1, parseInt($('#g-cuotas').value, 10) || 1);
  const body = {
    tipo: 'gasto', espacio: neg ? 'negocio' : 'personal', monto, moneda, tasa, descripcion: $('#g-desc').value.trim(), categoria: $('#g-cat').value, metodo, fecha: $('#g-fecha').value,
    credito: cred ? { cuotas, frecuencia: $('#g-freq').value, primerPago: $('#g-primer').value } : undefined
  };
  const rev = neg ? { mostrar: false } : K.revisarGasto(S, montoUSD, { credito: cred, cuotas });
  if (rev.mostrar) {
    const seguir = await sheetAlerta(rev);
    if (!seguir) { toast('Bien pensado. Tu meta sigue a salvo.'); back(); return; }
  }
  busy('[data-act=saveGasto], [data-form=gasto] .btn', true);
  try {
    const r = await api('/api/items?col=movimientos', { method: 'POST', body });
    addMov(r.item);
    if (r.deuda) S.deudas.push(r.deuda);
    back();
    toast(r.deuda ? `Anotado. Creé la deuda «${r.deuda.nombre}» en ${cuotas} cuotas.` : 'Gasto anotado');
  } catch (e) { err.textContent = e.message; busy('[data-act=saveGasto], [data-form=gasto] .btn', false); }
}
async function saveIngreso() {
  const err = $('#i-err');
  const { monto, moneda, tasa } = leerMonto('i');
  if (!monto) { err.textContent = 'Pon el monto.'; return; }
  if (moneda === 'VES' && !tasa) { err.textContent = 'Primero pon la tasa del día (arriba en Inicio).'; return; }
  busy('[data-act=saveIngreso], [data-form=ingreso] .btn', true);
  try {
    const r = await api('/api/items?col=movimientos', { method: 'POST', body: { tipo: 'ingreso', monto, moneda, tasa, descripcion: $('#i-desc').value.trim() || 'Ingreso extra', fecha: $('#i-fecha').value } });
    addMov(r.item);
    back();
    await showSuccess({ titulo: '¡Ingreso registrado!', texto: `Sumé <b>${fmtM(monto, moneda)}</b> a tu disponible. Ahora tienes ${fmt(K.resumen(S).disponible)}.` });
  } catch (e) { err.textContent = e.message; busy('[data-act=saveIngreso], [data-form=ingreso] .btn', false); }
}
async function savePago() {
  const err = $('#p-err');
  const id = $('input[name=p-deuda]:checked')?.value;
  const { monto, moneda, tasa } = leerMonto('p');
  if (!id) { err.textContent = 'Elige qué pagaste.'; return; }
  if (moneda === 'VES' && !tasa) { err.textContent = 'Primero pon la tasa del día (arriba en Inicio).'; return; }
  if (!monto) { err.textContent = 'Pon el monto pagado.'; return; }
  const antes = S.deudas.find((x) => x.id === id);
  busy('[data-form=pago] .btn', true);
  try {
    const r = await api(`/api/items?col=deudas&action=pagar&id=${id}`, { method: 'POST', body: { monto, moneda, tasa, fecha: $('#p-fecha').value, metodo: segVal('p-metodo') } });
    upsert(S.deudas, r.deuda);
    S.movimientos.unshift(r.movimiento);
    back();
    const d = r.deuda;
    const fin = K.fechaFin(d);
    if (r.parcial) {
      await showSuccess({
        titulo: '¡Abono registrado!',
        texto: `Abonaste <b>${fmtM(monto, moneda)}</b> a ${esc(d.nombre)}. Te faltan <b>${fmt(pendienteCuota(d))}</b> para completar la cuota del ${K.fmtDate(d.proximoPago)}.`,
        progFrom: ((antes.abonado || 0) / d.cuota) * 100, progTo: Math.min(100, (d.abonado / d.cuota) * 100),
        izq: `${fmt(d.abonado)} de ${fmt(d.cuota)}`, der: `Vence ${K.fmtDate(d.proximoPago)}`
      });
      return;
    }
    let prog = {};
    if (d.cuotasTotal) {
      prog = { progFrom: ((antes.cuotasPagadas || 0) / d.cuotasTotal) * 100, progTo: (d.cuotasPagadas / d.cuotasTotal) * 100, izq: `${d.cuotasPagadas} de ${d.cuotasTotal} pagadas`, der: d.activa && fin ? `Terminas el ${K.fmtDate(fin)}` : '¡Terminada!' };
    } else if (antes.saldo) {
      const pagado0 = 0, pagado1 = Math.min(100, ((antes.saldo - (d.saldo || 0)) / antes.saldo) * 100);
      prog = { progFrom: pagado0, progTo: pagado1, izq: `Saldo: ${fmt(d.saldo || 0)}`, der: d.activa ? '' : '¡Terminada!' };
    }
    await showSuccess({
      titulo: !d.activa ? '¡Deuda terminada!' : r.cuotasCubiertas > 1 ? `¡Pagaste ${r.cuotasCubiertas} cuotas!` : '¡Pago registrado!',
      texto: `${esc(d.nombre)}${d.cuotasTotal ? `, cuota ${d.cuotasPagadas} de ${d.cuotasTotal}` : ''} por <b>${fmtM(monto, moneda)}</b>.`,
      ...prog
    });
  } catch (e) { err.textContent = e.message; busy('[data-form=pago] .btn', false); }
}
async function saveDeuda() {
  const err = $('#d-err');
  const top = UI.stack[UI.stack.length - 1];
  const d = deudaFromForm();
  if (!d.nombre) { err.textContent = 'Ponle un nombre.'; $('#d-nombre').focus(); return; }
  if (!d.cuota) { err.textContent = 'Pon el monto de la cuota.'; $('#d-cuota').focus(); return; }
  if (d.tipo !== 'tarjeta' && !d.cuotasTotal && !d.saldo) { err.textContent = 'Pon las cuotas totales o el saldo, así sé hasta cuándo pagas.'; return; }
  if (d.cuotasTotal && d.cuotasPagadas >= d.cuotasTotal) d.activa = false; else d.activa = true;
  busy('[data-act=saveDeuda], [data-form=deuda] .btn', true);
  try {
    const r = top.id
      ? await api(`/api/items?col=deudas&id=${top.id}`, { method: 'PUT', body: d })
      : await api('/api/items?col=deudas', { method: 'POST', body: d });
    upsert(S.deudas, r.item);
    back();
    toast(top.id ? 'Deuda actualizada' : 'Deuda agregada');
  } catch (e) { err.textContent = e.message; busy('[data-act=saveDeuda], [data-form=deuda] .btn', false); }
}
async function saveMeta() {
  const err = $('#m-err');
  const top = UI.stack[UI.stack.length - 1];
  const body = { nombre: $('#m-nombre').value.trim(), precio: parseMoney($('#m-precio').value), apartado: parseMoney($('#m-ya').value), tipo: segVal('m-tipo') };
  if (!body.nombre) { err.textContent = 'Escribe qué es.'; return; }
  if (!body.precio) { err.textContent = 'Pon un precio aproximado.'; return; }
  busy('[data-act=saveMeta], [data-form=meta] .btn', true);
  try {
    const r = top.id
      ? await api(`/api/items?col=metas&id=${top.id}`, { method: 'PUT', body })
      : await api('/api/items?col=metas', { method: 'POST', body: { ...body, prioridad: S.metas.filter((m) => m.tipo === body.tipo).length } });
    upsert(S.metas, r.item);
    UI.metaTipo = body.tipo;
    back();
    toast(top.id ? 'Meta actualizada' : 'Meta agregada');
  } catch (e) { err.textContent = e.message; busy('[data-act=saveMeta], [data-form=meta] .btn', false); }
}
async function saveAjustes() {
  const err = $('#aj-err');
  const fijos = $$('[data-fijo-row]').map((r) => { const [n, m] = $$('input', r); return { nombre: n.value.trim(), monto: parseMoney(m.value) }; }).filter((f) => f.nombre && f.monto);
  const perfil = { ...S.perfil, nombre: $('#aj-nombre').value.trim(), frecuencia: $('#aj-freq').value, ingreso: parseMoney($('#aj-ingreso').value), ingresoMoneda: segVal('aj-ing-moneda') || 'USD', uso: $('#aj-uso').value, negocioNombre: $('#aj-neg').value.trim(), apartar: parseMoney($('#aj-apartar').value), fijos, onboarded: true };
  busy('[data-act=saveAjustes]', true);
  try {
    await api('/api/perfil', { method: 'PUT', body: { perfil } });
    S.perfil = { ...S.perfil, ...perfil };
    if (perfil.uso === 'personal') UI.espacio = 'personal';
    back();
    toast('Ajustes guardados');
  } catch (e) { err.textContent = e.message; busy('[data-act=saveAjustes]', false); }
}
async function savePerfilParcial(cambios) {
  const perfil = { ...S.perfil, ...cambios };
  await api('/api/perfil', { method: 'PUT', body: { perfil } });
  S.perfil = perfil;
}

// ---------- Exportar (CSV abre en Excel) ----------
function downloadCsv(name, rows) {
  const csv = '﻿' + rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
const numCsv = (n) => String(n).replace('.', ',');

// =====================================================
// EMPRENDIMIENTO / NEGOCIO
// =====================================================
const METODOS_VENTA = [['efectivo', 'Efectivo'], ['pago_movil', 'Pago móvil'], ['punto', 'Punto'], ['zelle', 'Zelle']];
const addDias = (iso, n) => { const d = K.parse(iso); d.setDate(d.getDate() + n); return K.iso(d); };
const nombreNeg = () => S.perfil.negocioNombre || (S.perfil.uso === 'negocio' ? 'Mi negocio' : 'Mi emprendimiento');
const horaAhora = () => { const d = new Date(); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
const hora12 = (h) => { const [H, M] = String(h || '12:00').split(':').map(Number); return `${((H + 11) % 12) + 1}:${String(M).padStart(2, '0')} ${H < 12 ? 'a. m.' : 'p. m.'}`; };
const DIA_CORTO = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
const provUSD = (p) => (p.moneda === 'VES' ? (K.tasaDe(S) ? r2(p.saldo / K.tasaDe(S)) : 0) : p.saldo);
function proveedoresPend() {
  const hoy = K.today(), sem = addDias(hoy, 7);
  const pend = S.proveedores.filter((p) => !p.pagado);
  return {
    pend, total: r2(pend.reduce((a, p) => a + provUSD(p), 0)),
    atrasados: pend.filter((p) => p.vence < hoy),
    semana: pend.filter((p) => p.vence >= hoy && p.vence <= sem),
    luego: pend.filter((p) => p.vence > sem)
  };
}
// Gráfica de barras simple (sin librerías)
function barras(items, { pico = true } = {}) {
  const max = Math.max(...items.map((x) => x.v), 0);
  const iPico = pico && max > 0 ? items.findIndex((x) => x.v === max) : -1;
  return `<div class="chart" role="img" aria-label="${esc(items.map((x) => `${x.lbl}: ${fmt(x.v)}`).join(', '))}" style="grid-template-columns:repeat(${items.length},minmax(0,1fr));gap:${items.length > 14 ? 2 : 8}px">
    ${items.map((x, i) => { const h = max ? Math.max(3, (x.v / max) * 100) : 3; return `<div class="col"><div class="area">${i === iPico ? `<span class="pk" style="bottom:calc(${h}% + 4px)">Pico</span>` : ''}<div class="b ${i === iPico ? 'top' : x.hoy ? 'hoy' : ''}" style="height:${h}%;animation-delay:${Math.min(i * 0.03, 0.3)}s"></div></div><span class="d">${x.lbl}</span></div>`; }).join('')}
  </div>`;
}
function ventaRow(v) {
  return `<button class="row" data-act="ventaSheet" data-id="${v.id}">
    <span class="main"><span class="t" style="display:block">${esc(v.descripcion || 'Venta')}</span><span class="s">${hora12(v.hora)} · ${METODO_TXT[v.metodo] || ''}</span></span>
    <span class="amt num">${fmtM(v.monto, v.moneda)}<small>${equiv(v.monto, v.moneda, v.tasa)}</small></span></button>`;
}
function provRow(p) {
  const d = K.parse(p.vence);
  const atras = !p.pagado && p.vence < K.today();
  return `<button class="row" data-act="provSheet" data-id="${p.id}">
    <div class="date-badge"><b class="${atras ? 'neg' : ''}">${d.getDate()}</b><span>${K.MESES[d.getMonth()]}</span></div>
    <span class="main"><span class="t" style="display:block">${esc(p.empresa)}</span><span class="s">${atras ? '<b class="neg">Vencido · </b>' : ''}${esc(p.concepto || '')}${p.saldo < p.monto && !p.pagado ? ` · abonado ${fmtM(r2(p.monto - p.saldo), p.moneda)}` : ''}</span></span>
    <span class="amt num">${p.pagado ? '<span class="paid-mark">Pagado</span>' : fmtM(p.saldo, p.moneda)}<small>${p.pagado ? fmtM(p.monto, p.moneda) : p.moneda === 'VES' ? equiv(p.saldo, 'VES') : 'en dólares'}</small></span></button>`;
}

const NTABVIEWS = {
  inicio() {
    const hoy = K.today();
    const st = K.statsNegocio(S, hoy, hoy);
    const sem = K.statsNegocio(S, addDias(hoy, -6), hoy);
    const mes = K.statsNegocio(S, hoy.slice(0, 8) + '01', hoy);
    const pv = proveedoresPend();
    const d = K.parse(hoy);
    const ult = S.ventas[0];
    const urg = pv.atrasados.length + pv.semana.length;
    return `
    <header class="hello">
      <div class="pig-float">${pig({ size: 40, label: 'KOING' })}</div>
      <div class="who"><b>${esc(nombreNeg())}</b><span>${K.DIAS_SEMANA[d.getDay()][0].toUpperCase() + K.DIAS_SEMANA[d.getDay()].slice(1)} ${K.fmtDate(hoy)}</span></div>
      <button class="icon-btn" aria-label="Ajustes" data-act="push" data-v="ajustes">${icon('gear', 24)}</button>
    </header>
    ${espacioBar()}
    <section class="hero" aria-label="Ventas de hoy">
      <div style="display:flex;justify-content:space-between;align-items:center"><span class="lbl">Vendido hoy</span>${verToggle()}</div>
      ${bigAmount(st.vendido, `${st.ventas.length} venta${st.ventas.length === 1 ? '' : 's'}`)}
      ${tasaMini()}
    </section>
    <div class="scroll">
      <ul class="menu a-rows">
        ${menuRow({ ic: 'wallet', t: 'Caja de hoy', s: `${fmt(st.cobradoUSD)} en $ · ${fmtBs(st.cobradoVES)} · te queda ${fmt(st.ganancia)}`, act: 'push', v: 'detCaja' })}
        ${menuRow({ ic: 'chart', t: 'Tu semana', s: sem.vendido ? `${fmt(sem.vendido)} vendidos${sem.mejorDia ? ` · mejor día ${sem.mejorDia.dia}` : ''}` : 'Aún sin ventas esta semana', act: 'tab', v: 'reportes' })}
        ${menuRow({ ic: 'store', t: 'Proveedores', s: urg ? `<span class="neg" style="font-weight:800">${urg} por pagar esta semana</span> · debes ${fmt(pv.total)}` : pv.pend.length ? `Debes ${fmt(pv.total)} · nada vence esta semana` : 'No le debes a nadie', act: 'tab', v: 'proveedores' })}
        ${menuRow({ ic: 'swap', t: 'Pasar ganancia a lo personal', s: `Ganancia del mes ${fmt(mes.ganancia)}${mes.retiros ? ` · ya pasaste ${fmt(mes.retiros)}` : ''}`, act: 'retiroSheet' })}
        ${menuRow({ ic: 'bag', t: 'Ventas', s: ult ? `${esc(ult.descripcion || 'Venta')} · ${fmtM(ult.monto, ult.moneda)} · ${hora12(ult.hora)}` : 'Toca + para anotar tu primera venta', act: 'tab', v: 'ventas' })}
      </ul>
    </div>`;
  },

  ventas() {
    const dia = addDias(K.today(), UI.ventasDia || 0);
    const st = K.statsNegocio(S, dia, dia);
    const ventas = [...st.ventas].sort((a, b) => b.hora.localeCompare(a.hora));
    const titulo = UI.ventasDia === 0 || !UI.ventasDia ? 'Hoy' : UI.ventasDia === -1 ? 'Ayer' : K.fmtDate(dia);
    return `
    <div class="page-title"><h1>Ventas</h1><button class="btn small" data-act="exportVentas">${icon('dl', 18, 2.4)} Excel</button></div>
    <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 8px 0">
      <button class="icon-btn" aria-label="Día anterior" data-act="ventasDia" data-v="-1">${icon('back', 22, 2.4)}</button>
      <b style="font-size:16px">${titulo}</b>
      <button class="icon-btn" aria-label="Día siguiente" data-act="ventasDia" data-v="1" ${(UI.ventasDia || 0) >= 0 ? 'disabled style="opacity:.3"' : ''}>${icon('chev', 22, 2.4)}</button>
    </div>
    <div class="scroll">
      <div class="trio">
        <div><div class="lbl">Vendiste</div><div class="v num">${fmt(st.vendido)}</div></div>
        <div><div class="lbl">En $</div><div class="v num">${fmt(st.cobradoUSD)}</div></div>
        <div><div class="lbl">En Bs</div><div class="v num" style="font-size:16px">${fmtBs(st.cobradoVES)}</div></div>
      </div>
      <h2 class="cap">${ventas.length} venta${ventas.length === 1 ? '' : 's'}</h2>
      ${ventas.length ? `<div class="list a-rows">${ventas.map(ventaRow).join('')}</div>` : emptyState('No hay ventas este día.')}
      ${st.movs.length ? `<h2 class="cap">Salidas del día</h2><div class="list a-rows">${st.movs.map(movRow).join('')}</div>` : ''}
    </div>`;
  },

  proveedores() {
    const pv = proveedoresPend();
    const pagados = S.proveedores.filter((p) => p.pagado);
    const verPag = UI.provFiltro === 'pagados';
    const semTotal = r2(pv.semana.reduce((a, p) => a + provUSD(p), 0) + pv.atrasados.reduce((a, p) => a + provUSD(p), 0));
    return `
    <div class="page-title"><h1>Proveedores</h1><button class="btn small" data-act="push" data-v="formProveedor">${icon('plus', 18, 2.6)} Agregar</button></div>
    <div class="scroll">
      <div class="split">
        <div><div class="lbl">Le debes en total</div><div class="v num">${fmt(pv.total)}</div>${K.tasaDe(S) ? `<div class="s" style="font-size:13px;color:var(--muted)">≈ ${fmtBs(pv.total * K.tasaDe(S))}</div>` : ''}</div>
        <div><div class="lbl">Vence esta semana</div><div class="v num ${semTotal ? 'neg' : ''}">${fmt(semTotal)}</div><div class="s" style="font-size:13px;color:var(--muted)">${pv.semana.length + pv.atrasados.length} pago${pv.semana.length + pv.atrasados.length === 1 ? '' : 's'}</div></div>
      </div>
      <div class="seg" role="tablist" aria-label="Estado" style="margin-top:18px">
        <button role="tab" aria-selected="${!verPag}" data-act="provFiltro" data-v="pendientes">Por pagar (${pv.pend.length})</button>
        <button role="tab" aria-selected="${verPag}" data-act="provFiltro" data-v="pagados">Pagados (${pagados.length})</button>
      </div>
      ${verPag
        ? (pagados.length ? `<div class="list a-rows" style="margin-top:14px">${pagados.map(provRow).join('')}</div>` : emptyState('Aún no has terminado de pagarle a ningún proveedor.'))
        : !pv.pend.length ? emptyState('No le debes a nadie. Cuando compres a crédito a un proveedor, anótalo aquí.')
        : [['Vencidos', pv.atrasados], ['Esta semana', pv.semana], ['Más adelante', pv.luego]].filter(([, l]) => l.length).map(([t, l]) => `<h2 class="cap">${t}</h2><div class="list a-rows">${l.map(provRow).join('')}</div>`).join('')}
      <p style="margin:14px 0 0;font-size:14px;color:var(--muted)">Toca un proveedor para registrar un pago completo o un abono.</p>
    </div>`;
  },

  reportes() {
    const hoy = K.today();
    const per = UI.repPer || 'mes';
    const desde = per === 'semana' ? addDias(hoy, -6) : per === 'mes' ? hoy.slice(0, 8) + '01' : hoy.slice(0, 5) + '01-01';
    const st = K.statsNegocio(S, desde, hoy);
    let items;
    if (per === 'semana') items = Array.from({ length: 7 }, (_, i) => { const f = addDias(hoy, i - 6); return { lbl: DIA_CORTO[K.parse(f).getDay()], v: st.porDia[f] || 0, hoy: i === 6 }; });
    else if (per === 'mes') { const n = K.parse(hoy).getDate(); items = Array.from({ length: n }, (_, i) => { const f = hoy.slice(0, 8) + String(i + 1).padStart(2, '0'); return { lbl: (i + 1) % 5 === 0 || i === 0 ? String(i + 1) : '', v: st.porDia[f] || 0, hoy: i === n - 1 }; }); }
    else { const m = K.parse(hoy).getMonth(); items = Array.from({ length: m + 1 }, (_, i) => { const pre = hoy.slice(0, 5) + String(i + 1).padStart(2, '0'); const v = Object.entries(st.porDia).filter(([f]) => f.startsWith(pre)).reduce((a, [, x]) => a + x, 0); return { lbl: K.MESES[i].slice(0, 1).toUpperCase(), v, hoy: i === m }; }); }
    const maxP = st.estrella[0]?.total || 0;
    const mesNom = K.MESES[K.parse(hoy).getMonth()];
    return `
    <div class="page-title"><h1>Reportes</h1><button class="btn small" data-act="exportVentas" data-desde="${desde}">${icon('dl', 18, 2.4)} Excel</button></div>
    <div class="scroll">
      <div class="seg" role="tablist" aria-label="Periodo" style="margin-top:14px">
        <button role="tab" aria-selected="${per === 'semana'}" data-act="repPer" data-v="semana">7 días</button>
        <button role="tab" aria-selected="${per === 'mes'}" data-act="repPer" data-v="mes">${mesNom[0].toUpperCase() + mesNom.slice(1)}</button>
        <button role="tab" aria-selected="${per === 'anio'}" data-act="repPer" data-v="anio">${hoy.slice(0, 4)}</button>
      </div>
      <div class="trio">
        <div><div class="lbl">Vendiste</div><div class="v num">${fmt(st.vendido)}</div></div>
        <div><div class="lbl">Gastaste</div><div class="v num">${fmt(st.gastos)}</div></div>
        <div><div class="lbl">Ganaste</div><div class="v num ${st.ganancia < 0 ? 'neg' : 'pos'}">${fmt(st.ganancia)}</div></div>
      </div>
      ${st.vendido ? `
      ${barras(items)}
      ${monedaSplit('Cómo te pagaron', st.cobradoUSD, st.cobradoVES, st.cobradoVESusd, ['Cobrado en dólares', 'Cobrado en bolívares'])}
      <h2 class="cap">Picos de venta</h2>
      <div class="list">
        ${st.mejorDia ? `<div class="row"><span class="main"><span style="display:block">Tu mejor día</span><span class="s">promedio ${fmt(st.mejorDia.prom)} por ${st.mejorDia.dia}</span></span><b>${st.mejorDia.dia[0].toUpperCase() + st.mejorDia.dia.slice(1)}</b></div>` : ''}
        ${st.mejorHora ? `<div class="row"><span class="main"><span style="display:block">Tu mejor hora</span><span class="s">${st.mejorHora.pct}% de lo que vendes</span></span><b>${hora12(String(st.mejorHora.desde).padStart(2, '0') + ':00').replace(':00', '')} a ${hora12(String(st.mejorHora.hasta % 24).padStart(2, '0') + ':00').replace(':00', '')}</b></div>` : ''}
        ${st.peorDia && st.peorDia.dia !== st.mejorDia?.dia ? `<div class="row"><span class="main"><span style="display:block">Tu día más flojo</span><span class="s">promedio ${fmt(st.peorDia.prom)}</span></span><b>${st.peorDia.dia[0].toUpperCase() + st.peorDia.dia.slice(1)}</b></div>` : ''}
      </div>
      <h2 class="cap">Productos estrella</h2>
      <ol class="list a-rows" style="padding:0">
        ${st.estrella.map((p, i) => `<li class="row" style="flex-direction:column;align-items:stretch;gap:6px">
          <span style="display:flex;gap:10px;align-items:baseline"><b style="width:18px;color:var(--brand-strong)">${i + 1}</b><span class="main t">${esc(p.nombre)}</span><span class="s">${p.n} venta${p.n === 1 ? '' : 's'}</span><b class="num">${fmt(p.total)}</b></span>
          <span class="bar ${i ? 'sage' : ''}" style="margin-left:28px;height:6px"><span style="width:${maxP ? (p.total / maxP) * 100 : 0}%"></span></span></li>`).join('')}
      </ol>
      <p style="font-size:13px;color:var(--muted)">Los productos se agrupan por cómo escribes la venta. Usa las sugerencias al anotar para que se sumen bien.</p>`
      : emptyState('Aún no hay ventas en este periodo.')}
    </div>`;
  }
};

// ---------- Formularios del negocio ----------
Object.assign(VIEWS, {
  detCaja() {
    const hoy = K.today();
    const st = K.statsNegocio(S, hoy, hoy);
    const sem = K.statsNegocio(S, addDias(hoy, -6), hoy);
    const dias = Array.from({ length: 7 }, (_, i) => { const f = addDias(hoy, i - 6); return { lbl: i === 6 ? 'Hoy' : DIA_CORTO[K.parse(f).getDay()], v: sem.porDia[f] || 0, hoy: i === 6 }; });
    return `${head('Caja de hoy')}
    <div class="scroll">
      <div class="list a-rows" style="margin-top:8px">
        <div class="row"><span class="cur-tag usd">USD</span><span class="main">Cobrado en dólares</span><b class="num">${fmt(st.cobradoUSD)}</b></div>
        <div class="row"><span class="cur-tag ves">VES</span><span class="main"><span style="display:block">Cobrado en bolívares</span>${st.cobradoVES ? `<span class="s">≈ ${fmt(st.cobradoVESusd)}</span>` : ''}</span><b class="num">${fmtBs(st.cobradoVES)}</b></div>
        <div class="kv"><span>Gastos del negocio hoy</span><b class="num">${fmt(-st.gastos)}</b></div>
        <div class="kv"><b>Te queda hoy</b><b class="num ${st.ganancia < 0 ? 'neg' : 'pos'}" style="font-size:17px">${fmt(st.ganancia)}</b></div>
      </div>
      <div class="section-h"><h2>Últimos 7 días</h2></div>
      ${sem.vendido ? barras(dias) : emptyState('Cuando registres ventas, aquí verás tus días fuertes.')}
    </div>`;
  },
  formVenta() {
    return `${head('Nueva venta')}
    <form class="scroll" data-form="venta" novalidate autocomplete="off">
      ${amountHero('v')}
      <div class="field"><label for="v-desc">¿Qué vendiste?</label><input class="input" id="v-desc" maxlength="60" placeholder="Ej: Arepa reina" autocomplete="off">
        <ul class="suggest" id="v-sug" role="listbox" aria-label="Sugerencias" hidden></ul></div>
      <div class="field"><span class="lbl">¿Cómo te pagaron?</span>${segHtml('v-metodo', METODOS_VENTA, store.get('koing_vmet') || 'efectivo', 'Método de pago')}</div>
      <div class="form-rows">
        <div class="form-row"><label for="v-fecha">Fecha</label><input id="v-fecha" type="date" value="${K.today()}" max="${K.today()}"></div>
        <div class="form-row"><label for="v-hora">Hora</label><input id="v-hora" type="time" value="${horaAhora()}"></div>
      </div>
      <div class="err" id="v-err" role="alert"></div>
      <button class="btn block" style="margin-top:8px" data-otra="0">Registrar venta</button>
      <button type="button" class="btn link block" data-act="ventaOtra">Registrar y anotar otra</button>
    </form>`;
  },
  formProveedor(v) {
    const p = v.id ? S.proveedores.find((x) => x.id === v.id) : null;
    const x = p || { empresa: '', concepto: '', monto: 0, moneda: 'USD', vence: addDias(K.today(), 7) };
    return `${head(p ? 'Editar proveedor' : 'Nuevo proveedor', '<button class="text-btn strong" data-act="saveProveedor">Guardar</button>')}
    <form class="scroll" data-form="proveedor" novalidate>
      <div class="field"><label for="pr-emp">Empresa o proveedor</label><input class="input" id="pr-emp" value="${esc(x.empresa)}" maxlength="60" placeholder="Ej: Distribuidora Los Andes"></div>
      <div class="field"><label for="pr-con">¿Qué te vendió? (opcional)</label><input class="input" id="pr-con" value="${esc(x.concepto)}" maxlength="80" placeholder="Ej: Harina y granos, factura 0821"></div>
      <div class="field"><span class="lbl">¿En qué moneda le debes?</span>${monedaSeg('pr-moneda', x.moneda)}</div>
      <div class="field" data-amount="pr"><label for="pr-monto">${p ? 'Monto total' : '¿Cuánto le debes?'}</label><div class="money"><span id="pr-sym">${x.moneda === 'VES' ? 'Bs' : '$'}</span><input id="pr-monto" inputmode="decimal" value="${moneyVal(x.monto)}"></div><div class="conv" id="pr-conv" style="text-align:left"></div></div>
      <div class="field"><label for="pr-vence">¿Cuándo vence?</label><input class="input" id="pr-vence" type="date" value="${x.vence}"></div>
      <div class="err" id="pr-err" role="alert"></div>
      <button class="btn block" style="margin-top:18px">${p ? 'Guardar cambios' : 'Agregar'}</button>
    </form>`;
  },
  formPagoProv(v) {
    const p = S.proveedores.find((x) => x.id === v.id);
    if (!p) return `${head('Pago')}<div class="scroll">${emptyState('No encontré ese proveedor.')}</div>`;
    return `${head('Pagar a proveedor')}
    <form class="scroll" data-form="pagoProv" novalidate>
      <div class="list" style="margin-top:12px">
        <div class="kv"><span>Proveedor</span><b>${esc(p.empresa)}</b></div>
        <div class="kv"><span>Le debes</span><b class="num">${fmtM(p.saldo, p.moneda)}</b></div>
      </div>
      <div class="field"><span class="lbl">¿En qué moneda pagaste?</span>${monedaSeg('pp-moneda', p.moneda)}</div>
      <div class="field" data-amount="pp"><label for="pp-monto">Monto pagado</label><div class="money"><span id="pp-sym">${p.moneda === 'VES' ? 'Bs' : '$'}</span><input id="pp-monto" inputmode="decimal" value="${moneyVal(p.saldo)}"></div><div class="conv" id="pp-conv" style="text-align:left"></div>
        <span class="hint">Si pagas menos, queda como abono y el resto sigue pendiente.</span></div>
      <div class="field"><span class="lbl">¿Cómo pagaste?</span>${segHtml('pp-metodo', [['efectivo', 'Efectivo'], ['pago_movil', 'Pago móvil'], ['transferencia', 'Transferencia'], ['zelle', 'Zelle']], 'pago_movil', 'Método')}</div>
      <div class="field"><label for="pp-fecha">Fecha</label><input class="input" id="pp-fecha" type="date" value="${K.today()}"></div>
      <div class="err" id="pp-err" role="alert"></div>
      <button class="btn block" style="margin-top:14px">Registrar pago</button>
    </form>`;
  }
});
Object.assign(AFTER, {
  formVenta() { actualizarConv('v'); setTimeout(() => $('#v-monto')?.focus(), 320); },
  formProveedor() { actualizarConv('pr'); },
  formPagoProv() { actualizarConv('pp'); }
});

// ---------- Hojas del negocio ----------
function sheetNuevoNeg() {
  $('.tabbar .fab')?.classList.add('open');
  openSheet(`<h2>¿Qué quieres anotar?</h2>
    <div class="list a-rows">
      <button class="row" data-act="sheetPush" data-v="formVenta"><span class="main"><span class="t" style="display:block">Una venta</span><span class="s">En dólares o en bolívares</span></span><span class="chev">${icon('chev', 18)}</span></button>
      <button class="row" data-act="sheetPush" data-v="formGasto" data-espacio="negocio"><span class="main"><span class="t" style="display:block">Un gasto del ${S.perfil.uso === 'negocio' ? 'negocio' : 'emprendimiento'}</span><span class="s">Mercancía, insumos, servicios…</span></span><span class="chev">${icon('chev', 18)}</span></button>
      <button class="row" data-act="sheetPush" data-v="formProveedor"><span class="main"><span class="t" style="display:block">Una deuda con un proveedor</span><span class="s">A qué empresa le debes y cuándo vence</span></span><span class="chev">${icon('chev', 18)}</span></button>
      <button class="row" data-act="retiroSheet"><span class="main"><span class="t" style="display:block">Pasar ganancia a lo personal</span><span class="s">Se suma a tus ingresos personales</span></span><span class="chev">${icon('swap', 20)}</span></button>
    </div>
    <div class="actions"><button class="btn ghost" data-act="closeSheet">Cancelar</button></div>`, { label: 'Registrar' });
}
function sheetVenta(id) {
  const v = S.ventas.find((x) => x.id === id);
  if (!v) return;
  openSheet(`<h2>${esc(v.descripcion || 'Venta')}</h2>
    <div class="list" style="margin-top:8px">
      <div class="kv"><span>Monto</span><b class="num">${fmtM(v.monto, v.moneda)}</b></div>
      ${v.moneda === 'VES' && v.tasa ? `<div class="kv"><span>Tasa de ese día</span><b class="num">${fmtBs(v.tasa)} · ${equiv(v.monto, 'VES', v.tasa)}</b></div>` : ''}
      <div class="kv"><span>Cobro</span><b>${METODO_TXT[v.metodo] || ''}</b></div>
      <div class="kv"><span>Fecha</span><b>${K.fmtDate(v.fecha, true)} · ${hora12(v.hora)}</b></div>
    </div>
    <div class="actions"><button class="btn danger" data-act="confirmDel" data-col="ventas" data-id="${v.id}">Borrar venta</button>
    <button class="btn ghost" data-act="closeSheet">Cerrar</button></div>`, { label: 'Venta' });
}
function sheetProv(id) {
  const p = S.proveedores.find((x) => x.id === id);
  if (!p) return;
  const pagos = S.negMovs.filter((m) => m.proveedorId === id);
  openSheet(`<h2>${esc(p.empresa)}</h2>
    <p style="color:var(--muted)">${esc(p.concepto || '')}</p>
    <div class="list">
      <div class="kv"><span>Total</span><b class="num">${fmtM(p.monto, p.moneda)}</b></div>
      <div class="kv"><span>Te falta pagar</span><b class="num">${fmtM(p.saldo, p.moneda)}</b></div>
      <div class="kv"><span>Vence</span><b class="${!p.pagado && p.vence < K.today() ? 'neg' : ''}">${K.fmtDate(p.vence, true)}</b></div>
      ${pagos.length ? `<div class="kv"><span>Pagos hechos</span><b>${pagos.length}</b></div>` : ''}
    </div>
    <div class="actions">
      ${!p.pagado ? `<button class="btn" data-act="sheetPush" data-v="formPagoProv" data-id="${p.id}">Registrar pago o abono</button>` : ''}
      <button class="btn ghost" data-act="sheetPush" data-v="formProveedor" data-id="${p.id}">Editar</button>
      <button class="btn danger" data-act="confirmDel" data-col="proveedores" data-id="${p.id}">Eliminar</button>
    </div>`, { label: p.empresa });
}
function sheetRetiro() {
  const hoy = K.today();
  const mes = K.statsNegocio(S, hoy.slice(0, 8) + '01', hoy);
  const sug = Math.max(0, r2(mes.ganancia - mes.retiros));
  openSheet(`<h2>Pasar ganancia a lo personal</h2>
    <p style="color:var(--muted)">Sale de ${esc(nombreNeg())} y entra como ingreso en tus finanzas personales, así ves cuánto te deja tu ${S.perfil.uso === 'negocio' ? 'negocio' : 'emprendimiento'}.</p>
    <div class="list"><div class="kv"><span>Ganancia del mes</span><b class="num">${fmt(mes.ganancia)}</b></div>${mes.retiros ? `<div class="kv"><span>Ya pasaste</span><b class="num">${fmt(mes.retiros)}</b></div>` : ''}</div>
    <div class="field">${monedaSeg('rt-moneda', 'USD')}</div>
    <div class="field" data-amount="rt"><label for="rt-monto">¿Cuánto pasas?</label><div class="money"><span id="rt-sym">$</span><input id="rt-monto" inputmode="decimal" value="${moneyVal(sug)}"></div><div class="conv" id="rt-conv" style="text-align:left"></div></div>
    <div class="err" id="rt-err" role="alert"></div>
    <div class="actions"><button class="btn" data-act="saveRetiro">Pasar a lo personal</button><button class="btn ghost" data-act="closeSheet">Cancelar</button></div>`, { label: 'Pasar ganancia', onOpen: () => actualizarConv('rt') });
}
function sheetInvitar() {
  const url = location.origin;
  const msg = `Estoy usando KOING para llevar mis cuentas en $ y Bs, mis deudas y lo que quiero comprar. Es gratis: ábrela y te pide instalarla con un toque: ${url}`;
  openSheet(`<h2>Invita a un amigo</h2>
    <p style="color:var(--muted)">Así le llega (lo puedes cambiar antes de enviar):</p>
    <div class="bubble" style="margin-top:6px;min-height:0;padding:16px"><p style="font-size:15px">${esc(msg)}</p></div>
    <div class="actions">
      <a class="btn" href="https://wa.me/?text=${encodeURIComponent(msg)}" target="_blank" rel="noopener">Enviar por WhatsApp</a>
      ${navigator.share ? `<button class="btn ghost" data-act="compartir">${icon('share', 20)} Compartir por otra app</button>` : ''}
      <button class="btn ghost" data-act="copiarLink">${icon('copy', 20)} Copiar enlace</button>
    </div>`, { label: 'Invitar' });
}

// ---------- Guardar (negocio) ----------
async function saveVenta(otra = false) {
  const err = $('#v-err');
  const { monto, moneda, tasa } = leerMonto('v');
  if (!monto) { err.textContent = 'Pon cuánto cobraste.'; $('#v-monto').focus(); return; }
  if (moneda === 'VES' && !tasa) { err.textContent = 'Primero pon la tasa del día (arriba en Inicio).'; return; }
  const metodo = segVal('v-metodo');
  store.set('koing_vmet', metodo);
  const body = { monto, moneda, tasa, descripcion: $('#v-desc').value.trim(), metodo, fecha: $('#v-fecha').value, hora: $('#v-hora').value || horaAhora() };
  busy('[data-form=venta] .btn', true);
  try {
    const r = await api('/api/items?col=ventas', { method: 'POST', body });
    S.ventas.unshift(r.item);
    const hoyTot = K.statsNegocio(S, K.today(), K.today()).vendido;
    if (otra) {
      busy('[data-form=venta] .btn', false);
      $('#v-monto').value = ''; $('#v-desc').value = ''; $('#v-hora').value = horaAhora(); $('#v-sug').hidden = true; err.textContent = '';
      actualizarConv('v'); $('#v-monto').focus();
      toast(`Venta anotada · hoy llevas ${fmt(hoyTot)}`);
    } else {
      back();
      toast(`Venta anotada · hoy llevas ${fmt(hoyTot)}`);
    }
  } catch (e) { err.textContent = e.message; busy('[data-form=venta] .btn', false); }
}
async function saveProveedor() {
  const err = $('#pr-err');
  const top = UI.stack[UI.stack.length - 1];
  const { monto, moneda } = leerMonto('pr');
  const body = { empresa: $('#pr-emp').value.trim(), concepto: $('#pr-con').value.trim(), monto, moneda, vence: $('#pr-vence').value };
  if (!body.empresa) { err.textContent = 'Pon el nombre del proveedor.'; return; }
  if (!monto) { err.textContent = 'Pon cuánto le debes.'; return; }
  if (top.id) {
    const old = S.proveedores.find((x) => x.id === top.id);
    const abonado = old ? r2(old.monto - old.saldo) : 0;
    body.saldo = Math.max(0, r2(monto - abonado));
    body.pagado = body.saldo <= 0;
  }
  busy('[data-act=saveProveedor], [data-form=proveedor] .btn', true);
  try {
    const r = top.id ? await api(`/api/items?col=proveedores&id=${top.id}`, { method: 'PUT', body }) : await api('/api/items?col=proveedores', { method: 'POST', body });
    upsert(S.proveedores, r.item);
    S.proveedores.sort((a, b) => a.vence.localeCompare(b.vence));
    back();
    toast(top.id ? 'Proveedor actualizado' : 'Deuda con proveedor anotada');
  } catch (e) { err.textContent = e.message; busy('[data-act=saveProveedor], [data-form=proveedor] .btn', false); }
}
async function savePagoProv() {
  const err = $('#pp-err');
  const top = UI.stack[UI.stack.length - 1];
  const { monto, moneda, tasa } = leerMonto('pp');
  if (!monto) { err.textContent = 'Pon el monto pagado.'; return; }
  const antes = S.proveedores.find((x) => x.id === top.id);
  if (moneda !== antes.moneda && !tasa) { err.textContent = 'Para pagar en otra moneda necesito la tasa del día.'; return; }
  busy('[data-form=pagoProv] .btn', true);
  try {
    const r = await api(`/api/items?col=proveedores&action=pagar&id=${top.id}`, { method: 'POST', body: { monto, moneda, tasa, metodo: segVal('pp-metodo'), fecha: $('#pp-fecha').value } });
    upsert(S.proveedores, r.proveedor);
    addMov(r.movimiento);
    back();
    const p = r.proveedor;
    await showSuccess({
      titulo: p.pagado ? '¡Proveedor pagado!' : '¡Abono registrado!',
      texto: `${esc(p.empresa)}: pagaste <b>${fmtM(monto, moneda)}</b>.`,
      progFrom: ((antes.monto - antes.saldo) / antes.monto) * 100, progTo: ((p.monto - p.saldo) / p.monto) * 100,
      izq: p.pagado ? 'Pagado completo' : `Falta ${fmtM(p.saldo, p.moneda)}`, der: p.pagado ? '' : `Vence ${K.fmtDate(p.vence)}`
    });
  } catch (e) { err.textContent = e.message; busy('[data-form=pagoProv] .btn', false); }
}
async function saveRetiro() {
  const err = $('#rt-err');
  const { monto, moneda, tasa } = leerMonto('rt');
  if (!monto) { err.textContent = 'Pon el monto.'; return; }
  if (moneda === 'VES' && !tasa) { err.textContent = 'Primero pon la tasa del día.'; return; }
  busy('.sheet .btn', true);
  try {
    const r = await api('/api/items?col=movimientos&action=retiro', { method: 'POST', body: { monto, moneda, tasa, fecha: K.today(), nombreNegocio: nombreNeg() } });
    addMov(r.salida); addMov(r.entrada);
    await closeSheet(); goTabRefresh();
    await showSuccess({ titulo: '¡A tu bolsillo!', texto: `Pasaste <b>${fmtM(monto, moneda)}</b> de ${esc(nombreNeg())} a tus finanzas personales.` });
  } catch (e) { err.textContent = e.message; busy('.sheet .btn', false); }
}

// ---------- Recuperar clave ----------
function renderForgot(msg = '', ok = false) {
  tabEl.innerHTML = '';
  appEl.innerHTML = `
    <main class="intro a-fade">
      <button class="icon-btn" aria-label="Volver" data-act="authBack">${icon('back', 24, 2.2)}</button>
      <div class="pig-stage" style="height:160px"><div class="pig-float">${pig({ size: 130 })}</div>${shadow(100)}</div>
      <h1 style="margin:16px 0 6px;font-size:28px;font-weight:800;text-align:center">¿Olvidaste tu clave?</h1>
      <p style="margin:0 0 18px;text-align:center;color:var(--muted)">Te mando un enlace a tu correo para crear una nueva. Vence en 30 minutos.</p>
      ${ok ? `<div class="bubble a-bounce" style="min-height:0"><h1 style="font-size:20px">Revisa tu correo</h1><p style="font-size:16px">Si ese correo tiene cuenta en KOING, te llegó un enlace. Mira también en spam o promociones.</p></div>`
      : `<form data-form="forgot" novalidate>
        <div class="field"><label for="f-email">Correo de tu cuenta</label><input class="input" id="f-email" type="email" inputmode="email" autocomplete="email" required></div>
        <div class="err" role="alert">${esc(msg)}</div>
        <button class="btn block" style="margin-top:6px">Enviarme el enlace</button>
      </form>`}
    </main>`;
}
function renderReset(tok, msg = '') {
  tabEl.innerHTML = '';
  appEl.innerHTML = `
    <main class="intro a-fade">
      <div class="pig-stage" style="height:160px"><div class="pig-float">${pig({ size: 130 })}</div>${shadow(100)}</div>
      <h1 style="margin:16px 0 6px;font-size:28px;font-weight:800;text-align:center">Crea tu nueva clave</h1>
      <form data-form="reset" data-token="${esc(tok)}" novalidate>
        <div class="field"><label for="r-pass">Nueva clave</label><input class="input" id="r-pass" type="password" autocomplete="new-password" minlength="6" required><span class="hint">Mínimo 6 caracteres.</span></div>
        <div class="field"><label for="r-pass2">Repítela</label><input class="input" id="r-pass2" type="password" autocomplete="new-password" minlength="6" required></div>
        <div class="err" role="alert">${esc(msg)}</div>
        <button class="btn block" style="margin-top:6px">Guardar y entrar</button>
      </form>
    </main>`;
}

// =====================================================
// ACCIONES (delegación de eventos)
// =====================================================
const pushParams = (el) => ({ ...(el.dataset.id ? { id: el.dataset.id } : {}), ...(el.dataset.espacio ? { espacio: el.dataset.espacio } : {}) });
const ACT = {
  reload: () => location.reload(),
  introNext: () => { introStep = Math.min(3, introStep + 1); renderIntro(false); },
  introPrev: () => { introStep = Math.max(0, introStep - 1); renderIntro(false); },
  introEnd: () => { store.set('koing_intro', '1'); if (S.perfil?.onboarded && token.get()) { renderApp('a-fade'); } else renderAuth(); },
  authMode: (el) => { authMode = el.dataset.v; renderAuth(); },
  segPick: (el) => {
    const g = el.closest('.seg');
    $$('button', g).forEach((b) => b.setAttribute('aria-checked', String(b === el)));
    g.dispatchEvent(new Event('seg', { bubbles: true }));
  },
  obBack: () => { obCollect(); UI.ob.step--; UI.ob.dir = -1; renderOnboarding(); },
  obNext: () => obNext(false),
  obSkip: () => { if (UI.ob.step === 5) UI.ob.d.tieneDeudas = false; if (UI.ob.step === 7) UI.ob.d.metas = []; obNext(true); },
  obUso: (el) => {
    const box = $('#ob-neg-box'); box.hidden = el.value === 'personal';
    $('label', box).textContent = `¿Cómo se llama tu ${el.value === 'negocio' ? 'negocio' : 'emprendimiento'}?`;
    if (!box.hidden) setTimeout(() => $('#ob-neg').focus(), 30);
  },
  obDeudas: (el) => { UI.ob.d.tieneDeudas = el.dataset.v === 'si'; renderOnboarding(); UI.ob.dir = 1; },
  obAddDeuda: () => obAddDeuda(),
  obDelDeuda: (el) => { UI.ob.d.deudas.splice(+el.dataset.i, 1); renderOnboarding(); },
  obAddMeta: () => obAddMeta(),
  obDelMeta: (el) => { UI.ob.d.metas.splice(+el.dataset.i, 1); renderOnboarding(); },
  obFijoToggle: (el) => { const m = el.parentElement.querySelector('.money'); m.hidden = !el.checked; if (el.checked) setTimeout(() => $('input', m).focus(), 30); },
  obAddFijo: () => {
    const n = $('#ob-otro').value.trim(); if (!n) return;
    obCollect(); UI.ob.d.fijos.push({ nombre: n, monto: 0 });
    renderOnboarding();
    const inp = $(`[data-nombre="${CSS.escape(n)}"]`); inp && inp.focus();
  },

  tab: (el) => { if (UI.stack.length) { UI.stack = []; UI.tab = el.dataset.v; return renderApp('a-fade'); } goTab(el.dataset.v); },
  push: (el) => push(el.dataset.v, pushParams(el)),
  back: () => back(),
  nuevo: () => (esNeg() ? sheetNuevoNeg() : sheetNuevo()),
  closeSheet: () => { $('.tabbar .fab')?.classList.remove('open'); closeSheet(); },
  sheetPush: async (el) => { $('.tabbar .fab')?.classList.remove('open'); await closeSheet(); push(el.dataset.v, pushParams(el)); },
  deudaSheet: (el) => sheetDeuda(el.dataset.id),
  metaSheet: (el) => sheetMeta(el.dataset.id),
  movSheet: (el) => sheetMov(el.dataset.id),
  deudaFiltro: (el) => { UI.deudaFiltro = el.dataset.v; goTabRefresh(); },
  metaTipo: (el) => { const dir = el.dataset.v === 'quiero' ? 'a-inR' : 'a-inL'; UI.metaTipo = el.dataset.v; goTabRefresh(); const l = $('#metas-lista'); l && l.classList.add(dir); },
  movPer: (el) => { UI.movOffset = Math.min(0, UI.movOffset + Number(el.dataset.v)); appEl.innerHTML = `<div class="screen ${Number(el.dataset.v) > 0 ? 'a-inR' : 'a-inL'}">${TABVIEWS.movimientos()}</div>`; },
  histOpen: (el) => { const i = +el.dataset.i; UI.histOpen = UI.histOpen === i ? -1 : i; appEl.innerHTML = `<div class="screen">${VIEWS.historial()}</div>`; },
  pagoPick: (el) => { const d = S.deudas.find((x) => x.id === el.value); if (d && segVal('p-tipo') !== 'parcial') { const t = K.tasaDe(S); $('#p-monto').value = moneyVal(segVal('p-moneda') === 'VES' && t ? r2(pendienteCuota(d) * t) : pendienteCuota(d)); actualizarConv('p'); } pagoHint(); },
  toggleAvisos: async (el) => { try { await savePerfilParcial({ avisos: el.checked }); toast(el.checked ? 'Te aviso antes de gastar' : 'Avisos apagados', false); } catch (e) { el.checked = !el.checked; toast(e.message, false); } },
  apartarPlanSheet: () => {
    openSheet(`<h2>¿Cuánto apartar cada ${nomP()}?</h2><p style="color:var(--muted)">Con esto calculo cuándo llegas a cada meta.</p>
      <div class="money"><span>${S.perfil.moneda}</span><input id="plan-monto" inputmode="decimal" value="${moneyVal(S.perfil.apartar)}"></div>
      <div class="actions"><button class="btn" data-act="savePlan">Guardar</button><button class="btn ghost" data-act="closeSheet">Cancelar</button></div>`, { label: 'Apartar' });
  },
  savePlan: async () => { try { await savePerfilParcial({ apartar: parseMoney($('#plan-monto').value) }); await closeSheet(); goTabRefresh(); toast('Listo, recalculé tus metas'); } catch (e) { toast(e.message, false); } },
  apartar: async (el) => {
    const monto = parseMoney($('#ap-monto').value); if (!monto) return;
    try {
      const r = await api('/api/items?col=movimientos', { method: 'POST', body: { tipo: 'ahorro', monto, metaId: el.dataset.id, fecha: K.today() } });
      S.movimientos.unshift(r.item); if (r.meta) upsert(S.metas, r.meta);
      await closeSheet(); goTabRefresh();
      const m = r.meta;
      await showSuccess({ titulo: '¡Apartado!', texto: `Guardé <b>${fmt(monto)}</b> para ${esc(m.nombre)}.`, progFrom: ((m.apartado - monto) / m.precio) * 100, progTo: Math.min(100, (m.apartado / m.precio) * 100), izq: `${fmt(m.apartado)} de ${fmt(m.precio)}`, der: m.apartado >= m.precio ? '¡Ya te alcanza!' : `Faltan ${fmt(m.precio - m.apartado)}` });
    } catch (e) { toast(e.message, false); }
  },
  metaMove: async (el) => {
    const m = S.metas.find((x) => x.id === el.dataset.id);
    const lista = K.metasOrdenadas(S, m.tipo).filter((x) => !x.completada);
    const i = lista.findIndex((x) => x.id === m.id), j = i + Number(el.dataset.v);
    if (j < 0 || j >= lista.length) return;
    [lista[i], lista[j]] = [lista[j], lista[i]];
    lista.forEach((x, k) => { x.prioridad = k; });
    await closeSheet(); goTabRefresh();
    try { await api('/api/items?col=metas&action=reordenar', { method: 'POST', body: { ids: lista.map((x) => x.id) } }); } catch (e) { toast(e.message, false); }
  },
  metaDone: async (el) => {
    try {
      const r = await api(`/api/items?col=metas&id=${el.dataset.id}`, { method: 'PUT', body: { completada: true } });
      upsert(S.metas, r.item); await closeSheet(); goTabRefresh();
      await showSuccess({ titulo: '¡Lo lograste!', texto: `Marcaste <b>${esc(r.item.nombre)}</b> como comprada. A por la siguiente.` });
    } catch (e) { toast(e.message, false); }
  },
  confirmDel: async (el) => {
    const { col, id } = el.dataset;
    await closeSheet();
    const ok = await confirmar({ titulo: '¿Seguro que quieres borrarlo?', texto: 'Esto no se puede deshacer.' });
    if (!ok) return;
    try {
      const r = await api(`/api/items?col=${col}&id=${id}`, { method: 'DELETE' });
      if (col === 'movimientos') {
        const fuera = (x) => x.id !== id && x.id !== r.vinculoBorrado;
        S.movimientos = S.movimientos.filter(fuera); S.negMovs = S.negMovs.filter(fuera);
      } else S[col] = S[col].filter((x) => x.id !== id);
      if (r.proveedor) upsert(S.proveedores, r.proveedor);
      if (r.deuda) upsert(S.deudas, r.deuda);
      if (r.meta) upsert(S.metas, r.meta);
      if (r.deudaBorrada) S.deudas = S.deudas.filter((x) => x.id !== r.deudaBorrada);
      if (col === 'deudas') S.movimientos.forEach((m) => { if (m.deudaId === id) m.deudaId = null; });
      goTabRefresh();
      toast('Borrado', false);
    } catch (e) { toast(e.message, false); }
  },
  espacio: (el) => {
    if (UI.espacio === el.dataset.v) return;
    UI.espacio = el.dataset.v; store.set('koing_espacio', UI.espacio); UI.tab = 'inicio'; UI.stack = [];
    renderApp(UI.espacio === 'negocio' ? 'a-inR' : 'a-inL');
    contarMontos(appEl);
  },
  ver: (el) => { UI.ver = el.dataset.v; store.set('koing_ver', UI.ver); goTabRefresh(); },
  tasaSheet: () => sheetTasa(),
  saveTasa: async () => {
    const v = parseMoney($('#tasa-man').value);
    if (!v) return;
    try { await savePerfilParcial({ tasaManual: { valor: v, fecha: K.today() } }); aplicarTasa(null); await closeSheet(); goTabRefresh(); toast(`Usando ${fmtBs(v)} por $ hoy`, false); } catch (e) { toast(e.message, false); }
  },
  usarBCV: async () => {
    try { await savePerfilParcial({ tasaManual: null }); aplicarTasa(null); await closeSheet(); goTabRefresh(); toast('Usando la tasa del BCV', false); } catch (e) { toast(e.message, false); }
  },
  ventaSheet: (el) => sheetVenta(el.dataset.id),
  provSheet: (el) => sheetProv(el.dataset.id),
  retiroSheet: async () => { $('.tabbar .fab')?.classList.remove('open'); await closeSheet(); sheetRetiro(); },
  saveRetiro: () => saveRetiro(),
  ventaOtra: () => saveVenta(true),
  saveProveedor: () => saveProveedor(),
  sugPick: (el) => { $('#v-desc').value = el.dataset.v; $('#v-sug').hidden = true; $('#v-monto').value || $('#v-monto').focus(); },
  ventasDia: (el) => { UI.ventasDia = Math.min(0, (UI.ventasDia || 0) + Number(el.dataset.v)); appEl.innerHTML = `<div class="screen ${Number(el.dataset.v) > 0 ? 'a-inR' : 'a-inL'}">${NTABVIEWS.ventas()}</div>`; },
  provFiltro: (el) => { UI.provFiltro = el.dataset.v; goTabRefresh(); },
  repPer: (el) => { UI.repPer = el.dataset.v; goTabRefresh(); },
  exportVentas: (el) => {
    const desde = el.dataset.desde || '0000-01-01';
    const rows = [['Fecha', 'Hora', 'Descripción', 'Cobro', 'Moneda', 'Monto', 'Tasa', 'Monto en $']];
    S.ventas.filter((v) => v.fecha >= desde).forEach((v) => rows.push([v.fecha, v.hora, v.descripcion, METODO_TXT[v.metodo] || v.metodo, v.moneda === 'VES' ? 'Bs' : '$', numCsv(v.monto), v.tasa ? numCsv(v.tasa) : '', numCsv(K.usd(v, S))]));
    downloadCsv(`koing-ventas-${K.today()}.csv`, rows);
  },
  invitar: () => sheetInvitar(),
  cajaCrear: async (el) => {
    const meta = Number($('input[name=caja-meta]:checked')?.value || 500);
    el.disabled = true;
    try {
      const r = await api('/api/items?col=cajas', { method: 'POST', body: { meta } });
      S.cajas.unshift(r.item); UI.cajaNueva = false;
      appEl.innerHTML = `<div class="screen a-fade">${VIEWS.caja()}</div>`;
      $$('.caja .celda').forEach((b, i) => { b.style.animationDelay = Math.min(i * 0.012, 0.8) + 's'; b.classList.add('celda-in'); });
    } catch (e) { $('#caja-err').textContent = e.message; el.disabled = false; }
  },
  cajaNueva: () => { UI.cajaNueva = true; appEl.innerHTML = `<div class="screen a-fade">${VIEWS.caja()}</div>`; },
  cajaCancelarNueva: () => { UI.cajaNueva = false; appEl.innerHTML = `<div class="screen a-fade">${VIEWS.caja()}</div>`; },
  cajaTachar: async (el) => {
    const c = S.cajas[0]; const i = Number(el.dataset.i);
    const ya = c.tachados.includes(i);
    if (ya) {
      const ok = await confirmar({ titulo: `¿Destachar ${fmt(c.numeros[i])}?`, texto: 'Úsalo si lo tachaste por error.', ok: 'Destachar' });
      if (!ok) return;
    }
    // Lo marcamos al instante y luego guardamos
    const antes = [...c.tachados];
    c.tachados = ya ? c.tachados.filter((x) => x !== i) : [...c.tachados, i];
    actualizarCaja(el, !ya);
    if (!ya) celebrar(c.numeros[i], cajaAhorrado(c), c.meta, c.tachados.length === c.numeros.length);
    try {
      const r = await api(`/api/items?col=cajas&action=tachar&id=${c.id}`, { method: 'POST', body: { i, valor: !ya } });
      S.cajas[0] = r.item;
    } catch (e) { c.tachados = antes; actualizarCaja(el, ya); toast(e.message, false); }
  },
  instalarApp: async () => {
    if (INST.puedeInstalar()) { const r = await INST.instalar(); if (r === 'accepted') toast('¡Instalada! Búscala en tu pantalla de inicio'); return; }
    openSheet(`<h2>Instalar en iPhone</h2><ol class="steps"><li><span class="n">1</span><span>Toca <b>Compartir</b> (el cuadrito con la flecha).</span></li><li><span class="n">2</span><span>Elige <b>Agregar a inicio</b>.</span></li><li><span class="n">3</span><span>Toca <b>Agregar</b>.</span></li></ol><div class="actions"><button class="btn ghost" data-act="closeSheet">Entendido</button></div>`, { label: 'Instalar' });
  },
  compartir: async () => { try { await navigator.share({ title: 'KOING', text: 'Llevo mis cuentas en $ y Bs con KOING. Pruébala:', url: location.origin }); } catch (e) {} },
  copiarLink: async () => { try { await navigator.clipboard.writeText(location.origin); toast('Enlace copiado'); } catch (e) { toast(location.origin, false); } },
  forgot: () => renderForgot(),
  authBack: () => renderAuth(),
  addFijoRow: () => { $('#aj-fijos').insertAdjacentHTML('beforeend', fijoRow()); $('#aj-fijos [data-fijo-row]:last-child input').focus(); },
  delFijoRow: (el) => el.closest('[data-fijo-row]').remove(),
  saveAjustes: () => saveAjustes(),
  saveGasto: () => saveGasto(),
  saveIngreso: () => saveIngreso(),
  saveDeuda: () => saveDeuda(),
  saveMeta: () => saveMeta(),
  verIntro: () => { UI.stack = []; renderIntro(true); },
  rehacerPreguntas: () => { UI.stack = []; startOnboarding(); },
  logout: async () => {
    const ok = await confirmar({ titulo: '¿Cerrar sesión?', texto: 'Tus datos quedan guardados en tu cuenta.', ok: 'Cerrar sesión' });
    if (!ok) return;
    token.clear(); Object.assign(S, { user: null, perfil: null, deudas: [], metas: [], movimientos: [], ventas: [], proveedores: [], negMovs: [] }); UI.stack = []; UI.tab = 'inicio'; UI.espacio = 'personal'; authMode = 'login'; renderAuth();
  },
  borrarCuenta: async () => {
    const ok = await confirmar({ titulo: '¿Eliminar tu cuenta?', texto: 'Se borran tu perfil, deudas, metas y movimientos para siempre.', ok: 'Sí, eliminar todo' });
    if (!ok) return;
    try { await api('/api/perfil', { method: 'DELETE' }); token.clear(); location.reload(); } catch (e) { toast(e.message, false); }
  },
  exportCsv: () => {
    const rows = [['Fecha', 'Espacio', 'Tipo', 'Descripción', 'Categoría', 'Método', 'Moneda', 'Monto', 'Tasa', 'Monto en $']];
    [...S.movimientos, ...S.negMovs].sort((a, b) => b.fecha.localeCompare(a.fecha)).forEach((m) => {
      const s = m.tipo === 'ingreso' ? 1 : -1;
      rows.push([m.fecha, m.espacio === 'negocio' ? 'Negocio' : 'Personal', m.tipo, m.descripcion, m.categoria, METODO_TXT[m.metodo] || m.metodo, m.moneda === 'VES' ? 'Bs' : '$', numCsv(s * m.monto), m.tasa ? numCsv(m.tasa) : '', numCsv(s * K.usd(m, S))]);
    });
    downloadCsv(`koing-movimientos-${K.today()}.csv`, rows);
  },
  exportProy: () => {
    const rows = [['Periodo', 'Fecha', 'Concepto', 'Monto', 'Estado']];
    K.proyeccion(S, 12).forEach((x) => {
      x.pagos.forEach((p) => rows.push([x.p.label, p.fecha, p.nombre, numCsv(p.monto), p.pagado ? 'Pagado' : 'Pendiente']));
      rows.push([x.p.label, '', 'TOTAL DEUDAS', numCsv(x.debo), '']);
      rows.push([x.p.label, '', 'ME QUEDA', numCsv(x.queda), '']);
    });
    downloadCsv(`koing-deudas-por-${nomP()}-${K.today()}.csv`, rows);
  }
};
function goTabRefresh() {
  if (UI.stack.length) return renderApp();
  appEl.innerHTML = `<div class="screen">${curViews()[UI.tab]()}</div>`;
}

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const a = el.dataset.act;
  if (!ACT[a]) return;
  if (el.tagName === 'A') e.preventDefault();
  // Los checkbox/radio deben conservar su comportamiento nativo
  if (!(el.tagName === 'INPUT' && (el.type === 'checkbox' || el.type === 'radio'))) e.preventDefault();
  ACT[a](el, e);
});
document.addEventListener('change', (e) => {
  const el = e.target;
  if (el.matches('input[type=checkbox][data-act], input[type=radio][data-act]')) return; // ya manejado en click
});
document.addEventListener('submit', async (e) => {
  const f = e.target.closest('[data-form]');
  if (!f) return;
  e.preventDefault();
  const k = f.dataset.form;
  if (k === 'auth') {
    const err = $('.err', f);
    const btn = $('button.btn', f);
    btn.disabled = true; err.textContent = '';
    try {
      const body = { email: $('#a-email').value, password: $('#a-pass').value, nombre: $('#a-nombre')?.value };
      const r = await api(`/api/auth?action=${authMode === 'registro' ? 'register' : 'login'}`, { method: 'POST', body });
      token.set(r.token);
      await boot();
    } catch (x) { err.textContent = x.message; btn.disabled = false; }
  }
  if (k === 'forgot') {
    const btn = $('button.btn', f), err = $('.err', f);
    btn.disabled = true;
    try { await api('/api/auth?action=forgot', { method: 'POST', body: { email: $('#f-email').value } }); renderForgot('', true); }
    catch (x) { err.textContent = x.message; btn.disabled = false; }
  }
  if (k === 'reset') {
    const btn = $('button.btn', f), err = $('.err', f);
    if ($('#r-pass').value !== $('#r-pass2').value) { err.textContent = 'Las dos claves no coinciden.'; return; }
    btn.disabled = true;
    try {
      const r = await api('/api/auth?action=reset', { method: 'POST', body: { token: f.dataset.token, password: $('#r-pass').value } });
      token.set(r.token); history.replaceState(null, '', '/'); toast('Listo, ya tienes clave nueva'); await boot();
    } catch (x) { err.textContent = x.message; btn.disabled = false; }
  }
  if (k === 'venta') saveVenta(false);
  if (k === 'proveedor') saveProveedor();
  if (k === 'pagoProv') savePagoProv();
  if (k === 'gasto') saveGasto();
  if (k === 'ingreso') saveIngreso();
  if (k === 'pago') savePago();
  if (k === 'deuda') saveDeuda();
  if (k === 'meta') saveMeta();
});
// Selector $/Bs: recuerda la última moneda y actualiza la equivalencia
document.addEventListener('seg', (e) => {
  const g = e.target;
  if (!g.id || !g.id.endsWith('-moneda')) return;
  const px = g.id.slice(0, -7);
  const mon = segVal(g.id);
  const symEl = $(`#${px}-sym`); if (symEl) symEl.textContent = mon === 'VES' ? 'Bs' : '$';
  if (px === 'ob-ing' || px === 'aj-ing') return;
  if (['g', 'i', 'v'].includes(px)) store.set('koing_mon', mon);
  // En pagos, convertimos el monto ya escrito
  const inp = $(`#${px}-monto`); const t = K.tasaDe(S);
  if ((px === 'p' || px === 'pp' || px === 'rt') && inp && t && parseMoney(inp.value)) {
    const v = parseMoney(inp.value); inp.value = moneyVal(mon === 'VES' ? r2(v * t) : r2(v / t));
  }
  actualizarConv(px);
});
document.addEventListener('input', (e) => {
  const box = e.target.closest('[data-amount]');
  if (box) actualizarConv(box.dataset.amount);
  if (e.target.id === 'v-desc') {
    const ul = $('#v-sug'); const t = e.target.value.trim();
    const sug = t ? K.sugerencias(S, t, 3).filter((x) => x.nombre.toLowerCase() !== t.toLowerCase()) : [];
    ul.hidden = !sug.length;
    ul.innerHTML = sug.map((x) => `<li><button type="button" data-act="sugPick" data-v="${esc(x.nombre)}">${esc(x.nombre)}<small>vendido ${x.n} ${x.n === 1 ? 'vez' : 'veces'}</small></button></li>`).join('');
  }
  if (e.target.id === 'ob-apartar') {
    const h = $('#ob-libre'); const base = Number(h.dataset.base);
    h.textContent = `Te quedarían ${fmtSym(r2(base - parseMoney(e.target.value)), UI.ob.d.moneda)} libres para el día a día.`;
  }
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && UI.sheet) ACT.closeSheet();
});

// ---------- Service worker ----------
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}

// ---------- Pantalla de inicio animada ----------
const T0 = performance.now();
const SPLASH_MIN = 1950; // ms: monedas + sacudida
function esperar(ms) { return new Promise((ok) => setTimeout(ok, ms)); }
async function revelar() {
  const sp = $('#splash');
  if (!sp) return;
  const falta = SPLASH_MIN - (performance.now() - T0);
  if (falta > 0) await esperar(falta);
  sp.classList.remove('sp-wait');
  sp.classList.add('sp-out');
  appEl.firstElementChild?.classList.add('app-reveal');
  tabEl.firstElementChild?.classList.add('app-reveal');
  setTimeout(() => { contarMontos(); }, 450);
  setTimeout(() => { sp.remove(); $$('.app-reveal').forEach((e) => e.classList.remove('app-reveal')); }, 1000);
}
// Si cargar tarda más que la animación, las monedas siguen cayendo
setTimeout(() => { const sp = $('#splash'); if (sp && !sp.classList.contains('sp-out')) sp.classList.add('sp-wait'); }, SPLASH_MIN);

// Los montos grandes cuentan desde 0 (como en el video)
function contarMontos(root = document) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  $$('[data-count]', root).forEach((el) => {
    const fin = Number(el.dataset.count) || 0;
    const f = el.dataset.modo === 'bs' ? fmtBs : fmt;
    const t0 = performance.now(), dur = 1100;
    const paso = (now) => {
      const k = Math.min(1, (now - t0) / dur);
      const e = 1 - Math.pow(1 - k, 3);
      el.textContent = f(fin * e);
      if (k < 1) requestAnimationFrame(paso);
    };
    requestAnimationFrame(paso);
  });
}

boot().finally(revelar);
