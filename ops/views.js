'use strict';
// The five destinations of the redesigned dashboard (Home, Games, Tasks,
// Agents, Activity) plus the phone "More" page. They read the same /api/state
// snapshot as the classic views in app.js and reuse its helpers (escape, age,
// badge, agentSignal, candidateCapture, corpusLaunchActions, ...). Each new card
// opens the same detail dialogs. The classic task list, blockers and agent
// session pages are tabs of Tasks and Agents (see route() in app.js); "More"
// holds only pages with no main-view equivalent.

const ICONS = {
  home: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  games: '<rect x="2" y="6" width="20" height="12" rx="4"/><path d="M7 10v4M5 12h4"/><circle cx="16" cy="11" r="1"/><circle cx="18" cy="13" r="1"/>',
  tasks: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M8 2v4M16 2v4M7 11h4M7 15h7"/>',
  agents: '<rect x="4" y="7" width="16" height="12" rx="3"/><path d="M12 3v4M9 12v1M15 12v1M9 16h6"/>',
  activity: '<path d="M3 12h4l3 8 4-16 3 8h4"/>',
  more: '<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
  refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/>',
  play: '<path d="M7 4.5v15l13-7.5z" fill="currentColor" stroke="none"/>',
  term: '<path d="M4 7l5 5-5 5M12 18h8"/>',
  pause: '<rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor" stroke="none"/><rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor" stroke="none"/>',
  alert: '<path d="M12 3l10 18H2z"/><path d="M12 10v4M12 17v.5"/>',
  check: '<path d="M5 12l5 5 9-10"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18"/>',
};
const icon = (name, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;
function paintIcons(root = document) {
  root.querySelectorAll('[data-icon]').forEach(el => { if (!el.firstChild) el.innerHTML = icon(el.dataset.icon); });
}

const PAGE_TITLES = { home: 'Home', games: 'Games', tasks: 'Tasks', agents: 'Agents', activity: 'Activity', more: 'More', corpus: 'EXE corpus', release: 'Release checklist', dos: 'DOS / ToyVM', analytics: 'Usage & cost' };
// Pages without their own phone tab highlight "More" there; on the desktop
// sidebar they highlight their own entry.
const NAV_SECTION = { corpus: 'more', release: 'more', dos: 'more', analytics: 'more' };
const agoText = value => value ? (Date.now() - Date.parse(value) < 60000 ? 'just now' : age(value) + ' ago') : '';
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

// ---- shared derivations ---------------------------------------------------

function liveAgents() {
  return state.agents.filter(a => ['working', 'tool'].includes(a.state) && a.lastActivityAt && Date.now() - Date.parse(a.lastActivityAt) < 15 * 60000);
}
function stoppedAgents() { return topLevel(currentAgents()).filter(a => agentSignal(a).stopped); }
function idleAgents() {
  const busy = new Set([...liveAgents(), ...stoppedAgents()].map(a => a.id));
  return topLevel(state.agents).filter(a => !busy.has(a.id) && !a.parentAgentId && !liveAgents().some(c => c.parentAgentId === a.id));
}
// "Needs you": every request a person has to answer, phrased as the ask.
function needsYou() {
  const items = [];
  for (const p of (state.approvals?.items || []).filter(p => !p.sent)) {
    items.push({ kind: 'bad', ic: 'alert', title: 'Approve or deny a waiting command', body: `${p.reason || 'A command is waiting in a terminal.'} · ${p.label || ''}`, acts: [`<button class="btn small primary" data-approval="${escape(p.id)}">Review command</button>`] });
  }
  const { needsUser } = BlockerModel.blockerSummary(state);
  for (const t of needsUser) {
    const ask = t.needs || t.waitingOn || t.blocker || t.next || 'The owner needs a decision.';
    items.push({ kind: 'hot', ic: 'alert', title: t.title, body: ask, acts: [`<button class="btn small primary" data-blocker="${escape(t.id)}">Answer</button>`, `<button class="btn small" data-task="${escape(t.id)}">Details</button>`] });
  }
  const review = state.tasks.filter(t => t.status === 'review');
  if (review.length) items.push({ kind: 'info', ic: 'check', title: `${plural(review.length, 'finished result')} to review`, body: review.slice(0, 3).map(t => t.title).join(' · ') + (review.length > 3 ? ' …' : ''), acts: [`<a class="btn small" href="#tasks/needs">Open review queue</a>`] });
  for (const a of stoppedAgents()) {
    items.push({ kind: 'warn', ic: 'pause', title: `Agent stopped with work left: ${agentName(a)}`, body: agentSignal(a).reason, acts: [terminalButton(a, 'Resume in terminal', true), `<button class="btn small" data-agent="${escape(a.id)}">Details</button>`] });
  }
  return items;
}
function needsCount() {
  const { needsUser, approvals } = BlockerModel.blockerSummary(state);
  return approvals.length + needsUser.length + state.tasks.filter(t => t.status === 'review').length + stoppedAgents().length;
}
function terminalButton(a, label = 'Terminal', primary = false) {
  const entry = state.terminals?.find(t => t.agentId === a.id);
  if (!entry) return '';
  return `<button class="btn small${primary ? ' primary' : ''}" data-terminal="${escape(entry.id)}" ${entry.available ? '' : 'disabled'} title="${escape(entry.available ? 'Open the live terminal' : entry.reason || 'Terminal unavailable')}">${icon('term')} ${escape(label)}</button>`;
}

// One status vocabulary for games: On the public site / Playable / Starts, not checked / Broken.
const GAME_STATUS = {
  live: ['On public site', 'good'],
  playable: ['Playable', 'accent'],
  starts: ['Starts, not checked', 'mute'],
  broken: ['Broken', 'bad'],
};
function gameList() { return state.candidates.filter(c => corpusKind(c) === 'games'); }
function gameStatus(c) {
  if (c.releaseReadiness?.productionMembership === 'yes') return 'live';
  if (candidateCapture(c).gameplay) return 'playable';
  if (['failed', 'harness-error'].includes(c.latestRun?.outcome)) return 'broken';
  return 'starts';
}
function playRoute(c) { return (c.launch?.routes || []).find(r => r.available === true && typeof r.url === 'string' && /^\//.test(r.url)); }
function siteRoute(c) { return (c.launch?.productionRoutes || []).find(r => typeof r.url === 'string' && /^(https?:\/\/|\/)/i.test(r.url)); }
function playButtons(c, big = false) {
  const play = playRoute(c), site = siteRoute(c), size = big ? '' : ' small';
  return (play ? `<a class="btn primary${size}" href="${escape(play.url)}" target="_blank" rel="noopener noreferrer" aria-label="Play ${escape(c.name || c.id)}">${icon('play')} Play</a>` : `<span class="btn${size} disabled" title="${escape(c.launch?.routes?.[0]?.reason || c.launch?.reason || 'No local launch route')}">Can’t launch here</span>`) +
    (site ? `<a class="btn${size}" href="${escape(site.url)}" target="_blank" rel="noopener noreferrer">${icon('globe')} On site</a>` : '');
}
function gameCard(c) {
  const st = gameStatus(c), [label, tone] = GAME_STATUS[st], { shot } = candidateCapture(c);
  return `<article class="card game game-${st}"><button class="shot" data-game="${escape(c.id)}" aria-label="Details for ${escape(c.name || c.id)}">${shot ? `<img src="${escape(shot.url)}" alt="" loading="lazy">` : `<span class="none">${icon('games')}<span>No screenshot yet</span></span>`}<span class="badge b-${tone}">${escape(label)}</span></button><div class="body"><h3><button class="linkish" data-game="${escape(c.id)}">${escape(c.name || c.id)}</button></h3><div class="meta">${escape(c.category?.label || 'Unclassified')}${c.localOnly ? ' · local only' : ''}</div><div class="acts">${playButtons(c)}</div></div></article>`;
}

// ---- header and navigation -----------------------------------------------

function renderChrome() {
  const { base, sub } = route(), section = NAV_SECTION[base] || base;
  const mark = (a, on) => { a.classList.toggle('active', on); if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); };
  document.querySelectorAll('nav a[data-view]').forEach(a => mark(a, a.dataset.view === base || a.dataset.view === section));
  // Tab bars inside Tasks and Agents: one per page, the current tab highlighted.
  document.querySelectorAll('.subnav').forEach(nav => {
    nav.hidden = nav.dataset.for !== base;
    nav.querySelectorAll('a[data-sub]').forEach(a => mark(a, a.dataset.sub === sub));
  });
  const tc = s => state.tasks.filter(t => t.status === s).length;
  const tabCounts = { needs: needsCount(), active: tc('active'), ready: tc('ready'), done: tc('done'), sessions: topLevel(state.agents).length };
  document.querySelectorAll('[data-count]').forEach(el => { const n = tabCounts[el.dataset.count]; el.textContent = n || ''; });
  const current = document.querySelector(`.subnav[data-for="${base}"] a[data-sub="${sub}"]`);
  $('#page-title').textContent = (PAGE_TITLES[base] || 'Home') + (sub && current ? ' · ' + current.dataset.label : '');
  const needs = needsCount(), live = topLevel(liveAgents()).length, stopped = stoppedAgents().length, b = state.emulatorBuild;
  $('#needs-count').textContent = needs || '';
  const tab = $('#tab-needs-count'); tab.textContent = needs; tab.hidden = !needs;
  $('#games-count').textContent = gameList().length;
  $('#agents-count').textContent = live ? live + ' on' : '';
  const build = !b ? ['Build unknown', ''] : b.dirty ? [`Build ${String(b.commit || '').slice(0, 8)} · modified`, 'warn'] : [`Build ${String(b.commit || '').slice(0, 8)} · clean`, 'good'];
  const pills = [
    `<a class="pill" href="#agents"><span class="dot ${live ? 'good pulse' : ''}"></span>${plural(live, 'agent')} working</a>`,
    stopped ? `<a class="pill" href="#agents"><span class="dot warn"></span>${stopped} stopped with work left</a>` : '',
    needs ? `<a class="pill pill-hot" href="#tasks/needs"><span class="dot hot"></span>${needs} waiting on you</a>` : '',
  ].join('');
  const buildHtml = `<span class="dot ${build[1]}"></span>${escape(build[0])}`;
  if ($('#build-line').innerHTML !== buildHtml) { $('#build-line').innerHTML = buildHtml; $('#build-line').title = b?.note || ''; }
  if ($('#health').innerHTML !== pills) $('#health').innerHTML = pills;
}

// ---- Home -------------------------------------------------------------------

function homeView() {
  const games = gameList(), counts = { live: 0, playable: 0, starts: 0, broken: 0 };
  for (const c of games) counts[gameStatus(c)]++;
  const total = games.length || 1, live = topLevel(liveAgents()), stopped = stoppedAgents(), idle = idleAgents();
  const tc = s => state.tasks.filter(t => t.status === s).length, asks = needsYou();
  const seg = (n, tone) => n ? `<span class="seg-${tone}" style="width:${(100 * n / total).toFixed(2)}%" title="${n}"></span>` : '';
  const helpers = liveAgents().filter(a => a.parentAgentId).length;
  // Newest first by run start. Reviewed gameplay is rare, so recent captures from
  // agent runs (not reviewed gameplay) are shown beside it.
  const newest = (pick, limit) => {
    const out = [], seen = new Set();
    for (const r of [...state.runs].sort((a, b) => (b.startedAt || '').localeCompare(a.startedAt || ''))) {
      const shot = pick(r);
      if (!shot || seen.has(r.candidateId)) continue;
      const c = state.candidates.find(c => c.id === r.candidateId || c.appIds?.includes(r.candidateId));
      if (!c || seen.has(c.id) || !matches(c)) continue;
      seen.add(c.id); seen.add(r.candidateId); out.push([c, r, shot]);
      if (out.length === limit) break;
    }
    return out;
  };
  const latest = newest(r => r.gameplayScreenshots?.at(-1), 4);
  const captures = newest(r => !r.gameplayScreenshots?.length && (r.visuals?.at(-1) || r.screenshots?.at(-1)), 4);
  const stale = !latest.length || Date.now() - Date.parse(latest[0][1].startedAt) > 3 * 86400000;
  const mini = ([c, r, shot], note) => `<div class="mini"><button class="shot" data-game="${escape(c.id)}" aria-label="Details for ${escape(c.name || c.id)}"><img src="${escape(shot.url)}" alt="" loading="lazy"></button><div class="cap" title="${escape(c.name || c.id)}">${escape(c.name || c.id)}</div><div class="sub">${playRoute(c) ? `<a href="${escape(playRoute(c).url)}" target="_blank" rel="noopener noreferrer">${icon('play')} Play</a> · ` : ''}${note}${agoText(r.startedAt)}</div></div>`;
  const commits = (state.activity || []).filter(a => a.type === 'commit' && matches(a)).slice(0, 6);
  return `${statusSummary(true)}<div class="kpis">
    <a class="card kpi" href="#agents"><div class="v">${live.length}</div><div class="l">Agents working now</div><div class="h">${stopped.length} stopped with work left · ${idle.length} idle</div></a>
    <a class="card kpi kpi-hot" href="#tasks/needs"><div class="v">${asks.length}</div><div class="l">Waiting on you</div><div class="h">${state.tasks.filter(t => t.status === 'review').length} results to review</div></a>
    <a class="card kpi" href="#games"><div class="v">${counts.live + counts.playable}<small> / ${games.length}</small></div><div class="l">Games playable</div><div class="bar">${seg(counts.live, 'good')}${seg(counts.playable, 'accent')}${seg(counts.starts, 'mute')}${seg(counts.broken, 'bad')}</div></a>
    <a class="card kpi" href="#tasks/active"><div class="v">${tc('active')}</div><div class="l">Tasks in progress</div><div class="h">${tc('ready')} up next · ${tc('blocked')} blocked</div></a>
  </div>
  <div class="grid2">
    <div class="col-stack">
      <section class="card needs"><div class="card-h"><h2>${asks.length ? `<span class="n">${asks.length}</span>` : ''}Needs you</h2><a class="link" href="#tasks/needs">All →</a></div>
        ${asks.filter(matches).map(askRow).join('') || `<div class="calm">${icon('check')} Nothing is waiting on you.</div>`}
      </section>
      <section class="card"><div class="card-h"><h2>Latest reviewed gameplay</h2><a class="link" href="#games">All games →</a></div>
        ${latest.length ? `<div class="mini-games">${latest.map(x => mini(x, '')).join('')}</div>` : '<div class="calm">No reviewed gameplay yet.</div>'}
        ${stale && latest.length ? `<p class="sub card-note">No newer reviewed gameplay run; the newest is ${agoText(latest[0][1].startedAt)}.</p>` : ''}
        ${captures.length ? `<div class="card-h card-h-sub"><h3>Latest captures from agent runs</h3><a class="link" href="#corpus">Corpus →</a></div><div class="mini-games">${captures.map(x => mini(x, 'capture · ')).join('')}</div>` : ''}
      </section>
    </div>
    <div class="col-stack">
      <section class="card"><div class="card-h"><h2>Running now</h2><a class="link" href="#agents">Agents →</a></div>
        ${live.filter(matchesTree).map(a => `<div class="run-row"><span class="dot good pulse"></span><div><h3><button class="linkish" data-agent="${escape(a.id)}">${escape(agentName(a))}</button></h3><p>${escape(a.summary || agentLine2(a, agentSignal(a)))}</p><div class="who">${escape(a.provider)} · ${escape(a.id.split(':').at(-1).slice(0, 6))}</div></div><span class="ago">${agoText(a.lastActivityAt)}</span></div>`).join('') || '<div class="calm">No agent is working right now.</div>'}
        ${helpers ? `<a class="showmore" href="#agents">+ ${plural(helpers, 'helper agent')} working for these →</a>` : ''}
      </section>
      <section class="card"><div class="card-h"><h2>Recent changes</h2><a class="link" href="#activity">Activity →</a></div>
        <ul class="feed">${commits.map(c => `<li><span class="k ${c.code?.state === 'merged' ? 'k-good' : ''}">${c.code?.state === 'merged' ? '✓' : '•'}</span><span>${escape(c.subject || c.text)} ${c.code?.state === 'merged' ? '<span class="badge b-good">on main</span>' : c.code?.state === 'pushed' ? '<span class="badge b-info">pushed</span>' : '<span class="badge b-mute">local</span>'}</span><span class="ago">${agoText(c.time)}</span></li>`).join('') || '<li><span></span><span class="sub">No commits.</span><span></span></li>'}</ul>
      </section>
    </div>
  </div>`;
}
function askRow(d) {
  return `<div class="ask ask-${d.kind}"><div class="ask-ic">${icon(d.ic)}</div><div class="ask-copy"><h3>${escape(d.title)}</h3><p>${escape(d.body)}</p></div><div class="acts">${d.acts.join('')}</div></div>`;
}

// ---- Games ------------------------------------------------------------------

let gameFilter = 'all', gameLimit = 48;
function gamesView() {
  const games = gameList(), counts = { live: 0, playable: 0, starts: 0, broken: 0 };
  for (const c of games) counts[gameStatus(c)]++;
  const rank = { live: 1, playable: 0, starts: 2, broken: 3 };
  const shown = games.filter(c => (gameFilter === 'all' || gameStatus(c) === gameFilter) && matches(c))
    .sort((a, b) => rank[gameStatus(a)] - rank[gameStatus(b)] || Number(!candidateCapture(a).shot) - Number(!candidateCapture(b).shot) || (a.name || a.id).localeCompare(b.name || b.id));
  const chip = (id, label, n, tone = '') => `<button class="chip" data-game-filter="${id}" aria-pressed="${gameFilter === id}">${tone ? `<span class="dot ${tone}"></span>` : ''}${label} <span class="c">${n}</span></button>`;
  return `<div class="chips">${chip('all', 'All', games.length)}${chip('live', 'On public site', counts.live, 'good')}${chip('playable', 'Playable', counts.playable, 'accent')}${chip('starts', 'Starts, not checked', counts.starts, 'mute')}${chip('broken', 'Broken', counts.broken, 'bad')}<a class="chip chip-link" href="#corpus">All games &amp; apps →</a></div>
    <div class="games">${shown.slice(0, gameLimit).map(gameCard).join('') || empty('No games match.')}</div>
    ${shown.length > gameLimit ? `<button class="showmore wide" data-more-games="1">Show ${Math.min(48, shown.length - gameLimit)} more of ${shown.length - gameLimit}</button>` : ''}`;
}
const GATE_NAMES = { gameplay: 'Gets into real gameplay', input: 'Controls work', correctness: 'Looks and sounds right', performance: 'Runs fast enough', distribution: 'OK to publish', package: 'Packaged for the site' };
function gameDetail(id) {
  const c = state.candidates.find(c => c.id === id); if (!c) return;
  const st = gameStatus(c), [label, tone] = GAME_STATUS[st], r = c.releaseReadiness;
  const runs = state.runs.filter(x => x.candidateId === c.id || c.appIds?.includes(x.candidateId));
  const shots = [...new Map(runs.flatMap(x => [...(x.gameplayScreenshots || []), ...(x.screenshots || [])]).map(s => [s.url, s])).values()].slice(0, 8);
  const gates = Object.entries(GATE_NAMES).map(([k, name]) => [name, r?.gates?.[k]?.status || 'unknown', r?.gates?.[k]?.summary || '']);
  const passed = gates.filter(g => g[1] === 'passed').length;
  const mark = s => s === 'passed' ? ['y', '✓'] : ['blocked', 'failed'].includes(s) ? ['x', '✕'] : ['n', '?'];
  show('GAME / ' + c.id, `<div class="game-detail">
    <div class="gd-hero">${shots.length ? `<div class="hero"><img id="gd-hero" src="${escape(shots[0].url)}" alt="${escape(shots[0].name)}"></div>${shots.length > 1 ? `<div class="thumbs">${shots.map((s, i) => `<button class="${i ? '' : 'on'}" data-hero="${escape(s.url)}" aria-label="Show ${escape(s.name)}"><img src="${escape(s.url)}" alt="" loading="lazy"></button>`).join('')}</div>` : ''}` : `<div class="hero hero-none">${icon('games')}<span>No screenshot yet</span></div>`}</div>
    <div class="gd-info">
      <div class="gd-head"><span class="badge b-${tone}">${escape(label)}</span>${r?.productionMembership === 'no' ? '<span class="badge b-mute">Not on the public site yet</span>' : ''}<h2>${escape(c.name || c.id)}</h2><div class="sub">${escape(c.category?.label || 'Unclassified')}${c.version ? ' · ' + escape(c.version) : ''}</div><div class="gd-play">${playButtons(c, true)}</div></div>
      ${r?.scope === 'game' ? `<div class="card-h"><h2>Ready to publish?</h2><span class="badge ${passed === gates.length ? 'b-good' : 'b-warn'}">${passed} of ${gates.length} checks</span></div><ul class="checks">${gates.map(([name, s, why]) => `<li title="${escape(why)}"><span class="ck ${mark(s)[0]}">${mark(s)[1]}</span><span>${escape(name)}</span><span class="ago">${s === 'passed' ? 'reviewed' : s === 'unknown' ? 'not checked' : escape(s.replaceAll('-', ' '))}</span></li>`).join('')}</ul>${r?.next ? `<p class="gd-next"><b>Next step:</b> ${escape(r.next)}</p>` : ''}` : ''}
      <div class="card-h"><h2>History</h2></div><ul class="feed">${runs.slice(0, 6).map(x => `<li><span class="k ${x.outcome === 'passed' ? 'k-good' : ['failed', 'harness-error'].includes(x.outcome) ? 'k-bad' : ''}">${x.outcome === 'passed' ? '✓' : ['failed', 'harness-error'].includes(x.outcome) ? '!' : '•'}</span><span><button class="linkish" data-run="${escape(x.key)}">${escape(x.route || x.id)}</button> <span class="sub">${escape(x.verification || '')}</span></span><span class="ago">${agoText(x.startedAt)}</span></li>`).join('') || '<li><span></span><span class="sub">No recorded runs yet.</span><span></span></li>'}</ul>
      <details class="tech"><summary>Technical details, evidence and linked tasks</summary>${candidateDetailHtml(c)}</details>
    </div></div>`);
}
document.addEventListener('click', event => {
  const hero = event.target.closest?.('[data-hero]');
  if (hero) { $('#gd-hero').src = hero.dataset.hero; hero.parentElement.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === hero)); return; }
  const el = event.target.closest?.('[data-game],[data-game-filter],[data-more-games],[data-task-mode]');
  if (!el || !state) return;
  if (el.dataset.game) gameDetail(el.dataset.game);
  if (el.dataset.gameFilter) { gameFilter = el.dataset.gameFilter; gameLimit = 48; render(); }
  if (el.dataset.moreGames) { gameLimit += 48; render(); }
});

