'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { createProcessObserver } = require('./processes');
const { classifyCandidate } = require('./corpus-categories');
const { inventory } = require('./corpus-inventory');
const { getCatalog, getBuildIdentity, launchFor } = require('./emulator-server');
const { loadReleaseReview, deriveReleaseReadiness } = require('./release-readiness');
const { createActivityReader, boardEntry, linkCommits } = require('./activity');
const { buildDosCorpus } = require('./dos-corpus');

const MB = 1024 * 1024;
// V8 slices can retain their entire transcript-sized parent. Copy only the
// clipped UTF-16 code units, preserving even unmatched surrogates verbatim.
const clip = (value, n = 220) => typeof value === 'string'
  ? Buffer.from(value.replace(/\s+/g, ' ').slice(0, n), 'utf16le').toString('utf16le') : '';
const number = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
const date = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null;
const inside = (root, file) => file === root || file.startsWith(root + path.sep);

function normalizePerformance(p) {
  if(!p || !['guest-presents','guest-logical-frame-submissions','selected-window-presentations'].includes(p.metric) || !date(p.measuredAt) || !clip(p.renderer) || !clip(p.scene) || !clip(p.host) || !Array.isArray(p.samples) || !p.samples.length || p.samples.length>100)return null;
  const logical=p.metric==='guest-logical-frame-submissions', windowPresentations=p.metric==='selected-window-presentations';
  if(windowPresentations){
    const v=p.visibility, r=v?.client;
    if(p.physicalFps!==null || !r || ![r.x,r.y,r.w,r.h].every(Number.isFinite) || r.w<=0 || r.h<=0 || !Number.isFinite(v.fraction) || v.fraction<=0 || v.fraction>1)return null;
  }
  if(logical || windowPresentations ? p.counterKind!==p.metric || p.qualification?.accepted!==true || !clip(p.qualification.sceneReview) || !clip(p.qualification.counterReview) || !clip(p.qualification.evidence) : p.counterKind!==undefined && p.counterKind!=='guest-flip-events')return null;
  if(p.samples.some(s=>!Number.isInteger(s.frames) || s.frames<0 || number(s.durationMs)===null || s.durationMs<=0))return null;
  const samples=p.samples.map(s=>({frames:s.frames,durationMs:s.durationMs,fps:s.frames*1000/s.durationMs,p95FrameMs:number(s.p95FrameMs)}));
  const fps=samples.reduce((n,s)=>n+s.frames,0)*1000/samples.reduce((n,s)=>n+s.durationMs,0);
  if(!Number.isFinite(fps))return null;
  return {fps,samples,metric:p.metric,counterKind:p.counterKind,physicalFps:windowPresentations?null:undefined,visibility:windowPresentations?{client:{...p.visibility.client},fraction:p.visibility.fraction}:undefined,qualification:logical || windowPresentations?{accepted:true,sceneReview:clip(p.qualification.sceneReview),counterReview:clip(p.qualification.counterReview),evidence:clip(p.qualification.evidence)}:undefined,measuredAt:date(p.measuredAt),renderer:clip(p.renderer),scene:clip(p.scene),host:clip(p.host),gpu:clip(p.gpu),wasmSha256:clip(p.wasmSha256),historical:p.historical===true,notes:clip(p.notes,2000)};
}

async function safeFile(root, relative) {
  if (typeof relative !== 'string' || path.isAbsolute(relative) || relative.includes('\0')) return null;
  try {
    const base = await fs.realpath(root);
    const target = await fs.realpath(path.resolve(base, relative));
    return inside(base, target) && (await fs.stat(target)).isFile() ? target : null;
  } catch { return null; }
}

async function readText(file, limit = 2 * MB) {
  const h = await fs.open(file, 'r');
  try {
    const stat = await h.stat();
    if (stat.size > limit) throw new Error(`file exceeds ${limit / MB} MiB read limit`);
    // Reading to EOF after stat can allocate without limit when a writer keeps
    // appending. Pin this read to the bounded size we actually checked.
    const buffer = Buffer.alloc(stat.size);
    let offset = 0;
    while (offset < buffer.length) {
      const { bytesRead } = await h.read(buffer, offset, buffer.length - offset, offset);
      if (!bytesRead) break;
      offset += bytesRead;
    }
    return buffer.subarray(0, offset).toString('utf8');
  } finally { await h.close(); }
}

async function windowText(file, start, length) {
  const h = await fs.open(file, 'r');
  try {
    const buffer = Buffer.alloc(length);
    const { bytesRead } = await h.read(buffer, 0, length, start);
    return buffer.subarray(0, bytesRead).toString('utf8');
  } finally { await h.close(); }
}

// A Claude /goal record: undefined when the record says nothing about the goal,
// null when it clears it, otherwise {condition, met, at}.
function goalOf(e, time) {
  if (e.type === 'attachment' && e.attachment?.type === 'goal_status' && typeof e.attachment.condition === 'string')
    return { condition: clip(e.attachment.condition, 1000), met: e.attachment.met === true, at: time };
  if (e.type === 'user' && typeof e.message?.content === 'string') {
    const out = (/<local-command-stdout>([\s\S]*?)<\/local-command-stdout>/.exec(e.message.content)?.[1] || '').trim();
    const set = /^Goal set: ([\s\S]+)/.exec(out);
    if (set) return { condition: clip(set[1], 1000), met: false, at: time };
    if (/^Goal (?:cleared|removed)/i.test(out)) return null;
  }
  return undefined;
}

