#!/usr/bin/env node
// Summarise a key-to-pixels timeline from tools/page-probes/arm-key-latency.js.
//
//   node tools/key-latency-report.js PROBE.log [--json=OUT.json]
//
// PROBE.log is tools/web-input-probe.js output containing one
// `evalfile .../read-key-latency.js => {...}` line. For every arrow-key
// keydown it reports, in page milliseconds from the browser's own event
// timestamp:
//   deq     the guest's message poll took the WM_KEYDOWN
//   moved   the first presented guest frame whose pixels changed where the
//           600 ms before the key were still (the frame that shows the key)
//   paint   the first #screen composite after that frame reached the page
// and how many guest presents arrived between deq and moved. The display
// itself adds up to one more refresh after `paint`; the page cannot see it.
//
// Motion test: 128x96 luma thumbnails. A cell is "noisy" if it changed by more
// than NOISE between any two frames of the baseline; a frame after the key
// "moved" when at least MIN_CELLS non-noisy cells changed by more than STEP
// from the frame before it. Constants are below; the report prints them.
'use strict';
const fs = require('fs');

const NOISE = 6, STEP = 20, MIN_CELLS = 2;
// The still window before each key. Short on purpose: a player still sliding
// from the previous tap marks its own cells noisy and hides the next move.
const BASELINE_MS = Number((process.argv.find(a => a.startsWith('--baseline-ms=')) || '=250').split('=')[1]);
const VK = { ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40, KeyZ: 90, KeyX: 88, Enter: 13 };

function parseLog(file) {
  const text = fs.readFileSync(file, 'utf8');
  const line = text.split('\n').find(l => /read-key-latency\.js => /.test(l));
  if (!line) throw new Error('no read-key-latency.js line in ' + file);
  let v = JSON.parse(line.slice(line.indexOf('=> ') + 3));
  if (typeof v === 'string') v = JSON.parse(v);
  return v;
}

const decode = b64 => b64 ? Buffer.from(b64, 'base64') : null;
const pct = (a, p) => { if (!a.length) return NaN; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * (s.length - 1) + 0.5))]; };
const r1 = x => Number.isFinite(x) ? Math.round(x * 10) / 10 : null;

