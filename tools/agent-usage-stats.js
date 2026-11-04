#!/usr/bin/env node
// agent-usage-stats.js — per-day token usage of the coding agents, next to commits.
//
// WHY THIS EXISTS
// The project is built by Codex and Claude Code sessions, and the only record of
// how much model work went into a day is in their session logs: Codex rollouts
// (~/.codex/sessions/**/rollout-*.jsonl[.gz]) and Claude Code transcripts
// (~/.claude/projects/*/**.jsonl). Those logs are large and get deleted to free
// disk, so this tool reduces them to a small durable summary
// (docs/stats/agent-usage-daily.json) that the story and anyone else can read.
// It never copies transcript text: only ids, roles, models, timestamps, counters.
//
// The logs live on two machines (Codex on the ops box and the laptop, Claude on
// the laptop), so the work is split into scan steps that run where the logs are
// and a merge step that runs in the repo:
//
//   node tools/agent-usage-stats.js codex  --root=DIR [--root=DIR] --host=NAME --out=FILE [--match=wine-assembly]
//   node tools/agent-usage-stats.js claude --root=DIR --host=NAME --out=FILE [--match=wine-assembly]
//   node tools/agent-usage-stats.js merge  --in=FILE [--in=FILE...] [--ref=origin/main] --out=docs/stats/agent-usage-daily.json
//                                          [--sessions-out=docs/stats/agent-sessions.json]
//   node tools/agent-usage-stats.js report --in=docs/stats/agent-usage-daily.json [--from=YYYY-MM-DD] [--weekly]
//
// COUNTING RULES (the part that is easy to get wrong)
// - Codex token_count events carry the thread's CUMULATIVE total_token_usage.
//   Each thread is counted once: samples are ordered by time and only the
//   increase over the previous sample is attributed to the sample's UTC day, so
//   repeated events, resumes and compactions are not double-counted. A counter
//   that goes DOWN is a reset; that sample contributes its last_token_usage.
// - A thread's first sample contributes last_token_usage, not its cumulative
//   total, and samples timestamped before the thread's own session_meta are
//   history copied from a parent (forks) and contribute nothing. Both keep a
//   forked thread from re-counting its parent.
// - The same thread id seen in several files or on several hosts is one thread;
//   merge keeps the copy with the larger total.
// - Claude Code writes one line per content block of a streamed message, each
//   carrying the same usage; and a resumed session copies earlier messages into
//   its new file. Messages are therefore deduplicated by message.id (+requestId).
// - Codex input_tokens INCLUDE cached_input_tokens and output_tokens INCLUDE
//   reasoning tokens; total = input + output. Claude's input_tokens EXCLUDE the
//   cache fields; total = input + cache_creation + cache_read + output. The
//   "uncached input" fields are the comparable ones.
// - Peak concurrency = the most distinct threads (both vendors) that consumed
//   tokens inside one 10-minute UTC bucket of that day.

'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const readline = require('readline');
const { execFileSync } = require('child_process');

const BUCKET_MS = 10 * 60 * 1000;

function parseArgs(argv) {
  const out = { _: [] };
  for (const a of argv) {
    const m = /^--([^=]+)(?:=(.*))?$/.exec(a);
    if (!m) { out._.push(a); continue; }
    const k = m[1], v = m[2] === undefined ? true : m[2];
    if (k in out) out[k] = [].concat(out[k], v); else out[k] = v;
  }
  return out;
}
const list = v => v === undefined ? [] : [].concat(v);
const day = ms => new Date(ms).toISOString().slice(0, 10);

function walk(dir, re, acc = []) {
  let ents;
  try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return acc; }
  for (const e of ents) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, re, acc);
    else if (e.isFile() && re.test(e.name)) acc.push(p);
  }
  return acc;
}

function lines(file) {
  let s = fs.createReadStream(file, { highWaterMark: 1 << 20 });
  if (file.endsWith('.gz')) s = s.pipe(zlib.createGunzip());
  return readline.createInterface({ input: s, crlfDelay: Infinity });
}