// ---- Tasks board -------------------------------------------------------------

function boardCard(t) {
  const agent = state.agents.find(a => a.id === t.owner), live = agent && liveAgents().some(a => a.id === agent.id);
  const owner = !t.owner ? 'Unassigned' : agent ? agentName(agent) === t.title ? t.owner.split(':')[0] : t.owner.split(':')[0] + ' · ' + t.owner.split(':').at(-1).slice(0, 6) : t.owner.split(':')[0];
  const next = t.status === 'blocked' ? t.needs || t.blocker || t.next : t.next || t.done;
  return `<button class="task-card task-card-${escape(t.status)}" data-task="${escape(t.id)}"><h3>${escape(t.title)}</h3>${next ? `<p>${escape(next)}</p>` : ''}<span class="f"><span class="dot ${live ? 'good pulse' : ''}"></span>${escape(owner)}${t.progressAt ? ' · ' + agoText(t.progressAt) : ''}</span></button>`;
}
// Board: the four columns that matter now, each capped with a link to its full
// tab. "#tasks/needs" is the Needs-you column on its own. The other tabs
// (Running, Up next, Done, List) are the classic list in app.js, Blocked is the
// blocker view.
const BOARD_CAP = 6;
function tasksBoard(sub = '') {
  const by = s => sortedTasks(state.tasks.filter(t => t.status === s && matches(t)));
  const asks = needsYou().filter(matches), review = by('review');
  const { needsUser } = BlockerModel.blockerSummary(state);
  const blocked = by('blocked').filter(t => !needsUser.includes(t));
  const cols = [
    ['needs', 'Needs you', asks.length, [...asks.filter(a => a.kind !== 'info').map(askRow), ...review.map(boardCard)]],
    ['active', 'Running', by('active').length, by('active').map(boardCard)],
    ['ready', 'Up next', by('ready').length, by('ready').map(boardCard)],
    ['blocked', 'Blocked · agents handling', blocked.length, blocked.map(boardCard)],
  ];
  const tools = `<div class="board-tools"><a class="chip chip-link" href="#tasks/all">Backlog <span class="c">${state.tasks.filter(t => t.status === 'backlog').length}</span></a><button id="new-task" class="btn primary small">+ New task</button></div>`;
  if (sub === 'needs') return tools + `<div class="needs-list">${cols[0][3].join('') || `<div class="calm">${icon('check')} Nothing is waiting on you.</div>`}</div>`;
  return tools + `<div class="board">${cols.map(([k, l, n, cards]) => `<section class="col" aria-label="${escape(l)}"><div class="col-h"><a href="#tasks/${k}">${escape(l)}</a><span class="c">${n}</span></div>${cards.slice(0, BOARD_CAP).join('') || '<div class="calm small">Nothing here.</div>'}${cards.length > BOARD_CAP ? `<a class="showmore" href="#tasks/${k}">All ${cards.length} →</a>` : ''}</section>`).join('')}</div>`;
}

