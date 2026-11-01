// ===== Instalar KOING como app =====
// Android (Chrome, Edge, Samsung): botón que abre el instalador del sistema.
// iPhone: no existe instalación automática, se muestran los pasos de Safari.
// Navegadores dentro de WhatsApp / Instagram / Facebook: no pueden instalar, se manda a Chrome o Safari.
import { pig, icon } from './pig.js';

const ua = navigator.userAgent || '';
export const esIOS = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const esAndroid = /Android/i.test(ua);
export const esMovil = esIOS || esAndroid;
// Navegador interno de una app (no puede instalar)
export const esInterno = /FBAN|FBAV|FB_IAB|Instagram|WhatsApp|Line\/|Snapchat|TikTok|; wv\)/i.test(ua);
export const instalada = () =>
  matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches || navigator.standalone === true;

let promptEvt = null;
const oyentes = new Set();
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault(); // guardamos el aviso para lanzarlo con nuestro botón
  promptEvt = e;
  oyentes.forEach((f) => f());
});
window.addEventListener('appinstalled', () => {
  promptEvt = null;
  try { localStorage.setItem('koing_instalada', '1'); } catch (e) {}
  oyentes.forEach((f) => f('instalada'));
});
export const puedeInstalar = () => !!promptEvt;
export function alCambiar(f) { oyentes.add(f); return () => oyentes.delete(f); }
export async function instalar() {
  if (!promptEvt) return 'no-disponible';
  promptEvt.prompt();
  const r = await promptEvt.userChoice.catch(() => ({ outcome: 'dismissed' }));
  if (r.outcome === 'accepted') promptEvt = null;
  return r.outcome;
}

// ¿Mostramos la pantalla obligatoria? Solo en teléfonos y si no está abierta como app
export function necesitaInstalar() {
  if (!esMovil || instalada()) return false;
  try { if (sessionStorage.getItem('koing_sin_instalar') === '1') return false; } catch (e) {}
  return true;
}

// Ícono de "compartir" de Safari
const icoShare = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12M7 8l5-5 5 5"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg>';
const icoMas = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="4"/><path d="M12 8v8M8 12h8"/></svg>';
const icoDots = '<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>';

function pasos(lista) {
  return `<ol class="steps">${lista.map(([ic, t]) => `<li><span class="n">${ic}</span><span>${t}</span></li>`).join('')}</ol>`;
}

// Pinta la pantalla de instalación dentro de `el`. `onSeguir` se llama si la persona continúa en el navegador.
export function pantallaInstalar(el, onSeguir) {
  let estado = 'esperando';
  let quitar = null;
  const pintar = () => {
    let cuerpo = '', acciones = '', escape = false;
    if (estado === 'instalada') {
      cuerpo = `<h1>¡Listo, ya está instalada!</h1><p class="lead">Busca el ícono del cerdito en tu pantalla de inicio y ábrela desde ahí. Ya puedes cerrar esta pestaña.</p>`;
      escape = true;
    } else if (esInterno) {
      const url = location.href.replace(/^https?:\/\//, '');
      cuerpo = `<h1>Ábrela en ${esIOS ? 'Safari' : 'Chrome'} para instalarla</h1>
        <p class="lead">Estás dentro de otra app (como WhatsApp o Instagram) y desde aquí no se puede instalar.</p>
        ${esIOS ? pasos([[icoDots, 'Toca los <b>tres puntos</b> o el botón de <b>compartir</b> de esta ventana.'], ['2', 'Elige <b>Abrir en Safari</b>.'], ['3', 'Allá te pido instalarla con un toque.']]) : ''}`;
      acciones = esAndroid
        ? `<a class="btn block" href="intent://${url}#Intent;scheme=https;package=com.android.chrome;end">Abrir en Chrome</a>
           <button class="btn ghost block" data-inst="copiar">Copiar enlace</button>`
        : `<button class="btn block" data-inst="copiar">Copiar enlace</button>`;
      escape = true;
    } else if (esIOS) {
      cuerpo = `<h1>Instala KOING en tu iPhone</h1>
        <p class="lead">Así la abres como una app, a pantalla completa y sin buscar el link. Son 3 toques:</p>
        ${pasos([[icoShare, 'Toca <b>Compartir</b>, el cuadrito con la flecha (abajo en Safari).'], [icoMas, 'Baja y elige <b>Agregar a inicio</b>.'], ['3', 'Toca <b>Agregar</b>. El cerdito aparece en tu pantalla.']])}`;
      escape = true;
    } else if (puedeInstalar()) {
      cuerpo = `<h1>Instala KOING</h1><p class="lead">Un toque y queda en tu teléfono como una app: se abre a pantalla completa y funciona aunque se caiga el internet.</p>`;
      acciones = `<button class="btn block" data-inst="instalar">Instalar KOING</button>`;
    } else if (estado === 'sin-aviso') {
      cuerpo = `<h1>Instala KOING</h1><p class="lead">Desde el menú del navegador:</p>
        ${pasos([[icoDots, 'Toca los <b>tres puntos</b> arriba a la derecha.'], [icoMas, 'Elige <b>Instalar aplicación</b> o <b>Agregar a pantalla principal</b>.'], ['3', 'Confirma con <b>Instalar</b>.']])}`;
      escape = true;
    } else {
      cuerpo = `<h1>Instala KOING</h1><p class="lead">Preparando la instalación…</p>`;
      acciones = `<button class="btn block" disabled>Instalar KOING</button>`;
    }
    el.innerHTML = `<main class="intro a-fade install">
      <div class="pig-stage" style="height:200px"><div class="pig-float">${pig({ size: 150 })}</div></div>
      <div class="install-body">${cuerpo}</div>
      <div class="grow"></div>
      <div class="install-actions">${acciones}
        ${escape ? '<button class="btn link block" data-inst="seguir">Seguir en el navegador por ahora</button>' : ''}</div>
    </main>`;
  };
  pintar();
  quitar = alCambiar((ev) => { estado = ev === 'instalada' ? 'instalada' : estado; pintar(); });
  // Si en 3,5 s el navegador no ofrece instalar, mostramos los pasos del menú
  if (!esIOS && !esInterno && !puedeInstalar()) setTimeout(() => { if (!puedeInstalar() && estado === 'esperando') { estado = 'sin-aviso'; pintar(); } }, 3500);
  el.onclick = async (e) => {
    const b = e.target.closest('[data-inst]');
    if (!b) return;
    const a = b.dataset.inst;
    if (a === 'instalar') {
      const r = await instalar();
      if (r === 'accepted') { estado = 'instalada'; pintar(); }
    }
    if (a === 'copiar') {
      try { await navigator.clipboard.writeText(location.origin); b.textContent = 'Enlace copiado'; } catch (x) { b.textContent = location.origin; }
    }
    if (a === 'seguir') {
      try { sessionStorage.setItem('koing_sin_instalar', '1'); } catch (x) {}
      quitar && quitar(); el.onclick = null;
      onSeguir();
    }
  };
}
