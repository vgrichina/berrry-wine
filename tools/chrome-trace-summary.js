#!/usr/bin/env node
'use strict';
// Summarize a browser-wide Chrome trace per thread: who was busy, and on the
// threads that ran JS, which functions the time went to.
//
//   node tools/chrome-trace-summary.js TRACE.json[.gz] [--top=15] [--min-busy=1]
//        [--wasm-names=build/wine-assembly.named.wasm] [--incl=REGEX] [--json]
//
// The trace comes from tools/web-input-probe.js's `ctrace:MS:PATH` step (or a
// DevTools "Save profile"). Per thread it prints:
//   busy%   union of the thread's trace slices (X / B-E events) over the trace
//           window. A thread that never yields (a guest Worker looping in wasm)
//           reads 100% even when it is waiting inside Atomics.wait -- the
//           sample split says which.
//   samples split of V8 CPU-profile time: wasm / js / gc / program / idle.
//           Present only for threads V8 sampled (page main thread, Workers).
//   top     self time per function (V8 samples). Wasm functions show their WAT
//           name when --wasm-names points at a WINE_WAT_NAMES=1 build of the
//           SAME commit (build/wine-assembly.named.wasm; only the name section
//           differs from the canonical module, so the indices agree).
//   incl    with --incl=REGEX: inclusive time of every JS function whose
//           url matches REGEX (e.g. --incl=gpu-stream), i.e. how one drain
//           splits into record decode, uploads and draws.
//   events  for threads without samples (GPU process, compositor): the slice
//           names with the most summed duration (nested slices double count).
// --min-busy hides threads below that busy percentage.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const argv = process.argv.slice(2);
const opt = (name, dflt) => {
  const a = argv.find(x => x.startsWith(`--${name}=`));
  return a === undefined ? dflt : a.slice(name.length + 3);
};
const file = argv.find(a => !a.startsWith('--'));
if (!file) {
  console.error('usage: chrome-trace-summary.js TRACE.json[.gz] [--top=N] [--wasm-names=WASM] [--incl=REGEX] [--json]');
  process.exit(2);
}
const TOP = Number(opt('top', 15));
const MIN_BUSY = Number(opt('min-busy', 1));
const INCL = opt('incl', '') ? new RegExp(opt('incl', '')) : null;
const JSON_OUT = argv.includes('--json');

function readLeb(buf, pos) {
  let result = 0, shift = 0, b;
  do { b = buf[pos++]; result += (b & 0x7f) * 2 ** shift; shift += 7; } while (b & 0x80);
  return [result, pos];
}

// Function index -> name from a wasm `name` custom section (subsection 1).
function wasmNames(wasmPath) {
  const names = new Map();
  if (!wasmPath) return names;
  const buf = fs.readFileSync(wasmPath);
  let pos = 8;
  while (pos < buf.length) {
    const id = buf[pos++];
    let size; [size, pos] = readLeb(buf, pos);
    const end = pos + size;
    if (id === 0) {
      let nlen, p; [nlen, p] = readLeb(buf, pos);
      if (buf.toString('utf8', p, p + nlen) === 'name') {
        p += nlen;
        while (p < end) {
          const sub = buf[p++];
          let ssize; [ssize, p] = readLeb(buf, p);
          const send = p + ssize;
          if (sub === 1) {
            let count, q = p; [count, q] = readLeb(buf, q);
            for (let i = 0; i < count; i++) {
              let idx, len; [idx, q] = readLeb(buf, q); [len, q] = readLeb(buf, q);
              names.set(idx, buf.toString('utf8', q, q + len)); q += len;
            }
          }
          p = send;
        }
      }
    }
    pos = end;
  }
  return names;
}
const WASM_NAMES = wasmNames(opt('wasm-names', ''));

function loadTrace(f) {
  let buf = fs.readFileSync(f);
  if (buf[0] === 0x1f && buf[1] === 0x8b) buf = zlib.gunzipSync(buf);
  const parsed = JSON.parse(buf.toString('utf8'));
  return Array.isArray(parsed) ? parsed : parsed.traceEvents;
}

const events = loadTrace(file);
const procNames = new Map(), threadNames = new Map();
let t0 = Infinity, t1 = -Infinity;
for (const e of events) {
  if (e.ph === 'M') {
    if (e.name === 'process_name') procNames.set(e.pid, e.args.name);
    else if (e.name === 'thread_name') threadNames.set(`${e.pid}:${e.tid}`, e.args.name);
    continue;
  }
  if (typeof e.ts !== 'number' || e.ts <= 0) continue;
  if (e.ts < t0) t0 = e.ts;
  const end = e.ts + (e.dur || 0);
  if (end > t1) t1 = end;
}
const windowUs = t1 - t0;