// ---- Agents -----------------------------------------------------------------

let idleAgentsOpen = false;
function agentTile(a) {
  const signal = agentSignal(a), stopped = !!signal.stopped, working = ['working', 'tool'].includes(a.state);
  const helpers = state.agents.filter(c => c.parentAgentId === a.id && ['working', 'tool'].includes(c.state));
  const state_ = stopped ? ['Stopped — work left', 'warn'] : working ? ['Working', 'good'] : [signal.label, signal.color === 'bad' ? 'bad' : signal.color === 'warn' ? 'warn' : 'mute'];
  return `<article class="card agent-tile agent-${escape(a.state)} ${stopped ? 'agent-stopped' : ''}"><div class="row"><span class="dot ${state_[1]} ${working ? 'pulse' : ''}"></span><span class="badge b-${state_[1]}">${escape(state_[0])}</span><span class="badge b-mute">${a.provider === 'codex' ? 'Codex' : 'Claude'}</span><span class="ago">${agoText(a.lastActivityAt)}</span></div>
    <h3><button class="linkish" data-agent="${escape(a.id)}">${escape(agentName(a))}</button></h3><p>${escape(signal.reason || a.summary || agentLine2(a, signal))}</p>${agentGoal(a)}
    ${helpers.length ? `<div class="sub helpers">+ ${plural(helpers.length, 'helper')} working: ${helpers.slice(0, 3).map(h => escape(agentName(h))).join(' · ')}</div>` : ''}
    <div class="foot">${terminalButton(a, stopped ? 'Resume' : 'Terminal', stopped)}<button class="btn small ghost" data-agent="${escape(a.id)}">Details</button></div></article>`;
}
function agentsGrouped() {
  const live = topLevel(liveAgents()).filter(matchesTree), stopped = stoppedAgents().filter(matchesTree), idle = idleAgents().filter(matchesTree)
    .sort((a, b) => (b.lastActivityAt || '').localeCompare(a.lastActivityAt || ''));
  const working = live.filter(a => !stopped.includes(a));
  return `<h2 class="section-title">Working now · ${working.length}</h2><div class="agents">${working.map(agentTile).join('') || '<div class="calm">No agent is working right now.</div>'}</div>
    ${stopped.length ? `<h2 class="section-title">Stopped with work left · ${stopped.length}</h2><div class="agents">${stopped.map(agentTile).join('')}</div>` : ''}
    <details class="card idle-list agent-history" ${idleAgentsOpen || query ? 'open' : ''}><summary>Idle and earlier sessions · ${idle.length}</summary>${idle.map(a => `<div class="idle-row"><button class="linkish" data-agent="${escape(a.id)}">${escape(agentName(a))}</button><span class="badge b-mute">${escape(a.provider)}</span><span class="ago">${agoText(a.lastActivityAt)}</span></div>`).join('')}</details>`;
}
document.addEventListener('toggle', event => { if (event.target.matches?.('.idle-list') && event.target.isConnected && !query) idleAgentsOpen = event.target.open; }, true);

// ---- More (phone) -------------------------------------------------------------

function moreView() {
  // Task list, Blockers and Agent sessions are tabs inside Tasks and Agents now.
  const rows = [['corpus', 'EXE corpus', 'Every game and app, with filters and evidence'], ['release', 'Release checklist', 'Unreleased games sorted by what is left'], ['dos', 'DOS / ToyVM', 'DOS payloads and ToyVM verdicts'], ['analytics', 'Usage & cost', 'Daily per-agent usage and time']];
  return `<div class="card more-list">${rows.map(([id, l, h]) => `<a href="#${id}" data-view="${id}"><span><b>${escape(l)}</b><span class="sub">${escape(h)}</span></span><span aria-hidden="true">›</span></a>`).join('')}</div><p class="sub foot-note">${$('#build-line').innerHTML} · ${escape($('#updated').textContent)}</p>`;
}

// Phone: the search field hides behind an icon so each page opens on its own content.
document.addEventListener('click', event => {
  const toggle = event.target.closest?.('#search-toggle');
  if (!toggle) return;
  const on = document.body.classList.toggle('searching');
  toggle.setAttribute('aria-expanded', String(on));
  if (on) $('#search').focus();
});
