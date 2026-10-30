// Session chips: one small status item per live side feature of a session
// (an attached agent, a recording, a LAN room), each with a Win98 tray-style
// popup menu. Setup and consent stay dialogs; once a feature is running it is
// just a chip, so nothing holds a window open over the game.
//
//   const chip = window.wineSession.add({ id, domId, icon, text, short, tone, title,
//                                         action: { label, title, onclick }, menu: () => items });
//   chip.update({ text, tone, ... });  chip.pulse();  chip.openMenu();  chip.remove();
//
//   icon, badge   names from ICONS: the chip's identity before its text, and a
//          state mark after it (the agent's eye while it watches)
//   tone   'normal' | 'live' | 'attention' (yellow outline, never dims) |
//          'drive' (blue) | 'dim'
//   action { icon, label, short, title, onclick }: one inline button
//   items  { header: text, icon } | { sub: text } | { sep: true } |
//          { text, check|radio: bool, checked, disabled, onclick }
//
// Two renderers over one model, picked by what is on screen:
//   tray   the desktop taskbar is showing: chips sit in the clock area, short
//          text ("🤖 ✋", "● 0:42"), menus open upward like a tray icon's.
//   float  no taskbar (single-app, phone, fullscreen): one strip top right,
//          over the game but never resizing it, dimmed after 3s without news.
// The canvas is what agents screenshot and what the recorder captures, so
// chips are never in either picture.
//
// Loaded as a module by whoever needs it first (agent-connect-ui.js,
// recorder.js); it also sets window.wineSession for classic scripts.

const STYLE = `
  .wa-chips {
    display: flex; align-items: stretch; color: #000; user-select: none; -webkit-user-select: none;
    font: 11px "Microsoft Sans Serif", "MS Sans Serif", Tahoma, Arial, sans-serif;
  }
  .wa-chips[hidden] { display: none; }
  .wa-chips.float {
    position: fixed; z-index: 4850; padding: 1px; background: #c0c0c0;
    top: calc(8px + env(safe-area-inset-top, 0px)); right: calc(8px + env(safe-area-inset-right, 0px));
    border: 1px solid; border-color: #fff #000 #000 #fff;
    box-shadow: inset -1px -1px #808080, 2px 2px 0 rgba(0,0,0,.35);
    transition: opacity .4s;
  }
  body.single-app.app-running:not(.no-debug) .wa-chips.float { top: calc(30px + env(safe-area-inset-top, 0px)); } /* under the debug peek */
  /* Left of the round exit-fullscreen button (40px at top 16, right 18 in
     index.html) and centred on it: covering the only way out of a full-screen
     game is worse than any chip. */
  body.page-fullscreen .wa-chips.float,
  body.single-app.exclusive-fullscreen .wa-chips.float,
  body.windowed-phone.windowed-focus-close .wa-chips.float {
    top: calc(24px + env(safe-area-inset-top, 0px)); right: calc(66px + env(safe-area-inset-right, 0px));
  }
  .wa-chips.float.idle { opacity: .55; }
  .wa-chips.float.idle:hover { opacity: 1; }
  .wa-chips.tray { height: 20px; margin-right: 2px; gap: 1px; }

  .wa-chip {
    display: flex; align-items: center; gap: 4px; padding: 0 7px; height: 20px; white-space: nowrap;
    border: 1px solid transparent; background: none; color: inherit; font: inherit; cursor: pointer;
  }
  .wa-chips.float .wa-chip + .wa-chip { box-shadow: -1px 0 #808080, -2px 0 #fff; margin-left: 2px; }
  .wa-chips.tray .wa-chip { padding: 0 3px; height: 20px; }
  .wa-chip.pressed { border-color: #000 #fff #fff #000; background: #d4d4d4; }
  .wa-icon { display: inline-block; vertical-align: middle; flex: none; }
  .wa-chip .wa-icon { width: 16px; height: 16px; }
  .wa-chip.drive { background: #000080; color: #fff; }
  .wa-chip.dim { color: #606060; }
  .wa-chip.attention { outline: 2px solid #ffd75e; outline-offset: -2px; animation: wa-chip-attn 1s steps(2) infinite; }
  @keyframes wa-chip-attn { 50% { outline-color: #000080; } }
  .wa-chip.pulse { animation: wa-chip-pulse .4s steps(2) 1; }
  @keyframes wa-chip-pulse { 50% { background: #000080; color: #fff; } }
  .wa-chip .act {
    display: inline-flex; align-items: center; gap: 3px;
    margin-left: 3px; padding: 0 5px; height: 16px; line-height: 12px; font: inherit; color: #000; background: #c0c0c0; cursor: pointer;
    border: 1px solid; border-color: #fff #000 #000 #fff; box-shadow: inset -1px -1px #808080;
  }
  .wa-chip .act:active { border-color: #000 #fff #fff #000; box-shadow: none; }

  .wa-chip-menu {
    position: fixed; z-index: 4950; min-width: 190px; max-width: calc(100vw - 16px); padding: 3px; box-sizing: border-box;
    background: #c0c0c0; color: #000; font: 11px "Microsoft Sans Serif", "MS Sans Serif", Tahoma, Arial, sans-serif;
    border: 1px solid; border-color: #dfdfdf #000 #000 #dfdfdf;
    box-shadow: inset 1px 1px #fff, inset -1px -1px #808080, 2px 2px 0 rgba(0,0,0,.35);
    user-select: none; -webkit-user-select: none;
  }
  .wa-chip-menu .it { position: relative; padding: 3px 18px 3px 22px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .wa-chip-menu .it.cmd { cursor: pointer; }
  .wa-chip-menu .it.cmd:hover, .wa-chip-menu .it.cmd:focus { background: #000080; color: #fff; outline: none; }
  .wa-chip-menu .it.off { color: #808080; text-shadow: 1px 1px #fff; cursor: default; }
  .wa-chip-menu .it.off:hover { background: none; color: #808080; }
  .wa-chip-menu .it.hd { padding-left: 6px; font-weight: 700; }
  .wa-chip-menu .it.sub { padding-left: 6px; color: #404040; }
  .wa-chip-menu .it .mk { position: absolute; left: 7px; }
  .wa-chip-menu .it.hd { display: flex; align-items: center; gap: 4px; }
  .wa-chip-menu .sep { margin: 3px 1px; border-top: 1px solid #808080; border-bottom: 1px solid #fff; }
  @media (pointer: coarse) { .wa-chip-menu .it { padding-top: 7px; padding-bottom: 7px; } }
`;

