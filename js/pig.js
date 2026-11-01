// El cerdito de KOING, dibujado en SVG para poder animar sus partes
export function pig({ size = 200, coin = 'idle', label = 'Cerdito de KOING', cls = '' } = {}) {
  const h = Math.round(size * (coin === 'drop' ? 1.25 : 0.9));
  const vb = coin === 'drop' ? '0 -70 200 250' : '0 0 200 180';
  const coinEl = coin === 'none' ? ''
    : coin === 'drop'
      ? '<g class="drop"><circle cx="100" cy="-38" r="17" fill="var(--coin)" stroke="var(--pig-line)" stroke-width="7"/></g>'
      : '<g class="coin-idle"><circle cx="100" cy="28" r="17" fill="var(--coin)" stroke="var(--pig-line)" stroke-width="7"/></g>';
  return `<svg class="pig ${cls}" width="${size}" height="${h}" viewBox="${vb}" role="img" aria-label="${label}">
  ${coinEl}
  <g class="${coin === 'drop' ? 'hop' : ''}">
    <path class="tail" d="M42 96 C26 96 22 78 34 76 C42 75 42 84 36 85" fill="none" stroke="var(--pig-line)" stroke-width="7" stroke-linecap="round"/>
    <path d="M60 128 L70 160 L86 160 L92 140 Z M116 140 L124 160 L140 160 L146 126 Z" fill="var(--pig-shade)" stroke="var(--pig-line)" stroke-width="7" stroke-linejoin="round"/>
    <path d="M128 66 L152 42 L150 78 Z" fill="var(--pig-fill)" stroke="var(--pig-line)" stroke-width="7" stroke-linejoin="round"/>
    <path d="M150 84 L180 80 L180 114 L150 112 Z" fill="var(--pig-fill)" stroke="var(--pig-line)" stroke-width="7" stroke-linejoin="round"/>
    <ellipse cx="100" cy="100" rx="62" ry="47" fill="var(--pig-fill)" stroke="var(--pig-line)" stroke-width="7"/>
    <path d="M66 112 Q100 146 150 116 L150 130 Q100 150 66 124 Z" fill="var(--pig-shade)" opacity=".55"/>
    <path d="M82 70 Q100 63 118 70" fill="none" stroke="var(--pig-line)" stroke-width="7" stroke-linecap="round"/>
    <ellipse class="eye" cx="140" cy="90" rx="6" ry="6" fill="var(--pig-line)"/>
  </g>
</svg>`;
}

export const shadow = (w = 150) => `<svg width="${w}" height="16" viewBox="0 0 150 16" aria-hidden="true"><ellipse class="pig-shadow" cx="75" cy="8" rx="70" ry="7" fill="var(--pig-line)" opacity=".22"/></svg>`;

// Íconos de trazo (sin emojis)
const P = {
  home: '<path d="M3 10.5L12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  list: '<path d="M4 6h16M4 12h16M4 18h10"/>',
  card: '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M7 15h4"/>',
  goal: '<path d="M9 11l3 3 8-8"/><path d="M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  back: '<path d="M15 18l-6-6 6-6"/>',
  chev: '<path d="M9 6l6 6-6 6"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  warn: '<path d="M12 3l9.5 17h-19z"/><path d="M12 10v4M12 17.5v.01"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  up: '<path d="M6 15l6-6 6 6"/>',
  down: '<path d="M6 9l6 6 6-6"/>',
  dl: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  bag: '<path d="M3 6h18l-2 12H5z"/><path d="M8 6V4h8v2"/>',
  store: '<path d="M3 21V8l9-5 9 5v13"/><path d="M9 21v-6h6v6"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/>',
  swap: '<path d="M7 7h13l-4-4M17 17H4l4 4"/>',
  share: '<path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M12 3v13M7 8l5-5 5 5"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>'
};
export const icon = (name, size = 24, sw = 2) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ''}</svg>`;
