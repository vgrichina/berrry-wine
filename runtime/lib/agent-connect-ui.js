// Start → Connect Agent… (docs/design-agent-connect.md, section 1).
//
// A view over lib/agent-connect.js and nothing more: every decision (what the
// link is, whether an answer is genuine, what the agent may do) is made
// there, and this file only draws its state and turns buttons into calls on
// the controller. Loaded on first use, so a page nobody pairs costs nothing.
//
//   Pair       the link, Copy / Share, countdown, the permission boxes
//   Request    who is asking: bot name, key label, self-reported label
//
// Those two need the player, so they are dialogs. Everything after Allow is
// a 🤖 session chip (lib/session-chips.js): its text says what the agent is
// doing, it blinks per command, it carries ✋ Take back while the agent
// drives, and its menu holds the mode radios, the permissions and
// Disconnect. Minimizing the pairing dialog also leaves a chip, counting
// down the link.
//
// Everything an agent chose (its name, its "runs as" label) is written with
// textContent: an agent is untrusted input like any other.

import { startPairing, current } from './agent-connect.js';
import { add as addChip, iconEl } from './session-chips.js';

const TERMINAL = ['closed', 'expired', 'denied', 'failed'];
const DEBUG_PAGE = /[?&]debug\b/.test(location.search);

const STYLE = `
  #wa-agent-dialog {
    position: fixed; z-index: 4900; left: 50%; top: 50%; transform: translate(-50%, -50%);
    width: 380px; max-width: calc(100vw - 16px); box-sizing: border-box;
    font-family: "Microsoft Sans Serif", "MS Sans Serif", Tahoma, Arial, sans-serif;
    font-size: 11px; color: #000; background: #c0c0c0;
    border: 1px solid; border-color: #dfdfdf #000 #000 #dfdfdf;
    box-shadow: inset 1px 1px #fff, inset -1px -1px #808080, 2px 2px 0 rgba(0,0,0,.25);
    padding: 1px; user-select: none;
  }
  #wa-agent-dialog[hidden] { display: none; }
  #wa-agent-dialog .title {
    display: flex; align-items: center; gap: 2px; height: 18px; margin: 1px;
    padding: 0 2px 0 4px; color: #fff; font-weight: bold;
    background: linear-gradient(to right, #000080, #1084d0);
  }
  #wa-agent-dialog .title { cursor: default; touch-action: none; }
  #wa-agent-dialog .title span { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  #wa-agent-dialog .title button {
    width: 16px; height: 14px; padding: 0; font: bold 10px/1 Arial, sans-serif;
    background: #c0c0c0; color: #000; border: 1px solid; border-color: #fff #000 #000 #fff;
    box-shadow: inset -1px -1px #808080; cursor: pointer;
  }
  #wa-agent-dialog .client { padding: 10px 12px 12px; line-height: 15px; }
  #wa-agent-dialog .head { display: flex; gap: 10px; align-items: flex-start; margin-bottom: 8px; }
  #wa-agent-dialog .head .big { font-size: 26px; line-height: 30px; width: 32px; height: 32px; flex: none; }
  #wa-agent-dialog .head b { font-size: 12px; }
  #wa-agent-dialog .muted { color: #404040; }
  #wa-agent-dialog .link {
    width: 100%; box-sizing: border-box; margin: 4px 0; padding: 3px 4px;
    font: 11px/14px "Lucida Console", Consolas, monospace; background: #fff; color: #000;
    border: 1px solid; border-color: #808080 #fff #fff #808080; box-shadow: inset 1px 1px #000;
    user-select: text; -webkit-user-select: text;
  }
  @media (pointer: coarse) { #wa-agent-dialog .link { font-size: 16px; } } /* iOS zooms on focus below 16px */
  #wa-agent-dialog .row { display: flex; align-items: center; gap: 6px; margin: 6px 0; flex-wrap: wrap; }
  #wa-agent-dialog .row .grow { flex: 1; }
  #wa-agent-dialog fieldset { border: 1px solid; border-color: #808080 #fff #fff #808080; margin: 8px 0; padding: 4px 8px 6px; }
  #wa-agent-dialog legend { padding: 0 3px; }
  #wa-agent-dialog label { display: flex; align-items: center; gap: 5px; margin: 3px 0; cursor: pointer; }
  #wa-agent-dialog label.off { color: #808080; cursor: default; }
  #wa-agent-dialog input[type=checkbox], #wa-agent-dialog input[type=radio] { margin: 0; accent-color: #000; }
  #wa-agent-dialog button.btn {
    min-width: 75px; height: 23px; padding: 0 8px; font: inherit; color: #000; background: #c0c0c0; cursor: pointer;
    border: 1px solid; border-color: #fff #000 #000 #fff; box-shadow: inset -1px -1px #808080, inset 1px 1px #dfdfdf;
  }
  #wa-agent-dialog button.btn.default { outline: 1px solid #000; outline-offset: -1px; }
  #wa-agent-dialog button.btn:active { border-color: #000 #fff #fff #000; box-shadow: none; }
  #wa-agent-dialog button.btn[disabled] { color: #808080; text-shadow: 1px 1px #fff; cursor: default; }
  #wa-agent-dialog .buttons { display: flex; justify-content: flex-end; gap: 6px; margin-top: 10px; }
  #wa-agent-dialog .spin::before { content: "◌ "; display: inline-block; animation: wa-agent-spin 1.2s linear infinite; }
  @keyframes wa-agent-spin { to { transform: rotate(360deg); } }
  #wa-agent-dialog .dot { color: #008000; }
  #wa-agent-dialog .warn { color: #800000; }
  #wa-agent-dialog code { font: 11px "Lucida Console", Consolas, monospace; word-break: break-all; }

`;