// Pixel-art icons drawn by RetroDiffusion through berrry's image endpoint.
// Always the deployed site's URL, not this page's origin: a local dev server
// has no image API, and berrry caches by URL, so one fixed URL per icon (same
// size, style, prompt and seed) is generated once and every page after that
// shows the same pixels. Each keeps an emoji to fall back on if the image
// cannot load (offline, a blocked request).
const ICON_BASE = 'https://wine-assembly.berrry.app/api/retrodiffusion/image/32/32/mc_item';
export const ICONS = Object.freeze({
  robot: ['friendly+robot+head+with+antenna+windows+98+desktop+icon', '🤖'],
  record: ['red+record+button+dot+video+camera+windows+98+icon', '●'],
  lan: ['blue+globe+with+network+cable+windows+98+network+icon', '🌐'],
  hand: ['raised+open+hand+palm+stop+gesture+icon', '✋'],
  eye: ['single+open+eye+watching+icon', '👁'],
  pause: ['pause+symbol+two+vertical+bars+icon', '⏸'],
  hourglass: ['small+hourglass+with+sand+timer+icon', '⏳'],
});

export function iconUrl(name) {
  const icon = ICONS[name];
  return icon ? `${ICON_BASE}?prompt=${icon[0]}&remove_bg=true&seed=7` : null;
}

// An <img> for a named icon, or the text itself for anything else.
export function iconEl(name, size = 16, cls = 'ico') {
  const icon = ICONS[name];
  if (!icon) return h('span', { class: cls, text: name });
  const img = h('img', { class: `${cls} wa-icon`, src: iconUrl(name), alt: icon[1], width: String(size), height: String(size),
    draggable: 'false', 'data-icon': name });
  img.addEventListener('error', () => img.replaceWith(h('span', { class: cls, 'data-icon': name, text: icon[1] })), { once: true });
  return img;
}

const IDLE_MS = 3000;
const chips = new Map();   // id -> { spec, el }
let strip = null;
let menu = null;           // { id, el }
let idleTimer = null;
let installed = false;

function h(tag, props, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else if (v === true) node.setAttribute(k, '');
    else node.setAttribute(k, v);
  }
  for (const c of children.flat()) if (c) node.append(c);
  return node;
}

function install() {
  if (installed) return;
  installed = true;
  document.head.append(h('style', { id: 'wa-chips-style', text: STYLE }));
  strip = h('div', { class: 'wa-chips', id: 'wa-chips', role: 'status', 'aria-label': 'Session' });
  strip.addEventListener('pointerenter', wake);
  place();
  // Placement follows the shell: launching an app in single-app mode hides
  // the taskbar, and fullscreen shows only the fullscreen element's subtree.
  new MutationObserver(place).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  window.addEventListener('resize', place);
  document.addEventListener('fullscreenchange', place);
  document.addEventListener('webkitfullscreenchange', place);
  document.addEventListener('pointerdown', (e) => {
    if (menu && !menu.el.contains(e.target) && !(e.target.closest && e.target.closest('.wa-chip'))) closeMenu();
  }, true);
  document.addEventListener('keydown', (e) => { if (menu && e.key === 'Escape') closeMenu(); }, true);
}