const zero = () => ({ input: 0, cached: 0, output: 0, reasoning: 0, total: 0 });
function add(a, b) { for (const k of Object.keys(b)) a[k] = (a[k] || 0) + b[k]; return a; }

// ---------------------------------------------------------------- codex scan
async function scanCodex(args) {
  const roots = list(args.root);
  const match = args.match === undefined ? /wine-assembly/i : new RegExp(args.match, 'i');
  const files = roots.flatMap(r => walk(r, /^rollout-.*\.jsonl(\.gz)?$/)).sort();
  const threads = new Map(); // id -> { meta, samples: [[ts, in, cached, out, reas, total, lastIn, lastCached, lastOut, lastReas, lastTotal, modelIdx]] }
  const models = [];
  const modelIdx = m => { let i = models.indexOf(m); if (i < 0) { models.push(m); i = models.length - 1; } return i; };
  const skipped = { cwd: 0, cwds: {}, noMeta: 0, badLines: 0, errors: [] };
  const fileList = [];
  let n = 0;
  for (const f of files) {
    n++;
    const st = fs.statSync(f);
    let meta = null, model = null, t = null, keep = true, events = 0;
    try {
      for await (const line of lines(f)) {
        if (!meta) {
          if (line.includes('"type":"session_meta"')) {
            let o;
            try { o = JSON.parse(line); } catch { skipped.badLines++; continue; }
            if (o.type !== 'session_meta') continue;
            const p = o.payload || {};
            meta = {
              id: p.id || p.session_id, cwd: p.cwd || '', originator: p.originator || '',
              source: typeof p.source === 'string' ? p.source : (p.source && p.source.subagent ? 'subagent' : JSON.stringify(p.source || '')),
              parent: p.source && p.source.subagent && p.source.subagent.thread_spawn ? p.source.subagent.thread_spawn.parent_thread_id : null,
              nickname: (p.source && p.source.subagent && p.source.subagent.thread_spawn && p.source.subagent.thread_spawn.agent_nickname) || null,
              cli: p.cli_version || '', startMs: Date.parse(p.timestamp || o.timestamp),
            };
            if (!match.test(meta.cwd)) {
              keep = false; skipped.cwd++;
              skipped.cwds[meta.cwd] = (skipped.cwds[meta.cwd] || 0) + 1;
              break;
            }
            t = threads.get(meta.id);
            if (!t) { t = { meta, samples: [], files: [] }; threads.set(meta.id, t); }
            else if (meta.startMs < t.meta.startMs) t.meta.startMs = meta.startMs;
            t.files.push({ path: f, bytes: st.size, mtime: st.mtime.toISOString() });
          }
          continue;
        }
        const head = line.slice(0, 160);
        if (head.includes('"type":"turn_context"')) {
          const m = /"model":"([^"]+)"/.exec(line);
          if (m) model = m[1];
          continue;
        }
        if (!head.includes('"type":"event_msg"') || !line.includes('"token_count"') || line.length > 50000) continue;
        let o;
        try { o = JSON.parse(line); } catch { skipped.badLines++; continue; }
        const p = o.payload;
        if (!p || p.type !== 'token_count' || !p.info || !p.info.total_token_usage) continue;
        const u = p.info.total_token_usage, l = p.info.last_token_usage || {};
        t.samples.push([Date.parse(o.timestamp), u.input_tokens | 0, u.cached_input_tokens | 0, u.output_tokens | 0,
          u.reasoning_output_tokens | 0, u.total_tokens | 0, l.input_tokens | 0, l.cached_input_tokens | 0,
          l.output_tokens | 0, l.reasoning_output_tokens | 0, l.total_tokens | 0, modelIdx(model || 'unknown')]);
        events++;
      }
    } catch (e) {
      skipped.errors.push(`${f}: ${e.message}`);
    }
    if (!meta) skipped.noMeta++;
    fileList.push({ path: f, bytes: st.size, mtime: st.mtime.toISOString(), id: meta ? meta.id : null, kept: !!(meta && keep), events });
    if (n % 100 === 0) process.stderr.write(`codex ${n}/${files.length}\n`);
  }

  const out = { kind: 'codex', host: args.host || 'unknown', scannedAt: new Date().toISOString(), roots, skipped, files: fileList, threads: {} };
  let forkSkipped = 0, resets = 0;
  for (const [id, t] of threads) {
    const s = t.samples.sort((a, b) => a[0] - b[0] || a[5] - b[5]);
    const days = {}, buckets = new Set(), byModel = {};
    const tot = zero();
    let prev = null, first = null, last = null;
    for (const x of s) {
      if (prev && x[0] === prev[0] && x[5] === prev[5]) continue;
      let d;
      if (x[0] < t.meta.startMs - 1000) { forkSkipped++; prev = x; continue; }
      if (!prev) d = [x[6], x[7], x[8], x[9], x[10]];
      else if (x[5] < prev[5]) { resets++; d = [x[6], x[7], x[8], x[9], x[10]]; }
      else d = [x[1] - prev[1], x[2] - prev[2], x[3] - prev[3], x[4] - prev[4], x[5] - prev[5]];
      prev = x;
      if (d[4] <= 0) continue;
      const v = { input: Math.max(0, d[0]), cached: Math.max(0, d[1]), output: Math.max(0, d[2]), reasoning: Math.max(0, d[3]), total: d[4] };
      const k = day(x[0]);
      add(days[k] || (days[k] = zero()), v);
      add(tot, v);
      const mn = models[x[11]];
      byModel[mn] = (byModel[mn] || 0) + v.total;
      buckets.add(Math.floor(x[0] / BUCKET_MS));
      if (first === null) first = x[0];
      last = x[0];
    }
    const m = t.meta;
    const role = m.source === 'subagent' ? 'subagent' : (m.originator === 'codex_exec' || m.source === 'exec') ? 'exec' : 'interactive';
    out.threads[id] = {
      id, vendor: 'codex', host: out.host, role, originator: m.originator, source: m.source, parent: m.parent,
      nickname: m.nickname, cli: m.cli, start: new Date(m.startMs).toISOString(),
      firstUse: first === null ? null : new Date(first).toISOString(), lastUse: last === null ? null : new Date(last).toISOString(),
      models: byModel, totals: tot, days, buckets: [...buckets].sort((a, b) => a - b),
      files: t.files,
    };
  }
  out.diagnostics = { threads: threads.size, forkCopiedSamplesSkipped: forkSkipped, counterResets: resets, models };
  fs.writeFileSync(args.out, JSON.stringify(out));
  process.stderr.write(`codex: ${files.length} files, ${threads.size} threads kept, ${skipped.cwd} other-cwd, ${skipped.errors.length} errors -> ${args.out}\n`);
}

