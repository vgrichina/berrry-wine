// The page's half of "Connect an Agent" (docs/design-agent-connect.md): make
// a one-paste link, find the agent's sealed answer, ask the player, and then
// serve the agent's commands over a WebRTC DataChannel.
//
// The Start-menu dialog in index.html is only a view of this module's state;
// everything that decides anything lives here, so a test can drive a pairing
// with no dialog at all.
//
//   const pairing = await startPairing({ onState });
//   pairing.link                 what the player gives their agent
//   pairing.allow() / deny()     the consent buttons
//   pairing.setPerms({see, control, eval})
//   pairing.setMode('drive' | 'watch' | 'paused')
//   pairing.takeBack()           the "Take back" pill
//   pairing.disconnect()
//
// onState(state) fires on every change: { phase, link, expires, bot, perms,
// mode, rtt, lastAction, error }. Phases: gathering -> waiting -> asking ->
// connected -> closed (or expired / denied / failed).
//
// The page never writes to berrry. Its offer rides inside the link, and the
// agent's answer is a public record only the link's key opens.

import { runCommands, commandNeeds, setInputBlocked } from './agent-remote.js';

const POLL_MS = 1500;
const SKILL_PATH = '/skills/wine-assembly-connect/SKILL.md';
const ICE = [{ urls: 'stun:stun.l.google.com:19302' }];

// lib/agent-pair.js and its tweetnacl are classic scripts (UMD). index.html
// already loads tweetnacl for the virtual LAN; load whichever is missing.
async function pairLib() {
  if (!window.nacl) await import('./vendor/tweetnacl.js');
  if (!window.AgentPair) await import('./agent-pair.js');
  if (!window.AgentPair) throw new Error('lib/agent-pair.js did not load');
  return window.AgentPair;
}

function gathered(pc, ms) {
  return new Promise((resolve) => {
    if (pc.iceGatheringState === 'complete') return resolve();
    const check = () => {
      if (pc.iceGatheringState === 'complete') { pc.removeEventListener('icegatheringstatechange', check); resolve(); }
    };
    pc.addEventListener('icegatheringstatechange', check);
    setTimeout(resolve, ms || 4000);
  });
}

// Known agents: a convenience for the consent dialog ("known since ..."),
// never an authorization. Every access tolerates storage that throws.
const KNOWN_KEY = 'wa.agent.known';
function knownAgents() {
  try { return JSON.parse(localStorage.getItem(KNOWN_KEY) || '[]'); } catch (_) { return []; }
}
function rememberAgent(bot) {
  try {
    const list = knownAgents().filter(a => a.pub !== bot.pub);
    const prev = knownAgents().find(a => a.pub === bot.pub);
    list.unshift({ pub: bot.pub, username: bot.username,
      firstSeen: prev ? prev.firstSeen : new Date().toISOString(), lastSeen: new Date().toISOString() });
    localStorage.setItem(KNOWN_KEY, JSON.stringify(list.slice(0, 20)));
  } catch (_) {}
}

let active = null;

export function current() { return active; }