function fullscreenHost() {
  const fs = document.fullscreenElement || document.webkitFullscreenElement;
  // A fullscreened <canvas> has no subtree to put anything in.
  return fs && fs.tagName !== 'CANVAS' ? fs : null;
}

function mode() {
  if (fullscreenHost()) return 'float';
  const bar = document.getElementById('taskbar');
  const clock = document.getElementById('clock-area');
  return bar && clock && bar.getClientRects().length && getComputedStyle(bar).display !== 'none' ? 'tray' : 'float';
}

function place() {
  if (!strip) return;
  const m = mode();
  if (m === 'tray') {
    const clock = document.getElementById('clock-area');
    // A sibling of #notify-icons, not a child: the renderer rebuilds that
    // container from the guest's Shell_NotifyIcon state on every change.
    const icons = document.getElementById('notify-icons');
    if (strip.parentNode !== clock) clock.insertBefore(strip, icons && icons.parentNode === clock ? icons : clock.firstChild);
  } else {
    const host = fullscreenHost() || document.body;
    if (strip.parentNode !== host) host.append(strip);
  }
  if (!strip.classList.contains(m)) {
    strip.classList.remove('tray', 'float');
    strip.classList.add(m);
    for (const c of chips.values()) draw(c);
    if (menu) closeMenu();
  }
  if (menu && menu.el.parentNode !== (fullscreenHost() || document.body)) (fullscreenHost() || document.body).append(menu.el);
  strip.hidden = chips.size === 0;
}

function wake() {
  if (!strip) return;
  strip.classList.remove('idle');
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    const attention = [...chips.values()].some(c => c.spec.tone === 'attention');
    if (!menu && !attention) strip.classList.add('idle');
  }, IDLE_MS);
}

function draw(c) {
  const s = c.spec;
  // Redrawn on every update (a countdown, each agent command): reuse the icon
  // nodes, so an image is not reloaded and does not blink once a second.
  const icons = c.icons || (c.icons = new Map());
  const icon = (name, cls) => {
    const key = `${name}|${cls}`;
    if (!icons.has(key)) icons.set(key, iconEl(name, 16, cls));
    return icons.get(key);
  };
  const tray = strip.classList.contains('tray');
  const text = tray && s.short != null ? s.short : s.text;
  c.el.className = `wa-chip ${s.tone || 'normal'}${menu && menu.id === s.id ? ' pressed' : ''}`;
  c.el.title = s.title || s.text || '';
  c.el.setAttribute('aria-label', s.title || s.text || s.id);
  const parts = [];
  if (s.icon) parts.push(icon(s.icon, 'ico'));
  if (text) parts.push(h('span', { class: 'txt', text }));
  if (s.badge) parts.push(icon(s.badge, 'badge'));
  if (s.action) {
    const a = s.action;
    const label = tray && a.short != null ? a.short : a.label;
    parts.push(h('button', { class: 'act', type: 'button', title: a.title || a.label, 'aria-label': a.label,
      onclick: (e) => { e.stopPropagation(); a.onclick(); } }, a.icon ? icon(a.icon, 'act-ico') : null, label || null));
  }
  c.el.replaceChildren(...parts);
}

function closeMenu() {
  if (!menu) return;
  const id = menu.id;
  menu.el.remove();
  menu = null;
  const c = chips.get(id);
  if (c) draw(c);
  wake();
}

function buildMenu(c) {
  const items = (typeof c.spec.menu === 'function' ? c.spec.menu() : c.spec.menu) || [];
  return items.filter(Boolean).map((it) => {
    if (it.sep) return h('div', { class: 'sep' });
    if (it.header != null) return h('div', { class: 'it hd' }, it.icon ? iconEl(it.icon) : null, h('span', { text: it.header }));
    if (it.sub != null) return h('div', { class: 'it sub', text: it.sub });
    const mark = it.radio ? (it.checked ? '●' : '') : it.check ? (it.checked ? '✓' : '') : '';
    const row = h('div', { class: `it ${it.disabled ? 'off' : 'cmd'}`, role: it.radio ? 'menuitemradio' : it.check ? 'menuitemcheckbox' : 'menuitem',
      'aria-checked': it.radio || it.check ? String(!!it.checked) : null, 'aria-disabled': it.disabled ? 'true' : null,
      tabindex: it.disabled ? null : '-1', title: it.title },
    mark ? h('span', { class: 'mk', text: mark }) : null, it.text);
    row.waItem = it;
    return row;
  });
}

