#!/usr/bin/env node
'use strict';

// Native disassembly of the microbench modules, through tools/wasm-native.js.
//
//   node tools/wat-microbench/native.js --mods=DIR --out=DIR \
//       [--ids=regs.wide.mem,regs.wide.local] [--engines=sm-ion,sm-baseline,v8-tf]
//
// For each module id and engine it saves the full disassembly of the hot
// function -- `$run` (the loop), or for the per-op-function engines one
// representative handler (`$th_ADD` threaded, `$ci_ADD` call_indirect) --
// under OUT/native/<arch>/<engine>/<id>.<func>.txt, and writes
// OUT/native/<arch>/metrics.json with structural counts per function:
// instructions, instructions touching memory, stack-relative (spill/frame)
// accesses, calls and indirect jumps. Counts are static (whole function,
// cold paths included) -- read them for shape, and the profile-free timing
// in run.js for cost. Host arch only: run it on each machine.
// Needs what wasm-native.js needs (SM / D8 shells, GNU objdump; on Linux set
// OBJDUMP=/usr/bin/objdump).

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = /^--([^=]+)(?:=(.*))?$/.exec(a); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const ROOT = path.join(__dirname, '..', '..');
const modsDir = path.resolve(args.mods || 'scratch/wat-microbench/mods');
const outDir = path.resolve(args.out || path.join(modsDir, '..', 'results'));
const engines = String(args.engines || 'sm-ion,sm-baseline,v8-tf').split(',');
const manifest = JSON.parse(fs.readFileSync(path.join(modsDir, 'manifest.json'), 'utf8'));
const ids = args.ids ? String(args.ids).split(',') : manifest.filter((m) => !m.copyOf).map((m) => m.id);

const hotFunc = (id) => (/\.threaded$/.test(id) ? ['$th_ADD', '$run'] : /\.callind-loop$/.test(id) ? ['$ci_ADD', '$run'] : ['$run']);

function metrics(text) {
  const lines = text.split('\n').filter((l) => /^\s+[0-9a-f]+:\s/.test(l));
  const arm = process.arch === 'arm64';
  const m = { insns: lines.length, mem: 0, stack: 0, calls: 0, indirectJumps: 0 };
  for (const l of lines) {
    const ins = l.replace(/^\s+[0-9a-f]+:\s+[0-9a-f ]+\t/, '');
    if (arm) {
      if (/\[/.test(ins)) m.mem++;
      if (/\[(sp|x29)\b/.test(ins)) m.stack++;
      if (/^\s*(bl|blr)\b/.test(ins)) m.calls++;
      if (/^\s*br\b/.test(ins)) m.indirectJumps++;
    } else {
      if (/\(%/.test(ins)) m.mem++;
      if (/\(%(rsp|rbp)\)|0x[0-9a-f]+\(%(rsp|rbp)\)|-?0x[0-9a-f]+\(%r(s|b)p/.test(ins)) m.stack++;
      if (/^\s*call/.test(ins)) m.calls++;
      if (/^\s*jmp\s+\*/.test(ins)) m.indirectJumps++;
    }
  }
  return m;
}

const arch = process.arch;
const base = path.join(outDir, 'native', arch);
fs.mkdirSync(base, { recursive: true });
const metricsPath = path.join(base, 'metrics.json');
const all = fs.existsSync(metricsPath) ? JSON.parse(fs.readFileSync(metricsPath, 'utf8')) : {};
for (const e of engines) {
  const dir = path.join(base, e);
  fs.mkdirSync(dir, { recursive: true });
  const ea = e === 'v8-tf' ? ['--engine=v8'] : ['--engine=sm', `--tier=${e === 'sm-baseline' ? 'baseline' : 'ion'}`];
  for (const id of ids) {
    for (const fn of hotFunc(id)) {
      const r = spawnSync(process.execPath, [path.join(ROOT, 'tools/wasm-native.js'), ...ea,
        `--wasm=${path.join(modsDir, id + '.wasm')}`, `--wat=${path.join(modsDir, id + '.wat')}`, `--func=${fn}`, '--limit=100000'],
      { encoding: 'utf8', maxBuffer: 1 << 26 });
      const text = (r.stdout || '') + (r.status ? '\nERROR ' + (r.stderr || '') : '');
      fs.writeFileSync(path.join(dir, `${id}.${fn.slice(1)}.txt`), text);
      const key = `${id}|${fn}|${e}`;
      all[key] = r.status ? { error: (r.stderr || '').trim().split('\n')[0] } : metrics(text);
      console.log(`${arch} ${e.padEnd(12)} ${(id + ' ' + fn).padEnd(44)} ${JSON.stringify(all[key])}`);
    }
  }
}
fs.writeFileSync(metricsPath, JSON.stringify(all, null, 1));
