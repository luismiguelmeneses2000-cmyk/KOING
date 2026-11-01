// ===== KOING · aplicación =====
import { api, token } from './api.js';
import { pig, shadow, icon } from './pig.js';
import * as K from './calc.js';

const { esc } = K;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const appEl = $('#app');
const tabEl = $('#tabbar-root');
const sheetEl = $('#sheet-root');
const r2 = (n) => Math.round(n * 100) / 100;

// ---------- Estado ----------
const S = { user: null, perfil: null, deudas: [], metas: [], movimientos: [], fmt: (n) => fmt(n) };
const UI = { tab: 'inicio', stack: [], sheet: null, metaTipo: 'necesito', deudaFiltro: 'activas', movOffset: 0, histOpen: 0, ob: null };
const TABS = { inicio: 0, movimientos: 1, deudas: 3, metas: 4 };

function fmt(n, { sign = false } = {}) {
  const sym = S.perfil?.moneda || '$';
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
  const d = await api('/api/perfil');
  Object.assign(S, { user: d.user, perfil: d.perfil, deudas: d.deudas, metas: d.metas, movimientos: d.movimientos });
}
const upsert = (arr, item) => { const i = arr.findIndex((x) => x.id === item.id); if (i >= 0) arr[i] = item; else arr.unshift(item); };

