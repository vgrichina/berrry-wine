#!/usr/bin/env node
'use strict';
// Offline PE/disassembly/ABI and harness controls. Never launches run.js or WASM.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { fixtures, KINDS, parseArgs, runnerArgs, checkSuccess } =
  require('../../test-edit-winhelp-callback-native');
const dir = path.resolve(process.argv[2] || '');
assert(process.argv[2], 'usage: node validate.js EVIDENCE_DIRECTORY');
fs.mkdirSync(dir, { recursive: true });
function disasm(bytes, name) {
  const file = path.join(dir, `${name}.bin`);
  fs.writeFileSync(file, bytes);
  const r = spawnSync('objdump', ['-D', '-b', 'binary', '-m', 'i386', '-Mintel', file],
    { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  fs.writeFileSync(path.join(dir, `${name}.asm`), r.stdout);
  assert.doesNotMatch(r.stdout, /\(bad\)|\.byte/);
  const ins = [];
  for (const line of r.stdout.split('\n')) {
    const m = /^\s*([0-9a-f]+):\s+(?:[0-9a-f]{2} )+\s+([a-z][a-z0-9]*)\s*(.*)$/.exec(line);
    if (m) ins.push({ at: parseInt(m[1], 16), op: m[2], arg: m[3].trim() });
  }
  assert(ins.length > 10);
  return ins;
}
function imports(pe) {
  const off = rva => rva - 0x1000 + 0x200;
  assert.equal(pe.readUInt16LE(0x84), 0x14c);
  assert.equal(pe.readUInt16LE(0x98), 0x10b);
  assert.equal(pe.readUInt32LE(0xa8), 0x2000);
  const result = new Map();
  for (let desc = off(pe.readUInt32LE(0x100)); pe.readUInt32LE(desc); desc += 20) {
    const oft = pe.readUInt32LE(desc), iat = pe.readUInt32LE(desc + 16);
    for (let i = 0; pe.readUInt32LE(off(oft) + i * 4); i++) {
      const p = off(pe.readUInt32LE(off(oft) + i * 4)) + 2;
      result.set(0x400000 + iat + i * 4, pe.toString('ascii', p, pe.indexOf(0, p)));
    }
  }
  assert.deepEqual([...result.values()].sort(),
    ['CreateWindowExA', 'SendMessageA', 'WinHelpA', 'ExitProcess'].sort());
  return result;
}
function abi(ins, iat, cleanup) {
  const byOffset = new Map(ins.map((x, i) => [x.at, i]));
  const depthAt = new Map(), todo = [[0, 0]], calls = new Set();
  let returns = 0, exits = 0;
  while (todo.length) {
    const [i, depth] = todo.pop();
    assert(i >= 0 && i < ins.length, 'CFG stays within emitted instructions');
    if (depthAt.has(i)) {
      assert.equal(depthAt.get(i), depth, 'stack depth agrees at CFG join');
      continue;
    }
    depthAt.set(i, depth);
    const { op, arg } = ins[i];
    let nextDepth = depth;
    if (op === 'push') nextDepth += 4;
    if (op === 'pop') nextDepth -= 4;
    if (op === 'call') {
      const addr = /ds:0x([a-f0-9]+)/.exec(arg);
      assert(addr, 'calls must be public import IAT indirections');
      const name = iat.get(parseInt(addr[1], 16));
      assert(name, 'call targets resolved import slot');
      calls.add(name);
      nextDepth -= { CreateWindowExA: 48, SendMessageA: 16, WinHelpA: 16, ExitProcess: 4 }[name];
      if (name === 'ExitProcess') { assert.equal(nextDepth, 0); exits++; continue; }
    }
    assert(nextDepth >= 0, 'no stack underflow');
    if (op === 'ret') {
      assert.equal(nextDepth, 0, 'callback balances its own stack');
      assert.equal(Number(arg), cleanup, 'stdcall callback argument cleanup');
      returns++; continue;
    }
    if (op.startsWith('j')) {
      const target = Number(arg);
      assert(byOffset.has(target), `branch lands on instruction ${arg}`);
      todo.push([byOffset.get(target), nextDepth]);
      if (op === 'jmp') continue;
    }
    todo.push([i + 1, nextDepth]);
  }
  assert(cleanup ? returns > 0 : exits > 0);
  return { instructions: ins.length, reachable: depthAt.size, calls: [...calls], returns, exits };
}
const results = [];
for (const kind of KINDS) {
  const f = fixtures(kind), iat = imports(f.exe);
  assert(f.exeCode.length < 0x2000, 'EXE code cannot overlap callback at RVA4000');
  assert(f.editCode.length < 0x1000, 'callback cannot overlap data at RVA5000');
  assert(f.exe.subarray(0x4200).every(b => b === 0), 'observation data initially zero');
  const exe = disasm(f.exeCode, `${kind}-exe`);
  const edit = disasm(f.editCode, `${kind}-edit`);
  const dll = disasm(f.dllCode, `${kind}-dll`);
  const result = { kind, exe: abi(exe, iat, 0), edit: abi(edit, iat, 16), dll: abi(dll, iat, 8) };
  for (const offset of ['0x4', '0x8', '0xc', '0x10'])
    assert(edit.some(x => x.arg.includes(`[esp+${offset}]`)), `EDITSTREAM ABI ${offset}`);
  assert(dll.some(x => x.arg.includes('[esp+0x8]')), 'second WinHelp argument');
  assert(edit.some(x => x.op === 'mov' && x.arg === 'BYTE PTR [ecx],0x58'));
  // Prove ABI validator rejects an incorrect callback pop and bad IAT.
  assert.throws(() => abi(edit.map(x => x.op === 'ret' ? { ...x, arg: '0xc' } : x), iat, 16));
  assert.throws(() => abi(exe, new Map(), 0));
  results.push(result);
}
const badArgs = [[], ['--wat=x'], ['--generate-only='], ['--case=bad'],
  ['--generate-only=x', '--generate-only=y'], ['--generate-only=x', '--wasm=x'],
  ['--artifacts=x', '--wasm=x', '--source=abc', '--sha256=abc']];
for (const args of badArgs) assert.throws(() => parseArgs(args));
assert.equal(parseArgs(['--generate-only=x', '--case=edit-nested']).case, 'edit-nested');
const opts = parseArgs(['--artifacts=x', '--wasm=x', `--source=${'a'.repeat(40)}`,
  `--sha256=${'b'.repeat(64)}`]);
assert.equal(opts.artifacts, 'x');
const args = runnerArgs({ exe: '/tmp/f.exe', overlay: '/tmp/overlay' }, '/tmp/pinned.wasm');
for (const flag of ['--no-build', '--wasm=/tmp/pinned.wasm', '--no-renderer',
  '--max-seconds=120', '--max-batches=4000', '--dump=0x405000:1024'])
  assert(args.includes(flag), `runner flag ${flag}`);
// A success exit without observations must never be counted as qualification.
for (const kind of KINDS) {
  assert.throws(() => checkSuccess('[Exit] code=0\n', kind));
  assert.throws(() => checkSuccess('*** CRASH\n', kind));
}
// Synthetic log controls validate the assertion reader only. These are never
// persisted as run.log or counted as guest execution.
function oracleBytes(kind) {
  const b = Buffer.alloc(1024), put = (off, value) => b.writeUInt32LE(value >>> 0, off);
  const help = kind.startsWith('help-'), failed = ['edit-error', 'edit-timeout'].includes(kind);
  put(0, 1); put(4, 2); put(8, kind === 'edit-error' ? 123 : kind === 'edit-timeout' ? 1 : 0);
  put(12, failed ? 0 : 1); put(16, 70); put(20, 70);
  put(28, 0x51ac0ffe); put(32, 0xc001c0de);
  put(36, kind.endsWith('timeout') ? 0x71ae0001 : 0);
  put(0x38, 4095); put(0x3c, kind.endsWith('nested') ? 73 : 72);
  put(0x88, failed ? 143 : 144); put(0x98, kind.endsWith('nested') ? 2 : 0);
  put(0xa0, 71); put(0xa4, 0x1047);
  put(0xa8, kind.endsWith('timeout') ? 0 : 0x1234);
  put(0xac, kind.endsWith('timeout') ? 0 : 0x2234);
  put(0x300, failed ? 0 : 0x58);
  for (const [off, seed, result] of [[0x100, 0x11000000, help || !failed ? 1 : 0],
    [0x140, 0x22000000, 1], [0x200, 0x33000000, 1]]) {
    for (const reg of [1, 2, 3, 5, 6, 7]) {
      put(off + reg * 4, seed + reg * 0x101);
      put(off + 32 + reg * 4, seed + reg * 0x101);
    }
    put(off + 16, 0x740f000); put(off + 48, 0x740f000); put(off + 32, result);
  }
  return b;
}
function syntheticLog(b) {
  const lines = ['[Exit] code=0'];
  for (let i = 0; i < b.length; i += 16)
    lines.push(`  0x${(0x405000 + i).toString(16)}  ${[...b.subarray(i, i + 16)]
      .map(v => v.toString(16).padStart(2, '0')).join(' ')} `);
  return lines.join('\n');
}
let oracleNegatives = 0;
for (const kind of KINDS) {
  const b = oracleBytes(kind);
  checkSuccess(syntheticLog(b), kind);
  for (const off of [0x120, 0x124, 0x128, 0x12c, 0x130, 0x134, 0x138, 0x13c, 16, 20, 28, 32]) {
    const changed = Buffer.from(b);
    changed[off] ^= 1;
    assert.throws(() => checkSuccess(syntheticLog(changed), kind), `oracle detects ${kind}/${off}`);
    oracleNegatives++;
  }
}
fs.writeFileSync(path.join(dir, 'validation.json'), JSON.stringify({
  status: 'PASS', qualification: 'OFFLINE ONLY; no x86/VM execution',
  cases: results, argumentNegatives: badArgs.length, abiNegatives: 14, missingEvidenceNegatives: 14,
  syntheticOraclePositives: 7, syntheticOracleNegatives: oracleNegatives,
}, null, 2));
console.log('PASS: seven generated cases, disassembly CFG/ABI, 7 argument negatives, 14 ABI negatives, 14 missing-evidence negatives, 7 synthetic log positives/84 negatives. Native UNEXECUTED.');