let dialog = null;
let chip = null;
let pairing = null;
let unsubscribe = null;
let tick = null;
let perms = { see: true, control: true, eval: false };
let remember = false;

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

function installChrome() {
  if (dialog) return;
  document.head.append(h('style', { id: 'wa-agent-style', text: STYLE }));
  dialog = h('div', { id: 'wa-agent-dialog', role: 'dialog', 'aria-label': 'Connect an Agent', hidden: true });
  document.body.append(dialog);
  wireDrag(dialog);

  window.addEventListener('agent-connect-action', () => { if (chip) chip.pulse(); });
}

// Drag by the title bar, mouse or finger, like the Read Me window: kept on
// screen so the bar can never be parked where it cannot be grabbed again.
// Wired once on the dialog, because each state change rebuilds the bar. The
// first drag trades the centring transform for explicit coordinates, which
// then survive every later state change.
function wireDrag(win) {
  let drag = null;
  win.addEventListener('pointerdown', (e) => {
    const bar = e.target.closest('.title');
    if (!bar || e.button !== 0 || e.target.closest('button')) return;
    const r = win.getBoundingClientRect();
    win.style.transform = 'none';
    win.style.left = `${Math.round(r.left)}px`;
    win.style.top = `${Math.round(r.top)}px`;
    drag = { id: e.pointerId, dx: e.clientX - r.left, dy: e.clientY - r.top, barH: bar.offsetHeight };
    win.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  win.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const maxX = Math.max(0, window.innerWidth - win.offsetWidth);
    const maxY = Math.max(0, window.innerHeight - drag.barH - 8);
    win.style.left = `${Math.round(Math.min(maxX, Math.max(0, e.clientX - drag.dx)))}px`;
    win.style.top = `${Math.round(Math.min(maxY, Math.max(0, e.clientY - drag.dy)))}px`;
  });
  const end = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    drag = null;
    try { win.releasePointerCapture(e.pointerId); } catch (_) { /* already released */ }
  };
  win.addEventListener('pointerup', end);
  win.addEventListener('pointercancel', end);
}