const threads = new Map();
const threadOf = (pid, tid) => {
  const key = `${pid}:${tid}`;
  let t = threads.get(key);
  if (!t) {
    t = { key, pid, tid, process: procNames.get(pid) || `pid ${pid}`, thread: threadNames.get(key) || `tid ${tid}`,
      intervals: [], open: [], eventDur: new Map(), samples: null };
    threads.set(key, t);
  }
  return t;
};

// Slices.
for (const e of events) {
  if (e.ph !== 'X' && e.ph !== 'B' && e.ph !== 'E') continue;
  if (typeof e.ts !== 'number' || e.ts <= 0) continue;
  const t = threadOf(e.pid, e.tid);
  if (e.ph === 'X') {
    const dur = e.dur || 0;
    t.intervals.push([e.ts, e.ts + dur]);
    t.eventDur.set(e.name, (t.eventDur.get(e.name) || 0) + dur);
  } else if (e.ph === 'B') t.open.push(e);
  else {
    const b = t.open.pop();
    if (b) {
      t.intervals.push([b.ts, e.ts]);
      t.eventDur.set(b.name, (t.eventDur.get(b.name) || 0) + (e.ts - b.ts));
    }
  }
}
for (const t of threads.values()) {
  for (const b of t.open) t.intervals.push([b.ts, t1]);   // still open at trace end
  t.intervals.sort((a, b) => a[0] - b[0]);
  let busy = 0, cs = -1, ce = -1;
  for (const [s0, e0] of t.intervals) {
    const s = Math.max(s0, t0), e = Math.min(e0, t1);
    if (e <= s) continue;
    if (s > ce) { if (ce > cs) busy += ce - cs; cs = s; ce = e; } else if (e > ce) ce = e;
  }
  if (ce > cs) busy += ce - cs;
  t.busyUs = busy;
}

// V8 CPU profiles: Profile + ProfileChunk events, keyed by pid + profile id.
const profiles = new Map();
for (const e of events) {
  if (e.name !== 'Profile' && e.name !== 'ProfileChunk') continue;
  const key = `${e.pid}:${e.id}`;
  let p = profiles.get(key);
  if (!p) { p = { pid: e.pid, tid: e.tid, nodes: new Map(), samples: [], deltas: [], startTime: 0 }; profiles.set(key, p); }
  const d = (e.args && e.args.data) || {};
  if (e.name === 'Profile') { p.startTime = d.startTime || 0; p.tid = e.tid; continue; }
  const cp = d.cpuProfile || {};
  for (const n of cp.nodes || []) p.nodes.set(n.id, n);
  for (const s of cp.samples || []) p.samples.push(s);
  for (const dt of d.timeDeltas || []) p.deltas.push(dt);
}

function frameName(cf) {
  const url = cf.url || '';
  let name = cf.functionName || '(anonymous)';
  const isWasm = url.startsWith('wasm://') || /^wasm-function\[\d+\]$/.test(name);
  if (isWasm) {
    const m = /(\d+)\]?$/.exec(name);
    if (m && /^(?:\$func\d+|wasm-function\[\d+\])$/.test(name) && WASM_NAMES.has(Number(m[1]))) name = WASM_NAMES.get(Number(m[1]));
    return { key: `${name} [wasm]`, kind: 'wasm' };
  }
  if (name === '(idle)') return { key: name, kind: 'idle' };
  if (name === '(garbage collector)') return { key: name, kind: 'gc' };
  if (name === '(program)' || name === '(root)') return { key: name, kind: 'program' };
  const loc = url ? ` ${path.basename(url.split('?')[0])}:${(cf.lineNumber || 0) + 1}` : ' (native)';
  return { key: `${name}${loc}`, kind: 'js', url };
}

