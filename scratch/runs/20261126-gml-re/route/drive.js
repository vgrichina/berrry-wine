#!/usr/bin/env node
// tl;dr: drive a frozen `test/run.js --control=PORT --frozen` Spelunky Classic
// session over HTTP (same /ctl protocol as tools/ctl.js).
//
//   node drive.js PORT to-tutorial OUTDIR     boot -> tutorial level (batch 29000)
//   node drive.js PORT cycles N [OUTDIR]      N run/jump/whip cycles (600 batches each)
//   node drive.js PORT eval 'CODE'            ctl eval, prints the value
//   node drive.js PORT step N
//
// Batch numbers and keys are the ones of the 20261125 gameplay-profile route
// (route.sh + cycle.sh there): Enter at 21000 and 22020, hold Left 25040-27440,
// Up 27740-27800, tutorial at ~29000; a cycle is Right+Z jump, X whip, Left+Z
// jump, X whip.
'use strict';
const http = require('http');
const path = require('path');
const [port, verb, ...rest] = process.argv.slice(2);
const url = new URL(`http://127.0.0.1:${port}/ctl`);

function post(body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const r = http.request({ host: url.hostname, port: url.port, path: url.pathname, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } }, res => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch (e) { reject(new Error(data)); } });
    });
    r.on('error', reject);
    r.setTimeout(0);
    r.end(payload);
  });
}
async function must(body) {
  const res = await post(body);
  if (!res.ok) throw new Error(`${JSON.stringify(body)} -> ${res.error}`);
  return res.value;
}
const step = n => must({ action: 'step', n });
const cmd = c => must({ cmd: c });
const png = f => cmd(`png:${path.resolve(f)}`);
const ev = code => must({ action: 'eval', code });

async function cycle(out, tag) {
  const p = async n => { if (out) await png(path.join(out, `${tag}-${n}.png`)); };
  await cmd('keydown:39'); await step(40); await cmd('keydown:90'); await step(20); await p('jumpR');
  await step(20); await cmd('keyup:90'); await step(70); await cmd('keyup:39');
  await step(20); await cmd('keydown:88'); await step(6); await p('whipR'); await step(24); await cmd('keyup:88'); await step(100);
  await cmd('keydown:37'); await step(40); await cmd('keydown:90'); await step(20); await p('jumpL');
  await step(20); await cmd('keyup:90'); await step(70); await cmd('keyup:37');
  await step(20); await cmd('keydown:88'); await step(6); await p('whipL'); await step(24); await cmd('keyup:88'); await step(100);
}

(async () => {
  if (verb === 'to-tutorial') {
    const out = rest[0];
    await step(21000); await png(path.join(out, 'b21000-intro.png'));
    await cmd('keydown:13'); await step(20); await cmd('keyup:13'); await step(1000);
    await cmd('keydown:13'); await step(20); await cmd('keyup:13'); await step(3000);
    await png(path.join(out, 'b25040-title.png'));
    await cmd('keydown:37'); await step(2400); await cmd('keyup:37'); await step(300);
    await png(path.join(out, 'b27740-start-door.png'));
    await cmd('keydown:38'); await step(60); await cmd('keyup:38'); await step(1200);
    await png(path.join(out, 'b29000-tutorial.png'));
    console.log('presents', await ev('instance.exports.d3d9_gps_stat(4)'));
  } else if (verb === 'cycles') {
    const n = parseInt(rest[0], 10) || 1;
    for (let i = 0; i < n; i++) await cycle(rest[1], `c${Date.now()}`);
    console.log('presents', await ev('instance.exports.d3d9_gps_stat(4)'));
  } else if (verb === 'eval') {
    const v = await ev(rest.join(' '));
    console.log(typeof v === 'string' ? v : JSON.stringify(v));
  } else if (verb === 'step') {
    await step(parseInt(rest[0], 10));
  } else {
    throw new Error('verb?');
  }
})().catch(e => { console.error(e.message); process.exit(1); });