function fmtCountdown(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function ago(t) {
  if (!t) return '';
  const s = Math.round((Date.now() - t) / 1000);
  return s < 60 ? `${s}s ago` : `${Math.round(s / 60)} min ago`;
}

function shareText(link) {
  return `Connect to my Windows 98 game and play it with me: ${link}`;
}

async function copyLink(link, status) {
  const text = shareText(link);
  try {
    await navigator.clipboard.writeText(text);
    status.textContent = 'Copied. Paste it to your agent.';
  } catch (_) {
    // Plain-http LAN pages have no Clipboard API: select it for the person.
    const box = dialog.querySelector('.link');
    if (box) { box.focus(); box.select(); }
    status.textContent = 'Press Ctrl+C (or ⌘C) to copy the selected link.';
  }
}

function setPerm(key, value) {
  perms = Object.assign({}, perms, { [key]: value });
  if (pairing) pairing.setPerms(perms);
}

function permBoxes() {
  const box = (key, text, enabled) => h('label', { class: enabled ? null : 'off' },
    h('input', { type: 'checkbox', checked: !!perms[key], disabled: !enabled,
      onchange: (e) => setPerm(key, e.target.checked) }),
    text);
  return h('fieldset', {},
    h('legend', { text: 'Agent may' }),
    box('see', 'see the screen', true),
    box('control', 'use the mouse and keyboard', true),
    box('eval', DEBUG_PAGE ? 'run page code (eval)' : 'run page code (eval): only on ?debug pages', DEBUG_PAGE));
}

function titleBar(text, onClose, closeLabel) {
  return h('div', { class: 'title' },
    h('span', { text }),
    h('button', { type: 'button', title: closeLabel || 'Close', 'aria-label': closeLabel || 'Close', onclick: onClose },
      closeLabel === 'Minimize' ? '_' : '×'));
}

function viewPair(s) {
  const status = h('span', { class: 'grow muted' });
  const left = h('span', { class: 'muted' });
  const buttons = [
    h('button', { class: 'btn default', type: 'button', disabled: !s.link, onclick: () => copyLink(s.link, status) }, 'Copy'),
  ];
  if (s.link && navigator.share) {
    buttons.push(h('button', { class: 'btn', type: 'button',
      onclick: () => navigator.share({ title: 'Play with me', text: shareText(s.link) }).catch(() => {}) }, 'Share'));
  }
  const body = h('div', { class: 'client' },
    h('div', { class: 'head' }, iconEl('robot', 32, 'big'),
      h('div', {}, h('b', { text: 'Let an AI agent see and play this session.' }),
        h('div', { class: 'muted', text: 'Give this link to your agent. Any AI agent that can run commands on a computer will do.' }))),
    s.link
      ? h('input', { class: 'link', type: 'text', readonly: true, value: s.link, 'aria-label': 'Link for your agent',
          onfocus: (e) => e.target.select() })
      : h('div', { class: 'link muted' }, h('span', { class: 'spin', text: 'Making a link…' })),
    h('div', { class: 'row' }, ...buttons, status, left),
    permBoxes(),
    h('div', { class: 'row' },
      h('span', { class: `grow ${s.link ? 'spin' : ''}`, text: s.link ? 'Waiting for an agent…' : '' }),
      h('button', { class: 'btn', type: 'button', onclick: cancel }, 'Cancel')),
    s.token ? h('div', { class: 'muted' }, 'Agent already has the skill? It needs only ', h('code', { text: `${s.token.slice(0, 14)}…` }),
      ' (the part after #).') : null);
  const update = () => {
    const st = pairing && pairing.state;
    if (st && st.expires) left.textContent = `${fmtCountdown(st.expires - Date.now())} left`;
  };
  update();
  return { title: 'Connect an Agent', body, update, close: hide, closeLabel: 'Minimize' };
}

function viewAsk(s) {
  const bot = s.bot || {};
  const can = [perms.see && 'see the screen', perms.control && 'use the mouse and keyboard', perms.eval && 'run page code']
    .filter(Boolean).join(', ') || 'nothing yet (no permissions ticked)';
  const body = h('div', { class: 'client' },
    h('div', { class: 'head' }, iconEl('robot', 32, 'big'),
      h('div', {},
        h('b', {}, h('span', { text: bot.username || 'An agent' }), ' wants to connect.'),
        h('div', {}, 'key ', h('code', { text: bot.keyLabel || '?' }), ' ',
          h('span', { class: 'muted', text: bot.knownSince
            ? `(known since ${new Date(bot.knownSince).toLocaleDateString()})` : '(new agent)' })),
        bot.runsAs ? h('div', {}, 'says it runs as: ', h('span', { text: String(bot.runsAs).slice(0, 60) }),
          h('span', { class: 'muted', text: ' (unverified)' })) : null,
        h('div', { class: 'muted', text: 'via the link you just made' }))),
    h('div', {}, `It will be able to: ${can}.`),
    h('label', {}, h('input', { type: 'checkbox', checked: remember, onchange: (e) => { remember = e.target.checked; } }),
      'Remember this agent on this device'),
    h('div', { class: 'buttons' },
      h('button', { class: 'btn default', type: 'button', onclick: () => pairing.allow({ remember }) }, 'Allow'),
      h('button', { class: 'btn', type: 'button', onclick: () => pairing.deny() }, 'Deny')));
  return { title: 'Connect an Agent', body, close: () => pairing.deny() };
}

function viewConnecting() {
  const body = h('div', { class: 'client' }, h('div', { class: 'spin', text: 'Connecting to the agent…' }),
    h('div', { class: 'buttons' }, h('button', { class: 'btn', type: 'button', onclick: cancel }, 'Cancel')));
  return { title: 'Connect an Agent', body, close: hide, closeLabel: 'Minimize' };
}

// --- the 🤖 chip -----------------------------------------------------------

function botName(s) { return (s.bot && s.bot.username) || 'agent'; }

function agentMenu() {
  const s = pairing && pairing.state;
  if (!s) return [];
  if (s.phase === 'gathering' || s.phase === 'waiting') {
    return [
      { header: 'Waiting for an agent', icon: 'robot' },
      { sub: s.expires ? `link expires in ${fmtCountdown(s.expires - Date.now())}` : 'making a link…' },
      { sep: true },
      { text: 'Show link…', onclick: showDialog },
      { text: 'Cancel', onclick: cancel },
    ];
  }
  if (s.phase === 'connecting') return [{ header: 'Connecting…', icon: 'robot' }, { sep: true }, { text: 'Cancel', onclick: cancel }];
  const bot = s.bot || {};
  const mode = (value, text) => ({ text, radio: true, checked: s.mode === value, onclick: () => pairing.setMode(value) });
  const perm = (key, text, enabled = true) => ({ text, check: true, checked: !!s.perms[key], disabled: !enabled,
    onclick: () => setPerm(key, !s.perms[key]) });
  return [
    { header: `${botName(s)}${s.rtt != null ? ` · ${s.rtt} ms` : ''}`, icon: 'robot' },
    { sub: `key ${bot.keyLabel || '?'}${bot.runsAs ? ` · runs as ${String(bot.runsAs).slice(0, 40)} (unverified)` : ''}` },
    { sub: s.lastAction ? `last: ${s.lastAction} · ${ago(s.lastActionAt)} · ${s.commands} command${s.commands === 1 ? '' : 's'}` : 'no actions yet' },
    { sep: true },
    mode('drive', 'Agent drives'),
    mode('watch', 'Watch only'),
    mode('paused', 'Paused'),
    { sep: true },
    perm('see', 'May see the screen'),
    perm('control', 'May use mouse and keyboard'),
    perm('eval', DEBUG_PAGE ? 'May run page code' : 'May run page code (?debug only)', DEBUG_PAGE),
    { sep: true },
    { text: 'Disconnect', onclick: () => pairing.disconnect() },
  ];
}

function chipSpec(s) {
  const name = botName(s);
  const base = { icon: 'robot', badge: null, action: null, onclick: null, menu: agentMenu, tone: 'normal' };
  switch (s.phase) {
    case 'gathering':
      return Object.assign(base, { text: 'making a link…', short: '…', title: 'AI agent: making a link' });
    case 'waiting': {
      const left = s.expires ? fmtCountdown(s.expires - Date.now()) : '';
      return Object.assign(base, { badge: 'hourglass', text: `waiting for agent… ${left}`, short: left, title: 'AI agent: waiting for your agent to use the link' });
    }
    case 'asking':
      return Object.assign(base, { tone: 'attention', menu: null, onclick: showDialog,
        text: `${name} wants to connect — Allow?`, short: 'Allow?', title: `${name} wants to connect` });
    case 'connecting':
      return Object.assign(base, { text: 'connecting…', short: '…', title: 'AI agent: connecting' });
    default:
      if (s.mode === 'drive') {
        return Object.assign(base, { tone: 'drive', text: `${name} driving`, short: '', title: `${name} is driving. Its menu has the mode, permissions and Disconnect.`,
          action: { icon: 'hand', label: 'Take back', short: '', title: 'Use your own mouse and keyboard again (the agent keeps watching)',
            onclick: () => pairing && pairing.takeBack() } });
      }
      if (s.mode === 'watch') return Object.assign(base, { badge: 'eye', text: `${name} watching`, short: '', title: `${name} is watching` });
      return Object.assign(base, { tone: 'dim', badge: 'pause', text: `${name} paused`, short: '', title: `${name} is paused` });
  }
}

function syncChip(s) {
  if (!s || TERMINAL.includes(s.phase)) {
    if (chip) { chip.remove(); chip = null; }
    return;
  }
  const spec = chipSpec(s);
  if (chip) chip.update(spec);
  else chip = addChip(Object.assign({ id: 'agent' }, spec));
}

function viewEnded(s) {
  const text = {
    closed: 'The agent is disconnected.',
    expired: 'The link expired before an agent answered.',
    denied: 'You denied the agent.',
    failed: 'The connection failed.',
  }[s.phase];
  const body = h('div', { class: 'client' },
    h('div', { class: 'head' }, iconEl('robot', 32, 'big'),
      h('div', {}, h('b', { text }), s.error && s.phase !== 'denied' ? h('div', { class: 'muted', text: s.error }) : null)),
    h('div', { class: 'buttons' },
      h('button', { class: 'btn default', type: 'button', onclick: () => begin() }, 'New Link'),
      h('button', { class: 'btn', type: 'button', onclick: hide }, 'Close')));
  return { title: 'Connect an Agent', body, close: hide };
}

let renderedPhase = null;
let view = null;

function render(s) {
  syncChip(s);
  if (!s) return;
  // Rebuild only on a phase or mode change, so a countdown tick or a command
  // counter never throws away a half-selected link or a focused checkbox.
  const key = `${s.phase}|${s.mode}|${!!s.link}`;
  if (key === renderedPhase) { if (view && view.update) view.update(); return; }
  renderedPhase = key;
  // Allowed and connected: the dialog closes into the chip.
  if (s.phase === 'connected') { view = null; dialog.replaceChildren(); dialog.hidden = true; return; }
  const pick = { gathering: viewPair, waiting: viewPair, asking: viewAsk, connecting: viewConnecting };
  view = (pick[s.phase] || viewEnded)(s);
  dialog.replaceChildren(titleBar(view.title, view.close, view.closeLabel), view.body);
  // Surface the two moments that need the player even if they minimized us.
  if (s.phase === 'asking' || (TERMINAL.includes(s.phase) && s.phase !== 'denied')) dialog.hidden = false;
}

async function begin() {
  if (unsubscribe) unsubscribe();
  renderedPhase = null;
  render({ phase: 'gathering', mode: 'drive', link: null });
  dialog.hidden = false;
  try {
    pairing = await startPairing({ perms });
  } catch (err) {
    render({ phase: 'failed', error: `could not start: ${err && err.message || err}`, mode: 'drive' });
    return;
  }
  unsubscribe = pairing.subscribe(render);
}

function cancel() {
  if (pairing && !TERMINAL.includes(pairing.state.phase)) pairing.disconnect();
  hide();
}

function hide() {
  if (dialog) dialog.hidden = true;
}

function showDialog() {
  if (dialog && view) dialog.hidden = false;
}

// Start menu entry. Reopens a live session rather than replacing it: the
// dialog while pairing, the chip's menu once connected.
export function open() {
  installChrome();
  if (!tick) {
    tick = setInterval(() => {
      if (view && view.update && !dialog.hidden) view.update();
      if (chip && pairing && pairing.state.phase === 'waiting') syncChip(pairing.state); // the countdown
    }, 1000);
  }
  const live = pairing || current();
  if (live && !TERMINAL.includes(live.state.phase)) {
    pairing = live;
    if (live.state.phase === 'connected') { if (chip) chip.openMenu(); }
    else dialog.hidden = false;
    return pairing;
  }
  begin();
  return null;
}

export function controller() { return pairing; }