// --------------------------------------------------------------- claude scan
async function scanClaude(args) {
  const root = args.root;
  const match = args.match === undefined ? /wine-assembly/i : new RegExp(args.match, 'i');
  const projects = fs.readdirSync(root).filter(d => match.test(d));
  const files = projects.flatMap(p => walk(path.join(root, p), /\.jsonl$/)).sort();
  const seen = new Set();
  const threads = new Map();
  const errors = [];
  let dup = 0, n = 0;
  for (const f of files) {
    n++;
    const st = fs.statSync(f);
    const sub = f.includes(`${path.sep}subagents${path.sep}`);
    try {
      for await (const line of lines(f)) {
        if (!line.includes('"usage"') || !line.includes('"type":"assistant"')) continue;
        let o;
        try { o = JSON.parse(line); } catch { continue; }
        if (o.type !== 'assistant' || !o.message || !o.message.usage) continue;
        const msg = o.message;
        if (msg.model === '<synthetic>') continue;
        const key = `${msg.id || o.uuid}|${o.requestId || ''}`;
        if (seen.has(key)) { dup++; continue; }
        seen.add(key);
        const sid = o.sessionId + (o.agentId ? `:${o.agentId}` : (sub ? `:${path.basename(f, '.jsonl')}` : ''));
        let t = threads.get(sid);
        if (!t) {
          t = { id: sid, vendor: 'claude', host: args.host || 'unknown', role: (sub || o.isSidechain) ? 'subagent' : 'main',
            project: path.relative(root, f).split(path.sep)[0], cwd: o.cwd || null, files: new Set(), models: {},
            totals: { input: 0, cacheCreate: 0, cacheRead: 0, output: 0, total: 0 }, days: {}, buckets: new Set(), first: null, last: null };
          threads.set(sid, t);
        }
        t.files.add(f);
        const u = msg.usage;
        const v = { input: u.input_tokens | 0, cacheCreate: u.cache_creation_input_tokens | 0, cacheRead: u.cache_read_input_tokens | 0, output: u.output_tokens | 0 };
        v.total = v.input + v.cacheCreate + v.cacheRead + v.output;
        const ms = Date.parse(o.timestamp);
        const k = day(ms);
        add(t.days[k] || (t.days[k] = { input: 0, cacheCreate: 0, cacheRead: 0, output: 0, total: 0, messages: 0 }), { ...v, messages: 1 });
        add(t.totals, v);
        t.models[msg.model] = (t.models[msg.model] || 0) + v.total;
        t.buckets.add(Math.floor(ms / BUCKET_MS));
        if (t.first === null || ms < t.first) t.first = ms;
        if (t.last === null || ms > t.last) t.last = ms;
      }
    } catch (e) { errors.push(`${f}: ${e.message}`); }
    if (n % 200 === 0) process.stderr.write(`claude ${n}/${files.length}\n`);
  }
  const out = { kind: 'claude', host: args.host || 'unknown', scannedAt: new Date().toISOString(), roots: [root], projects,
    skipped: { errors }, diagnostics: { files: files.length, duplicateMessageLines: dup, messages: seen.size }, threads: {} };
  for (const [id, t] of threads) {
    out.threads[id] = { ...t, files: [...t.files].map(p => ({ path: p })), buckets: [...t.buckets].sort((a, b) => a - b),
      start: new Date(t.first).toISOString(), firstUse: new Date(t.first).toISOString(), lastUse: new Date(t.last).toISOString() };
    delete out.threads[id].first; delete out.threads[id].last;
  }
  fs.writeFileSync(args.out, JSON.stringify(out));
  process.stderr.write(`claude: ${files.length} files, ${threads.size} threads, ${seen.size} messages (${dup} dup lines) -> ${args.out}\n`);
}