function analyse(v) {
  const frames = v.frames.map(f => ({ t: f.t, luma: decode(f.luma) }));
  const presses = v.keys.filter(k => k.type === 'keydown' && !k.repeat && VK[k.code]);
  const rows = [];
  for (const k of presses) {
    const vk = VK[k.code];
    const deq = v.deq.find(d => d.msg === 0x100 && d.vk === vk && d.t >= k.t);
    const enq = (v.enq || []).find(d => d.msg === 0x100 && d.vk === vk && d.t >= k.t);
    // The guest's message polls around the key: the last one before the
    // enqueue, and the first after it (whether or not it took this key).
    const polls = v.polls || [];
    const pollAfterEnq = enq ? polls.find(t => t >= enq.t) : undefined;
    const base = frames.filter(f => f.t >= k.t - BASELINE_MS && f.t < k.t && f.luma);
    const after = frames.filter(f => f.t >= k.t && f.t <= k.t + 2000);
    const n = base[0] ? base[0].luma.length : 0;
    const noisy = new Uint8Array(n);
    for (let i = 1; i < base.length; i++) {
      for (let c = 0; c < n; c++) if (Math.abs(base[i].luma[c] - base[i - 1].luma[c]) > NOISE) noisy[c] = 1;
    }
    let moved = null, prev = base[base.length - 1] || null, movedCells = 0;
    for (const f of after) {
      if (!f.luma || !prev || !prev.luma) { prev = f; continue; }
      let cells = 0;
      for (let c = 0; c < n; c++) if (!noisy[c] && Math.abs(f.luma[c] - prev.luma[c]) > STEP) cells++;
      if (cells >= MIN_CELLS) { moved = f; movedCells = cells; break; }
      prev = f;
    }
    const paint = moved ? v.paints.find(p => p >= moved.t) : null;
    const framesBetween = deq && moved ? frames.filter(f => f.t > deq.t && f.t <= moved.t).length : null;
    const firstAfterDeq = deq ? frames.find(f => f.t > deq.t) : null;
    rows.push({
      key: k.code, at: r1(k.t),
      enqMs: enq ? r1(enq.t - k.t) : null,
      firstPollAfterEnqMs: pollAfterEnq !== undefined ? r1(pollAfterEnq - k.t) : null,
      deqMs: deq ? r1(deq.t - k.t) : null,
      firstPresentAfterDeqMs: firstAfterDeq ? r1(firstAfterDeq.t - k.t) : null,
      movedMs: moved ? r1(moved.t - k.t) : null,
      presentsDeqToMoved: framesBetween,
      paintMs: paint != null ? r1(paint - k.t) : null,
      baselineFrames: base.length, noisyCells: noisy.reduce((a, b) => a + b, 0), movedCells,
    });
  }
  const ok = rows.filter(r => r.paintMs != null);
  const col = name => ok.map(r => r[name]).filter(Number.isFinite);
  // Present cadence and arrival -> composite over the whole log.
  const ft = frames.map(f => f.t);
  const intervals = ft.slice(1).map((t, i) => t - ft[i]);
  const toPaint = [];
  for (const t of ft) { const p = v.paints.find(x => x >= t); if (p != null) toPaint.push(p - t); }
  const keyups = v.keys.filter(k => k.type === 'keyup' && VK[k.code]).map(k => {
    const d = v.deq.find(x => x.msg === 0x101 && x.vk === VK[k.code] && x.t >= k.t);
    return d ? d.t - k.t : null;
  }).filter(Number.isFinite);
  const span = ft.length > 1 ? (ft[ft.length - 1] - ft[0]) / 1000 : 0;
  const pollGaps = (v.polls || []).slice(1).map((t, i) => t - v.polls[i]);
  const all = name => rows.map(r => r[name]).filter(Number.isFinite);
  return {
    threads: v.threads, constants: { NOISE, STEP, MIN_CELLS, BASELINE_MS },
    presses: rows,
    summary: {
      n: rows.length, measured: ok.length,
      enqMs: { p50: r1(pct(all('enqMs'), 0.5)), max: r1(Math.max(...all('enqMs'))) },
      firstPollAfterEnqMs: { p50: r1(pct(all('firstPollAfterEnqMs'), 0.5)), max: r1(Math.max(...all('firstPollAfterEnqMs'))) },
      polls: (v.polls || []).length, pollGapMs: { p50: r1(pct(pollGaps, 0.5)), p95: r1(pct(pollGaps, 0.95)), max: r1(Math.max(...pollGaps)) },
      deqMs: { p50: r1(pct(col('deqMs'), 0.5)), max: r1(Math.max(...col('deqMs'))) },
      movedMs: { p50: r1(pct(col('movedMs'), 0.5)), max: r1(Math.max(...col('movedMs'))) },
      paintMs: { p50: r1(pct(col('paintMs'), 0.5)), min: r1(Math.min(...col('paintMs'))), max: r1(Math.max(...col('paintMs'))) },
      presentsDeqToMoved: { p50: pct(col('presentsDeqToMoved'), 0.5) },
      keyupDeqMs: { p50: r1(pct(keyups, 0.5)), max: r1(Math.max(...keyups)) },
      presents: ft.length, presentsPerSec: span ? r1((ft.length - 1) / span) : null,
      presentIntervalMs: { p50: r1(pct(intervals, 0.5)), p95: r1(pct(intervals, 0.95)) },
      frameToPaintMs: { p50: r1(pct(toPaint, 0.5)), p95: r1(pct(toPaint, 0.95)) },
    },
  };
}

if (require.main === module) {
  const file = process.argv[2];
  if (!file) { console.error('usage: key-latency-report.js PROBE.log [--json=OUT]'); process.exit(2); }
  const out = analyse(parseLog(file));
  const jsonArg = process.argv.find(a => a.startsWith('--json='));
  if (jsonArg) fs.writeFileSync(jsonArg.slice(7), JSON.stringify(out, null, 1) + '\n');
  console.log(`threads=${out.threads} motion: noise>${NOISE} step>${STEP} cells>=${MIN_CELLS}`);
  console.log('key         at(ms)   enq  poll   deq  1stPres  moved  pres(deq..moved)  paint  baseFr noisy cells');
  for (const r of out.presses) {
    console.log(`${r.key.padEnd(10)} ${String(r.at).padStart(8)} ${String(r.enqMs).padStart(5)} ${String(r.firstPollAfterEnqMs).padStart(5)} ${String(r.deqMs).padStart(6)} ${String(r.firstPresentAfterDeqMs).padStart(7)} ${String(r.movedMs).padStart(6)} ${String(r.presentsDeqToMoved).padStart(8)}          ${String(r.paintMs).padStart(6)} ${String(r.baselineFrames).padStart(6)} ${String(r.noisyCells).padStart(5)} ${r.movedCells}`);
  }
  console.log(JSON.stringify(out.summary, null, 1));
}

module.exports = { analyse, parseLog };