export async function startPairing(opts) {
  const o = opts || {};
  if (active && !['closed', 'expired', 'denied', 'failed'].includes(active.state.phase)) active.disconnect();
  const AgentPair = await pairLib();
  const origin = (o.origin || location.origin).replace(/\/$/, '');
  const listeners = new Set();
  if (o.onState) listeners.add(o.onState);

  const state = {
    phase: 'gathering', link: null, token: null, expires: null, bot: null,
    perms: Object.assign({ see: true, control: true, eval: false }, o.perms || {}),
    mode: 'drive', rtt: null, lastAction: null, lastActionAt: null, error: null, commands: 0,
  };
  const emit = () => { for (const fn of listeners) { try { fn(Object.assign({}, state)); } catch (_) {} } };
  const set = (patch) => { Object.assign(state, patch); emit(); };

  const pc = new RTCPeerConnection({ iceServers: o.iceServers || ICE });
  const channel = pc.createDataChannel('agent', { ordered: true });
  let pollTimer = null;
  let consent = null;
  let answered = false;

  const send = (message) => {
    if (channel.readyState !== 'open') return;
    for (const frame of AgentPair.frames(message)) channel.send(frame);
  };
  const event = (ev) => send({ t: 'event', event: ev });

  function finish(phase, error) {
    if (pollTimer) clearTimeout(pollTimer);
    pollTimer = null;
    if (state.phase === 'connected' || phase === 'closed') {
      try { setInputBlocked(false); } catch (_) {}
    }
    try { channel.close(); } catch (_) {}
    try { pc.close(); } catch (_) {}
    set({ phase, error: error || null });
    if (active === controller) window.removeEventListener('agent-remote-input', onInputChange);
  }

  // The page enforces the player's checkboxes and the dialog's mode, never
  // the agent. Watch-only keeps observation; paused refuses everything but
  // a ping, so the agent learns why rather than timing out.
  function allow(cmd) {
    if (state.mode === 'paused' && cmd.action !== 'ping') return 'the player paused the agent';
    const need = commandNeeds(cmd);
    if (!need) return null;
    if (need === 'control' && state.mode === 'watch') return 'the player set watch-only mode: you can look but not act';
    if (!state.perms[need]) {
      return { see: 'the player did not allow seeing the screen',
        control: 'the player did not allow mouse and keyboard',
        eval: 'the player did not allow running page code' }[need];
    }
    if (need === 'eval' && !/[?&]debug\b/.test(location.search)) return 'page code (eval) is available only on ?debug pages';
    return null;
  }

  const receive = AgentPair.assembler(async (msg) => {
    if (msg && msg.t === 'cmds' && Array.isArray(msg.commands)) {
      const started = performance.now();
      // Drive mode means the agent holds the input once it acts. Decided
      // here per command rather than by agent-remote's auto-engage, which a
      // manual "Take back" retires for the rest of the page's life, and a
      // new session (or a switch back to drive) must not inherit that.
      if (state.mode === 'drive' && state.perms.control
          && msg.commands.some(c => commandNeeds(c) === 'control')) {
        try { setInputBlocked(true); } catch (_) {}
      }
      const results = await runCommands(msg.commands, allow);
      const first = msg.commands[0] || {};
      set({
        commands: state.commands + msg.commands.length,
        lastAction: first.cmd || first.action || '?',
        lastActionAt: Date.now(),
        rtt: Math.round(performance.now() - started),
      });
      try { window.dispatchEvent(new CustomEvent('agent-connect-action', { detail: { commands: msg.commands } })); } catch (_) {}
      send({ t: 'results', id: msg.id, results });
    } else if (msg && msg.t === 'event' && msg.event && msg.event.type === 'bye') {
      finish('closed', 'the agent disconnected');
    }
  });

  channel.onmessage = (e) => { try { receive(String(e.data)); } catch (_) {} };
  channel.onopen = () => {
    set({ phase: 'connected' });
    event({ type: 'hello', app: runningApp(), perms: state.perms, mode: state.mode });
  };
  channel.onclose = () => { if (state.phase === 'connected') finish('closed', 'the connection closed'); };
  pc.onconnectionstatechange = () => {
    if (pc.connectionState === 'failed') finish('failed', 'the network path between you and the agent is blocked');
  };

  // "Take back" in the ?debug toolbar or the pill both land here: tell the
  // agent, so it stops acting on a picture the player is now changing.
  function onInputChange(e) {
    if (state.phase === 'connected' && e.detail && !e.detail.blocked) event({ type: 'user-took-input' });
  }
  window.addEventListener('agent-remote-input', onInputChange);

  await pc.setLocalDescription(await pc.createOffer());
  await gathered(pc);
  const made = AgentPair.makeToken(pc.localDescription.sdp);
  const recordKey = AgentPair.recordKey(made.id);
  set({
    phase: 'waiting',
    token: made.token,
    link: `${origin}${SKILL_PATH}#${made.token}`,
    expires: made.expires * 1000,
  });

  async function poll() {
    pollTimer = null;
    if (state.phase !== 'waiting') return;
    if (Date.now() > state.expires) { finish('expired', 'the link expired before an agent answered'); return; }
    try {
      const res = await fetch(`${origin}/api/public-data/users/${encodeURIComponent(recordKey)}?fresh=${Date.now()}`,
        { cache: 'no-store', credentials: 'omit' });
      const rows = res.ok ? await res.json() : [];
      for (const row of (Array.isArray(rows) ? rows : [])) {
        const opened = AgentPair.openAnswer(made, row.value);
        if (!opened || answered) continue;
        answered = true;
        const known = knownAgents().find(a => a.pub === opened.bot.pub);
        set({ phase: 'asking', bot: Object.assign({}, opened.bot, { knownSince: known ? known.firstSeen : null }) });
        consent = { answer: opened.sdp };
        if (o.autoAllow) controller.allow();
        return;
      }
    } catch (_) { /* offline for a moment: try again */ }
    if (state.phase === 'waiting') pollTimer = setTimeout(poll, POLL_MS);
  }
  poll();

  const controller = {
    get state() { return Object.assign({}, state); },
    get link() { return state.link; },
    subscribe(fn) { listeners.add(fn); fn(Object.assign({}, state)); return () => listeners.delete(fn); },
    async allow(opts2) {
      if (state.phase !== 'asking' || !consent) return;
      if (opts2 && opts2.remember) rememberAgent(state.bot);
      set({ phase: 'connecting' });
      try {
        await pc.setRemoteDescription({ type: 'answer', sdp: consent.answer });
      } catch (err) {
        finish('failed', `could not use the agent's answer: ${err.message}`);
      }
    },
    deny() { finish('denied', 'you denied the agent'); },
    setPerms(perms) { set({ perms: Object.assign({}, state.perms, perms) }); event({ type: 'perms', perms: state.perms }); },
    setMode(mode) {
      if (!['drive', 'watch', 'paused'].includes(mode)) return;
      set({ mode });
      if (mode !== 'drive') { try { setInputBlocked(false); } catch (_) {} }
      event({ type: 'mode', mode });
    },
    takeBack() {
      try { setInputBlocked(false, { manual: true }); } catch (_) {}
      set({ mode: 'watch' });
      event({ type: 'mode', mode: 'watch' });
    },
    disconnect() {
      event({ type: 'bye' });
      finish('closed', 'you disconnected the agent');
    },
  };
  active = controller;
  return controller;
}

function runningApp() {
  const running = window.wineShell && window.wineShell.runningApps;
  return (running && running.length && running[running.length - 1].name) || null;
}