// ---------- Arranque ----------
async function boot() {
  if (!token.get()) {
    return store.get('koing_intro') ? renderAuth() : renderIntro();
  }
  appEl.innerHTML = `<div class="loading">${pig({ size: 110, cls: 'pig-float' })}<span>Abriendo tu KOING…</span></div>`;
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
  ['¿Me ayudas a conocerte?', 'Son 7 preguntas rápidas y armo tu KOING solito. Nada de cargar todo a mano.']
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
      nombre: p.nombre || S.user?.nombre || '', frecuencia: p.frecuencia || 'quincenal', ingreso: p.ingreso || 0, moneda: p.moneda || '$',
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
  const sym = d.moneda;
  let body = '';
  if (step === 1) {
    body = `<h1>¿Cómo te llamo?</h1><p class="lead">Así te saludo cada vez que abras la app.</p>
      <div class="field"><label for="ob-nombre">Tu nombre</label><input class="input" id="ob-nombre" value="${esc(d.nombre)}" maxlength="40" autocomplete="given-name"></div>
      <div class="field"><label for="ob-moneda">¿En qué moneda llevas tus cuentas?</label>
        <select class="input" id="ob-moneda">${['$', 'Bs', '€'].map((m) => `<option ${m === d.moneda ? 'selected' : ''} value="${m}">${m === '$' ? 'Dólares ($)' : m === 'Bs' ? 'Bolívares (Bs)' : 'Euros (€)'}</option>`).join('')}</select></div>`;
  } else if (step === 2) {
    const opts = [['semanal', 'Semanal', ''], ['quincenal', 'Quincenal', '15 y último'], ['mensual', 'Mensual', ''], ['variable', 'Variable / por proyecto', '']];
    body = `<h1>¿Cada cuánto cobras?</h1><p class="lead">Con esto calculo cuánto tienes disponible en cada periodo. Puedes cambiarlo luego en Ajustes.</p>
      <fieldset class="radio-list"><legend class="sr">Frecuencia de pago</legend>
      ${opts.map(([v, t, s]) => `<label><input type="radio" name="freq" value="${v}" ${d.frecuencia === v ? 'checked' : ''}><span>${t}</span>${s ? `<small>${s}</small>` : ''}</label>`).join('')}</fieldset>`;
  } else if (step === 3) {
    body = `<h1>¿Cuánto recibes por ${per}?</h1><p class="lead">Tu sueldo se suma solo cada ${per}; no tienes que anotarlo. Si recibes algo extra, lo agregas como ingreso.</p>
      <div class="field"><label for="ob-ingreso">Monto por ${per}</label>
        <div class="money"><span>${sym}</span><input id="ob-ingreso" inputmode="decimal" placeholder="0,00" value="${moneyVal(d.ingreso)}"></div>
        <span class="hint">${d.frecuencia === 'variable' ? 'Como varía, pon un promedio por quincena.' : 'Si varía, pon un promedio.'}</span></div>`;
  } else if (step === 4) {
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
  } else if (step === 5) {
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
  } else if (step === 6) {
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
  } else if (step === 7) {
    const tmp = { perfil: { ...d, onboarded: true }, deudas: d.deudas.map((x, i) => ({ ...x, id: 'ob' + i, activa: true, cuotasPagadas: x.cuotasPagadas || 0 })), metas: [], movimientos: [] };
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
        <div class="progress" role="progressbar" aria-valuemin="1" aria-valuemax="7" aria-valuenow="${step}"><span style="width:${(step / 7) * 100}%"></span></div>
        <span class="q-count">${step} de 7</span>
      </div>
      <div class="q-body ${dir > 0 ? 'a-inR' : 'a-inL'}">
        <div class="q-pig"><div class="pig-float">${pig({ size: 46, label: '' })}</div>Armemos tu KOING</div>
        ${body}
      </div>
      <div class="q-foot">
        <div class="err" id="ob-err" role="alert"></div>
        <button class="btn block" data-act="obNext">${step === 7 ? 'Listo, armar mi KOING' : 'Continuar'}</button>
        ${[4, 5, 6].includes(step) ? '<button class="btn link" data-act="obSkip">Omitir por ahora</button>' : ''}
      </div>
    </main>`;
  const prog = $('.progress span', appEl);
  appEl.innerHTML = html;
  if (prog) { const n = $('.progress span', appEl); n.style.width = prog.style.width; requestAnimationFrame(() => requestAnimationFrame(() => { n.style.width = `${(step / 7) * 100}%`; })); }
  const f = $('.q-body input:not([type=radio]):not([type=checkbox])', appEl);
  if (f && step <= 3) setTimeout(() => f.focus({ preventScroll: true }), 260);
}
const fmtSym = (n, sym) => (sym === 'Bs' ? 'Bs ' : sym) + (Number(n) || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const tipoDeuda = (t) => ({ cuotas: 'Compra en cuotas', tarjeta: 'Tarjeta de crédito', prestamo: 'Préstamo', otro: 'Otra deuda' }[t] || 'Deuda');

function obCollect() {
  const { step, d } = UI.ob;
  if (step === 1) { d.nombre = $('#ob-nombre').value.trim(); d.moneda = $('#ob-moneda').value; }
  if (step === 2) { d.frecuencia = ($('input[name=freq]:checked') || {}).value || 'quincenal'; }
  if (step === 3) { d.ingreso = parseMoney($('#ob-ingreso').value); }
  if (step === 5) {
    const all = [...FIJOS_COMUNES, ...d.fijos.filter((f) => !FIJOS_COMUNES.includes(f.nombre)).map((f) => f.nombre)];
    d.fijos = $$('[data-fijo]').map((cb) => {
      if (!cb.checked) return null;
      const i = cb.dataset.fijo; return { nombre: all[i], monto: parseMoney($(`[data-fijo-monto="${i}"]`).value) };
    }).filter(Boolean);
  }
  if (step === 7) { d.apartar = parseMoney($('#ob-apartar').value); d.avisos = $('#ob-avisos').checked; }
}
async function obNext(skip = false) {
  const ob = UI.ob;
  if (!skip) obCollect();
  const err = $('#ob-err');
  if (ob.step === 3 && !ob.d.ingreso) { err.textContent = 'Pon cuánto recibes (aunque sea un aproximado).'; return; }
  if (ob.step === 4 && !skip && ob.d.tieneDeudas === null) { err.textContent = 'Elige una opción.'; return; }
  if (ob.step === 4 && !skip && ob.d.tieneDeudas && $('#od-nombre')?.value.trim()) { if (!obAddDeuda()) return; }
  if (ob.step === 6 && !skip && $('#om-nombre')?.value.trim()) { if (!obAddMeta()) return; }
  if (skip && ob.step === 5) ob.d.fijos = [];
  if (ob.step < 7) { ob.step++; ob.dir = 1; return renderOnboarding(); }
  // Guardar todo
  const btn = $('[data-act=obNext]'); btn.disabled = true; btn.textContent = 'Armando tu KOING…';
  try {
    const d = ob.d;
    await api('/api/perfil', {
      method: 'PUT',
      body: {
        perfil: { nombre: d.nombre, frecuencia: d.frecuencia, ingreso: d.ingreso, moneda: d.moneda, fijos: d.fijos, apartar: d.apartar, avisos: d.avisos, onboarded: true },
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
  const t = UI.tab, idx = TABS[t];
  const b = (k, label, ic) => `<button data-act="tab" data-v="${k}" ${t === k ? 'aria-current="page"' : ''}>${icon(ic, 24, t === k ? 2.4 : 2)}${label}</button>`;
  tabEl.innerHTML = `<div class="tabbar"><nav aria-label="Principal">
    <span class="ind" style="left:${idx * 20 + 10}%"></span>
    ${b('inicio', 'Inicio', 'home')}${b('movimientos', 'Movimientos', 'list')}
    <button class="fab" data-act="nuevo" aria-label="Registrar">${icon('plus', 28, 2.6)}</button>
    ${b('deudas', 'Deudas', 'card')}${b('metas', 'Metas', 'goal')}
  </nav></div>`;
}
function renderApp(anim = '') {
  const top = UI.stack[UI.stack.length - 1];
  const html = top ? VIEWS[top.v](top) : TABVIEWS[UI.tab]();
  appEl.innerHTML = `<div class="screen ${anim}">${html}</div>`;
  renderTabbar();
  window.scrollTo(0, 0);
  const after = top ? AFTER[top.v] : null;
  after && after(top);
}
function goTab(t) {
  if (t === UI.tab && !UI.stack.length) return;
  const dir = TABS[t] > TABS[UI.tab] ? 'a-inR' : 'a-inL';
  const ind = $('.tabbar .ind');
  UI.tab = t;
  if (ind) ind.style.left = `${TABS[t] * 20 + 10}%`;
  appEl.innerHTML = `<div class="screen ${dir}">${TABVIEWS[t]()}</div>`;
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
const TABVIEWS = {
  inicio() {
    const r = K.resumen(S);
    const pf = S.perfil;
    const base = Math.max(r.ingresos, r.cuotas + r.fijos + r.gastos + r.ahorro, 1);
    const w = (x) => `${Math.max(0, Math.min(100, (x / base) * 100)).toFixed(1)}%`;
    const en30 = K.iso(new Date(Date.now() + 30 * 86400000));
    const prox = K.pagosDelPeriodo(S, { start: '0000-01-01', end: en30 }).filter((x) => !x.pagado).map((x) => ({ ...x, atrasada: x.fecha < K.today() })).slice(0, 4);
    const ult = S.movimientos.slice(0, 5);
    const meta = K.metaPrincipal(S);
    const dias = K.diasRestantes(r.p);
    return `
    <header class="hello">
      <div class="pig-float">${pig({ size: 40, label: 'KOING' })}</div>
      <div class="who"><b>Hola${pf.nombre ? ', ' + esc(pf.nombre) : ''}</b><span>${K.nombrePeriodo(pf.frecuencia) === 'quincena' ? 'Quincena' : K.nombrePeriodo(pf.frecuencia) === 'mes' ? 'Mes' : 'Semana'} ${r.p.label} · ${dias === 1 ? 'último día' : `faltan ${dias} días`}</span></div>
      <button class="icon-btn" aria-label="Ajustes" data-act="push" data-v="ajustes">${icon('gear', 24)}</button>
    </header>
    <section class="hero" aria-label="Resumen">
      <span class="lbl">Disponible para gastar</span>
      <div class="big num ${r.disponible < 0 ? 'neg' : ''}">${fmt(r.disponible)}</div>
      <div class="stack" aria-hidden="true">
        <span style="width:${w(r.cuotas)};background:var(--brand-strong)"></span>
        <span style="width:${w(r.fijos + r.gastos)};background:var(--sage)"></span>
        <span style="width:${w(r.ahorro)};background:var(--sand)"></span>
      </div>
      <div class="legend"><span><i style="background:var(--brand-strong)"></i>Deudas</span><span><i style="background:var(--sage)"></i>Gastado</span>${r.ahorro ? '<span><i style="background:var(--sand)"></i>Apartado</span>' : ''}<span><i style="background:var(--track);outline:1px solid var(--line-strong)"></i>Libre</span></div>
    </section>
    <div class="scroll">
      <div class="list a-rows" style="margin-top:16px">
        <div class="kv"><span>Ingresos${r.extra ? ` <small style="color:var(--muted)">(incluye ${fmt(r.extra)} extra)</small>` : ''}</span><b class="num">${fmt(r.ingresos)}</b></div>
        <div class="kv"><span>Cuotas de deudas</span><b class="num">${fmt(-r.cuotas)}</b></div>
        ${r.fijos ? `<div class="kv"><span>Gastos fijos</span><b class="num">${fmt(-r.fijos)}</b></div>` : ''}
        <div class="kv"><span>Gastos</span><b class="num">${fmt(-r.gastos)}</b></div>
        ${r.ahorro ? `<div class="kv"><span>${r.ahorroReal >= r.plan ? 'Apartado para metas' : 'Por apartar para metas'}</span><b class="num">${fmt(-r.ahorro)}</b></div>` : ''}
      </div>

      ${meta ? `<div class="section-h"><h2>Tu meta #1</h2><button data-act="tab" data-v="metas">Ver metas</button></div>
        <button class="meta-row" data-act="metaSheet" data-id="${meta.id}" style="border-top:1px solid var(--line)">
          <div class="main"><div class="top"><span>${esc(meta.nombre)}</span><span class="num">${fmt(meta.precio)}</span></div>
          <div class="bar"><span style="width:${Math.min(100, ((meta.apartado || 0) / meta.precio) * 100)}%"></span></div>
          <div class="sub"><span>Faltan ${fmt(meta.precio - (meta.apartado || 0))}</span><span>${K.etaMetas(S)[meta.id] || ''}</span></div></div></button>` : ''}

      <div class="section-h"><h2>Próximos pagos</h2><button data-act="tab" data-v="deudas">Ver todo</button></div>
      ${prox.length ? `<div class="list a-rows">${prox.map((x) => { const d = K.parse(x.fecha); return `
        <button class="row" data-act="deudaSheet" data-id="${x.deudaId}">
          <div class="date-badge"><b>${d.getDate()}</b><span>${K.MESES[d.getMonth()]}</span></div>
          <div class="main"><div class="t">${esc(x.nombre)}</div><div class="s">${x.atrasada ? '<span class="neg" style="font-weight:800">Atrasada · </span>' : ''}${x.total ? `Cuota ${x.n} de ${x.total}` : 'Pago'}</div></div>
          <span class="amt num">${fmt(x.monto)}</span></button>`; }).join('')}</div>`
        : emptyState(S.deudas.some((d) => d.activa) ? 'No tienes pagos en estos días.' : '¡Sin deudas! Si compras algo a crédito, lo anoto aquí.')}

      <div class="section-h"><h2>Últimos movimientos</h2><button data-act="tab" data-v="movimientos">Ver todo</button></div>
      ${ult.length ? `<div class="list a-rows">${ult.map(movRow).join('')}</div>` : emptyState('Aún no hay movimientos. Toca <b>+</b> para anotar tu primer gasto.')}
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
    const salidas = r2(movs.filter((m) => m.tipo !== 'ingreso').reduce((a, m) => a + (m.tipo === 'gasto' && m.metodo === 'credito' ? 0 : m.monto), 0));
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
        <div><div class="lbl">Entró</div><div class="v num pos">${fmt(r.extra + (S.perfil.ingreso || 0))}</div></div>
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
       `próx. ${K.fmtDate(d.proximoPago)}`].filter(Boolean).join(' · ');
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
function movRow(m) {
  const sign = m.tipo === 'ingreso' ? 1 : -1;
  const sub = m.tipo === 'ingreso' ? 'Ingreso' : m.tipo === 'pago' ? 'Pago de deuda' : m.tipo === 'ahorro' ? 'Apartado para meta'
    : `${m.categoria} · ${{ debito: 'Débito', efectivo: 'Efectivo', pago_movil: 'Pago móvil', credito: 'A crédito' }[m.metodo]}`;
  return `<button class="row" data-act="movSheet" data-id="${m.id}">
    <span class="main"><span class="t" style="display:block">${esc(m.descripcion || m.categoria)}</span><span class="s">${K.fmtDate(m.fecha)} · ${sub}</span></span>
    <span class="amt num ${sign > 0 ? 'pos' : ''}">${fmt(sign * m.monto, { sign: true })}</span></button>`;
}

// ---------- Vistas apiladas ----------
const head = (title, right = '') => `<header class="topbar"><div class="side"><button class="icon-btn" aria-label="Volver" data-act="back">${icon('back', 24, 2.2)}</button></div><h1>${title}</h1><div class="side r">${right}</div></header>`;
const segHtml = (id, opts, val, label) => `<div class="seg" role="radiogroup" aria-label="${label}" id="${id}">${opts.map(([v, t]) => `<button type="button" role="radio" aria-checked="${v === val}" data-act="segPick" data-v="${v}">${t}</button>`).join('')}</div>`;
const segVal = (id) => $(`#${id} [aria-checked=true]`)?.dataset.v;

const VIEWS = {
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
      <div class="field"><label for="aj-ingreso">Ingreso por ${nomP()}</label><div class="money"><span>${p.moneda}</span><input id="aj-ingreso" inputmode="decimal" value="${moneyVal(p.ingreso)}"></div></div>
      <div class="field"><label for="aj-moneda">Moneda</label><select class="input" id="aj-moneda">${['$', 'Bs', '€'].map((m) => `<option ${m === p.moneda ? 'selected' : ''}>${m}</option>`).join('')}</select></div>
      <div class="field"><label for="aj-apartar">Apartar para metas por ${nomP()}</label><div class="money"><span>${p.moneda}</span><input id="aj-apartar" inputmode="decimal" value="${moneyVal(p.apartar)}"></div></div>
      <h2 class="cap">Gastos fijos al mes</h2>
      <div class="list" id="aj-fijos">${(p.fijos || []).map((f) => fijoRow(f)).join('')}</div>
      <button class="btn link" data-act="addFijoRow">${icon('plus', 18, 2.6)} Agregar gasto fijo</button>
      <div class="err" id="aj-err" role="alert"></div>
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

  formGasto() {
    const cats = ['Comida', 'Mercado', 'Transporte', 'Servicios', 'Salud', 'Casa', 'Ropa', 'Tecnología', 'Ocio', 'Educación', 'Regalos', 'Otros'];
    return `${head('Nuevo gasto', '<button class="text-btn strong" data-act="saveGasto">Guardar</button>')}
    <form class="scroll" data-form="gasto" novalidate>
      <div class="amount-hero"><label for="g-monto">Monto</label><div class="wrap"><span>${S.perfil.moneda === 'Bs' ? 'Bs' : S.perfil.moneda}</span><input id="g-monto" inputmode="decimal" placeholder="0,00" autocomplete="off"></div></div>
      <div class="form-rows">
        <div class="form-row"><label for="g-desc">Descripción</label><input id="g-desc" placeholder="Ej: Audífonos" maxlength="60"></div>
        <div class="form-row"><label for="g-cat">Categoría</label><select id="g-cat">${cats.map((c) => `<option>${c}</option>`).join('')}</select></div>
        <div class="form-row"><label for="g-fecha">Fecha</label><input id="g-fecha" type="date" value="${K.today()}" max="${K.today()}"></div>
      </div>
      <div class="field"><span class="lbl">¿Cómo pagaste?</span>
        ${segHtml('g-metodo', [['debito', 'Débito'], ['efectivo', 'Efectivo'], ['pago_movil', 'Pago móvil'], ['credito', 'A crédito']], 'debito', 'Método de pago')}
      </div>
      <div id="g-credito" hidden>
        <div class="form-rows">
          <div class="form-row"><label for="g-cuotas">Cuotas</label><input id="g-cuotas" inputmode="numeric" value="4"></div>
          <div class="form-row"><label for="g-freq">Se paga</label><select id="g-freq"><option value="quincenal">Cada quincena</option><option value="mensual">Cada mes</option><option value="semanal">Cada semana</option></select></div>
          <div class="form-row"><label for="g-primer">Primer pago</label><input id="g-primer" type="date" value="${K.nextDate(K.today(), 'quincenal')}"></div>
        </div>
      </div>
      <p class="hint" id="g-hint" style="color:var(--muted);font-size:14px;margin:8px 0 0">Si eliges «A crédito» te pido cuotas y lo anoto en Deudas.</p>
      <div class="err" id="g-err" role="alert"></div>
      <button class="btn block" style="margin-top:8px">Guardar gasto</button>
    </form>`;
  },

  formIngreso() {
    return `${head('Nuevo ingreso', '<button class="text-btn strong" data-act="saveIngreso">Guardar</button>')}
    <form class="scroll" data-form="ingreso" novalidate>
      <div class="amount-hero"><label for="i-monto">Monto</label><div class="wrap"><span>${S.perfil.moneda}</span><input id="i-monto" inputmode="decimal" placeholder="0,00"></div></div>
      <div class="form-rows">
        <div class="form-row"><label for="i-desc">Descripción</label><input id="i-desc" placeholder="Ej: Trabajo extra" maxlength="60"></div>
        <div class="form-row"><label for="i-fecha">Fecha</label><input id="i-fecha" type="date" value="${K.today()}"></div>
      </div>
      <p style="color:var(--muted);font-size:14px">Tu sueldo de ${fmt(S.perfil.ingreso)} ya se cuenta solo cada ${nomP()}. Aquí anotas lo extra.</p>
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
        ${act.map((x) => `<label><input type="radio" name="p-deuda" value="${x.id}" ${x.id === sel ? 'checked' : ''} data-act="pagoPick"><span>${esc(x.nombre)}</span><small class="num">${fmt(x.cuota)} · ${K.fmtDate(x.proximoPago)}</small></label>`).join('')}
      </fieldset>
      <div class="field"><label for="p-monto">Monto pagado</label><div class="money"><span>${S.perfil.moneda}</span><input id="p-monto" inputmode="decimal" value="${moneyVal(d?.cuota)}"></div></div>
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
  formGasto() {
    const upd = () => {
      const cred = segVal('g-metodo') === 'credito';
      $('#g-credito').hidden = !cred;
      const monto = parseMoney($('#g-monto').value), n = Math.max(1, parseInt($('#g-cuotas').value, 10) || 1);
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
      <div class="kv"><span>Te falta pagar</span><b class="num">${fmt(K.restanteDeuda(d))}</b></div>
      ${d.activa ? `<div class="kv"><span>Próximo pago</span><b>${K.fmtDate(d.proximoPago, true)}</b></div>` : ''}
      <div class="kv"><span>Terminas</span><b>${fin ? K.fmtDate(fin, true) : 'Sin fecha fin'}</b></div>
    </div>
    <div class="actions">
      ${d.activa ? `<button class="btn" data-act="sheetPush" data-v="formPago" data-id="${d.id}">Registrar pago de ${fmt(d.cuota)}</button>` : ''}
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
  const m = S.movimientos.find((x) => x.id === id);
  if (!m) return;
  const tipo = { gasto: 'Gasto', ingreso: 'Ingreso', pago: 'Pago de deuda', ahorro: 'Apartado para meta' }[m.tipo];
  openSheet(`<h2>${esc(m.descripcion || m.categoria)}</h2>
    <div class="list" style="margin-top:8px">
      <div class="kv"><span>Monto</span><b class="num">${fmt(m.monto)}</b></div>
      <div class="kv"><span>Tipo</span><b>${tipo}</b></div>
      ${m.tipo === 'gasto' ? `<div class="kv"><span>Categoría</span><b>${esc(m.categoria)}</b></div><div class="kv"><span>Pago</span><b>${{ debito: 'Débito', efectivo: 'Efectivo', pago_movil: 'Pago móvil', credito: 'A crédito' }[m.metodo]}</b></div>` : ''}
      <div class="kv"><span>Fecha</span><b>${K.fmtDate(m.fecha, true)}</b></div>
    </div>
    <p style="color:var(--muted);font-size:14px;margin-top:12px">${m.tipo === 'pago' ? 'Si lo borras, la cuota vuelve a quedar pendiente.' : m.creaDeuda ? 'Si lo borras, también se borra la deuda que creó.' : m.tipo === 'ahorro' ? 'Si lo borras, se descuenta de lo apartado en la meta.' : ''}</p>
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
  const monto = parseMoney($('#g-monto').value);
  if (!monto) { err.textContent = 'Pon cuánto gastaste.'; $('#g-monto').focus(); return; }
  const metodo = segVal('g-metodo');
  const cred = metodo === 'credito';
  const cuotas = Math.max(1, parseInt($('#g-cuotas').value, 10) || 1);
  const body = {
    tipo: 'gasto', monto, descripcion: $('#g-desc').value.trim(), categoria: $('#g-cat').value, metodo, fecha: $('#g-fecha').value,
    credito: cred ? { cuotas, frecuencia: $('#g-freq').value, primerPago: $('#g-primer').value } : undefined
  };
  const rev = K.revisarGasto(S, monto, { credito: cred, cuotas });
  if (rev.mostrar) {
    const seguir = await sheetAlerta(rev);
    if (!seguir) { toast('Bien pensado. Tu meta sigue a salvo.'); back(); return; }
  }
  busy('[data-act=saveGasto], [data-form=gasto] .btn', true);
  try {
    const r = await api('/api/items?col=movimientos', { method: 'POST', body });
    S.movimientos.unshift(r.item);
    if (r.deuda) S.deudas.push(r.deuda);
    back();
    toast(r.deuda ? `Anotado. Creé la deuda «${r.deuda.nombre}» en ${cuotas} cuotas.` : 'Gasto anotado');
  } catch (e) { err.textContent = e.message; busy('[data-act=saveGasto], [data-form=gasto] .btn', false); }
}
async function saveIngreso() {
  const err = $('#i-err');
  const monto = parseMoney($('#i-monto').value);
  if (!monto) { err.textContent = 'Pon el monto.'; return; }
  busy('[data-act=saveIngreso], [data-form=ingreso] .btn', true);
  try {
    const r = await api('/api/items?col=movimientos', { method: 'POST', body: { tipo: 'ingreso', monto, descripcion: $('#i-desc').value.trim() || 'Ingreso extra', fecha: $('#i-fecha').value } });
    S.movimientos.unshift(r.item);
    back();
    await showSuccess({ titulo: '¡Ingreso registrado!', texto: `Sumé <b>${fmt(monto)}</b> a tu disponible. Ahora tienes ${fmt(K.resumen(S).disponible)}.` });
  } catch (e) { err.textContent = e.message; busy('[data-act=saveIngreso], [data-form=ingreso] .btn', false); }
}
async function savePago() {
  const err = $('#p-err');
  const id = $('input[name=p-deuda]:checked')?.value;
  const monto = parseMoney($('#p-monto').value);
  if (!id) { err.textContent = 'Elige qué pagaste.'; return; }
  if (!monto) { err.textContent = 'Pon el monto pagado.'; return; }
  const antes = S.deudas.find((x) => x.id === id);
  busy('[data-form=pago] .btn', true);
  try {
    const r = await api(`/api/items?col=deudas&action=pagar&id=${id}`, { method: 'POST', body: { monto, fecha: $('#p-fecha').value, metodo: segVal('p-metodo') } });
    upsert(S.deudas, r.deuda);
    S.movimientos.unshift(r.movimiento);
    back();
    const d = r.deuda;
    const fin = K.fechaFin(d);
    let prog = {};
    if (d.cuotasTotal) {
      prog = { progFrom: ((antes.cuotasPagadas || 0) / d.cuotasTotal) * 100, progTo: (d.cuotasPagadas / d.cuotasTotal) * 100, izq: `${d.cuotasPagadas} de ${d.cuotasTotal} pagadas`, der: d.activa && fin ? `Terminas el ${K.fmtDate(fin)}` : '¡Terminada!' };
    } else if (antes.saldo) {
      const pagado0 = 0, pagado1 = Math.min(100, ((antes.saldo - (d.saldo || 0)) / antes.saldo) * 100);
      prog = { progFrom: pagado0, progTo: pagado1, izq: `Saldo: ${fmt(d.saldo || 0)}`, der: d.activa ? '' : '¡Terminada!' };
    }
    await showSuccess({
      titulo: d.activa ? '¡Pago registrado!' : '¡Deuda terminada!',
      texto: `${esc(d.nombre)}${d.cuotasTotal ? `, cuota ${d.cuotasPagadas} de ${d.cuotasTotal}` : ''} por <b>${fmt(monto)}</b>.`,
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
  const perfil = { ...S.perfil, nombre: $('#aj-nombre').value.trim(), frecuencia: $('#aj-freq').value, ingreso: parseMoney($('#aj-ingreso').value), moneda: $('#aj-moneda').value, apartar: parseMoney($('#aj-apartar').value), fijos, onboarded: true };
  busy('[data-act=saveAjustes]', true);
  try {
    await api('/api/perfil', { method: 'PUT', body: { perfil } });
    S.perfil = { ...S.perfil, ...perfil };
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
// ACCIONES (delegación de eventos)
// =====================================================
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
  obSkip: () => { if (UI.ob.step === 4) UI.ob.d.tieneDeudas = false; if (UI.ob.step === 6) UI.ob.d.metas = []; obNext(true); },
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
  push: (el) => push(el.dataset.v, el.dataset.id ? { id: el.dataset.id } : {}),
  back: () => back(),
  nuevo: () => sheetNuevo(),
  closeSheet: () => { $('.tabbar .fab')?.classList.remove('open'); closeSheet(); },
  sheetPush: async (el) => { $('.tabbar .fab')?.classList.remove('open'); await closeSheet(); push(el.dataset.v, el.dataset.id ? { id: el.dataset.id } : {}); },
  deudaSheet: (el) => sheetDeuda(el.dataset.id),
  metaSheet: (el) => sheetMeta(el.dataset.id),
  movSheet: (el) => sheetMov(el.dataset.id),
  deudaFiltro: (el) => { UI.deudaFiltro = el.dataset.v; goTabRefresh(); },
  metaTipo: (el) => { const dir = el.dataset.v === 'quiero' ? 'a-inR' : 'a-inL'; UI.metaTipo = el.dataset.v; goTabRefresh(); const l = $('#metas-lista'); l && l.classList.add(dir); },
  movPer: (el) => { UI.movOffset = Math.min(0, UI.movOffset + Number(el.dataset.v)); appEl.innerHTML = `<div class="screen ${Number(el.dataset.v) > 0 ? 'a-inR' : 'a-inL'}">${TABVIEWS.movimientos()}</div>`; },
  histOpen: (el) => { const i = +el.dataset.i; UI.histOpen = UI.histOpen === i ? -1 : i; appEl.innerHTML = `<div class="screen">${VIEWS.historial()}</div>`; },
  pagoPick: (el) => { const d = S.deudas.find((x) => x.id === el.value); if (d) $('#p-monto').value = moneyVal(d.cuota); },
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
      S[col] = S[col].filter((x) => x.id !== id);
      if (r.deuda) upsert(S.deudas, r.deuda);
      if (r.meta) upsert(S.metas, r.meta);
      if (r.deudaBorrada) S.deudas = S.deudas.filter((x) => x.id !== r.deudaBorrada);
      if (col === 'deudas') S.movimientos.forEach((m) => { if (m.deudaId === id) m.deudaId = null; });
      goTabRefresh();
      toast('Borrado', false);
    } catch (e) { toast(e.message, false); }
  },
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
    token.clear(); Object.assign(S, { user: null, perfil: null, deudas: [], metas: [], movimientos: [] }); UI.stack = []; UI.tab = 'inicio'; authMode = 'login'; renderAuth();
  },
  borrarCuenta: async () => {
    const ok = await confirmar({ titulo: '¿Eliminar tu cuenta?', texto: 'Se borran tu perfil, deudas, metas y movimientos para siempre.', ok: 'Sí, eliminar todo' });
    if (!ok) return;
    try { await api('/api/perfil', { method: 'DELETE' }); token.clear(); location.reload(); } catch (e) { toast(e.message, false); }
  },
  exportCsv: () => {
    const rows = [['Fecha', 'Tipo', 'Descripción', 'Categoría', 'Método', 'Monto']];
    S.movimientos.forEach((m) => rows.push([m.fecha, m.tipo, m.descripcion, m.categoria, m.metodo, numCsv(m.tipo === 'ingreso' ? m.monto : -m.monto)]));
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
  appEl.innerHTML = `<div class="screen">${TABVIEWS[UI.tab]()}</div>`;
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
  if (k === 'gasto') saveGasto();
  if (k === 'ingreso') saveIngreso();
  if (k === 'pago') savePago();
  if (k === 'deuda') saveDeuda();
  if (k === 'meta') saveMeta();
});
document.addEventListener('input', (e) => {
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

boot();