// --------------------------------------------------------------------- merge
function gitCommits(ref) {
  const fmt = '%H%x09%aI%x09%an%x09%ae%x09%(trailers:key=Co-Authored-By,valueonly,separator=;)';
  const raw = execFileSync('git', ['log', ref, `--format=${fmt}`], { maxBuffer: 1 << 28, encoding: 'utf8' });
  const res = [];
  for (const l of raw.split('\n')) {
    if (!l) continue;
    const [h, date, an, ae, co] = l.split('\t');
    const who = `${an} ${ae}`, trail = co || '';
    let cls = 'human';
    if (/codex/i.test(who)) cls = 'codex';
    else if (/claude|anthropic/i.test(who) || /claude/i.test(trail)) cls = 'claude';
    else if (/wine ops|wine-ops/i.test(who)) cls = 'ops';
    else if (/codex/i.test(trail)) cls = 'codex';
    res.push({ h, day: day(Date.parse(date)), cls });
  }
  return res;
}

function merge(args) {
  const ins = list(args.in).map(f => JSON.parse(fs.readFileSync(f, 'utf8')));
  const threads = new Map();
  const sources = [];
  for (const d of ins) {
    sources.push({ kind: d.kind, host: d.host, scannedAt: d.scannedAt, roots: d.roots, threads: Object.keys(d.threads).length,
      files: d.files ? d.files.length : (d.diagnostics && d.diagnostics.files), skipped: d.skipped && { ...d.skipped, errors: (d.skipped.errors || []).length },
      diagnostics: d.diagnostics && { ...d.diagnostics, models: undefined } });
    for (const t of Object.values(d.threads)) {
      const k = `${t.vendor}:${t.id}`;
      const old = threads.get(k);
      if (!old || t.totals.total > old.totals.total) threads.set(k, t);
    }
  }
  const commits = gitCommits(args.ref || 'origin/main');
  const days = {};
  const D = k => days[k] || (days[k] = {
    date: k, commits: { total: 0, codex: 0, claude: 0, ops: 0, human: 0 },
    codex: { threads: 0, ...zero(), byRole: {} }, claude: { threads: 0, input: 0, cacheCreate: 0, cacheRead: 0, output: 0, total: 0, messages: 0, byRole: {} },
    totalTokens: 0, tokensPerCommit: null, peakConcurrent: 0, peakConcurrentCodex: 0, peakConcurrentClaude: 0,
  });
  for (const c of commits) { const x = D(c.day).commits; x.total++; x[c.cls]++; }
  const bucketAll = new Map(), bucketCx = new Map(), bucketCl = new Map();
  const sessions = [];
  for (const t of threads.values()) {
    const role = t.vendor === 'codex' && t.role === 'interactive' && t.host === 'boat' ? 'coordinator'
      : t.vendor === 'codex' && t.role === 'exec' ? 'worker' : t.role;
    for (const [k, v] of Object.entries(t.days)) {
      const x = D(k)[t.vendor];
      x.threads++;
      for (const f of Object.keys(v)) x[f] = (x[f] || 0) + v[f];
      x.byRole[role] = (x.byRole[role] || 0) + v.total;
    }
    for (const b of t.buckets) {
      bucketAll.set(b, (bucketAll.get(b) || 0) + 1);
      const m = t.vendor === 'codex' ? bucketCx : bucketCl;
      m.set(b, (m.get(b) || 0) + 1);
    }
    const topModel = Object.entries(t.models).sort((a, b) => b[1] - a[1])[0];
    sessions.push({ vendor: t.vendor, id: t.id, host: t.host, role, model: topModel ? topModel[0] : null,
      models: Object.keys(t.models).length > 1 ? t.models : undefined, parent: t.parent || undefined,
      start: t.start, firstUse: t.firstUse, lastUse: t.lastUse, totalTokens: t.totals.total,
      outputTokens: t.totals.output, files: t.files.map(f => f.path) });
  }
  for (const [map, field] of [[bucketAll, 'peakConcurrent'], [bucketCx, 'peakConcurrentCodex'], [bucketCl, 'peakConcurrentClaude']]) {
    for (const [b, n] of map) { const x = D(day(b * BUCKET_MS)); if (n > x[field]) x[field] = n; }
  }
  const sorted = Object.keys(days).sort();
  const all = [];
  for (const k of sorted) {
    const x = days[k];
    x.totalTokens = x.codex.total + x.claude.total;
    x.codex.uncachedInput = x.codex.input - x.codex.cached;
    x.tokensPerCommit = x.commits.total ? Math.round(x.totalTokens / x.commits.total) : null;
    x.logged = { codex: x.codex.total > 0, claude: x.claude.total > 0 };
    all.push(x);
  }
  const firstOf = v => (all.find(x => x[v].total > 0) || {}).date || null;
  const gaps = all.filter(x => x.commits.total > 0 && x.totalTokens === 0).map(x => `${x.date} (${x.commits.total})`);
  const sum = (f) => all.reduce((a, x) => a + f(x), 0);
  sessions.sort((a, b) => (a.start || '').localeCompare(b.start || ''));
  const result = {
    generated: new Date().toISOString(), tool: 'tools/agent-usage-stats.js', ref: args.ref || 'origin/main',
    definitions: {
      day: 'UTC calendar day of the token event / commit author date',
      codexTotal: 'input (includes cached) + output (includes reasoning), from cumulative total_token_usage deltas per thread',
      claudeTotal: 'input + cache_creation + cache_read + output, per unique message.id',
      roles: 'codex: coordinator = interactive TUI thread on the ops box, worker = codex exec, subagent = spawned by a thread, interactive = laptop TUI; claude: main / subagent',
      peakConcurrent: 'max distinct threads that used tokens in one 10-minute UTC bucket of the day',
    },
    coverage: { firstCodexDay: firstOf('codex'), firstClaudeDay: firstOf('claude'), daysWithCommitsButNoLogs: gaps },
    sources,
    totals: {
      commits: sum(x => x.commits.total), codexTokens: sum(x => x.codex.total), claudeTokens: sum(x => x.claude.total),
      codexOutput: sum(x => x.codex.output), claudeOutput: sum(x => x.claude.output),
      codexThreads: sessions.filter(s => s.vendor === 'codex').length, claudeThreads: sessions.filter(s => s.vendor === 'claude').length,
    },
    days: all,
  };
  fs.mkdirSync(path.dirname(args.out), { recursive: true });
  fs.writeFileSync(args.out, JSON.stringify(result, null, 1) + '\n');
  if (args['sessions-out']) {
    // Paths are reduced to file names: the directories are machine-specific.
    const lean = sessions.map(s => ({ ...s, files: s.files.map(p => path.basename(p)) }));
    fs.writeFileSync(args['sessions-out'], '[\n' + lean.map(s => JSON.stringify(s)).join(',\n') + '\n]\n');
  }
  process.stderr.write(`merge: ${all.length} days, ${sessions.length} sessions -> ${args.out}\n`);
}