// Screenshot-heavy Claude logs push a whole 1 MiB tail window past the last goal
// record, so look for one backwards from `end` down to `stop`, matching only the
// lines that can carry it. Returns undefined when the range holds none.
async function scanGoal(file, end, stop) {
  const h = await fs.open(file, 'r');
  try {
    let carry = Buffer.alloc(0);
    while (end > stop) {
      const start = Math.max(stop, end - MB), buffer = Buffer.alloc(end - start);
      await h.read(buffer, 0, buffer.length, start);
      // Join record bytes before decoding: a byte window can split UTF-8.
      const bytes = carry.length ? Buffer.concat([buffer, carry]) : buffer;
      const first = start > 0 ? bytes.indexOf(10) : -1;
      carry = first >= 0 ? Buffer.from(bytes.subarray(0, first)) : Buffer.alloc(0);
      const text = bytes.subarray(first >= 0 ? first + 1 : 0).toString('utf8');
      const lines = text.split('\n');
      for (let i = lines.length - 1; i >= 0; i--) {
        if (!lines[i].includes('"goal_status"') && !/Goal (?:set: |cleared|removed)/i.test(lines[i])) continue;
        try { const e = JSON.parse(lines[i]); const goal = goalOf(e, date(e.timestamp)); if (goal !== undefined) return goal; } catch { /* partial line */ }
      }
      // Preserve the existing UTF-16 length limit, with a cheap byte precheck.
      if (carry.length > 16 * MB && carry.toString('utf8').length > 16 * MB) carry = Buffer.alloc(0);
      end = start;
    }
    return undefined;
  } finally { await h.close(); }
}

// Session logs can exceed 100 MiB. Read complete records from bounded windows;
// never copy the transcript or serve tool arguments/reasoning to the browser.
async function logWindows(file, size) {
  const budget = 1280 * 1024;
  let chunks;
  if (size <= budget) chunks = [await windowText(file, 0, size)];
  else {
    const head = await windowText(file, 0, 256 * 1024);
    const tail = await windowText(file, size - MB, MB);
    chunks = [head.slice(0, head.lastIndexOf('\n')), '{"type":"ops_window_boundary"}\n' + tail.slice(tail.indexOf('\n') + 1)];
  }
  const records = [];
  for (const chunk of chunks) for (const line of chunk.split('\n')) {
    try { const record = JSON.parse(line); if (record && typeof record === 'object') records.push(record); } catch { /* partial line or unsupported record */ }
  }
  return { records, partial: size > budget };
}