// Some Chrome versions give nodes children instead of parent; derive parents.
for (const p of profiles.values()) {
  for (const n of p.nodes.values()) for (const c of n.children || []) { const cn = p.nodes.get(c); if (cn && cn.parent === undefined) cn.parent = n.id; }
}
for (const p of profiles.values()) {
  if (!p.samples.length) continue;
  const t = threadOf(p.pid, p.tid);
  const s = t.samples || (t.samples = { totalUs: 0, kind: { wasm: 0, js: 0, gc: 0, program: 0, idle: 0 }, self: new Map(), incl: new Map() });
  const info = new Map();
  for (const [id, n] of p.nodes) info.set(id, frameName(n.callFrame || {}));
  // Sample i covers the interval to sample i+1. A gap far above the sampling
  // interval (the sampler starved, or the profile started before the trace
  // window) is not time spent in that one frame: cap it at 4x the median
  // interval and count it separately, and drop samples outside the window.
  const times = [];
  for (let i = 0, t = p.startTime; i < p.samples.length; i++) { t += p.deltas[i] || 0; times.push(t); }
  const gaps = times.slice(1).map((t, i) => t - times[i]).filter(x => x > 0).sort((a, b) => a - b);
  const median = gaps.length ? gaps[gaps.length >> 1] : 0;
  const cap = median > 0 ? 4 * median : Infinity;
  for (let i = 0; i < p.samples.length; i++) {
    if (times[i] < t0 || times[i] > t1) continue;
    const raw = Math.max(0, i + 1 < times.length ? times[i + 1] - times[i] : median);
    const dt = Math.min(raw, cap);
    s.lostUs = (s.lostUs || 0) + (raw - dt);
    const id = p.samples[i];
    const f = info.get(id);
    if (!f) continue;
    s.totalUs += dt;
    s.kind[f.kind] += dt;
    s.self.set(f.key, (s.self.get(f.key) || 0) + dt);
    if (INCL) {
      const seen = new Set();
      for (let nid = id; nid !== undefined;) {
        const n = p.nodes.get(nid);
        if (!n) break;
        const g = info.get(nid);
        if (g && g.kind === 'js' && INCL.test(g.url || '') && !seen.has(g.key)) {
          seen.add(g.key);
          s.incl.set(g.key, (s.incl.get(g.key) || 0) + dt);
        }
        nid = n.parent;
      }
    }
  }
}

const ms = us => +(us / 1000).toFixed(1);
const pct = (a, b) => b > 0 ? +(100 * a / b).toFixed(1) : 0;
const rows = [...threads.values()]
  .map(t => ({ t, busyPct: pct(t.busyUs, windowUs) }))
  .filter(r => r.busyPct >= MIN_BUSY || r.t.samples)
  .sort((a, b) => b.t.busyUs - a.t.busyUs);

const out = { file: path.basename(file), windowMs: ms(windowUs), wasmNames: WASM_NAMES.size, threads: [] };
for (const { t, busyPct } of rows) {
  const row = { process: t.process, thread: t.thread, pid: t.pid, tid: t.tid, busyMs: ms(t.busyUs), busyPct };
  if (t.samples) {
    const s = t.samples;
    row.sampledMs = ms(s.totalUs);
    row.sampleGapMs = ms(s.lostUs || 0);
    row.split = Object.fromEntries(Object.entries(s.kind).map(([k, v]) => [k, pct(v, s.totalUs)]));
    row.top = [...s.self].filter(([k]) => k !== '(idle)').sort((a, b) => b[1] - a[1]).slice(0, TOP)
      .map(([k, v]) => ({ fn: k, ms: ms(v), pct: pct(v, s.totalUs) }));
    if (INCL) row.incl = [...s.incl].sort((a, b) => b[1] - a[1]).slice(0, TOP)
      .map(([k, v]) => ({ fn: k, ms: ms(v), pct: pct(v, s.totalUs) }));
  } else {
    row.events = [...t.eventDur].sort((a, b) => b[1] - a[1]).slice(0, Math.min(TOP, 8))
      .map(([k, v]) => ({ name: k, ms: ms(v) }));
  }
  out.threads.push(row);
}

if (JSON_OUT) { console.log(JSON.stringify(out, null, 1)); process.exit(0); }
console.log(`${out.file}: window ${out.windowMs} ms, ${out.wasmNames ? out.wasmNames + ' wasm names' : 'no wasm names'}`);
for (const r of out.threads) {
  console.log(`\n== ${r.process} / ${r.thread} (${r.pid}:${r.tid})  busy ${r.busyMs} ms = ${r.busyPct}%`);
  if (r.split) {
    console.log(`   sampled ${r.sampledMs} ms (+${r.sampleGapMs} ms unsampled gaps): ` + Object.entries(r.split).map(([k, v]) => `${k} ${v}%`).join('  '));
    for (const f of r.top) console.log(`   ${String(f.ms).padStart(8)} ms ${String(f.pct).padStart(5)}%  ${f.fn}`);
    if (r.incl && r.incl.length) {
      console.log('   -- inclusive (--incl) --');
      for (const f of r.incl) console.log(`   ${String(f.ms).padStart(8)} ms ${String(f.pct).padStart(5)}%  ${f.fn}`);
    }
  } else {
    for (const e of r.events) console.log(`   ${String(e.ms).padStart(8)} ms  ${e.name}`);
  }
}
