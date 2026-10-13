'use strict';

// Real guest LoadLibrary/FreeLibrary, imports, and callbacks. Internal export
// names intentionally differ from filenames. An occupied row shifts the
// physical rows away from the dependency-list indices before the cycle loads.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const crypto = require('node:crypto');
const { X86, pe, u32, BASE, DATA } = require('./test-dll-lifecycle-real-pe');
const ROOT = path.join(__dirname, '..');
const OUT = process.env.WA_DLL_GRAPH_ARTIFACTS || path.join(ROOT, 'scratch/dll-import-graph-lifecycle');
const ret = [0xb8, 1, 0, 0, 0, 0xc2, 12, 0];
const counters = { a: 0, b: 0x10, d: 0x20, c: 0x30, e: 0x40 };
const ids = { a: 1, b: 2, c: 3, e: 4, d: 5 };
function graphDll(name, dependency) {
  const a = new X86(), id = ids[name], offset = counters[name];
  a.emit(0x53, 0x8b, 0x5c, 0x24, 8, 0x8b, 0x44, 0x24, 12);
  a.emit(0xff, 0x04, 0x85, u32(DATA + offset));
  a.emit(0x83, 0xf8, 1).branch([0x0f, 0x84], 'attach');
  a.emit(0x85, 0xc0).branch([0x0f, 0x85], 'done');
  a.eaxFrom(0x50).emit(0xc7, 0x04, 0x85, u32(DATA + 0x54), u32(id));
  a.emit(0xff, 0x05, u32(DATA + 0x50)).branch(0xe9, 'peer');
  a.label('attach').eaxFrom(0xdc).emit(0xc7, 0x04, 0x85, u32(DATA + 0xe0), u32(id));
  a.emit(0xff, 0x05, u32(DATA + 0xdc));
  a.label('peer');
  if (dependency) {
    // Called during both attach and detach. A cyclic peer must remain mapped
    // even if its own process-detach callback has already returned.
    a.emit(0xff, 0x93, u32(0x1c40), 0x3d, u32(100 + ids[dependency]));
    a.branch([0x0f, 0x84], 'done').store(0x7c, id);
  }
  a.label('done').emit(0x5b, ...ret);
  const image = pe([[0x1000, a.finish()], [0x1250, [0xb8, 100 + id, 0, 0, 0, 0xc3]]], true);
  const raw = rva => rva - 0x1000 + 0x200, o = 0x80 + 24;
  if (dependency) {
    image.writeUInt32LE(0x1c00, raw(0x1814)); image.writeUInt32LE(0x1c80, raw(0x1820));
    image.writeUInt32LE(0x1c40, raw(0x1824)); image.writeUInt32LE(60, o + 108);
    image.writeUInt32LE(0x1cc0, raw(0x1c00)); image.writeUInt32LE(0x1cc0, raw(0x1c40));
    image.write('graph-' + dependency + '.dll\0', raw(0x1c80)); image.write('Ping\0', raw(0x1cc2));
  }
  image.writeUInt32LE(0x1f00, o + 96); image.writeUInt32LE(0xb0, o + 100);
  image.writeUInt32LE(0x1f60, raw(0x1f0c)); image.writeUInt32LE(1, raw(0x1f10));
  image.writeUInt32LE(1, raw(0x1f14)); image.writeUInt32LE(1, raw(0x1f18));
  image.writeUInt32LE(0x1f40, raw(0x1f1c)); image.writeUInt32LE(0x1f44, raw(0x1f20));
  image.writeUInt32LE(0x1f48, raw(0x1f24)); image.writeUInt32LE(0x1250, raw(0x1f40));
  image.writeUInt32LE(0x1f90, raw(0x1f44)); image.write('internal-alias.dll\0', raw(0x1f60));
  image.write('Ping\0', raw(0x1f90));
  return image;
}
function program() {
  const a = new X86();
  const load = rva => a.push(BASE + rva).api('LoadLibraryA').emit(0x85, 0xc0).branch([0x0f, 0x84], 'missing');
  const free = offset => a.emit(0xff, 0x35, u32(DATA + offset)).api('FreeLibrary').checkEax(1);
  load(0x1500); a.eaxTo(0xa0); // occupied no-entry row
  load(0x1520); a.eaxTo(0xa4); // A -> B -> A cycle
  load(0x1540); a.eaxTo(0xa8); // second root in the cycle
  a.checkMem(4, 1).checkMem(0x14, 1).checkMem(0x7c, 0);
  free(0xa4); a.checkMem(0, 0).checkMem(0x10, 0);
  free(0xa8); a.checkMem(0, 1).checkMem(0x10, 1).checkMem(0x50, 2).checkMem(0x7c, 0);
  a.eaxFrom(0x54).emit(0x3b, 0x05, u32(DATA + 0xe4)).branch([0x0f, 0x85], 'order');
  a.eaxFrom(0x58).emit(0x3b, 0x05, u32(DATA + 0xe0)).branch([0x0f, 0x85], 'order');
  a.push(BASE + 0x1520).api('GetModuleHandleA').checkEax(0);
  a.push(BASE + 0x1540).api('GetModuleHandleA').checkEax(0);
  load(0x1560); a.eaxTo(0xac); // C -> D
  load(0x1580); a.eaxTo(0xb0); // E -> same D
  a.checkMem(0x24, 1).checkMem(0x34, 1).checkMem(0x44, 1);
  free(0xac); a.checkMem(0x30, 1).checkMem(0x20, 0).checkMem(0x40, 0);
  a.push(BASE + 0x15a0).api('GetModuleHandleA').emit(0x85, 0xc0).branch([0x0f, 0x84], 'missing');
  free(0xb0); a.checkMem(0x40, 1).checkMem(0x20, 1).checkMem(0x7c, 0);
  a.checkMem(0x50, 5).checkMem(0x5c, 3).checkMem(0x60, 4).checkMem(0x64, 5);
  a.push(BASE + 0x15a0).api('GetModuleHandleA').checkEax(0);
  free(0xa0); a.store(0x80, 0x6a4f17a1).push(0).api('ExitProcess').emit(0xcc);
  a.label('missing').push(201).api('ExitProcess').emit(0xcc);
  a.label('order').push(202).api('ExitProcess').emit(0xcc);
  const code = a.finish(); assert(code.length < 0x1000);
  return pe([[0x2000, code], [0x1500, 'keeper.dll\0'], [0x1520, 'graph-a.dll\0'],
    [0x1540, 'graph-b.dll\0'], [0x1560, 'graph-c.dll\0'], [0x1580, 'graph-e.dll\0'], [0x15a0, 'graph-d.dll\0']]);
}
function prepare() {
  fs.mkdirSync(OUT, { recursive: true });
  const keeper = pe([], true); keeper.writeUInt32LE(0, 0x80 + 24 + 16);
  const files = { 'graph.exe': program(), 'keeper.dll': keeper, 'graph-a.dll': graphDll('a', 'b'),
    'graph-b.dll': graphDll('b', 'a'), 'graph-c.dll': graphDll('c', 'd'),
    'graph-e.dll': graphDll('e', 'd'), 'graph-d.dll': graphDll('d') };
  const hashes = {};
  for (const [name, bytes] of Object.entries(files)) {
    fs.writeFileSync(path.join(OUT, name), bytes);
    hashes[name] = crypto.createHash('sha256').update(bytes).digest('hex');
  }
  fs.writeFileSync(path.join(OUT, 'fixtures.json'), JSON.stringify(hashes, null, 2));
}
module.exports = { graphDll };
if (require.main === module) {
prepare();
if (!process.argv.includes('--prepare')) {
  const results = [];
  for (const mode of ['no-threads', 'threads']) {
    const args = ['test/run.js', `--exe=${path.join(OUT, 'graph.exe')}`, '--no-build',
      `--wasm=${process.env.WA_TEST_WASM || path.join(ROOT, 'build/wine-assembly.wasm')}`,
      `--${mode}`, '--quiet-api', '--quiet-blocks', '--max-seconds=15', '--dump=0x401480:4'];
    const run = cp.spawnSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8', timeout: 25000, detached: true, maxBuffer: 4e6 });
    let absent = false;
    try { process.kill(-run.pid, 'SIGKILL'); } catch (e) { if (e.code !== 'ESRCH') throw e; absent = true; }
    const output = (run.stdout || '') + (run.stderr || '');
    fs.writeFileSync(path.join(OUT, mode + '.log'), output);
    results.push({ mode, pid: run.pid, status: run.status, signal: run.signal, groupAbsent: absent,
      passed: run.status === 0 && /\[Exit\] code=0\b/.test(output) && /401480[^\n]*a1 17 4f 6a/i.test(output) });
    fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(results, null, 2));
  }
  assert(results.every(r => r.passed), 'Guest import graph assertions failed; see saved logs');
  console.log('PASS real PE import cycles, independent roots, shared dependency, reverse detach and cyclic peer execution');
} else console.log('Prepared real PE import graph fixtures in ' + OUT);

}
