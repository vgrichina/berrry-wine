'use strict';

const $ = selector => document.querySelector(selector);
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
let state, view = location.hash.slice(1) || 'home', filter = 'all', query = '', loading = false;
let analyticsData=null,analyticsPending=false,analyticsError='',analyticsDay='';
async function loadAnalytics() {
  if(analyticsPending || analyticsData && Date.now()-Date.parse(analyticsData.generatedAt)<60000)return;
  analyticsPending=true;
  try {const r=await fetch('/api/analytics');if(!r.ok)throw Error(`HTTP ${r.status}`);analyticsData=await r.json();analyticsError='';}
  catch(e){analyticsError=e.message;}
  finally {analyticsPending=false;if(view==='analytics')render();}
}
const duration=ms=>ms<60000?Math.round(ms/1000)+'s':ms<3600000?Math.round(ms/60000)+'m':(ms/3600000).toFixed(1)+'h';
function analyticsView() {
  if(!analyticsPending && !analyticsError && (!analyticsData || Date.now()-Date.parse(analyticsData.generatedAt)>60000))loadAnalytics();
  const heading=title('Agent analytics','Daily usage, output and observed time · UTC');
  if(!analyticsData)return heading+empty(analyticsError?'Analytics unavailable: '+analyticsError:'Indexing session logs… first load can take a minute.')+(analyticsError?'<button data-analytics-retry>Retry</button>':'');
  const data=analyticsData,day=analyticsDay||data.days[0]?.day;
  const rows=data.rows.filter(r=>r.day===day && matches(r)).sort((a,b)=>b.estimatedUsd-a.estimatedUsd);
  const daily=data.days.find(d=>d.day===day),sum=k=>rows.reduce((n,r)=>n+(r[k]||0),0),tokens=rows.reduce((n,r)=>n+r.tokens.input+r.tokens.read+r.tokens.write+r.tokens.writeHour+r.tokens.output,0);
  const kinds=[['model','Thinking / response'],['tools','Tools / process wait'],['tests','Test / benchmark wait'],['idle','Idle between turns'],['unknown','Unknown']];
  return heading+`<div class="analytics-days">${data.days.map(d=>`<button data-analytics-day="${escape(d.day)}" aria-pressed="${d.day===day}">${escape(d.day)}</button>`).join('')}</div><div class="analytics-totals"><div><strong>$${sum('estimatedUsd').toFixed(2)}</strong><span>API-equivalent estimate${sum('unpricedTokens')?' · partial':''}</span></div><div><strong>${num(tokens)}</strong><span>Tokens · ${num(sum('unpricedTokens'))} unpriced</span></div><div><strong>${rows.reduce((n,r)=>n+r.commits.length,0)}</strong><span>Attributed commits · ${daily?.unattributedCommits||0} unattributed across project</span></div></div><p class="source-note">Own usage per session; child usage is separate. Dollar amounts are estimates, not your subscription bill. Times are inferred from logs, not CPU measurements.</p><div class="analytics-legend">${kinds.map(([k,label])=>`<span class="analytics-key time-${k}">${label}</span>`).join('')}</div><div class="analytics-rows">${rows.map(r=>{const total=Object.values(r.ms).reduce((a,b)=>a+b,0);return `<article class="panel analytics-agent"><div class="analytics-heading"><strong>${escape(agentName({id:r.agentId,title:r.title}))}</strong><span>${escape(r.provider)} · ${escape(r.agentId.split(':').at(-1).slice(0,8))}${r.parentAgentId?' · subagent':''}</span><b>$${r.estimatedUsd.toFixed(2)}${r.unpricedTokens?' + unpriced':''}</b></div><div class="analytics-timebar" aria-label="Observed time distribution">${kinds.filter(([k])=>r.ms[k]>0).map(([k,label])=>`<span class="time-${k}" style="width:${100*r.ms[k]/total}%" title="${label}: ${duration(r.ms[k])}"></span>`).join('')}</div><div class="analytics-times">${kinds.map(([k,label])=>`<span>${label} <b>${duration(r.ms[k])}</b></span>`).join('')}</div><div class="analytics-numbers"><span>Input ${num(r.tokens.input)}</span><span>Cache read ${num(r.tokens.read)}</span><span>Cache write ${num(r.tokens.write+r.tokens.writeHour)}</span><span>Output ${num(r.tokens.output)}</span><span>${r.requests} requests</span><span>${r.commits.length} commits</span></div><details><summary>Models, attribution and identity</summary><p class="sub">${escape(r.agentId)}${r.parentAgentId?' · Parent '+escape(r.parentAgentId):''}</p>${Object.entries(r.models).map(([model,m])=>`<p>${escape(model)} · ${m.requests} requests · $${m.estimatedUsd.toFixed(2)}${m.unpricedTokens?' + '+num(m.unpricedTokens)+' unpriced tokens':''}</p>`).join('')}<p>Commit hashes: ${r.commits.map(h=>escape(h.slice(0,10))).join(', ')||'None attributed'}</p></details></article>`;}).join('')||empty('No usage recorded for this day.')}</div><details class="panel"><summary>Coverage and accounting rules · ${data.scannedSessions} sessions</summary>${data.notes.map(n=>`<p>${escape(n)}</p>`).join('')}<p>Rates checked ${escape(data.rates.checkedAt)}; editable in ops/analytics-rates.json.</p>${data.rates.sources.map(s=>link(s,'Pricing source')).join(' · ')}${data.warnings.map(w=>`<p class="warn">${escape(w)}</p>`).join('')}</details>`;
}
document.addEventListener('click',event=>{if(event.target.closest?.('[data-analytics-retry]')){analyticsError='';loadAnalytics();return;}const button=event.target.closest?.('[data-analytics-day]');if(button){analyticsDay=button.dataset.analyticsDay;render();}});
const num = n => n === null || n === undefined ? 'unknown' : new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
function age(value) { if (!value) return 'unknown'; const minutes = Math.max(0, (Date.now() - Date.parse(value)) / 60000); return minutes < 1 ? '<1m' : minutes < 60 ? `${Math.floor(minutes)}m` : minutes < 1440 ? `${Math.floor(minutes / 60)}h ${Math.floor(minutes % 60)}m` : `${Math.floor(minutes / 1440)}d`; }
const when = value => value ? new Date(value).toLocaleString() : 'unknown';
const badge = (text, tone = '') => `<span class="badge ${tone}">${escape(text)}</span>`;
const tone = status => ['passed', 'done', 'present', 'reviewed'].includes(status) ? 'good' : ['failed', 'blocked', 'harness-error'].includes(status) ? 'bad' : ['active', 'timeout', 'partial', 'running'].includes(status) ? 'warn' : '';
const matches = value => !query || JSON.stringify(value).toLowerCase().includes(query);
const empty = text => `<div class="empty">${escape(text)}</div>`;
const link = (url, text) => `<a href="${escape(url)}" target="_blank" rel="noopener noreferrer">${escape(text)} ↗</a>`;
const taskButton = t => `<button data-task="${escape(t.id)}">${escape(t.title)}</button>`;
const taskStates = [
  ['active', 'Running', 'Work assigned and in progress', '▶'],
  ['ready', 'Up next', 'Queued in source order; see any prerequisites below', '→'],
  ['review', 'Needs review', 'Results awaiting review or integration', '◇'],
  ['blocked', 'Blocked', 'A dependency or decision must be resolved', '!'],
  ['backlog', 'Backlog', 'Not scheduled yet', '○'],
  ['deferred', 'Deferred', 'Intentionally set aside', 'Ⅱ'],
  ['done', 'Done', 'Completed tasks; evidence remains available', '✓'],
  ['duplicate', 'Duplicate', 'Duplicate records retained for provenance; not queued or completed work', '·'],
  ['unknown', 'Historical notes', 'No current task status recorded', '·'],
];
const expandedTaskGroups = new Map();
let agentHistoryOpen=false;
let activityLimit=25;
let activityFilter='all';
let corpusGroup='all';
let corpusCategory='all';
let corpusRelease='all';
let corpusLaunch='all';
let corpusQuery='';
let corpusType='all';
let queueBriefingOpen=false;
const taskState = status => taskStates.find(s => s[0] === status) || taskStates.at(-1);
const sortedTasks = tasks => [...tasks].sort((a,b) => taskStates.indexOf(taskState(a.status)) - taskStates.indexOf(taskState(b.status)) || a.line - b.line);
function taskEvidence(t) {
  const visualRuns = state.runs.filter(r => r.visuals?.length);
  const direct = visualRuns.filter(r => r.taskId === t.id);
  return direct.length ? {runs:direct,label:'Task evidence'} : {runs:visualRuns.filter(r => t.candidateIds?.includes(r.candidateId)),label:'Related app'};
}
function taskPreview(t) {
  const {runs,label} = taskEvidence(t), run = runs[0];
  if (!run) return '';
  const visual = run.visuals.at(-1);
  return `<button class="task-preview" data-run="${escape(run.key)}" aria-label="Open ${escape(label.toLowerCase())} for ${escape(t.title)}"><img src="${escape(visual.url)}" alt="${escape(visual.kind + ': ' + (run.route || visual.name))}" loading="lazy"><span>${escape(label)} · ${age(run.startedAt)} ago</span></button>`;
}
function taskOwner(t, details=false) {
  if(!t.owner)return `<div class="task-owner"><span class="sub">Unassigned</span>${coordinatorButton()}</div>`;
  const agent=state.agents.find(a=>a.id===t.owner);
  const identity=details ? t.owner : t.owner.split(':')[0]+' · '+t.owner.split(':').at(-1).slice(-8);
  const [activity,color]=agent ? health(agent) : ['Session not observed',''];
  const pid=agent?.process?.matches?.[0]?.pid;
  return `<div class="task-owner"><span class="sub">Assigned to</span>${agent ? `<button class="owner-link" data-agent="${escape(agent.id)}" title="${escape(agent.id)}">${escape(identity)} ↗</button>` : `<span class="sub" title="${escape(t.owner)}">${escape(identity)}</span>`}${pid ? `<span class="sub">PID ${pid}</span>` : ''}${badge(activity,color)}${terminalLink({id:t.owner},details)}</div>`;
}
function taskRows(tasks) { return tasks.length ? sortedTasks(tasks).map(t => {
  const [status,label,,symbol] = taskState(t.status);
  const next = status === 'blocked' ? t.blocker || t.next : t.next;
  return `<div class="task task-${status}"><span class="task-symbol" aria-hidden="true">${symbol}</span><div class="task-body">${taskButton(t)}${t.status==='ready' && t.done?`<div class="task-next"><strong>Done when:</strong> ${escape(t.done)}</div>`:''}${next ? `<div class="task-next"><strong>${status === 'blocked' ? 'Blocked by' : status === 'done' ? 'Result' : 'Next'}:</strong> ${escape(next)}</div>` : ''}${dependencySummary(t)}${taskOwner(t)}${t.commits?.length?`<div class="sub task-code">Code: ${t.commits.length} commit${t.commits.length===1?'':'s'} · ${['merged','pushed','local'].map(k=>[k,t.commits.filter(c=>c.code?.state===k).length]).filter(([,n])=>n).map(([k,n])=>n+' '+k).join(' · ') || 'location unknown'}</div>`:''}<div class="sub">${escape(t.id)}${t.progressAt ? ' · Updated ' + age(t.progressAt) + ' ago' : ''}</div><div class="task-controls"><button class="task-details" data-task="${escape(t.id)}">${status==='review'?'Review →':'Details →'}</button>${taskControls(t)}</div></div>${taskPreview(t)}<div class="task-statuses">${badge(label, 'task-label task-label-' + status)}${pickupBadge(t)}</div></div>`;
}).join('') : empty('No matching tasks.'); }
function health(a) {
  if (!a.lastActivityAt) return ['Unknown', ''];
  if (a.state === 'idle') return ['Turn ended', ''];
  if (Date.now() - Date.parse(a.lastActivityAt) > 15 * 60000) return ['Quiet · check session', 'warn'];
  return [a.state === 'tool' ? 'Tool activity' : 'Recent activity', 'good'];
}
function visualCards(runs, limit = 6) {
  const cards = runs.filter(r => r.visuals?.length).slice(0, limit);
  return cards.length ? `<div class="visual-grid">${cards.map(r => {
    const image = r.visuals[r.visuals.length - 1];
    const candidate = state.candidates.find(c => c.id === r.candidateId);
    return `<button class="visual-card" data-run="${escape(r.key)}"><span class="visual-image"><img src="${escape(image.url)}" alt="${escape(image.kind + ': ' + (r.route || image.name))}" loading="lazy">${image.kind === 'diagram' ? '<span class="visual-kind">Diagram</span>' : ''}</span><span class="visual-caption"><strong>${escape(candidate?.name || r.candidateId)}</strong><span>${age(r.startedAt)} ago${r.outcome === 'failed' || r.outcome === 'harness-error' ? ' · ' + escape(r.outcome) : ''} · Open evidence →</span></span></button>`;
  }).join('')}</div>` : empty('No linked visuals yet.');
}
function agentRuns(a) { return state.runs.filter(r => r.agentId === a.id); }
function terminalLink(a, details=false) {
  const entry=state.terminals?.find(t=>t.agentId===a.id);
  if(!entry)return coordinator()?.available && state.tasks.some(t=>t.owner===a.id && ['active','ready','blocked','review'].includes(t.status)) ? coordinatorButton() : details ? '<span class="sub">Terminal unavailable · no registered tmux session</span>' : '';
  return `<button class="details-button" data-terminal="${escape(entry.id)}" ${entry.available?'':'disabled'} title="${escape(entry.available?'Open in view mode':entry.reason)}">${entry.available?'Terminal >_':'Terminal unavailable'}</button>`;
}
const cpuUsage = value => Number.isFinite(value) ? value.toFixed(1) + '%' : '—';
const memoryUsage = value => !Number.isFinite(value) ? '—' : value >= 1024 ** 3 ? (value / 1024 ** 3).toFixed(1) + ' GiB' : Math.round(value / 1024 ** 2) + ' MiB';
function processSummary(p, compact = false) {
  if (!p?.matches.length) return `<div class="process-line sub">PID ${p?.status === 'unavailable' ? 'unavailable' : 'not matched'}</div>`;
  return `<div class="process-line">${p.matches.map(m => `<span class="sub process-host">PID ${m.pid} · ${cpuUsage(m.cpuPercent)} CPU · ${memoryUsage(m.rssBytes)} RSS${m.shared ? ' · shared host' : ''}</span>`).join('')}${p.childCount ? `<span class="sub process-background">Background ${p.childCount} · ${cpuUsage(p.childCpuPercent)} CPU · ${memoryUsage(p.childRssBytes)} RSS</span>` : ''}${compact ? '' : `<span class="sub">Sampled ${age(p.checkedAt)} ago</span>`}</div>`;
}
function processDetails(p) {
  if (!p) return empty('No process observation available.');
  const rows = [...p.matches.map(m => ({ ...m, relation: m.evidence + (m.shared ? ' · shared' : '') })), ...p.children.map(m => ({ ...m, relation: 'Host descendant' }))];
  return section('Associated local processes') + processSummary(p) + `<p class="source-note">${escape(p.note || 'Exact session-log handle or verified Claude registry match. Descendants belong to the host; they may serve other sessions. Missing matches do not prove a session has exited.')} Sampled ${escape(when(p.checkedAt))}.</p>` +
    (rows.length ? `<div class="process-table"><table><thead><tr><th>PID / parent</th><th>Process</th><th>CPU</th><th>Memory RSS</th><th>OS state / age</th><th>Association</th></tr></thead><tbody>${rows.map(m => `<tr><td>${m.pid} / ${m.ppid}</td><td>${escape(m.name)}</td><td>${cpuUsage(m.cpuPercent)}</td><td>${memoryUsage(m.rssBytes)}</td><td>${escape(m.state)} / ${escape(m.elapsed)}</td><td>${escape(m.relation)}</td></tr>`).join('')}</tbody></table></div><p class="source-note">CPU is the OS-reported process percentage, not a model-utilization measure; it can exceed 100%. RSS is resident memory; summed RSS may count shared pages more than once. Background means host descendants, including shells, tools and services; detached/reparented or remote jobs are not attributed. Shared-host values are not per-agent usage. OS state: R runnable, S sleeping, T stopped, Z zombie.${p.childCount > p.children.length ? ` Showing the busiest ${p.children.length} of ${p.childCount} descendants; totals include all observed descendants.` : ''}</p>` : '');
}
function agentSignal(a) {
  const liveApproval=state.approvals?.items.some(p=>!p.sent && state.terminals?.some(t=>t.id===p.terminalId && t.agentId===a.id));
  const active=state.tasks.some(t=>t.owner===a.id && t.status==='active');
  const blocked=!active && state.tasks.some(t=>t.owner===a.id && t.status==='blocked');
  if(liveApproval)return {label:'Awaiting approval',color:'warn',rank:0,reason:'Review the live prompt to continue.'};
  const pending=state.tasks.filter(t=>t.owner===a.id && ['active','ready','review'].includes(t.status) && !t.blocker && (t.dependencies||[]).every(id=>state.tasks.some(d=>d.id===id && d.status==='done')));
  const workers=state.agents.filter(c=>c.parentAgentId===a.id && ['working','tool'].includes(c.state) && Date.now()-Date.parse(c.lastActivityAt)<15*60000);
  if(a.state==='idle' && pending.length && !workers.length)return {label:'Stopped with work remaining',color:'bad',rank:0,stopped:true,reason:`Turn ended ${age(a.lastActivityAt)} ago · ${pending.length} actionable task${pending.length===1?'':'s'}. Open terminal to inspect the draft or resume work.`};
  if(a.state==='idle' && workers.length)return {label:'Workers active',color:'good',rank:3,reason:`Coordinator turn ended; ${workers.length} worker${workers.length===1?'':'s'} still reporting activity.`};
  if(blocked)return {label:'Task blocked',color:'warn',rank:1,reason:'Read the blocker and required decision.'};
  if(active && a.state==='idle')return {label:'Assigned · turn ended',color:'warn',rank:2,reason:'Check the handoff or next pickup; the task is still marked running.'};
  const [label,color]=health(a);
  return {label,color,rank:color==='warn'?2:3,reason:color==='warn'?'No recent session activity. Inspect the terminal; this alone does not prove a stall.':''};
}
function stoppedAgentBanner() {
  const stopped=currentAgents().filter(a=>agentSignal(a).stopped);
  if(!stopped.length)return '';
  return `<section class="stopped-agents" role="status" aria-label="Stopped agents"><strong>■ ${stopped.length} agent${stopped.length===1?' has':'s have'} stopped with work remaining</strong>${stopped.map(a=>`<div><span><b>${escape(agentName(a))}</b> · ${escape(agentSignal(a).reason)}</span>${terminalLink(a)}<button data-agent="${escape(a.id)}">Inspect agent →</button></div>`).join('')}</section>`;
}
function subagentSummary(a) {
  const children = state.agents.filter(child => child.parentAgentId === a.id && child.id !== a.id)
    .sort((x, y) => (y.lastActivityAt || '').localeCompare(x.lastActivityAt || ''));
  if (!children.length) return '';
  const rows = children.map(child => {
    const signal = agentSignal(child);
    return `<li><div class="subagent-heading"><button data-agent="${escape(child.id)}">${escape(child.taskTitle || child.title || child.id)}</button>${badge(signal.label, signal.color)}</div><p>${escape(child.summary || child.lastEvent || 'No summary recorded')}</p><span class="sub">${escape(child.lastEvent || 'Unknown operation')} · Activity ${age(child.lastActivityAt)} ago</span></li>`;
  });
  return `<section class="subagent-summary" aria-label="Subagents"><h3>Subagents (${children.length})</h3><ul>${rows.slice(0, 3).join('')}</ul>${rows.length > 3 ? `<details><summary>Show ${rows.length - 3} more subagents</summary><ul>${rows.slice(3).join('')}</ul></details>` : ''}<p class="sub">From observed session logs; activity is not proof of progress.</p></section>`;
}
// One full-width row per agent: line 1 identity + status, line 2 the decision,
// next step or latest result. Subagents get the same two lines. Everything else
// (process, tokens, evidence, timestamps) stays in the agent detail view.
function agentName(a) {
  if(coordinator()?.agentId===a.id)return 'Coordinator';
  if(a.taskTitle)return a.taskTitle;
  const task=/\b([A-Z][A-Z0-9]+(?:-[A-Z0-9]+){2,})\b/.exec(a.title || '')?.[1];
  // Codex child prompts often start with a bracketed role label: use it rather than the whole prompt.
  const label=/^\[([^\]]{3,60})\]/.exec(a.title || '')?.[1];
  return task || label || (a.title && a.title !== a.id ? a.title : 'Untitled session');
}
function agentLine2(a,signal) {
  if(signal.reason)return signal.reason;
  const task=state.tasks.find(t=>t.owner===a.id && t.status==='active');
  if(task?.next)return 'Next: '+task.next;
  if(a.summary)return 'Latest: '+a.summary;
  return a.lastEvent && a.lastEvent!=='Unknown' ? 'Last operation: '+a.lastEvent+' · no result or next step recorded' : 'No result or next step recorded';
}
function agentActivity(a) {
  const elapsed=a.lastActivityAt?Date.now()-Date.parse(a.lastActivityAt):NaN;
  const freshness=!Number.isFinite(elapsed)?'unknown':elapsed<120000?'fresh':elapsed<600000?'quiet':'stale';
  return `<span class="agent-age activity-${freshness}" title="Last activity: green under 2 minutes; amber 2–10 minutes; red 10+ minutes. Activity is not proof of progress.">${Number.isFinite(elapsed)?(a.state==='idle'?'idle · last activity ':'last activity ')+age(a.lastActivityAt)+' ago':'activity unknown'}</span>`;
}
function subagentRows(a) {
  const children=state.agents.filter(child=>child.parentAgentId===a.id && child.id!==a.id)
    .sort((x,y)=>Number(y.state==='working' || y.state==='tool')-Number(x.state==='working' || x.state==='tool') || (y.lastActivityAt || '').localeCompare(x.lastActivityAt || ''));
  if(!children.length)return '';
  const rows=children.map(child=>{const signal=agentSignal(child);return `<li class="subagent-row"><div class="agent-line1"><span aria-hidden="true">↳</span><button class="agent-title" data-agent="${escape(child.id)}" title="${escape(child.title || child.id)}">${escape(agentName(child))}</button><span class="agent-status ${signal.color}">${escape(signal.label)}</span>${agentActivity(child)}</div><div class="agent-line2 sub" title="${escape(agentLine2(child,signal))}">${escape(agentLine2(child,signal))}</div></li>`;});
  return `<ul class="subagent-rows" aria-label="Subagents of ${escape(agentName(a))}">${rows.slice(0,3).join('')}</ul>${rows.length>3?`<details class="subagent-more"><summary>Show ${rows.length-3} more subagents</summary><ul class="subagent-rows">${rows.slice(3).join('')}</ul></details>`:''}`;
}
// The standing /goal of a top-level Claude session: an active goal keeps it going
// after each turn, a met goal no longer does, and without one it stops when idle.
function agentGoal(a) {
  if(a.provider!=='claude' || a.parentAgentId)return '';
  const g=a.goal;
  if(!g)return `<div class="agent-goal goal-none sub" title="No /goal recorded in the observed log: the session stops when its turn ends.">◌ No /goal</div>`;
  const label=g.met?'✓ Goal met — no longer driving':'◎ Goal';
  return `<div class="agent-goal ${g.met?'goal-met':'goal-active'}" title="${escape(g.condition)}${g.at?' · recorded '+escape(when(g.at)):''}"><strong>${label}:</strong> ${escape(g.condition)}</div>`;
}
function agentCard(a) {
  const signal=agentSignal(a),line2=agentLine2(a,signal);
  return `<article class="agent-row panel ${signal.rank<3?'agent-attention':'agent-routine'}"><div class="agent-line1"><span class="provider ${escape(a.provider)}">${escape(a.provider.toUpperCase())}</span><span class="agent-short sub" title="${escape(a.id)}">${escape(a.id.split(':').at(-1).replace(/^agent-/,'').slice(0,6))}</span><button class="agent-title" data-agent="${escape(a.id)}" title="${escape(a.title || a.id)}">${escape(agentName(a))}</button><span class="agent-status ${signal.color}">${escape(signal.label)}</span>${agentActivity(a)}${terminalLink(a)}<button class="details-button row-open" data-agent="${escape(a.id)}" aria-label="Details for ${escape(agentName(a))}">▸</button></div><div class="agent-line2 ${signal.reason?'agent-decision':'sub'}" title="${escape(line2)}">${escape(line2)}</div>${agentGoal(a)}${subagentRows(a)}</article>`;
}
const matchesTree = a => matches(a) || state.agents.some(c=>c.parentAgentId===a.id && matches(c));
// A current subagent is shown under its parent, so its parent row is current too.
function topLevel(agents) {
  const byId=new Map(state.agents.map(a=>[a.id,a])),out=[];
  for(const a of agents){const row=a.parentAgentId && byId.get(a.parentAgentId) || a;if(!out.includes(row))out.push(row);}
  return out;
}
// Committed → pushed → merged from local refs; tested from runs recording this
// commit; deploy is not recorded per commit (the production snapshot is files only).
function codeChips(c) {
  const code=c.code,main=state.codeState?.mainRef || 'main';
  const where=!code?'<span class="code-chip">location unknown</span>':code.state==='merged'?`<span class="code-chip code-merged">merged · ${escape(main)}</span>`:code.state==='pushed'?`<span class="code-chip code-pushed">pushed · not on ${escape(main)}${code.branches?.length?' · '+escape(code.branches.join(', ')):''}</span>`:'<span class="code-chip code-local">local only · not pushed</span>';
  const runs=c.runs || [],tested=runs.length?`<span class="code-chip">tested · ${runs.length} run${runs.length===1?'':'s'} (${runs.filter(r=>r.outcome==='passed').length} passed, ${runs.filter(r=>r.verification==='reviewed').length} reviewed)</span>`:'<span class="code-chip code-unknown">tested: no run records this commit</span>';
  return `${where}${tested}<span class="code-chip code-unknown" title="The production snapshot records deployed files, not a commit.">deployed: not recorded</span>${(c.taskIds || []).map(id=>`<button class="code-task" data-task="${escape(id)}">${escape(id)}</button>`).join('')}`;
}
function commitSection(t) {
  const commits=t.commits || [];
  if(!commits.length)return section('Code')+'<p class="sub">No commit message names this task ID.</p>';
  return section('Code')+`<p class="source-note">${escape(state.codeState?.note || '')}${state.codeState?.fetchedAt?' Last fetch '+escape(when(state.codeState.fetchedAt))+'.':''}</p><div class="panel">${commits.map(c=>`<div class="feed-row feed-commit"><div class="sub activity-meta"><code>${escape(c.shortHash)}</code><time>${escape(when(c.time))}</time>${typeof c.url==='string'&&/^https:\/\/github\.com\//.test(c.url)?`<a class="commit-link" href="${escape(c.url)}" target="_blank" rel="noopener noreferrer">GitHub ↗</a>`:''}</div><div class="feed-text commit-subject">${escape(c.subject)}</div><div class="code-chips">${codeChips(c)}</div></div>`).join('')}</div>`;
}
function feedRows(rows, truncate = false) { return rows.map(row => {
  const commit=row.type==='commit',text=String(commit?(row.subject || row.text || 'Untitled commit'):(row.text || ''));
  const date=row.time && Number.isFinite(Date.parse(row.time)) ? `<time datetime="${escape(row.time)}">${escape(when(row.time))}</time>` : '<span>Date not recorded</span>';
  const metadata=commit?`<code>${escape(row.shortHash || row.hash?.slice(0,8) || 'unknown')}</code><span>${escape(row.author || 'Unknown author')}</span>`:'';
  const github=commit && typeof row.url==='string' && /^https:\/\/github\.com\//i.test(row.url) && !/[\u0000-\u0020]/.test(row.url)?`<a class="commit-link" href="${escape(row.url)}" target="_blank" rel="noopener noreferrer" aria-label="${escape('Open commit '+(row.shortHash || row.hash || '')+' on GitHub')}">GitHub ↗</a>`:'';
  return `<div class="feed-row${commit?' feed-commit':''}"><div class="sub activity-meta"><span>${commit?'COMMIT':'MESSAGEBOARD'}</span>${metadata}${date}${github}</div><div class="feed-text${commit?' commit-subject':''}">${escape(truncate && text.length>360?text.slice(0,360)+'…':text)}</div>${commit?`<div class="code-chips">${codeChips(row)}</div>`:''}</div>`;
}).join('') || empty('No messageboard entries.'); }
// The page name lives in the header now; a view keeps its one-line purpose and actions.
function title(name, subtitle, action = '') { return `<div class="title-row"><p class="lead">${escape(subtitle)}</p>${action}</div>`; }
function section(name, target) { return `<div class="section-head"><h2>${name}</h2>${target ? `<a href="#${target}">View all →</a>` : ''}</div>`; }
function notice() { return state.warnings.length ? `<div class="notice"><details><summary>${state.warnings.length} source notices</summary><ul>${state.warnings.map(w => `<li>${escape(w)}</li>`).join('')}</ul></details></div>` : ''; }
function statusSummary(compact=false) {
  const status=state.projectStatus || {},lines=(status.body || '').split('\n');
  const headlineIndex=lines.findIndex(line=>/^# /.test(line));
  const headline=headlineIndex>=0?lines.splice(headlineIndex,1)[0].slice(2):lines.find(line=>line.trim()) || 'Agents have not posted a summary yet.';
  const freshness=status.updatedAt?`Updated ${age(status.updatedAt)} ago`:'Update time not recorded';
  const old=status.updatedAt && Date.now()-Date.parse(status.updatedAt)>24*60*60*1000;
  if(compact)return `<div class="briefing-compact"><div><span class="eyebrow">WHAT MATTERS NOW</span><p>${escape(headline)}</p><span class="sub">${escape(freshness)}${old?' · Review freshness':''}</span></div><button data-status-summary="open">Read TLDR →</button></div>`;
  const inline=text=>escape(text).replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>').replace(/`([^`]+)`/g,'<code>$1</code>');
  const groups=[{heading:'',lines:[]}];
  for(const line of lines){const heading=/^#{2,6} (.+)$/.exec(line);if(heading)groups.push({heading:heading[1],lines:[]});else groups.at(-1).lines.push(line);}
  const content=groups.filter(g=>g.heading || g.lines.some(line=>line.trim())).map(group=>{
    let html='',list=false,paragraph=[];
    const flush=()=>{if(paragraph.length){html+=`<p>${inline(paragraph.join(' '))}</p>`;paragraph=[];}if(list){html+='</ul>';list=false;}};
    for(const line of group.lines){const bullet=/^\s*[-*] (.+)$/.exec(line);if(bullet){if(paragraph.length)flush();if(!list){html+='<ul>';list=true;}html+=`<li>${inline(bullet[1])}</li>`;}else{if(!line.trim())flush();else{if(list)flush();paragraph.push(line.trim());}}}flush();
    return `<section>${group.heading?`<h3>${escape(group.heading)}</h3>`:''}${html}</section>`;
  }).join('');
  return `<article class="briefing panel"><div class="briefing-top"><h2>// What matters now</h2>${link('/source?path=ops/STATUS.md','Source')}</div><p class="briefing-headline">${escape(headline)}</p><div class="briefing-meta sub">${escape(freshness)}${status.author?' · '+escape(status.author):''}${old?' · Review freshness':''} · Agent-written summary</div><div class="briefing-copy">${content || '<p class="sub">Agents can publish the current outcome, decisions needed, and next step in ops/STATUS.md.</p>'}</div></article>`;
}
function blockerDependencies(t) {
  return BlockerModel.dependencies(state,t);
}
function blockerKind(t) {
  return BlockerModel.kind(state,t);
}
function blockerOwner(t) {
  return state.terminals?.find(x=>x.agentId===t.owner)?.label || (t.owner?t.owner.split(':')[0]+' agent · '+t.owner.split(':').at(-1).slice(-6):'Unassigned');
}
function blockerRows(tasks) {
  return BlockerModel.order(state,tasks).map(t=>{
    const [kind,color,action]=blockerKind(t),dependencies=blockerDependencies(t);
    const children=state.tasks.filter(x=>blockerDependencies(x).some(d=>d.id===t.id));
    const owner=state.agents.find(a=>a.id===t.owner);
    const ownerName=blockerOwner(t);
    const next=dependencies.length?'Waiting for '+dependencies.map(d=>d.title).join('; '):kind==='Capacity needed'?(t.waitingOn||t.needs):t.needs||t.next||'Owner needs to record a concrete next step.';
    const [who,basis]=BlockerModel.actor(state,t);
    return `<article class="blocker panel"><div class="blocker-heading">${taskButton(t)}${badge(kind,color)}${badge(who==='user'?'Needs your input':'Agent-resolvable',who==='user'?'warn':'')}</div><p class="blocker-ask">${escape(next)}</p><p class="sub blocker-basis">${escape(basis)}</p>${kind==='Review blocked'?'<p class="source-note">Automated review stopped validation. No dashboard override.</p>':''}<div class="blocker-meta sub"><span title="${escape(t.owner)}">${escape(ownerName)}</span><span>${t.progressAt?'Task updated '+age(t.progressAt)+' ago':'Task update time not recorded'}</span>${t.blockedAt?`<span>Blocked ${age(t.blockedAt)}</span>`:''}</div>${t.replies?.length?'<p class="reply-pending">Reply posted · awaiting owner verification</p>':''}${children.length?`<div class="blocker-dependents"><span class="sub">Also holds up</span>${children.map(c=>`<button data-task="${escape(c.id)}">${escape(c.title)} →</button>`).join('')}</div>`:''}<details class="blocker-evidence"><summary>Evidence and background</summary><p>${escape(t.blocker||'Reason not recorded.')}</p>${t.needs?`<p>Needs: ${escape(t.needs)}</p>`:''}${dependencies.map(d=>`<p>Waiting on ${taskButton(d)}</p>`).join('')}</details><div class="blocker-footer">${terminalLink({id:t.owner})}${dependencies.length?`<button data-blocker="${escape(dependencies[0].id)}">View dependency →</button>`:''}<button data-blocker="${escape(t.id)}">${escape(dependencies.length?'Message owner':action)} →</button></div></article>`;
  }).join('') || empty('No matching blockers.');
}
function blockersView() {
  const {blocked,approvals,counts,repeatedIds}=BlockerModel.blockerSummary(state);
  const relevant=blocked.filter(t=>matches(t)||blocked.some(c=>matches(c)&&blockerDependencies(c).some(d=>d.id===t.id)));
  const roots=BlockerModel.primaryRoots(state,relevant),{user,agent}=BlockerModel.split(state,roots);
  return title('Blockers',BlockerModel.countSummaryText(counts)) +
    `<p class="source-note">${approvals.length} live approvals · ${user.length} need your input · ${agent.length} agent-resolvable · ${relevant.length-roots.length} dependent rows (filtered row classifications; not current eligibility).</p>`+
    (repeatedIds.length?section('Repeated task IDs / recorded ambiguity')+BlockerModel.repeatedIdNotes(repeatedIds).map(note=>`<pre class="source-note">${escape(note)}</pre>`).join(''):'')+
    section('Needs your input')+(approvals.length?`<div class="blocker-list">${approvals.map(p=>`<article class="blocker panel blocker-action"><div class="blocker-heading"><strong>${escape(p.reason||'Command approval needed')}</strong>${badge('Live approval','warn')}</div><p class="sub">${escape(p.label)} · waiting ${age(p.firstSeenAt)} · checked against the live terminal</p><button data-approval="${escape(p.id)}">Review command →</button></article>`).join('')}</div>`:'<p class="sub">No live command approvals.</p>')+
    (user.length?`<div class="blocker-list">${blockerRows(user)}</div>`:'<p class="sub">No blocked task records a request for your input.</p>')+
    section('Agent-resolvable')+`<p class="source-note">Classified from recorded waitingOn, needs and dependencies (shared with Telegram /blockers); a task that records nothing stays with its owner.</p><div class="blocker-list">${blockerRows(agent)}</div>`;
}
function blockerDetail(id) {
  const t = state.tasks.find(t => t.id === id); if (!t) return;
  show('BLOCKER / ' + t.id, `<h1>${escape(t.title)}</h1><p>${escape(t.blocker || 'No blocker reason recorded.')}</p>${t.needs ? `<p><strong>Needs:</strong> ${escape(t.needs)}</p>` : ''}<p class="sub">Owner: ${escape(blockerOwner(t))} · Waiting on: ${escape(t.waitingOn || 'unspecified')}</p>${t.replyAllowed ? `<form id="blocker-reply" data-task-id="${escape(t.id)}"><label for="reply-text">Decision or help for the owner</label><textarea id="reply-text" required maxlength="2000" rows="4" placeholder="What changed, what to try, or which decision to follow…"></textarea><p class="source-note">Posts to the shared messageboard as dashboard-user. The owner must verify and update the task; posting does not unblock it.</p><button type="submit">Post reply to messageboard</button><p id="reply-status" role="status"></p></form>` : '<p class="notice">Add an explicit id: to this task in TODOS.md before posting a reply.</p>'}${section('Recent replies')}<div class="panel">${feedRows(t.replies || [])}</div><details class="blocker-source"><summary>Task source</summary><pre>${escape(t.body)}</pre></details>`);
}
function overview() {
  const tasks = sortedTasks(state.tasks.filter(t => !['done', 'deferred', 'duplicate', 'unknown'].includes(t.status) && matches(t)));
  return title('Operations console', 'Track the work. Inspect the evidence. Keep the agents in view.') +
    statusSummary()+
    `<div class="stats">${['active','ready','blocked','review'].map(status=>`<a class="stat" href="#tasks"><div class="sub">${escape(taskState(status)[1])}</div><div class="value task-label-${status}">${state.tasks.filter(t=>t.status===status).length}</div><div class="sub">From the task ledger</div></a>`).join('')}</div>` +
    (state.tasks.some(t => t.status === 'blocked') ? section('Needs attention', 'blockers') + `<div class="blocker-list">${blockerRows(state.tasks.filter(t => t.status === 'blocked' && matches(t)).slice(0, 4))}</div>` : '') +
    section('Current agents', 'agents') + `<div class="agent-list">${topLevel(currentAgents()).filter(matchesTree).slice(0, 4).map(agentCard).join('') || empty('No current project session logs found. Open Agents for history.')}</div>` +
    section('Current work and next steps', 'tasks') + `<div class="panel">${taskRows(tasks.slice(0, 6))}</div>` +
    section('Latest visuals', 'corpus') + visualCards(state.runs.filter(matches).filter((r, i, runs) => r.visuals?.length && !runs.slice(0, i).some(other => other.candidateId === r.candidateId && other.visuals?.length))) + notice();
}
function tasksView() {
  const tasks = state.tasks.filter(t => matches(t) && (filter === 'all' || t.status === filter));
  const counts = taskStates.slice(0,4).map(([s,label]) => `<button class="queue-count task-label-${s}" data-task-filter="${s}" aria-pressed="${filter === s}"><strong>${state.tasks.filter(t => t.status === s && matches(t)).length}</strong><span>${label}</span></button>`).join('');
  const groups = taskStates.map(([s,label,hint,symbol]) => {
    const items = tasks.filter(t => t.status === s);
    if (!items.length) return '';
    const open = filter !== 'all' || query || (expandedTaskGroups.get(s) ?? ['active','ready','review','blocked'].includes(s));
    return `<details class="task-group task-group-${s}" data-task-group="${s}" ${open ? 'open' : ''}><summary><span class="task-label task-label-${s}">${symbol} ${label}</span><span class="group-count">${items.length}</span><span class="group-hint">${hint}</span></summary><div class="panel">${taskRows(items)}</div></details>`;
  }).join('');
  return title('Task queue', 'Running first, then the next assignments. Status comes from the task ledger, not process activity.', '<div class="task-controls"><button id="todo-source">Read source</button><button id="new-task" class="primary-action">+ New task</button></div>') +coordinatorBar()+
    `<div class="queue-counts">${counts}</div><details class="queue-briefing" ${queueBriefingOpen?'open':''}><summary>Project TLDR</summary>${statusSummary(true)}</details><p id="task-queue-status" role="status"></p><div class="toolbar"><select id="filter" aria-label="Task status"><option value="all" ${filter === 'all' ? 'selected' : ''}>All statuses</option>${taskStates.map(([s,label]) => `<option value="${s}" ${s === filter ? 'selected' : ''}>${label}</option>`).join('')}</select><span class="sub">${tasks.length} items · source order; full criteria in Details</span></div>${groups || empty('No tasks match this view.')}`;
}
function candidateWork(c) {
  const order = ['active','review','blocked','ready'];
  return state.tasks.filter(t => c.taskIds.includes(t.id) && order.includes(t.status)).sort((a,b) => order.indexOf(a.status)-order.indexOf(b.status) || a.line-b.line)[0];
}
function candidateCapture(c) {
  const matching=state.runs.filter(r=>r.candidateId===c.id || c.appIds?.includes(r.candidateId));
  const gameplayRun=matching.find(r=>r.gameplayScreenshots?.length);
  const run=gameplayRun || (c.latestRun?.screenshots.length?c.latestRun:matching.find(r=>r.screenshots.length));
  return {run,shot:gameplayRun?run.gameplayScreenshots.at(-1):run?.screenshots.at(-1),gameplay:!!gameplayRun,older:!!run && run.key!==c.latestRun?.key};
}
function corpusAssessment(c,details=false) {
  const a=c.assessment;if(!a)return '';
  const color=a.needsReview?'warn':a.status==='Needs repair'?'bad':['Strong next candidate','Strong local candidate'].includes(a.status)?'good':'';
  return `<div class="corpus-assessment">${badge(a.needsReview?'New evidence · review needed':a.status,color)}${details?`<p>${escape(a.summary)}</p><p class="sub">${escape(a.origin)} · ${escape(a.distribution)}</p><p class="sub">${escape(a.licenseNote)}</p><p><strong>Next:</strong> ${escape(a.next)}</p><p class="sub">Evidence reviewed ${escape(when(a.reviewedAt))}; no fresh run implied.${a.appIds.length?' Registered apps: '+escape(a.appIds.join(', ')):''}</p>${a.registeredExecutablePresent && c.fixtureStatus!=='present'?'<p class="sub">A registered executable exists even though the original candidate fixture is incomplete. Assets and runtime still need verification.</p>':''}`:''}</div>`;
}
function perfComparisonHtml(c) {
  const cmp=ReleaseModel.perfComparisons(state,c),wasm=v=>v?escape(v.slice(0,12)):'not recorded';
  if(!cmp.count)return '';
  const side=(name,m)=>`${name} ${m.fps.toFixed(1)} · wasm ${wasm(m.wasmSha256)} · ${escape(when(m.measuredAt))}${m.reviewed?'':' · unreviewed'}`;
  return `<section class="perf-compare"><h3>Before / after</h3><p class="sub">${escape(cmp.text)}. Only identical scene, counter, renderer, host and GPU with recorded module hashes are compared.</p>${cmp.pairs.map(p=>`<p><strong>${p.deltaPct===null?'change unknown (before was 0)':(p.deltaPct>=0?'+':'')+p.deltaPct.toFixed(1)+'%'}</strong> ${escape(p.label)} · ${p.sameBuild?'same build (repeat)':'different builds'}<br><span class="sub">${side('Before',p.before)}</span><br><span class="sub">${side('After',p.after)}</span></p>`).join('')}${cmp.notComparable.length?`<details><summary>${cmp.notComparable.length} not comparable</summary><ul>${cmp.notComparable.map(n=>`<li>${side('Earlier',n.before)}: ${escape(n.reasons.join(', '))}</li>`).join('')}</ul></details>`:''}</section>`;
}
// Corpus search covers identity fields only (names, ids, executables, source,
// category), unlike the header search, which matches any text in the record.
const nonGameCategories=['tools','graphics-demos','unclassified','collections'];
function corpusKind(c) {
  const scope=c.releaseReadiness?.scope;
  if(scope==='game' || scope==='non-game')return scope==='game'?'games':'apps';
  return c.category && !nonGameCategories.includes(c.category.id)?'games':'apps';
}
function matchesCorpusSearch(c,text=corpusQuery,type=corpusType) {
  if(type!=='all' && corpusKind(c)!==type)return false;
  const words=text.toLowerCase().split(/\s+/).filter(Boolean);
  if(!words.length)return true;
  const hay=[c.name,c.id,c.version,c.sourceGroup,c.category?.label,c.kind,...(c.appIds||[]),...(c.executables||[])].filter(Boolean).join(' ').toLowerCase();
  return words.every(w=>hay.includes(w));
}
function corpusFps(c,details=false) {
  const gameCategory = c.category && !['tools','graphics-demos','unclassified','collections'].includes(c.category.id);
  if(!c.performance && !gameCategory && !/game/i.test(c.kind) && !['Shareware / demos','Retail / archived games','Freeware / community'].includes(c.assessment?.origin))return '';
  const p=c.performance;if(!p)return '<p class="sub corpus-fps">FPS — no linked measurement</p>';
  const flipEvents=p.counterKind==='guest-flip-events',logical=p.metric==='guest-logical-frame-submissions',rateLabel=p.metric==='selected-window-presentations'?'window presentations/s (coalesced GDI)':logical?'logical gameplay frames/s':flipEvents?'guest Flip events/s':'guest presentation events/s',intervalLabel=p.metric==='selected-window-presentations'?'p95 window-presentation interval':logical?'p95 submission interval':flipEvents?'p95 Flip interval':'p95 presentation interval';
  return `<div class="corpus-fps"><strong>${p.fps.toFixed(1)} ${rateLabel}</strong> <span class="sub">${p.historical?'Historical · ':''}${escape(p.renderer)} · ${age(p.measuredAt)} ago</span>${details?`<p>${escape(p.scene)} · ${escape(p.host)}</p><p class="sub">${escape(p.notes)}${p.visibility?` Visible client ${escape(JSON.stringify(p.visibility.client))}; ${(p.visibility.fraction*100).toFixed(2)}% visible. Physical-display FPS not measured.`:''} Measured ${escape(when(p.measuredAt))}.</p><div class="process-table"><table><tr><th>Sample</th><th>${rateLabel}</th><th>Duration</th><th>${intervalLabel}</th></tr>${p.samples.map((s,i)=>`<tr><td>${i+1}</td><td>${s.fps.toFixed(1)}</td><td>${(s.durationMs/1000).toFixed(1)}s</td><td>${s.p95FrameMs===null?'—':s.p95FrameMs.toFixed(1)+'ms'}</td></tr>`).join('')}</table></div><button data-run="${escape(p.runKey)}">Measurement source →</button>`:''}</div>`;
}
const releaseStates = [['ready','Ready for release','good'],['review-needed','Release review needed','warn'],['blocked','Release blocked','bad'],['unknown','Release readiness unknown',''],['already-production','Already in production','']];
function releaseState(c) { return releaseStates.find(([id])=>id===c.releaseReadiness?.status) || releaseStates[3]; }
function matchesRelease(c,selection=corpusRelease) {
  if(selection==='all')return true;
  const r=c.releaseReadiness;
  if(r?.scope!=='game')return false;
  if(selection==='gameplay-reviewed')return r.productionMembership==='no' && ['gameplay-reviewed','evidence-complete'].includes(r.prospect);
  return selection==='unreleased' ? r.productionMembership==='no' : releaseState(c)[0]===selection;
}
function corpusReleaseReview(c,details=false) {
  const r=c.releaseReadiness;
  if(r?.scope==='non-game')return details?'<p class="sub">Release review scope: non-game.</p>':'';
  const [,label,color]=releaseState(c),membership=({yes:'In production',no:'Not in production',unknown:'Production membership unknown'})[r?.productionMembership] || 'Production membership unknown';
  const heading=`<div class="release-heading">${badge(label,color)}<span class="sub">${escape(membership)}</span></div>`;
  if(!details)return `<div class="corpus-release">${heading}${r?.summary?`<p class="sub release-summary">${escape(r.summary)}</p>`:''}</div>`;
  const gates=Object.entries(r?.gates||{}),blockers=r?.blockers||[];
  const performanceStatus=({'recorded-review-needs-release-qualification':'Recorded measurement; release qualification still needed','not-measured':'No measurement recorded'})[r?.performance?.status] || 'Review status unknown';
  const performanceMetric=({'selected-window-presentations':'Window presentations (coalesced GDI)','guest-logical-frame-submissions':'Logical gameplay frame submissions','guest-flip-events':'Guest Flip events','guest-presentation-events':'Guest presentation events'})[r?.performance?.metric];
  return `<section class="corpus-release release-detail"><h2>Release readiness</h2>${heading}<p>${escape(r?.summary || 'No release review recorded.')}</p>${r?.next?`<p><strong>Next:</strong> ${escape(r.next)}</p>`:''}${blockers.length?`<h3>Release blockers</h3><ul>${blockers.map(b=>`<li>${escape(b.summary)}${b.source?`<div class="sub">${escape(b.source)}</div>`:''}</li>`).join('')}</ul>`:''}${gates.length?`<div class="release-gates">${gates.map(([name,g])=>`<div><strong>${escape(name)}</strong>${badge(String(g.status || 'unknown').replaceAll('-',' '),g.status==='blocked'?'bad':g.status==='passed'?'good':'')}<p>${escape(g.summary)}</p>${g.source?`<p class="sub">${escape(g.source)}</p>`:''}</div>`).join('')}</div>`:''}${r?.reviewedGameplay?.runKey?`<button data-run="${escape(r.reviewedGameplay.runKey)}">Reviewed gameplay evidence →</button>`:''}${r?.performance?`<p class="sub">Performance review: ${escape(performanceStatus)}${performanceMetric?' · '+escape(performanceMetric):''}</p>`:''}<p class="sub">Release review: ${escape(when(r?.reviewedAt))}. Gameplay screenshots and successful runs alone do not establish release readiness.</p></section>`;
}
function corpusReleaseBar() {
  const games=state.candidates.filter(c=>c.releaseReadiness?.scope==='game'),production=state.releaseReadiness?.production;
  const choices=[['ready','Ready for release'],['unreleased','Unreleased games'],['gameplay-reviewed','Unreleased · gameplay reviewed'],['blocked','Blocked']];
  return `<section class="release-bar" aria-label="Game release readiness"><div><strong>Game release readiness</strong><span class="sub">All ${games.length} game entries</span></div><div class="release-counts">${choices.map(([id,label])=>`<button data-release-filter="${id}" aria-pressed="${corpusRelease===id}"><strong>${games.filter(c=>matchesRelease(c,id)).length}</strong> ${label}</button>`).join('')}</div><p class="sub">${production?.status==='verified'?`Production snapshot checked ${escape(when(production.checkedAt))}.`:'Production membership is unverified; unknown entries are not counted as unreleased.'} ${games.filter(c=>c.releaseReadiness.productionMembership==='unknown').length} with unknown production membership.${production?.source?` Source: ${escape(production.source)}.`:''}</p></section>`;
}
function corpusLaunchActions(c,details=false,withBuild=details) {
  const launch=c.launch, routes=launch?.routes || [], production=launch?.productionRoutes || [];
  const safeUrl=value=>typeof value==='string' && (/^\/[^/\\]/.test(value) || /^https?:\/\//i.test(value)) && !/[\u0000-\u0020\\]/.test(value);
  const actions=routes.map(route=> {
    const label=routes.length>1 ? 'Launch in emulator · '+(route.label || route.appId) : 'Launch in emulator';
    if(route.available===true && safeUrl(route.url))return `<a class="emulator-launch" href="${escape(route.url)}" target="_blank" rel="noopener noreferrer" aria-label="${escape(label+' — '+(c.name || c.id))}">${escape(label)} ↗</a>`;
    const missing=route.missingPaths || [];
    return `<div class="launch-unavailable"><span>${routes.length>1?escape(route.label || route.appId)+': ':''}Launch unavailable</span><p class="sub">${escape(route.reason || 'No verified local launch route.')}</p>${missing.length&&!details?`<p class="sub missing-files">Missing: ${missing.slice(0,3).map(escape).join(', ')}${missing.length>3?` +${missing.length-3} more (Details)`:''}</p>`:''}${details && missing.length?`<details open><summary>Missing files (${missing.length})</summary><pre>${escape(missing.join('\n'))}</pre></details>`:''}</div>`;
  }).join('');
  const publicLinks=production.filter(route=>safeUrl(route.url)).map(route=>`<a class="production-launch" href="${escape(route.url)}" target="_blank" rel="noopener noreferrer" aria-label="${escape('Open production — '+(route.label || c.name || route.appId))}">Open production${production.length>1?' · '+escape(route.label || route.appId):''} ↗</a>`).join('');
  const served=ReleaseModel.servedBuild(state),available=routes.some(route=>route.available===true);
  const buildChip=available&&withBuild?`<span class="sub build-chip" title="${escape(state.emulatorBuild?.note || '')}">Build ${escape(served.text)}${served.reason?' · '+escape(served.reason):''}</span>`:'';
  return `<div class="corpus-launch${details?' launch-detail':''}" aria-label="Launch options">${actions || `<p class="sub">Launch unavailable: ${escape(launch?.reason || 'No verified local launch route.')}</p>`}${buildChip}${publicLinks}${details?'<p class="sub">Opens in a new tab pinned to the served wasm shown; if the module changes first, the launch refuses instead of running another build. Launch availability does not establish gameplay compatibility or release readiness.</p>':''}</div>`;
}
function launchableCandidate(c) { return c.launch?.routes?.some(route=>route.available===true) === true; }
function corpusLaunchBar() {
  const count=state.candidates.filter(launchableCandidate).length;
  return `<div class="launch-availability" aria-label="Emulator launch availability"><button data-launch-filter="available" aria-pressed="${corpusLaunch==='available'}"><strong>${count}</strong> Launchable now</button><span class="sub">${state.candidates.length-count} without an available local route. Launch availability is separate from gameplay verification. Launches serve: ${escape(ReleaseModel.servedBuild(state).text)}.</span>${corpusLaunch==='available'?'<button data-launch-filter="all">Show all launch states</button>':''}</div>`;
}
function corpusView() {
  const workRank = c => ({active:0,review:1,blocked:2,ready:3})[candidateWork(c)?.status] ?? 4;
  const resultRank = c => ({failed:0,'harness-error':0,timeout:0,running:1,unknown:2,passed:3})[c.latestRun?.outcome] ?? 4;
  const categories = [...new Map(state.candidates.map(c => [c.category?.id || 'unclassified', c.category || {id:'unclassified',label:'Unclassified'}])).values()].sort((a,b) => Number(a.id==='unclassified')-Number(b.id==='unclassified') || a.label.localeCompare(b.label));
  const candidates = state.candidates.filter(c => matches(c) && matchesCorpusSearch(c) && matchesRelease(c) && (corpusLaunch==='all' || launchableCandidate(c)) && (corpusCategory==='all' || (c.category?.id || 'unclassified')===corpusCategory) && (corpusGroup==='all' || c.sourceGroup===corpusGroup) && (filter === 'all' || filter === 'working' && candidateWork(c)?.status === 'active' || filter === 'no-run' && !c.latestRun || filter === 'with-shot' && candidateCapture(c).shot || filter === 'no-shot' && !candidateCapture(c).shot || c.latestRun?.outcome === filter))
    .sort((a,b) => (corpusRelease==='all'?0:(a.releaseReadiness?.rank??999)-(b.releaseReadiness?.rank??999)) || workRank(a)-workRank(b) || resultRank(a)-resultRank(b) || (a.name || a.id).localeCompare(b.name || b.id));
  return title('EXE corpus', 'Browse by category, release readiness and recorded evidence.') + corpusLaunchBar() + corpusReleaseBar() +
    `<div class="coverage-bar"><strong>${state.candidates.filter(c=>candidateCapture(c).shot).length} / ${state.candidates.length} with linked screenshots</strong><span>Historical images do not establish current compatibility.</span><button data-corpus-filter="with-shot">With screenshots</button><button data-corpus-filter="no-shot">Missing screenshots</button></div>`+
    `<div class="toolbar corpus-search-bar"><input id="corpus-query" type="search" placeholder="Search games and apps by name, id or exe…" aria-label="Search the EXE corpus" value="${escape(corpusQuery)}" autocomplete="off"><select id="corpus-type" aria-label="Entry type">${[['all','Games and apps'],['games','Games only'],['apps','Apps and tools only']].map(([id,label])=>`<option value="${id}" ${corpusType===id?'selected':''}>${label} (${id==='all'?state.candidates.length:state.candidates.filter(c=>corpusKind(c)===id).length})</option>`).join('')}</select>${corpusQuery||corpusType!=='all'?'<button data-corpus-search-clear="1">Clear search</button>':''}</div>`+
    `<div class="toolbar"><select id="corpus-launch" aria-label="Launch availability"><option value="all" ${corpusLaunch==='all'?'selected':''}>All launch states</option><option value="available" ${corpusLaunch==='available'?'selected':''}>Launchable now</option></select><select id="corpus-release" aria-label="Release readiness">${[['all','All release states'],['unreleased','Unreleased games'],['gameplay-reviewed','Unreleased · gameplay reviewed'],...releaseStates.map(([id,label])=>[id,label])].map(([id,label])=>`<option value="${id}" ${corpusRelease===id?'selected':''}>${escape(label)}</option>`).join('')}</select><select id="corpus-category" aria-label="Category"><option value="all">All categories</option>${categories.map(g=>`<option value="${escape(g.id)}" ${corpusCategory===g.id?'selected':''}>${escape(g.label)} (${state.candidates.filter(c=>(c.category?.id || 'unclassified')===g.id).length})</option>`).join('')}</select><select id="corpus-group" aria-label="Source group"><option value="all">All source groups</option>${[...new Set(state.candidates.map(c=>c.sourceGroup).filter(Boolean))].sort().map(g=>`<option ${corpusGroup===g?'selected':''} value="${escape(g)}">${escape(g)}</option>`).join('')}</select><select id="filter" aria-label="Corpus status">${[['all', 'All candidates'], ['working', 'In progress'], ['with-shot', 'With screenshots'], ['no-run', 'No recorded run'], ['no-shot', 'Missing screenshots'], ['passed', 'Latest run passed'], ['failed', 'Latest run failed'], ['harness-error', 'Harness error']].map(([s, label]) => `<option value="${s}" ${s === filter ? 'selected' : ''}>${label}</option>`).join('')}</select><span class="sub">${candidates.length} candidates · ${state.candidates.filter(c => candidateWork(c)?.status === 'active').length} in progress</span></div><p class="sub">Includes manifest and registered apps. Unclassified entries need category review. Source group does not imply redistribution permission.</p>${categories.map(category => {
      const members = candidates.filter(c => (c.category?.id || 'unclassified') === category.id);
      if (!members.length) return '';
      return `<section class="corpus-category" data-category="${escape(category.id)}"><h2>${escape(category.label)} <span class="sub">(${members.length})</span></h2><div class="corpus-grid">${members.map(c => {
      const {shot,run:captureRun,older,gameplay} = candidateCapture(c);
      const work = candidateWork(c);
      return `<div class="candidate-shell"><button class="candidate ${shot?'':'candidate-no-capture'} ${work?.status === 'active' ? 'candidate-working' : ''}" data-candidate="${escape(c.id)}">${work ? `<div class="candidate-work">${badge(work.status === 'active' ? '▶ In progress' : taskState(work.status)[1], 'task-label task-label-' + work.status)}<span>${escape(work.title)}</span></div>` : ''}<div class="thumbnail">${shot ? `<img src="${escape(shot.url)}" alt="${older?'Earlier':'Latest'} capture for ${escape(c.name)}: ${escape(shot.name)}" loading="lazy">` : 'NO LINKED CAPTURE'}</div><div class="candidate-info">${corpusReleaseReview(c)}${corpusAssessment(c)}<div class="sub">${escape(c.sourceGroup || 'Source unclassified')}${c.localOnly?' · Local only':''}</div><h3>${escape(c.name || c.id)}</h3><div class="sub">${escape(c.version || c.id)}</div>${gameplay?badge('Reviewed gameplay scene','good'):''}${corpusFps(c)}<div class="candidate-bottom">${badge(c.latestRun ? 'Latest run: '+c.latestRun.outcome : 'No recorded run', ['failed','harness-error'].includes(c.latestRun?.outcome)?'bad':'')}<span class="sub">${c.taskIds.length} linked tasks</span></div>${c.latestRun?.route?`<div class="sub candidate-route" title="${escape(c.latestRun.route)}">${escape(c.latestRun.route)}</div>`:''}<div class="sub">Fixture ${escape(c.fixtureStatus)} · ${shot ? (older?'Earlier capture · '+when(captureRun.startedAt):captureRun.verification + ' capture') : 'screenshot missing'}</div></div></button>${corpusLaunchActions(c)}</div>`;
    }).join('')}</div></section>`;
    }).join('') || empty('No matching candidates.')}`;
}
let desktopSelection='all';
function desktopRowHtml(row) {
  const c=state.candidates.find(x=>x.id===row.id),[,label,color]=releaseState(c);
  const gateMark=g=>g.met?'✓':g.status==='blocked'?'✕':'?';
  const unmet=row.gates.filter(g=>!g.met);
  const rate=row.rate.known?`<strong>${escape(row.rate.text)}</strong> <span class="sub">${row.rate.reviewed?'reviewed run':'unreviewed run'}${row.rate.historical?' · historical':''} · ${escape(row.rate.qualification)}${row.rate.measuredAt?' · '+age(row.rate.measuredAt)+' ago':''}${row.rate.scene?' · '+escape(row.rate.scene):''}</span>`:`<strong>${escape(row.rate.text)}</strong>`;
  const shot=row.screenshot?`<button class="desktop-shot" data-run="${escape(row.screenshot.runKey)}" aria-label="Open reviewed gameplay evidence for ${escape(row.name)}"><img src="${escape(row.screenshot.url)}" alt="Reviewed gameplay: ${escape(row.name)} · ${escape(row.screenshot.name)}" loading="lazy"></button>`:'<div class="desktop-shot desktop-shot-missing">No reviewed gameplay screenshot</div>';
  return `<article class="desktop-row panel" data-desktop-row="${escape(row.id)}">${shot}<div class="desktop-body"><div class="desktop-head"><h3>${escape(row.name)}</h3>${badge(label,color)}<span class="desktop-gates" aria-label="Release gates">${row.gates.map(g=>`<span class="gate gate-${g.met?'met':g.status==='blocked'?'blocked':'unknown'}" title="${escape(g.name+': '+g.status+' — '+g.detail)}">${gateMark(g)} ${escape(g.name)}</span>`).join('')}</span></div>`+
    `<p class="desktop-line">${rate}</p><p class="desktop-line sub">${escape(row.input.text)} · ${escape(row.sound.text)} · Deploy not recorded${row.gameplayRun?` · Gameplay run ${escape(row.gameplayRun.build.text)} · <span class="build-${row.gameplayRun.servedMatch.status}">${escape(row.gameplayRun.servedMatch.text)}</span>`:''}</p>`+
    `${row.staleReasons.length?`<p class="desktop-line notice-line">Review not current: ${escape(row.staleReasons.join(' '))}</p>`:''}`+
    `<ul class="desktop-blockers">${row.blockers.map(b=>`<li class="blocker-item"><strong>Blocker:</strong> ${escape(b.summary)}${b.source?` <span class="sub">${escape(b.source)}</span>`:''}</li>`).join('')}${unmet.map(g=>`<li><strong>${escape(g.name)}</strong> ${escape(g.status.replaceAll('-',' '))}: ${escape(g.detail)}${g.source?` <span class="sub">${escape(g.source)}</span>`:''}</li>`).join('')}</ul>`+
    `${row.next?`<p class="desktop-line"><strong>Next:</strong> ${escape(row.next)}</p>`:''}<div class="desktop-actions">${corpusLaunchActions(c,false,true)}<button data-candidate="${escape(row.id)}">Details →</button></div></div></article>`;
}
function desktopView() {
  const q=ReleaseModel.desktopQueue(state,desktopSelection),rows=q.rows.filter(r=>matches(state.candidates.find(c=>c.id===r.id)));
  const choices=[['all','All unreleased'],['playable','Playable (reviewed gameplay + launchable)'],['gameplay','Reviewed gameplay'],['review-needed','Review needed'],['unblocked','No recorded blockers'],['ready','Ready']];
  const counts=[['playable',q.playable,'Playable unreleased','reviewed gameplay screenshot and a launch route available now'],['review-needed',q.reviewNeeded,'Review needed','release status review-needed: no blockers, gates still to review'],['ready',q.ready,'Ready','every gate passed in a current release review']];
  const stale=q.staleReviews.length?`<p class="notice stale-reviews" role="status"><strong>${q.staleReviews.length} recorded release review${q.staleReviews.length===1?' is':'s are'} stale and need${q.staleReviews.length===1?'s':''} refreshing</strong> (${q.staleReviews.map(r=>escape(r.name)).join(', ')}): ${escape([...new Set(q.staleReviews.flatMap(r=>r.reasons))].join(' '))} Until refreshed their gates count as not reviewed.</p>`:'';
  return title('Ready for desktop',`${q.unreleased} unreleased games. Sorted by fewest blockers and unmet gates.`)+
    `<div class="release-counts desktop-counts">${counts.map(([id,n,label,hint])=>`<button data-desktop-filter="${id}" aria-pressed="${desktopSelection===id}" title="${escape(hint)}"><strong>${n}</strong> ${escape(label)}</button>`).join('')}</div>`+stale+
    `<div class="toolbar"><select id="desktop-selection" aria-label="Desktop readiness filter">${choices.map(([id,l])=>`<option value="${id}" ${desktopSelection===id?'selected':''}>${l}</option>`).join('')}</select><span class="sub">${rows.length} shown · ${q.production.status==='verified'?'production snapshot checked '+escape(when(q.production.checkedAt)):'production membership unverified'} · ${q.unknownMembership} games with unknown membership are not listed</span></div>`+
    `<p class="source-note">From recorded release reviews, runs and launch routes only. Rates use their recorded metric label; nothing is inferred from block or present counts. Sound and deploy evidence are not recorded for any game and are shown as such; they are not gates here. ✓ passed · ✕ blocked · ? not reviewed. This view does not publish or deploy.</p>`+
    `<div class="desktop-list">${rows.map(desktopRowHtml).join('') || empty('No unreleased games match this filter.')}</div>`;
}
document.addEventListener('change',event=>{if(event.target.id==='desktop-selection'){desktopSelection=event.target.value;render();}});
document.addEventListener('click',event=>{const el=event.target.closest?.('[data-desktop-filter]');if(el&&state){desktopSelection=desktopSelection===el.dataset.desktopFilter?'all':el.dataset.desktopFilter;render();}});
function currentAgents() {
  const owners=new Set(state.tasks.filter(t=>['active','ready','blocked','review'].includes(t.status)).map(t=>t.owner));
  return state.agents.filter(a=>a.id===coordinator()?.agentId || owners.has(a.id) || a.provider!=='claude' && a.state!=='idle' && Date.now()-Date.parse(a.lastActivityAt)<15*60000).sort((a,b)=>agentSignal(a).rank-agentSignal(b).rank || Number(b.id===coordinator()?.agentId)-Number(a.id===coordinator()?.agentId));
}
function agentsView() {
  const current=topLevel(currentAgents()),ids=new Set(current.map(a=>a.id)),history=topLevel(state.agents).filter(a=>!ids.has(a.id) && matchesTree(a));
  return title('Agents', 'Decisions and sessions needing a check first. Recent activity is not proof of task progress.') + `<div class="agent-list">${current.filter(matchesTree).map(agentCard).join('') || empty('No current sessions observed.')}</div><details class="agent-history" ${agentHistoryOpen || query?'open':''}><summary>Other observed sessions (${history.length})</summary><div class="agent-list">${history.map(agentCard).join('')}</div></details>` + notice();
}
function activityView() {
  const rows=matchingActivity();
  const cs=state.codeState;
  return title('Activity', 'Recent Git commits and messageboard entries. Undated messages retain their board order.')+(cs?`<p class="source-note">Commit state: ${cs.available?escape(cs.note)+(cs.mainRef?' Merged means reachable from '+escape(cs.mainRef)+'.':' No remote default branch found.')+(cs.fetchedAt?' Last fetch '+escape(when(cs.fetchedAt))+'.':' Last fetch time unknown.'):escape(cs.note)}</p>`:'')+`${state.activityWarning?`<p class="notice" role="status">${escape(state.activityWarning)}</p>`:''}<div class="toolbar"><select id="activity-filter" aria-label="Activity type">${[['all','All activity'],['commit','Commits'],['message','Messages']].map(([id,label])=>`<option value="${id}" ${activityFilter===id?'selected':''}>${label}</option>`).join('')}</select><span class="sub">Showing ${Math.min(activityLimit,rows.length)} of ${rows.length} matching entries</span></div><div class="panel">${rows.length?feedRows(rows.slice(0,activityLimit)):empty(query?'No activity matches this search and filter.':activityFilter==='commit'?'No commits available.':activityFilter==='message'?'No messages available.':'No activity available.')}</div>${rows.length>activityLimit?'<div class="form-actions"><button data-more-activity="25">Show 25 more</button><button data-more-activity="all">Show all matching entries</button></div>':''}`;
}
function matchingActivity() { return (state.activity || []).filter(row=>matches(row) && (activityFilter==='all' || (row.type==='commit'?'commit':'message')===activityFilter)); }
// The 5s poll re-renders the whole view. Assigning innerHTML would rebuild
// every node, so screenshots reload (blink), the focused search box loses its
// caret and opened <details> collapse. Patch the live tree instead: nodes that
// did not change are left alone, and user-owned state (an open <details>, the
// value of the field being typed in) survives the refresh.
let lastMainHtml=null;
function morphHtml(target, html) {
  if (html === lastMainHtml && target.childNodes.length) return;
  lastMainHtml = html;
  const next = document.createElement(target.tagName); next.innerHTML = html;
  morphChildren(target, next);
}
function morphChildren(live, next) {
  const a = [...live.childNodes], b = [...next.childNodes];
  for (let i = 0; i < b.length; i++) {
    const have = a[i], want = b[i];
    if (!have) { live.appendChild(want); continue; }
    if (have.nodeType !== want.nodeType || have.nodeName !== want.nodeName) { live.replaceChild(want, have); continue; }
    if (have.nodeType !== 1) { if (have.nodeValue !== want.nodeValue) have.nodeValue = want.nodeValue; continue; }
    morphAttributes(have, want);
    morphChildren(have, want);
  }
  for (let i = b.length; i < a.length; i++) a[i].remove();
}
function morphAttributes(have, want) {
  for (const {name, value} of [...want.attributes]) if (have.getAttribute(name) !== value) have.setAttribute(name, value);
  for (const {name} of [...have.attributes]) {
    if (want.hasAttribute(name)) continue;
    if (name === 'open' && have.tagName === 'DETAILS') continue;
    have.removeAttribute(name);
  }
  if ((have.tagName === 'INPUT' || have.tagName === 'TEXTAREA') && have !== document.activeElement && have.value !== (want.getAttribute('value') ?? '')) have.value = want.getAttribute('value') ?? '';
  if (have.tagName === 'SELECT') { const sel = want.querySelector('option[selected]'); if (sel && have.value !== sel.value && have !== document.activeElement) have.value = sel.value; }
}
function render() {
  if (!state) return;
  renderApprovals();
  renderChrome();
  $('#task-count').textContent = state.tasks.filter(t=>!['done','deferred','unknown'].includes(t.status)).length; $('#task-count').title='Open tasks; completed, deferred and historical records excluded'; $('#corpus-count').textContent = state.candidates.length; $('#dos-count').textContent = state.dosCorpus?.rows?.length || '';
  const blockerCounts = BlockerModel.countSummary(state);
  $('#blocker-count').textContent = blockerCounts.rawBlockedRows ? `${blockerCounts.distinctBlockedTaskIds} distinct IDs${blockerCounts.anonymousBlockedRows ? ` + ${blockerCounts.anonymousBlockedRows} anonymous rows` : ''}` : '';
  $('#blocker-count').title = BlockerModel.countSummaryText(blockerCounts);
  $('#updated').textContent = `Snapshot ${new Date(state.generatedAt).toLocaleTimeString()} · refresh every 5s`;
  const views = { home: homeView, games: gamesView, tasks: tasksBoard, agents: agentsGrouped, activity: activityView, more: moreView, overview, tasklist: tasksView, agentlist: agentsView, blockers: blockersView, corpus: corpusView, dos: dosView, release: desktopView, analytics: analyticsView };
  const classic = ['overview', 'tasklist', 'agentlist', 'blockers', 'corpus', 'dos', 'release', 'analytics'].includes(view);
  morphHtml($('#main'), (classic ? stoppedAgentBanner() : '') + (views[view] || homeView)());
  document.body.dataset.view = views[view] ? view : 'home';
}
function show(label, html) { currentTaskId=null;$('#detail-label').textContent = label; $('#detail-body').innerHTML = html; if (!$('#detail').open) $('#detail').showModal(); }
function runRows(runs) { return runs.map(r => `<div class="run"><div class="run-head"><button data-run="${escape(r.key)}">${escape(r.id)} · ${escape(r.route || 'route unspecified')}</button>${badge(r.outcome, tone(r.outcome))}</div><div class="sub">${escape(when(r.startedAt))} · ${escape(r.verification)} · ${escape(r.source)}</div></div>`).join('') || empty('No run folders recorded yet. See ops/README.md.'); }
function candidateDetail(id) {
  const c = state.candidates.find(c => c.id === id); if (!c) return;
  show('EXE CORPUS / ' + c.id, candidateDetailHtml(c));
}
function candidateDetailHtml(c) {
  const id = c.id;
  const {shot,run:captureRun,older,gameplay} = candidateCapture(c);
  return (`<h1>${escape(c.name)}</h1><p class="sub">${escape(c.version)} · Fixture ${escape(c.fixtureStatus)}${c.localOnly ? ' · Local only' : ''}</p>${badge(c.category?.label || 'Unclassified')}<p class="sub">${escape(c.category?.basis)}</p>${corpusLaunchActions(c,true)}${corpusReleaseReview(c,true)}${corpusAssessment(c,true)}${gameplay?badge('Reviewed gameplay scene','good'):''}${corpusFps(c,true)}${perfComparisonHtml(c)}<div class="detail-grid"><div>${shot ? `<img class="detail-shot" src="${escape(shot.url)}" alt="${older?'Earlier run':'Latest run'} capture"><p class="sub">${older?'Earlier capture; latest attempt: '+escape(c.latestRun?.outcome || 'unknown'):'Latest attempt'} · ${escape(captureRun.verification)} · ${escape(when(captureRun.startedAt))}</p>` : empty('No screenshot for the latest attempt.')}<p class="sub">Last reviewed success: ${c.lastVerifiedRun ? escape(c.lastVerifiedRun.id + ' · ' + c.lastVerifiedRun.route) : 'none recorded'}</p></div><div><h3>Linked TODOs</h3><div class="panel">${taskRows(state.tasks.filter(t => c.taskIds.includes(t.id)))}</div><div class="links">${c.noteLinks.map(n => link(n.url, 'Investigation notes')).join('')}${c.sourcePage ? link(c.sourcePage, 'Source page') : ''}</div></div></div><p>${escape(c.notes)}</p><pre>${escape(c.executables.join('\n'))}</pre>${section('Run history')}<div class="panel">${runRows(state.runs.filter(r => r.candidateId === id || c.appIds?.includes(r.candidateId)))}</div>`);
}
function agentDetail(id) {
  const a = state.agents.find(a => a.id === id); if (!a) return;
  const fields = [['Session', a.id], ['Model', a.model || 'unknown'], ['Worktree', a.cwd], ['Assigned task', a.taskId || 'unknown — no explicit owner match'], ['On task', age(a.taskStartedAt)], ['Current turn started', when(a.turnStartedAt)], ['Latest activity', when(a.lastActivityAt)], ['Last progress', when(a.progressAt)], ['Observed state', a.state], ['Process health', 'unknown — no process attachment'], ['Last operation', a.lastEvent], ['Last-request input', num(a.inputTokens)], ['Last-request output', num(a.outputTokens)], ['Cache read', num(a.cacheReadTokens)], ['Cache write', num(a.cacheWriteTokens)], ['Reported context limit', num(a.contextLimit)], ['Session total tokens', num(a.totalTokens)], ['Usage observed', when(a.usageAt)], ['Compactions observed', a.compactions + (a.partial ? ' in sampled log windows' : '')], ['Log coverage', a.partial ? 'head + tail only; history may be incomplete' : 'complete file']];
  fields.find(f => f[0] === 'Process health')[1] = 'unknown — PID presence does not establish responsiveness';
  if(a.provider==='claude' && !a.parentAgentId)fields.unshift(['Goal', a.goal ? (a.goal.met ? 'met (no longer driving): ' : 'active: ') + a.goal.condition : 'none recorded — stops when its turn ends']);
  fields.push(['Latest result', a.summary || 'not recorded'], ['Parent session', a.parentAgentId || 'none'], ['Context estimate', num(a.contextEstimate)], ['Cache reuse', a.cachePercent === null ? 'unknown' : Math.round(a.cachePercent) + '%']);
  show('AGENT / ' + a.provider.toUpperCase(), `<h1>${escape(a.taskTitle || a.title)}</h1>${processDetails(a.process)}${subagentSummary(a)}${visualCards(agentRuns(a))}<dl>${fields.map(([k, v]) => `<dt>${escape(k)}</dt><dd>${escape(v)}</dd>`).join('')}</dl><p class="source-note">Input tokens estimate the last request’s context, not current live occupancy. Cache reuse is cache-read / total request input. A quiet session may be waiting, stopped, or running a long tool; it is not automatically stuck.</p>`);
}
let activeRefresh=null;
function refresh() {
  if(activeRefresh)return activeRefresh;
  activeRefresh=fetchState().finally(()=>{activeRefresh=null;});return activeRefresh;
}
async function refreshAfterWrite(){if(activeRefresh)await activeRefresh;await refresh();}
async function fetchState() {
  try {
    const response = await fetch('/api/state'); if (!response.ok) throw new Error(`HTTP ${response.status}`);
    state = await response.json(); $('#connection').textContent = '● Connected'; $('#connection').classList.remove('error'); render();refreshTaskDetail();
  } catch (e) {
    $('#connection').textContent = '● Disconnected'; $('#connection').classList.add('error');
    if (!state) $('#main').innerHTML = empty(`Could not read project data: ${e.message}. Start node ops/server.js.`);
  }
}
document.addEventListener('change',event=>{if(event.target.id==='activity-filter'){activityFilter=event.target.value;activityLimit=25;render();}});
document.addEventListener('change',event=>{if(event.target.id==='corpus-group'){corpusGroup=event.target.value;render();}});
document.addEventListener('change',event=>{if(event.target.id==='corpus-launch'){corpusLaunch=event.target.value;render();}});
document.addEventListener('change',event=>{if(event.target.id==='corpus-release'){corpusRelease=event.target.value;render();}});
document.addEventListener('change',event=>{if(event.target.id==='corpus-category'){corpusCategory=event.target.value;render();}});
document.addEventListener('change',event=>{if(event.target.id==='corpus-type'){corpusType=event.target.value;render();}});
document.addEventListener('input',event=>{
  if(event.target.id!=='corpus-query')return;
  const caret=event.target.selectionStart;corpusQuery=event.target.value;render();
  const field=document.getElementById('corpus-query');if(field){field.focus();field.setSelectionRange(caret,caret);}
});
document.addEventListener('click',event=>{if(event.target.closest?.('[data-corpus-search-clear]')){corpusQuery='';corpusType='all';render();}});
document.addEventListener('click', event => {
  const el = event.target.closest('button'); if (!el || !state) return;
  if(el.dataset.launchFilter){corpusLaunch=el.dataset.launchFilter;render();}
  if(el.dataset.releaseFilter){corpusRelease=el.dataset.releaseFilter;corpusCategory='all';corpusGroup='all';filter='all';query='';$('#search').value='';render();}
  if(el.dataset.corpusFilter){filter=el.dataset.corpusFilter;render();}
  if(el.dataset.moreActivity){activityLimit=el.dataset.moreActivity==='all'?matchingActivity().length:activityLimit+Number(el.dataset.moreActivity);render();}
  if (el.dataset.terminal) { const entry=state.terminals?.find(t=>t.id===el.dataset.terminal);if(entry?.available)window.OpsTerminal.open(entry); }
  if (el.dataset.statusSummary) show('PROJECT / TLDR',statusSummary());
  if (el.dataset.taskFilter) { filter = filter === el.dataset.taskFilter ? 'all' : el.dataset.taskFilter; render(); }
  if (el.dataset.task) taskDetail(el.dataset.task);
  if (el.dataset.candidate) candidateDetail(el.dataset.candidate);
  if (el.dataset.agent) agentDetail(el.dataset.agent);
  if (el.dataset.blocker) blockerDetail(el.dataset.blocker);
  if (el.dataset.run) { const r = state.runs.find(r => r.key === el.dataset.run); if (r) show('RUN / ' + r.id, `<h1>${escape(r.route || r.id)}</h1><p>${badge(r.outcome, tone(r.outcome))} ${escape(r.summary)}</p><dl><dt>Started</dt><dd>${escape(when(r.startedAt))}</dd><dt>Finished</dt><dd>${escape(when(r.finishedAt))}</dd><dt>Review</dt><dd>${escape(r.verification)}</dd><dt>Build</dt><dd>${escape(r.build)}</dd><dt>Environment</dt><dd>${escape(r.environment)}</dd></dl><pre>${escape(r.command)}</pre><div class="links">${r.artifacts.map(a => link(a.url, a.name)).join('')}</div>${(r.visuals || r.screenshots).map(a => `<figure class="run-visual"><img class="detail-shot" src="${escape(a.url)}" alt="${escape(a.name)}"><figcaption class="sub">${escape(a.kind || 'screenshot')} · ${escape(a.name)}</figcaption></figure>`).join('')}`); }
  if (el.id === 'todo-source') show('TODOS.md', `<pre>${escape(state.todoText)}</pre>`);
});
$('#close-detail').onclick = () => $('#detail').close();
document.addEventListener('toggle', event => {
  if(event.target.matches?.('.agent-history') && event.target.isConnected && !query)agentHistoryOpen=event.target.open;
  if(event.target.matches?.('.queue-briefing') && event.target.isConnected)queueBriefingOpen=event.target.open;
  if (event.target.matches?.('details[data-task-group]') && !query && filter === 'all') expandedTaskGroups.set(event.target.dataset.taskGroup, event.target.open);
}, true);
document.addEventListener('submit', async event => {
  if (event.target.id !== 'blocker-reply') return;
  event.preventDefault();
  const form = event.target, button = form.querySelector('button'), status = form.querySelector('#reply-status');
  if (button.disabled) return;
  button.disabled = true; status.textContent = 'Posting…';
  try {
    const response = await fetch('/api/blocker-reply', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({taskId: form.dataset.taskId, message: form.querySelector('textarea').value}) });
    if (!response.ok) throw new Error(await response.text());
    status.textContent = 'Posted. Awaiting owner verification; task remains blocked.';
    form.querySelector('textarea').disabled = true;
    await refresh();
  } catch (e) { status.textContent = `Could not confirm posting: ${e.message}. Check Activity before retrying.`; button.disabled = false; }
});
$('#refresh').onclick = refresh;
$('#search').addEventListener('input', e => { query = e.target.value.toLowerCase(); activityLimit=25; render(); });
document.addEventListener('change', e => { if (e.target.id === 'filter') { filter = e.target.value; render(); } });
window.addEventListener('hashchange', () => { view = location.hash.slice(1) || 'home'; window.scrollTo(0, 0); filter = 'all'; query = ''; $('#search').value = ''; render(); });
paintIcons();
refresh();
setInterval(refresh, 5000);
