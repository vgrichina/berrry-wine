'use strict';
// Source isolation and actual authority/client Workers, with finite independent
// process-group deadlines. No original game or private gameplay state.
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
if (process.argv[2] === '--emit-native-fixture') {
  const fs = require('node:fs');
  const b = require('../tools/kernel32-native-fixture').makeFixture();
  const raw = rva => rva - 0x1000 + 0x200, base = 0x400000;
  // Replace the fixture's imports and entry point with an ordinary finite PE:
  // real visible STATIC window, two native guest Workers, public waits, exit.
  const groups = [['kernel32.dll', ['CreateThread', 'WaitForSingleObject', 'Sleep', 'ExitProcess', 'OutputDebugStringA']],
    ['user32.dll', ['CreateWindowExA']]];
  b.fill(0, raw(0x1100), raw(0x1200)); // no fixture export directory
  b.writeUInt32LE(0, 0x80 + 24 + 96); b.writeUInt32LE(0, 0x80 + 24 + 100);
  b.fill(0, raw(0x1800), raw(0x2000));
  let names = 0x1b00; const iat = {};
  groups.forEach(([dll, apis], g) => {
    const desc = raw(0x1800 + 20 * g), table = 0x1900 + g * 64;
    b.writeUInt32LE(table, desc); b.writeUInt32LE(0x1880 + g * 32, desc + 12);
    b.writeUInt32LE(table, desc + 16); b.write(dll + '\0', raw(0x1880 + g * 32));
    apis.forEach((name, i) => {
      b.writeUInt32LE(names, raw(table + i * 4)); b.write(name + '\0', raw(names) + 2);
      iat[name] = base + table + i * 4; names += name.length + 3;
    });
  });
  b.writeUInt32LE(60, 0x80 + 24 + 108);
  const u32 = n => { const v = Buffer.alloc(4); v.writeUInt32LE(n >>> 0); return [...v]; };
  const code = [], push = n => code.push(0x68, ...u32(n));
  const call = name => code.push(0xff, 0x15, ...u32(iat[name]));
  const str = (rva, text) => { b.write(text + '\0', raw(rva)); return base + rva; };
  const klass = str(0x1d00, 'STATIC'), title = str(0x1d20, 'Finite threaded desktop startup fixture');
  const marker = str(0x1d70, 'FINITE_NATIVE_TWO_WORKERS_COMPLETE');
  for (const n of [0,0,0,0,120,320,20,20,0x10000000,title,klass,0]) push(n);
  call('CreateWindowExA');
  for (const slot of [0x1e00, 0x1e04]) {
    for (const n of [0,0,0,base+0x2200,0,0]) push(n);
    call('CreateThread'); code.push(0xa3, ...u32(base + slot));
  }
  for (const slot of [0x1e00, 0x1e04]) {
    push(0xffffffff); code.push(0xff,0x35,...u32(base + slot)); call('WaitForSingleObject');
  }
  push(marker); call('OutputDebugStringA'); push(0); call('ExitProcess');
  Buffer.from(code).copy(b, raw(0x2000));
  Buffer.from([0x68,...u32(5),0xff,0x15,...u32(iat.Sleep),0x31,0xc0,0xc2,4,0]).copy(b,raw(0x2200));
  fs.writeFileSync(process.argv[3], b);
  process.exit(0);
}
(async () => {
  const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process');
  const root = process.cwd(), sup = require(path.join(root, 'tools/lmarbles-supervisor.cjs'));
  const c = require(path.join(root, 'tools/native-supervisor-common.cjs'));
  const sha = c.sha256;
  const files = new Map(), todo = ['lib/process-desktop.js'];
  while (todo.length) {
    const name = todo.pop();
    if (files.has(name)) continue;
    const body = fs.readFileSync(path.join(root, name)); files.set(name, body);
    for (const m of body.toString('latin1').matchAll(/require\(['"](\.[^'"]+)['"]\)/g)) {
      const base = path.normalize(path.join(path.dirname(name), m[1]));
      for (const suffix of ['', '.js', '.json', '/index.js']) {
        if (fs.statSync(path.join(root, base + suffix), { throwIfNoEntry: false })?.isFile()) { todo.push(base + suffix); break; }
      }
    }
  }
  const rows = [...files.keys()].sort().map(n => ({ path: n, sha256: sha(files.get(n)), body: files.get(n).toString('base64') }));
  const [packed, pin] = sup.indexedSource(rows);
  const code = "const fs=require('node:fs');const {ProcessDesktop}=require('./lib/process-desktop');(async()=>{const d=new ProcessDesktop();try{d.call({op:'snapshot'});console.log('HELLO')}finally{await d.close()}})().catch(e=>{console.error(e);process.exitCode=1});";
  async function run(label, { body = packed, indexPin = pin, program = code, module = Buffer.alloc(0), modulePin = null } = {}) {
    const source = sup.seal('startup-test-source', body), wasm = sup.seal('startup-test-module', module);
    const fdp = fd => process.platform === 'linux' ? '/proc/self/fd/' + fd : c.fdPath(fd);
    const env = { ...process.env, NODE_OPTIONS: '--require=' + path.join(root, 'tools/lmarbles-native-source-view.cjs'),
      LMARBLES_SOURCE_FD: fdp(source), LMARBLES_SOURCE_INDEX_SHA256: indexPin,
      LMARBLES_MODULE_FD: fdp(wasm), LMARBLES_MODULE_SHA256: modulePin || sha(module) };
    const p = cp.spawn(process.execPath, ['-e', program], { env, stdio: c.stdioWithFds([source, wasm]), detached: true });
    const fired = [];
    const timer = setTimeout(() => { fired.push(true); try { process.kill(-p.pid, 'SIGKILL'); } catch (e) { if (e.code !== 'ESRCH') throw e; } }, 12000);
    let r;
    try { r = await c.communicate(p); } finally { clearTimeout(timer); fs.closeSync(source); fs.closeSync(wasm); }
    assert(!fired.length, label + ': independent watchdog expired');
    return [r.returncode, r.stdout.toString(), r.stderr.toString()];
  }
  let rc, a, b;
  for (let i = 0; i < 3; i++) { [rc, a, b] = await run('cold-workers'); assert(rc === 0 && a.includes('HELLO'), JSON.stringify([rc, a, b])); }
  console.log('PASS three cold authority/client Worker handshakes and closure');
  [rc, a, b] = await run('index-tamper', { indexPin: '0'.repeat(64) }); assert(rc !== 0 && b.includes('sealed source index differs'));
  const size = packed.readUInt32LE(0), index = JSON.parse(packed.subarray(4, 4 + size));
  const entry = index.files.find(r => r.path === 'lib/process-desktop.js');
  const bad = Buffer.from(packed); bad[4 + size + entry.offset] ^= 1;
  [rc, a, b] = await run('source-tamper', { body: bad }); assert(rc !== 0 && b.includes('sealed source digest differs'));
  const missing = rows.filter(r => r.path !== 'lib/process-desktop.js'); const [blob, p] = sup.indexedSource(missing);
  [rc, a, b] = await run('missing-source', { body: blob, indexPin: p }); assert(rc !== 0 && b.includes('unsealed runtime input'));
  for (const method of ["fs.readFileSync('lib/process-desktop.js')", "fs.readFile('lib/process-desktop.js',(e)=>{if(e)throw e})", "fs.promises.readFile('lib/process-desktop.js')", "fs.createReadStream('lib/process-desktop.js')"]) {
    [rc, a, b] = await run('tampered-read', { body: bad, program: "const fs=require('node:fs');" + method }); assert(rc !== 0 && b.includes('sealed source digest differs'));
  }
  [rc, a, b] = await run('module-tamper', { module: Buffer.from('bad'), modulePin: '0'.repeat(64), program: "require('node:fs').readFileSync('build/wine-assembly.wasm')" });
  assert(rc !== 0 && b.includes('sealed module differs'));
  console.log('PASS missing/tampered index/source/module and sync/async/promise/stream fail-closed controls');
})().catch(e => { console.error(e); process.exitCode = 1; });