function parseTasks(text, candidates = []) {
  const lines = text.split(/\r?\n/);
  const tasks = [];
  let section = 'TODOs', fenced = false;
  const metadata = (body, key) => body.match(new RegExp(`^[ \\t]*${key}:[ \\t]*([^\\s|]+)`, 'im'))?.[1] || null;
  const field = (body, key,limit=1000) => clip(body.match(new RegExp(`^[ \\t]*${key}:[ \\t]*(.+)$`, 'im'))?.[1], limit);
  function add(title, body, line, status, kind, endLine) {
    // Examples in fenced blocks are prose, never task metadata.
    let inFence=false;
    const meta=body.split('\n').filter(line=>{if(/^\s*(```|~~~)/.test(line)){inFence=!inFence;return false;}return !inFence;}).join('\n');
    const explicit = metadata(meta, 'status');
    const candidateIds = candidates.filter(c => new RegExp(`(^|[^a-zA-Z0-9_-])${c.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^a-zA-Z0-9_-])`).test(body)).map(c => c.id);
    tasks.push({ id: metadata(meta, 'id') || `todo-${line}`, title: clip(title, 250), body: body.slice(0, 24000), line, endLine,
      // A duplicate is retained for provenance, not queued by its stale checkbox
      // or counted as completed work (including dependency satisfaction).
      section, kind, status: ['backlog', 'ready', 'active', 'blocked', 'review', 'deferred', 'done', 'duplicate'].includes(explicit) ? explicit : status,
      next: field(meta, 'next',2000), done: field(meta,'done',2000), notes:field(meta,'notes',4000), evidence:field(meta,'evidence',4000),
      explicitCandidates:field(meta,'candidate',4000).split(/[,\s]+/).filter(Boolean),
      dependencies:field(meta,'depends-on',4000).split(/[,\s]+/).filter(Boolean),
      createdAt:date(metadata(meta,'created')), createdBy:metadata(meta,'created-by'),
      acceptedAt:date(metadata(meta,'accepted')), acceptedBy:metadata(meta,'accepted-by'),lastRequest:metadata(meta,'last-request'),
      owner: metadata(meta, 'owner'), startedAt: date(metadata(meta, 'started')), progressAt: date(metadata(meta, 'progress')),
      blocker: field(meta, 'blocker'), needs: field(meta, 'needs'), waitingOn: field(meta, 'waiting-on'), blockedAt: date(metadata(meta, 'blocked-since')),
      replyAllowed: !inFence && /^[\w.-]{1,100}$/.test(metadata(meta, 'id') || '') && (meta.match(/^[ \t]*id:/gim) || []).length===1,
      candidateIds, source: 'TODOS.md' });
  }
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*(```|~~~)/.test(line)) { fenced = !fenced; continue; }
    if (fenced) continue;
    if (/^## /.test(line)) {
      section = line.slice(3).trim();
      let end = i + 1;
      while (end < lines.length && !/^## /.test(lines[end])) end++;
      const body = lines.slice(i, end).join('\n');
      // Legacy prose remains visible without guessing its current status.
      if (!/^\s*[-*] \[[ xX~!]\]/m.test(body)) add(section, body, i + 1, 'unknown', 'legacy section',end+1);
    }
    const match = line.match(/^\s*[-*] \[([ xX~!])\]\s+(.+)/);
    if (match) {
      let end = i + 1,insideFence=false;
      while(end<lines.length){
        if(/^\s*(```|~~~)/.test(lines[end]))insideFence=!insideFence;
        else if(!insideFence && /^\s*(?:[-*] \[|#{1,6} )/.test(lines[end]))break;
        end++;
      }
      const body = lines.slice(i, end).join('\n');
      add(match[2], body, i + 1, ({ x: 'done', '~': 'active', '!': 'blocked', ' ': 'ready' })[match[1].toLowerCase()], 'checkbox',end+1);
    }
  }
  for(const task of tasks){task.editable=task.kind==='checkbox' && task.replyAllowed && tasks.filter(t=>t.id===task.id).length===1;task.replyAllowed=task.editable;}
  return tasks;
}

function parseSession(provider, records, file, partial, root) {
  const session = { id: `${provider}:${path.basename(file, '.jsonl')}`, provider, title: '', model: null,
    cwd: null, startedAt: null, turnStartedAt: null, lastActivityAt: null, lastEvent: 'Unknown', state: 'unknown',
    inputTokens: null, outputTokens: null, cacheReadTokens: null, cacheWriteTokens: null, contextLimit: null,
    totalTokens: null, usageAt: null, compactions: 0, partial, progressAt: null, taskId: null };
  session.parentAgentId = provider === 'claude' && path.basename(path.dirname(file)) === 'subagents'
    ? `claude:${path.basename(path.dirname(path.dirname(file)))}` : null;
  session.summary = null;
  // Claude Code /goal: the latest condition and whether its Stop hook judged it met.
  session.goal = null;
  let projectMatch = false;
  let usageAtCompaction = false;
  let hasSessionMeta = false;
  for (const e of records) {
    if (e.type === 'ops_window_boundary') {
      session.turnStartedAt = null;
      session.state = 'unknown';
      session.lastActivityAt = null;
      session.lastEvent = 'Unknown';
      continue;
    }
    const p = e.payload || {};
    const time = date(e.timestamp);
    const cwd = e.cwd || p.cwd;
    if (typeof cwd === 'string' && inside(root, path.resolve(cwd))) { projectMatch = true; session.cwd = cwd; }
    if (!session.startedAt && time) session.startedAt = time;
    if (provider === 'codex') {
      if (e.type === 'session_meta' && !hasSessionMeta) {
        hasSessionMeta=true;
        session.id = `codex:${p.id || p.session_id || path.basename(file, '.jsonl')}`;
        session.startedAt = date(p.timestamp) || time;
        session.contextLimit = number(p.context_window);
        const parent = p.source?.subagent?.thread_spawn?.parent_thread_id;
        if (typeof parent === 'string' && parent) session.parentAgentId = `codex:${parent}`;
      }
      if (e.type === 'turn_context') session.model = clip(p.model) || session.model;
      if (e.type === 'event_msg') {
        if (p.type === 'task_started') { session.turnStartedAt = date(p.started_at) || time; session.state = 'working'; session.lastEvent = 'Turn started'; }
        if (p.type === 'task_complete') { session.state = 'idle'; session.lastEvent = 'Turn completed'; }
        if (p.type === 'turn_aborted') { session.state = 'idle'; session.lastEvent = 'Turn interrupted'; }
        if (p.type === 'user_message') session.title = clip(p.message, 160) || session.title;
        if (p.type === 'token_count' && p.info) {
          const u = p.info.last_token_usage || {};
          session.inputTokens = number(u.input_tokens); session.outputTokens = number(u.output_tokens);
          session.cacheReadTokens = number(u.cached_input_tokens); session.cacheWriteTokens = number(u.cache_write_input_tokens);
          session.contextLimit = number(p.info.model_context_window) ?? session.contextLimit;
          session.totalTokens = number(p.info.total_token_usage?.total_tokens); session.usageAt = time; usageAtCompaction = false;
        }
      }
      if (e.type === 'response_item') {
        if (p.type === 'message' && p.role === 'assistant') {
          const summary = Array.isArray(p.content) && p.content.filter(c => c.type === 'output_text').map(c => c.text || '').join(' ');
          if (summary) session.summary = clip(summary, 240);
        }
        if (p.type === 'message' && p.role === 'user' && Array.isArray(p.content)) {
          const message = p.content.filter(c => ['input_text', 'text'].includes(c.type)).map(c => c.text || '').join('\n').trim();
          if (message && !/^(?:<|# AGENTS\.md|# .*instructions)/i.test(message)) session.title = clip(message, 160);
        }
        if (['function_call', 'custom_tool_call'].includes(p.type)) { session.lastEvent = `Tool: ${clip(p.name, 70)}`; session.state = 'tool'; }
        if (['function_call_output', 'custom_tool_call_output'].includes(p.type)) { session.lastEvent = 'Tool returned'; session.state = 'working'; }
        if (p.type === 'message' && p.role === 'assistant') session.lastEvent = 'Assistant message';
      }
      if (e.type === 'compacted') { session.compactions++; usageAtCompaction = true; session.lastEvent = 'Context compacted'; }
      if (time && ['event_msg', 'response_item', 'compacted'].includes(e.type)) session.lastActivityAt = time;
    } else {
      // Child log filenames distinguish agents which share the parent sessionId.
      if (e.sessionId && !file.includes(`${path.sep}subagents${path.sep}`)) session.id = `claude:${e.sessionId}`;
      if (e.type === 'ai-title') session.title = clip(e.aiTitle, 160);
      if (e.type === 'system' && e.subtype === 'compact_boundary') { session.compactions++; usageAtCompaction = true; }
      const goal = goalOf(e, time);
      if (goal !== undefined) session.goal = goal;
      if (e.type === 'user') {
        const content = e.message?.content;
        const isTool = Array.isArray(content) && content.some(c => c.type === 'tool_result');
        session.lastEvent = isTool ? 'Tool returned' : 'User message'; session.state = 'working';
        if (!isTool) { session.turnStartedAt = time; if (!session.title) session.title = clip(typeof content === 'string' ? content : content?.find(c => c.type === 'text')?.text, 160); }
      }
      if (e.type === 'assistant') {
        const m = e.message || {}, u = m.usage;
        const summary = Array.isArray(m.content) && m.content.filter(c => c.type === 'text').map(c => c.text || '').join(' ');
        if (summary) session.summary = clip(summary, 240);
        session.model = clip(m.model) || session.model;
        const tool = Array.isArray(m.content) && m.content.find(c => c.type === 'tool_use');
        session.lastEvent = tool ? `Tool: ${clip(tool.name, 70)}` : 'Assistant message';
        session.state = tool ? 'tool' : m.stop_reason === 'end_turn' ? 'idle' : 'working';
        if (u) {
          // Claude's input_tokens excludes cache read/creation; Codex includes them.
          const pieces = [u.input_tokens, u.cache_read_input_tokens, u.cache_creation_input_tokens].map(number);
          session.inputTokens = pieces.every(n => n !== null) ? pieces.reduce((a, b) => a + b, 0) : null;
          session.cacheReadTokens = number(u.cache_read_input_tokens); session.cacheWriteTokens = number(u.cache_creation_input_tokens);
          session.outputTokens = number(u.output_tokens); session.usageAt = time; usageAtCompaction = false;
        }
      }
      if (time && ['user', 'assistant', 'progress', 'system'].includes(e.type)) session.lastActivityAt = time;
    }
  }
  if (!projectMatch) return null;
  session.title ||= session.id;
  session.contextEstimate = usageAtCompaction ? null : session.inputTokens;
  session.cachePercent = session.inputTokens > 0 && session.cacheReadTokens !== null && session.cacheReadTokens <= session.inputTokens
    ? 100 * session.cacheReadTokens / session.inputTokens : null;
  return session;
}

async function walkLogs(root, warnings, maxFiles = 10000) {
  const files = [];
  async function walk(dir, depth) {
    if (depth > 5 || files.length >= maxFiles) return;
    let entries;
    try { entries = await fs.readdir(dir, { withFileTypes: true }); }
    catch (e) { if (e.code !== 'ENOENT') warnings.push(`Session directory unavailable: ${e.code}`); return; }
    for (const entry of entries) {
      if (files.length >= maxFiles) break;
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(file, depth + 1);
      else if (entry.isFile() && entry.name.endsWith('.jsonl')) {
        try { const stat = await fs.stat(file); files.push({ file, size: stat.size, mtimeMs: stat.mtimeMs }); } catch { /* rotated */ }
      }
    }
  }
  await walk(root, 0);
  if (files.length >= maxFiles) warnings.push('Session discovery reached the 10,000-file limit.');
  return files.sort((a, b) => b.mtimeMs - a.mtimeMs);
}

function createReader(options = {}) {
  const root = path.resolve(options.root || path.join(__dirname, '..'));
  // The private emulator may serve a different checkout than the one the dashboard
  // reads TODOS/runs from, e.g. a clean main worktree beside a shared working tree.
  const emulatorRoot = path.resolve(options.emulatorRoot || process.env.WINE_EMULATOR_ROOT || root);
  // Inventory can follow current source while a deliberately pinned emulator
  // continues serving an older build. Never use this root for launch checks.
  const inventoryRoot = path.resolve(options.inventoryRoot || process.env.WINE_INVENTORY_ROOT || root);
  const readActivity = createActivityReader(root);
  const codexRoot = options.codexRoot === false ? null : options.codexRoot || path.join(os.homedir(), '.codex', 'sessions');
  const claudeRoot = options.claudeRoot === false ? null : options.claudeRoot || path.join(os.homedir(), '.claude', 'projects', root.replace(/[^a-zA-Z0-9-]/g, '-'));
  const sessionCache = new Map();
  const observeProcesses = createProcessObserver(options);
  const assets = new Map();
  let discovery = null, discoveredAt = 0, discoveryWarnings = [];
  let boardStamp='',taskMessages=new Map();
  async function sessions(warnings) {
    if (!discovery || Date.now() - discoveredAt > 30000) {
      discovery = [];
      discoveryWarnings = [];
      for (const [provider, dir] of [['codex', codexRoot], ['claude', claudeRoot]]) {
        if (!dir) continue;
        const found = await walkLogs(dir, discoveryWarnings);
        if (!found.length) discoveryWarnings.push(`${provider}: no local session logs found.`);
        discovery.push(...found.slice(0, 100).map(f => ({ ...f, provider })));
        if (found.length > 100) discoveryWarnings.push(`${provider}: observing the 100 most recently modified log files.`);
      }
      discoveredAt = Date.now();
      const keep = new Set(discovery.map(d => d.file));
      for (const file of sessionCache.keys()) if (!keep.has(file)) sessionCache.delete(file);
    }
    warnings.push(...discoveryWarnings);
    const result = [];
    for (const entry of discovery) {
      try {
        const stat = await fs.stat(entry.file);
        const identity = `${stat.dev}:${stat.ino}:${stat.birthtimeMs}`;
        const key = `${identity}:${stat.size}:${stat.mtimeMs}:${stat.ctimeMs}`;
        let cached = sessionCache.get(entry.file);
        if (!cached || cached.key !== key) {
          // A replacement or truncation is a new history, not an append. In
          // particular, never inherit the former file's goal after rotation.
          if (cached && (cached.identity !== identity || stat.size <= cached.goalSize)) cached = null;
          const { records, partial } = await logWindows(entry.file, stat.size);
          const session = parseSession(entry.provider, records, entry.file, partial, root);
          // In a windowed log the newest goal record may sit in the unread middle:
          // scan back over what was appended since the last look (64 MiB on first
          // sight), else keep the goal already known, else the windows' answer.
          if (session && entry.provider === 'claude' && partial) {
            const before = cached?.goalSize ?? Math.max(0, stat.size - 64 * MB);
            const found = await scanGoal(entry.file, stat.size, Math.max(0, Math.min(before, stat.size) - MB));
            session.goal = found !== undefined ? found : cached?.session ? cached.session.goal : session.goal;
          }
          cached = { key, identity, session, goalSize: stat.size };
          sessionCache.set(entry.file, cached);
        }
        if (cached.session) result.push({ ...cached.session, logFile: entry.file });
      } catch (e) {
        sessionCache.delete(entry.file);
        warnings.push(`${entry.provider}: could not read a session log (${e.code || e.message}).`);
      }
    }
    const seen = new Set();
    return result.sort((a, b) => (b.lastActivityAt || '').localeCompare(a.lastActivityAt || '')).filter(a => {
      if (seen.has(a.id)) return false;
      seen.add(a.id); return true;
    }).slice(0, 40);
  }
  async function runs(warnings) {
    const result = [];
    const corpus = await fs.readFile(path.join(root, 'test/toyvm-dos-corpus/manifest.json'), 'utf8').then(JSON.parse).catch(() => null);
    const explicitRuns = new Set((corpus?.titles || []).flatMap(t => (t.toyvm?.evidence || []).map(e => e.run)));
    for (const directory of ['scratch/runs', 'ops/runs']) {
      let entries;
      try { entries = await fs.readdir(path.join(root, directory), { withFileTypes: true }); }
      catch (e) { if (e.code !== 'ENOENT') warnings.push(`${directory}: ${e.code}`); continue; }
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const relative = `${directory}/${entry.name}`;
        try {
          const file = await safeFile(root, `${relative}/result.json`);
          if (!file) continue;
          const r = JSON.parse(await readText(file, MB));
          if (!r || typeof r !== 'object' || (typeof r.candidateId !== 'string' && !(r.candidateId === null && explicitRuns.has(relative))) || !date(r.startedAt)) throw new Error('candidateId and ISO startedAt are required');
          const allowed = ['passed', 'failed', 'timeout', 'harness-error', 'running', 'unknown'];
          if (!allowed.includes(r.outcome)) throw new Error('invalid outcome');
          const run = { id: entry.name, key: relative, source: directory, candidateId: r.candidateId, taskId: clip(r.taskId), agentId: clip(r.agentId),
            startedAt: date(r.startedAt), finishedAt: date(r.finishedAt), outcome: r.outcome, route: clip(r.route),
            command: clip(r.command, 4000), build: clip(typeof r.build === 'string' ? r.build : JSON.stringify(r.build || {}), 2000),
            environment: clip(typeof r.environment === 'string' ? r.environment : JSON.stringify(r.environment || {}), 1000),
            summary: clip(r.summary, 2000), verification: r.verification === 'reviewed' ? 'reviewed' : 'unreviewed',
            performance: normalizePerformance(r.performance),
            screenshots: [], gameplayScreenshots: [], visuals: [], artifacts: [] };
          const gameplayNames = new Set(run.verification === 'reviewed' && typeof r.gameplaySceneReview?.reviewer === 'string' && r.gameplaySceneReview.reviewer.trim() && Array.isArray(r.gameplayScreenshots)
            ? r.gameplayScreenshots.filter(v => typeof v === 'string') : []);
          const diagrams = new Set(Array.isArray(r.diagrams) ? r.diagrams.filter(v => typeof v === 'string') : []);
          const names = new Set(['result.json', 'output.log']);
          for (const value of [r.screenshot, ...(Array.isArray(r.screenshots) ? r.screenshots : []), ...diagrams, ...(Array.isArray(r.artifacts) ? r.artifacts : [])]) {
            if (typeof value === 'string') names.add(value);
          }
          for (const name of names) {
            if (!/\.(png|jpe?g|webp|json|txt|log)$/i.test(name)) continue;
            const file = await safeFile(path.join(root, relative), name);
            if (!file || !inside(await fs.realpath(root), file)) { if (name !== 'output.log') warnings.push(`${relative}: missing or unsafe artifact ${clip(name)}`); continue; }
            const key = `${relative}/${name}`;
            assets.set(key, { root: path.join(root, relative), name });
            const artifact = { name, url: `/artifact?key=${encodeURIComponent(key)}` };
            run.artifacts.push(artifact);
            if (/\.(png|jpe?g|webp)$/i.test(name)) {
              run.visuals.push({ ...artifact, kind: diagrams.has(name) ? 'diagram' : 'screenshot' });
              if (!diagrams.has(name)) {
                run.screenshots.push(artifact);
                if (gameplayNames.has(name)) run.gameplayScreenshots.push(artifact);
              }
            }
          }
          result.push(run);
        } catch (e) { warnings.push(`${relative}/result.json: ${e.message}`); }
      }
    }
    return result.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  }
  async function snapshot() {
    assets.clear();
    const warnings = [], sources = [];
    let projectStatus={available:false,body:'',updatedAt:null,author:null};
    try {
      const file=await safeFile(root,'ops/STATUS.md');
      if(file){
        const text=await readText(file,16*1024);
        const [header,...parts]=text.replace(/\r\n/g,'\n').split('\n\n');
        const metadata=header.split('\n').every(line=>/^(updated|author):/i.test(line));
        projectStatus={available:true,body:metadata?parts.join('\n\n').trim():text.trim(),
          updatedAt:metadata?date(header.match(/^updated:[ \t]*(.+)$/im)?.[1]?.trim()):null,
          author:metadata?clip(header.match(/^author:[ \t]*(.+)$/im)?.[1],160):null};
        sources.push('ops/STATUS.md');
      }
    }catch(e){warnings.push(`ops/STATUS.md: ${e.code || e.message}`);}
    let candidates = [], todo = '', activity = [], inventoryManifest = { candidates: [] };
    try {
      const manifest = JSON.parse(await readText(path.join(inventoryRoot, 'test/candidate-corpus/manifest.json')));
      if (!Array.isArray(manifest.candidates)) throw new Error('candidates must be an array');
      inventoryManifest = manifest;
      candidates = manifest.candidates.filter(c => c && typeof c.id === 'string').map(c => ({
        id: c.id, name: clip(c.name), version: clip(c.version), kind: clip(c.kind), notes: clip(c.notes, 4000),
        executables: Array.isArray(c.executables) ? c.executables.filter(v => typeof v === 'string') : [], localOnly: !!c.localOnly,
        sourcePage: typeof c.sourcePage === 'string' && /^https?:\/\//.test(c.sourcePage) ? c.sourcePage : null,
        fixture: c.fixture || c.id, fixtureStatus: 'unknown', noteLinks: [] }));
      const assetRoot = typeof manifest.assetRoot === 'string' ? manifest.assetRoot : 'test/binaries/candidates';
      for (const c of candidates) {
        const existing = await Promise.all(c.executables.map(e => safeFile(root, `${assetRoot}/${c.fixture}/${e}`)));
        c.fixtureStatus = !existing.length ? 'unknown' : existing.every(Boolean) ? 'present' : existing.some(Boolean) ? 'partial' : 'missing';
        const notes = new Set([`docs/re-notes/${c.id}.md`, ...(c.notes.match(/docs\/re-notes\/[a-zA-Z0-9._-]+\.md/g) || [])]);
        for (const note of notes) if (await safeFile(root, note)) c.noteLinks.push({ name: note, url: `/source?path=${encodeURIComponent(note)}` });
      }
      sources.push('test/candidate-corpus/manifest.json');
    } catch (e) { warnings.push(`Candidate manifest: ${e.message}`); }
    // Keep registry-only games and unknown apps visible without changing the
    // candidate manifest. Exact app/executable associations come from the same
    // inventory used by the coverage report, not fuzzy title matching. The
    // inventory registry follows current source. Launch availability below is
    // independently checked against the actual emulator checkout.
    try {
      const registryFile = await safeFile(inventoryRoot, 'lib/apps.js');
      if (registryFile) {
        delete require.cache[require.resolve(registryFile)];
        const registry = require(registryFile);
        let assessments = [];
        try { assessments = JSON.parse(await readText(path.join(root, 'ops/corpus-status.json'), MB)).entries || []; }
        catch (e) { if (e.code !== 'ENOENT') warnings.push(`Registry associations: ${e.message}`); }
        for (const entry of inventory(inventoryManifest, registry.APPS, assessments,
          [...(registry.DESKTOP_APPS || []), ...(registry.LOCAL_CANDIDATE_APPS || []), ...(registry.DEBUG_ONLY_APPS || [])])) {
          let c = candidates.find(c => c.id === entry.id);
          if (!c) {
            c = {id:entry.id,name:clip(entry.name),kind:clip(entry.kind),version:'Registered app',
              notes:'Registered in lib/apps.js; fixture presence does not establish a working launch route.',
              executables:entry.executablePaths,localOnly:true,sourcePage:null,fixture:entry.id,fixtureStatus:'unknown',noteLinks:[]};
            candidates.push(c);
          }
          c.inventoryScope = entry.scope;
          c.localDesktopAppIds = entry.appIds.filter(id => (registry.DESKTOP_APPS || []).some(row => row[0] === id));
          c.registryOnly = entry.origin === 'registry-only';
          c.appIds = entry.appIds;
          c.registeredExecutables = await Promise.all(entry.apps.map(async app => ({appId:app.id,path:app.executable,present:!!await safeFile(root,app.executable)})));
          if (c.registryOnly) c.fixtureStatus = c.registeredExecutables.every(e=>e.present) ? 'present' : c.registeredExecutables.some(e=>e.present) ? 'partial' : 'missing';
        }
        // Registry-only entries are named by their app id (aoe1, abedemo), and
        // most of them are in none of the labelled launcher arrays above. The
        // inventory checkout's picker carries human labels for apps it offers,
        // so use that wherever the corpus still has only the id.
        const pickerFile = await safeFile(inventoryRoot, 'index.html');
        if (pickerFile) {
          const labels = new Map();
          for (const m of (await readText(pickerFile, 4 * MB)).matchAll(/<option value="([\w.-]+)"[^>]*>([^<]{1,120})<\/option>/g)) {
            if (!labels.has(m[1])) labels.set(m[1], m[2].trim().replace(/&amp;/g, '&').replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"'));
          }
          for (const c of candidates) {
            if (c.name && c.name !== c.id) continue;
            const label = [c.id, ...(c.appIds || [])].map(id => labels.get(id)).find(Boolean);
            if (label) c.name = clip(label);
          }
        }
        sources.push('lib/apps.js');
      }
    } catch (e) { warnings.push(`App registry: ${e.message}`); }
    try { todo = await readText(path.join(root, 'TODOS.md')); sources.push('TODOS.md'); }
    catch (e) { warnings.push(`TODOS.md: ${e.code || e.message}`); }
    try {
      const file = path.join(root, 'messageboard.txt'), stat = await fs.stat(file);
      const start = Math.max(0, stat.size - 256 * 1024);
      let tail = await windowText(file, start, Math.min(stat.size, 256 * 1024));
      if (start) tail = tail.slice(tail.indexOf('\n') + 1);
      activity = tail.split(/\r?\n/).filter(l => l.trim()).slice(-150).reverse().map(boardEntry);
      sources.push('messageboard.txt (latest 150 entries)');
      const stamp=stat.mtimeMs+':'+stat.size;
      if(stamp!==boardStamp){
        const messages=new Map();
        for(const line of (await readText(file,32*MB)).split('\n')){
          const m=/^(\S+) (\S+) \[OPS-(NOTE|ACK|REPLY|TASK) ([\w.-]+)\] (.*)$/.exec(line);
          if(!m)continue;
          const rows=messages.get(m[4]) || [];
          rows.push({at:m[1],actor:m[2],kind:m[3],message:m[5].replace(/^request:[a-f0-9-]{36} /,'').replace(/ request:[a-f0-9-]{36}$/,''),text:line,source:'messageboard.txt'});
          if(rows.length>50)rows.shift();messages.set(m[4],rows);
        }
        taskMessages=messages;boardStamp=stamp;
      }
    } catch (e) { warnings.push(`messageboard.txt: ${e.code || e.message}`); }
    const activityResult = await readActivity(activity);
    activity = activityResult.activity;
    if (activityResult.warning) warnings.push(activityResult.warning);
    else sources.push('git log --all (latest 150 commits; cached 30 seconds)');
    const tasks = parseTasks(todo, candidates);
    for (const task of tasks) {
      task.discussion=taskMessages.get(task.id) || [];
      task.replies=task.discussion.filter(row=>row.kind==='REPLY').slice(-10).reverse();
      task.pickup=task.acceptedAt && task.acceptedBy ? 'accepted' : task.owner ? 'assigned' : 'awaiting';
    }
    const [runList, agents] = await Promise.all([runs(warnings), sessions(warnings)]);
    const observations = agents.length ? await observeProcesses(agents) : new Map();
    for (const a of agents) { a.process = observations.get(a); delete a.logFile; }
    for (const run of runList) if (!candidates.some(c => c.id === run.candidateId || c.appIds?.includes(run.candidateId))) warnings.push(`${run.key}: candidate ${run.candidateId} is not in the corpus.`);
    for (const a of agents) {
      const task = ['active','blocked','review','ready'].map(status=>tasks.find(t=>t.owner===a.id && t.status===status)).find(Boolean);
      if (task) { a.taskId = task.id; a.taskTitle = task.title; a.taskStartedAt = task.startedAt; a.progressAt = task.progressAt; }
    }
    let corpusReview = null;
    try {
      corpusReview = JSON.parse(await readText(path.join(root, 'ops/corpus-status.json'), MB));
      if (!Array.isArray(corpusReview.entries) || !date(corpusReview.reviewedAt)) throw new Error('entries and reviewedAt are required');
      sources.push('ops/corpus-status.json');
    } catch (e) { if(e.code !== 'ENOENT') warnings.push(`Corpus status review: ${e.message}`); }
    for (const c of candidates) {
      c.category = classifyCandidate(c);
      c.taskIds = tasks.filter(t => t.candidateIds.includes(c.id)).map(t => t.id);
      const matching = runList.filter(r => r.candidateId === c.id || c.appIds?.includes(r.candidateId));
      c.latestRun = matching[0] || null;
      c.lastVerifiedRun = matching.find(r => r.outcome === 'passed' && r.verification === 'reviewed') || null;
      const measured=matching.find(r=>r.performance);
      c.performance=measured?{...measured.performance,runKey:measured.key}:null;
      const review = corpusReview?.entries?.find(e => e.id === c.id);
      c.sourceGroup = clip(review?.origin) || (c.registryOnly ? 'Registry only' : 'Source unclassified');
      if(review)c.assessment={status:clip(review.status),summary:clip(review.summary,4000),next:clip(review.next,2000),
        reviewedAt:date(corpusReview.reviewedAt),origin:clip(review.origin),distribution:clip(review.distribution),licenseNote:clip(review.licenseNote,2000),appIds:Array.isArray(review.appIds)?review.appIds.map(v=>clip(v)):[],
        registeredExecutablePresent:Array.isArray(review.apps) && review.apps.some(a=>a.executablePresent),
        needsReview:(review.basedOnLatestRun || null)!==(c.latestRun?.key || null) || (review.basedOnLatestStartedAt || null)!==(c.latestRun?.startedAt || null)};
    }
    const releaseReadiness = deriveReleaseReadiness({candidates, runs: runList, tasks, review: await loadReleaseReview(root)});
    for (const candidate of candidates) candidate.releaseReadiness = releaseReadiness.entries.find(entry => entry.id === candidate.id);
    let emulatorBuild = null;
    try { emulatorBuild = await getBuildIdentity(emulatorRoot); } catch (error) { warnings.push('Emulator build identity: ' + error.message); }
    try {
      const launchCatalog = await getCatalog(emulatorRoot);
      for (const candidate of candidates) candidate.launch = launchFor(candidate,launchCatalog,releaseReadiness.production,emulatorBuild);
    } catch (error) { warnings.push('Emulator launch catalog: ' + error.message); }
    linkCommits(activityResult.commits || [], tasks, runList);
    // Original DOS titles, kept apart from the Windows EXE corpus. GitHub links
    // use the repository a real commit URL already names, never a guess.
    let dosCorpus = null;
    try {
      const commitUrl = (activityResult.commits || []).map(c => c.url).find(u => typeof u === 'string' && /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/commit\/[0-9a-f]+$/.test(u));
      const githubRepo = commitUrl ? commitUrl.replace(/\/commit\/[0-9a-f]+$/, '') : null;
      const githubRef = (activityResult.code?.mainRef || 'origin/main').replace(/^origin\//, '');
      dosCorpus = await buildDosCorpus({ root, candidates, runs: runList, tasks, githubRepo, githubRef });
      if (dosCorpus.available) sources.push('test/toyvm-dos-corpus/manifest.json', 'ops/dos-corpus.json'); else warnings.push('DOS corpus: ' + dosCorpus.reason);
      warnings.push(...dosCorpus.warnings);
    } catch (error) { warnings.push('DOS corpus: ' + error.message); }
    return { generatedAt: new Date().toISOString(), root, inventoryRoot, tasks, candidates, runs: runList, agents, activity,activityWarning:activityResult.warning,codeState:activityResult.code || null,projectStatus,releaseReadiness,emulatorBuild,dosCorpus,
      sources, warnings: [...new Set(warnings)], todoText: todo,todoRevision:crypto.createHash('sha256').update(todo).digest('hex'),
      telemetryNote: 'Local logs and process snapshots. Matched PIDs show process presence, not progress or responsiveness. Shared hosts may serve several agents. Last-request input estimates context; session tails may be partial.' };
  }
  async function artifact(key) {
    const value = assets.get(key);
    const file = value ? await safeFile(value.root, value.name) : null;
    return file && inside(await fs.realpath(root), file) ? file : null;
  }
  // Internal only: retain log paths for accounting without exposing them in /api/state.
  async function analyticsSnapshot() {
    const warnings = [];
    return { agents: await sessions(warnings), warnings };
  }
  return { root, emulatorRoot, inventoryRoot, snapshot, artifact, analyticsSnapshot };
}

module.exports = { createReader, parseTasks, parseSession, safeFile, logWindows, scanGoal };