// -------------------------------------------------------------------- report
function fmtT(n) {
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(0) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(0) + 'K';
  return String(n);
}
function report(args) {
  const d = JSON.parse(fs.readFileSync(args.in, 'utf8'));
  let rows = d.days.filter(x => !args.from || x.date >= args.from).filter(x => !args.to || x.date <= args.to);
  if (args.weekly) {
    const wk = {};
    for (const x of rows) {
      const t = new Date(x.date + 'T00:00:00Z'); const dow = (t.getUTCDay() + 6) % 7;
      const k = day(t.getTime() - dow * 86400000);
      const w = wk[k] || (wk[k] = { date: k, commits: { total: 0 }, codex: { total: 0, threads: 0 }, claude: { total: 0, threads: 0 }, totalTokens: 0, peakConcurrent: 0 });
      w.commits.total += x.commits.total; w.codex.total += x.codex.total; w.claude.total += x.claude.total;
      w.totalTokens += x.totalTokens; w.peakConcurrent = Math.max(w.peakConcurrent, x.peakConcurrent);
    }
    rows = Object.values(wk).map(w => ({ ...w, tokensPerCommit: w.commits.total ? Math.round(w.totalTokens / w.commits.total) : null }));
  }
  const maxT = Math.max(...rows.map(r => r.totalTokens)), maxC = Math.max(...rows.map(r => r.commits.total));
  const W = +(args.width || 30);
  for (const r of rows) {
    const tb = '█'.repeat(Math.round(r.totalTokens / maxT * W));
    const cb = '▒'.repeat(Math.round(r.commits.total / maxC * 15));
    console.log(`${r.date.slice(5)} ${tb.padEnd(W)} ${fmtT(r.totalTokens).padStart(6)} | ${cb.padEnd(15)} ${String(r.commits.total).padStart(4)}  cx ${fmtT(r.codex.total).padStart(6)} cl ${fmtT(r.claude.total).padStart(6)}  t/c ${r.tokensPerCommit === null ? '-' : fmtT(r.tokensPerCommit)}  peak ${r.peakConcurrent}`);
  }
}

const args = parseArgs(process.argv.slice(2));
const cmd = args._[0];
const run = { codex: scanCodex, claude: scanClaude, merge, report }[cmd];
if (!run || (cmd !== 'report' && !args.out) || (cmd === 'report' && !args.in)) {
  console.error('usage: agent-usage-stats.js codex|claude|merge|report ... (see header)');
  process.exit(2);
}
Promise.resolve(run(args)).catch(e => { console.error(e); process.exit(1); });