// One delegated listener reading the row's item, so a refresh can patch rows
// in place: an agent updates its chip on every command, and replacing the
// row under the pointer between press and release would swallow the click.
function onMenuClick(e) {
  const row = e.target.closest && e.target.closest('.it');
  const it = row && row.waItem;
  if (!it || it.disabled) return;
  e.stopPropagation();
  // Radios and checks keep the menu up, the way a toggle in a tray menu reads
  // back its new state; commands close it.
  const keep = it.radio || it.check;
  if (!keep) closeMenu();
  if (it.onclick) it.onclick();
  if (keep && menu) refreshMenu();
}

function positionMenu() {
  const c = chips.get(menu.id);
  const r = c.el.getBoundingClientRect();
  const el = menu.el;
  const w = el.offsetWidth, hgt = el.offsetHeight;
  const left = Math.max(4, Math.min(window.innerWidth - w - 4, r.right - w));
  const below = r.bottom + 2;
  const top = strip.classList.contains('tray') || below + hgt > window.innerHeight - 4 ? Math.max(4, r.top - hgt - 2) : below;
  el.style.left = `${Math.round(left)}px`;
  el.style.top = `${Math.round(top)}px`;
}

function refreshMenu() {
  if (!menu) return;
  const c = chips.get(menu.id);
  if (!c) { closeMenu(); return; }
  const rows = buildMenu(c);
  const old = [...menu.el.children];
  const same = old.length === rows.length && old.every((o, i) => o.className.split(' ')[0] === rows[i].className.split(' ')[0]
    && o.getAttribute('role') === rows[i].getAttribute('role'));
  if (!same) menu.el.replaceChildren(...rows);
  else {
    old.forEach((o, i) => {
      const n = rows[i];
      o.waItem = n.waItem;
      for (const a of ['class', 'aria-checked', 'aria-disabled', 'tabindex', 'title']) {
        if (n.hasAttribute(a)) o.setAttribute(a, n.getAttribute(a)); else o.removeAttribute(a);
      }
      o.replaceChildren(...n.childNodes);
    });
  }
  positionMenu();
}

function openMenu(id) {
  const c = chips.get(id);
  if (!c) return;
  if (menu) { const same = menu.id === id; closeMenu(); if (same) return; }
  if (!c.spec.menu) { c.spec.onclick && c.spec.onclick(); return; }
  menu = { id, el: h('div', { class: 'wa-chip-menu', role: 'menu', 'aria-label': c.spec.title || id, 'data-chip': id }) };
  menu.el.addEventListener('click', onMenuClick);
  (fullscreenHost() || document.body).append(menu.el);
  refreshMenu();
  draw(c);
  wake();
}

export function add(spec) {
  install();
  if (chips.has(spec.id)) chips.get(spec.id).handle.remove();
  const c = { spec: Object.assign({}, spec), el: null, handle: null };
  c.el = h('div', { class: 'wa-chip', role: 'button', tabindex: '0', 'data-chip': spec.id, id: spec.domId,
    onclick: () => (c.spec.onclick && !c.spec.menu ? c.spec.onclick() : openMenu(c.spec.id)),
    onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openMenu(c.spec.id); } } });
  c.handle = {
    get id() { return c.spec.id; },
    get el() { return c.el; },
    update(patch) {
      Object.assign(c.spec, patch);
      draw(c);
      if (menu && menu.id === c.spec.id) refreshMenu();
      if (c.spec.tone === 'attention') wake();
    },
    pulse() {
      c.el.classList.remove('pulse');
      void c.el.offsetWidth; // restart the animation
      c.el.classList.add('pulse');
      wake();
    },
    openMenu: () => { if (!menu || menu.id !== c.spec.id) openMenu(c.spec.id); },
    closeMenu: () => { if (menu && menu.id === c.spec.id) closeMenu(); },
    remove() {
      if (chips.get(c.spec.id) !== c) return;
      if (menu && menu.id === c.spec.id) closeMenu();
      chips.delete(c.spec.id);
      c.el.remove();
      place();
    },
  };
  chips.set(spec.id, c);
  strip.append(c.el);
  draw(c);
  place();
  wake();
  return c.handle;
}

export function get(id) { const c = chips.get(id); return c ? c.handle : null; }
export function list() { return [...chips.keys()]; }
export function placement() { return strip ? (strip.classList.contains('tray') ? 'tray' : 'float') : null; }

if (typeof window !== 'undefined') window.wineSession = { add, get, list, placement };
