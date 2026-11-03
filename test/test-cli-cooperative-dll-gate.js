'use strict';
// Prepared statically. Run only after the explicit predecessor runtime releases.
// No timer releases a gate: the child is killed on failure, with evidence kept.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const { startControlSession } = require(path.join(root, 'test/control-session'));
const u32 = n => [n & 255, n >>> 8 & 255, n >>> 16 & 255, n >>> 24 & 255];
const M = 0x403000;
function image(code, dll, imports, strings = {}) {
  const b = Buffer.alloc(0x2400), p = 0x80, o = p + 24, s = o + 0xe0;
  b.writeUInt16LE(0x5a4d, 0); b.writeUInt32LE(p, 0x3c); b.writeUInt32LE(0x4550, p);
  b.writeUInt16LE(0x14c, p + 4); b.writeUInt16LE(1, p + 6); b.writeUInt16LE(0xe0, p + 20);
  b.writeUInt16LE(dll ? 0x210e : 0x010e, p + 22); b.writeUInt16LE(0x10b, o);
  b.writeUInt32LE(0x1000, o + 16); b.writeUInt32LE(dll ? 0x10000000 : 0x400000, o + 28);
  b.writeUInt32LE(0x1000, o + 32); b.writeUInt32LE(0x200, o + 36);
  b.writeUInt32LE(0x4000, o + 56); b.writeUInt32LE(0x200, o + 60);
  b.writeUInt16LE(3, o + 68); b.writeUInt32LE(0x100000, o + 72); b.writeUInt32LE(16, o + 92);
  b.write('.text', s); b.writeUInt32LE(0x3000, s + 8); b.writeUInt32LE(0x1000, s + 12);
  b.writeUInt32LE(0x2200, s + 16); b.writeUInt32LE(0x200, s + 20); b.writeUInt32LE(0xe0000060, s + 36);
  Buffer.from(code).copy(b, 0x200);
  if (imports.length) {
    b.writeUInt32LE(0x2000, o + 104); b.writeUInt32LE(40, o + 108);
    b.writeUInt32LE(0x2100, 0x1200); b.writeUInt32LE(0x2200, 0x120c); b.writeUInt32LE(0x2100, 0x1210);
    b.write('kernel32.dll\0', 0x1400);
    imports.forEach((name, i) => {
      const rva = 0x2240 + i * 64;
      b.writeUInt32LE(rva, 0x1300 + i * 4); b.write(name + '\0', rva - 0x1000 + 0x200 + 2);
    });
  }
  for (const [rva, value] of Object.entries(strings)) b.write(value + '\0', Number(rva) - 0x1000 + 0x200);
  return b;
}
function assembler() {
  const code = [], labels = {}, fixups = [];
  return {
    code, emit(...bytes) { code.push(...bytes); },
    label(name) { labels[name] = code.length; },
    branch(op, name) { code.push(...op); fixups.push([code.length, name]); code.push(0, 0, 0, 0); },
    done() { const b = Buffer.from(code); for (const [off, label] of fixups) b.writeInt32LE(labels[label] - off - 4, off); return b; },
  };
}
async function main() {
  const ordinary = process.argv.includes('--ordinary');
  const faultOwner = process.argv.includes('--fault-owner');
  const evidence = process.env.WA_CLI_DLL_GATE_ARTIFACTS || path.join(root, 'scratch/runs', 'cli-dll-gate-' + Date.now() + '-' + process.pid);
  fs.mkdirSync(evidence, { recursive: true });
  const dir = fs.mkdtempSync(path.join(evidence, 'fixture-'));
  const a = assembler(), emit = (...b) => a.emit(...b);
  // Load the real DLL, spawn a real cooperative thread, wait for its attach,
  // then request FreeLibrary while that callback still owns the gate.
  emit(0x68, ...u32(0x402600), 0xff, 0x15, ...u32(0x402100), 0xa3, ...u32(M + 20));
  for (const n of [0, 0, 0, 0x401200, 0, 0]) emit(0x68, ...u32(n));
  emit(0xff, 0x15, ...u32(0x402104), 0xa3, ...u32(M + 24));
  a.label('wait'); emit(0x83, 0x3d, ...u32(M + (ordinary ? 12 : 0)), 0); a.branch([0x0f, 0x84], 'wait');
  emit(0xff, 0x35, ...u32(M + 20), 0xff, 0x15, ...u32(0x402108), 0xa3, ...u32(M + 16));
  a.label('done'); emit(0xeb, 0xfe);
  const exe = image(a.done(), false, ['LoadLibraryA', 'CreateThread', 'FreeLibrary', 'ExitThread'], { 0x2600: 'owner.dll' });
  // Thread body uses the production ExitThread import, after its attach.
  Buffer.from([0xc7, 0x05, ...u32(M + 12), 1, 0, 0, 0, 0x6a, 77, 0xff, 0x15, ...u32(0x40210c)]).copy(exe, 0x400);
  const d = assembler();
  d.emit(0x53, 0x8b, 0x5c, 0x24, 8, 0x83, 0x7c, 0x24, 12, 2); d.branch([0x0f, 0x85], 'other');
  d.emit(0xc7, 0x05, ...u32(M), 1, 0, 0, 0);
  d.emit(0xff, 0x93, ...u32(0x2100), 0xa3, ...u32(M + 28)); // real owning thread id
  d.emit(0x8d, 0x83, ...u32(0x2600), 0x50, 0xff, 0x93, ...u32(0x2104), 0xa3, ...u32(M + 32));
  d.emit(0x50, 0xff, 0x93, ...u32(0x2108), 0xb9, ...u32(50000)); // nested owner load/unload
  d.label('loop'); d.emit(0x49); d.branch([0x0f, 0x85], 'loop');
  if (faultOwner) d.emit(0x0f, 0x0b); // real guest fault, retired by runSlice
  d.emit(0xc7, 0x05, ...u32(M + 4), 1, 0, 0, 0); d.branch([0xe9], 'return');
  d.label('other'); d.emit(0x83, 0x7c, 0x24, 12, 0); d.branch([0x0f, 0x85], 'return');
  // PROCESS_DETACH observes whether THREAD_ATTACH really finished first.
  d.emit(0xa1, ...u32(M + 4), 0xa3, ...u32(M + 8));
  d.label('return'); d.emit(0x5b, 0xb8, 1, 0, 0, 0, 0xc2, 12, 0);
  fs.writeFileSync(path.join(dir, 'owner.exe'), exe);
  fs.writeFileSync(path.join(dir, 'owner.dll'), image(d.done(), true,
    ['GetCurrentThreadId', 'LoadLibraryA', 'FreeLibrary'], { 0x2600: 'nested.dll' }));
  fs.writeFileSync(path.join(dir, 'nested.dll'), image([0xb8, 1, 0, 0, 0, 0xc2, 12, 0], true, []));
  if (process.argv.includes('--prepare')) { console.log(dir); return; }
  const session = startControlSession(['-r', path.join(__dirname, 'helpers/cli-dll-gate-observer.js'), 'test/run.js', '--exe=' + path.join(dir, 'owner.exe'),
    '--no-build', '--no-threads', '--frozen', '--control-stdin', '--batch-size=1000',
    '--thread-slices=1', '--stuck-after=0', '--max-seconds=15', '--quiet-api', '--quiet-blocks', '--trace-thread', '--trace-yield'], { cwd: root });
  const guard = setTimeout(() => session.child.kill('SIGKILL'), 20000);
  try {
    await session.send('ping');
    await session.step(150);
    const result = await session.send({ action: 'eval', code: `Array.from({length:9}, (_,i) => exports.guest_read32(${M}+i*4)>>>0)` });
    assert.deepEqual(result.slice(0, 5), faultOwner ? [1, 0, 0, 0, 1] : [1, 1, 1, 1, 1],
      faultOwner ? 'fault is not reported as completed attach, detach or thread body' : 'real attach completes before detach, thread body runs, FreeLibrary succeeds');
    assert(result[5] && result[6], 'real mapped module and thread handles');
    assert.equal(result[7], 2, 'callback runs as cooperative owner 2');
    assert(result[8], 'same-owner nested LoadLibrary returns a real mapping');
    const gate = await session.send({ action: 'eval', code: 'Array.from(new Int32Array(memory.buffer, exports.get_dll_callback_lock(),2))' });
    assert.deepEqual(gate, [0, 0], 'callback lifecycle releases its own gate');
    if (faultOwner) {
      assert.match(session.output(), /crashed/);
      const index = await session.send({ action: 'eval', code: `exports.get_dll_index(exports.guest_read32(${M + 20}))` });
      assert(index >= 0, 'faulted callback image retains its quarantine mapping');
      const pins = await session.send({ action: 'eval', code: `new DataView(memory.buffer).getUint32(exports.get_dll_lifecycle_table()+${index}*exports.get_dll_lifecycle_stride()+12,true)` });
      assert(pins > 0, 'faulted notification retains the real image pin');
    } else {
      assert.match(session.output(), /exited/);
      assert.match(session.output(), /"exitCode":77/, 'ExitThread is attributed to the real cooperative thread');
    }
    if (ordinary) assert.doesNotMatch(session.output(), /\[cli-gate\]/, 'ordinary scheduling has no gate contention');
    else assert.match(session.output(), /\[cli-gate\] \{"caller":1,"gate":\[2,1\]/, 'main really waits for cooperative owner 2');
    await session.quit();
    console.log('PASS production CLI schedules cooperative DLL owner while main FreeLibrary waits');
  } finally {
    clearTimeout(guard);
    if (session.child.exitCode === null && session.child.signalCode === null) session.child.kill('SIGKILL');
    fs.writeFileSync(path.join(dir, 'cli.log'), session.output());
    console.log('Fixture evidence: ' + dir);
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
