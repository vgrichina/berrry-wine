'use strict';
// Blood II preparation only. Resolution and Worker loading use the unchanged
// production sealed-source loader; no runtime request can select live sources.
const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process');
const assert = require('node:assert/strict');
const c = require('./native-supervisor-common.cjs');
const { indexedSource } = require('./lmarbles-supervisor.cjs');
const root = path.resolve(__dirname, '..');
function collect(extra = [], { codec = true, revision = null, media = [] } = {}) {
  const prefixes = ['lib', 'host.js', 'test/run.js', 'src/api_table.json', 'src/win16-ordinals.generated.json', 'fonts', 'tools'];
  const git = args => cp.execFileSync('git', args, { cwd: root, maxBuffer: 32e6 });
  const tracked = new Set(revision ? git(['ls-tree', '-r', '--name-only', revision]).toString().trim().split('\n') : []);
  const names = (revision ? [...tracked].filter(n => prefixes.some(p => n === p || n.startsWith(p + '/')))
    : git(['ls-files', ...prefixes]).toString().trim().split('\n')).filter(n => /\.(js|cjs|json)$/.test(n));
  names.push(...extra, 'test/candidate-corpus/manifest.json');
  const blobs = new Map();
  if (revision) {
    const batchNames = [...new Set(names.filter(n => tracked.has(n)))];
    const batch = cp.execFileSync('git', ['cat-file', '--batch'], { cwd: root,
      input: batchNames.map(n => revision + ':' + n + '\n').join(''), maxBuffer: 64e6 });
    let offset = 0;
    for (const name of batchNames) {
      const end = batch.indexOf(10, offset), header = batch.subarray(offset, end).toString().split(' ');
      assert.equal(header[1], 'blob', name); const size = Number(header[2]);
      blobs.set(name, batch.subarray(end + 1, end + 1 + size)); offset = end + 2 + size;
    }
    assert.equal(offset, batch.length);
  }
  const read = file => {
    if (revision && tracked.has(file)) {
      if (!blobs.has(file)) blobs.set(file, git(['show', revision + ':' + file]));
      return blobs.get(file);
    }
    return fs.readFileSync(path.join(root, file));
  };
  // Include current untracked runtime modules, with their bytes in the same
  // inventory and recovery patch as tracked dirty inputs.
  if (!revision) names.push(...fs.readdirSync(path.join(root, 'lib')).filter(n => /\.(js|json)$/.test(n)).map(n => 'lib/' + n));
  if (codec) {
    const base = 'node_modules/pngjs';
    assert(fs.statSync(path.join(root, base, 'package.json')).isFile(), 'missing pngjs package');
    for (const n of fs.readdirSync(path.join(root, base), { recursive: true })) {
      const file = path.join(base, n);
      if (/\.(js|json)$/.test(file) && fs.statSync(path.join(root, file)).isFile()) names.push(file);
    }
  }
  const selected = new Set(names);
  for (let i = 0; i < names.length; i++) {
    const file = names[i], body = read(file).toString('latin1');
    for (const m of body.matchAll(/require\(['"](\.[^'"]+)['"]\)/g)) {
      const base = path.join(path.dirname(file), m[1]);
      for (const suffix of ['', '.js', '.cjs', '.json', '/index.js']) {
        const n = path.normalize(base + suffix);
        if ((revision ? tracked.has(n) || n.startsWith('node_modules/') && fs.statSync(path.join(root, n), { throwIfNoEntry: false })?.isFile()
          : fs.statSync(path.join(root, n), { throwIfNoEntry: false })?.isFile())) {
          if (!selected.has(n)) { selected.add(n); names.push(n); }
          break;
        }
      }
    }
  }
  const rows = new Map([...selected].sort().map(file => {
    assert(!revision || tracked.has(file) || file.startsWith('node_modules/'), 'unpinned non-Git input: ' + file);
    const b = read(file); return [file, { path: file, sha256: c.sha256(b), body: b.toString('base64') }];
  }));
  // Explicit media pins are a separate input class, never a live-source
  // fallback. In particular the ignored game manifest survives Git selection.
  for (const pin of media) {
    assert(!path.isAbsolute(pin.path) && !pin.path.split('/').includes('..'));
    assert(!rows.has(pin.path), 'duplicate media input: ' + pin.path);
    const b = fs.readFileSync(path.join(root, pin.path));
    assert.equal(b.length, pin.size, pin.path); assert.equal(c.sha256(b), pin.sha256, pin.path);
    rows.set(pin.path, { path: pin.path, sha256: pin.sha256, body: b.toString('base64') });
  }
  return [...rows.values()].sort((a, b) => a.path.localeCompare(b.path));
}
function freeze(rows, module) {
  const [packed, indexSHA256] = indexedSource(rows);
  const source = c.seal('blood2-source', packed), wasm = c.seal('blood2-module', module);
  const env = { ...process.env, NODE_OPTIONS: '--require=' + path.join(root, 'tools/lmarbles-native-source-view.cjs'),
    LMARBLES_SOURCE_FD: '/proc/self/fd/' + source, LMARBLES_MODULE_FD: '/proc/self/fd/' + wasm,
    LMARBLES_SOURCE_INDEX_SHA256: indexSHA256, LMARBLES_MODULE_SHA256: c.sha256(module) };
  return Object.freeze({ env: Object.freeze(env), fds: Object.freeze([source, wasm]), sourceSHA256: c.sha256(packed), indexSHA256,
    inventory: Object.freeze(rows.map(r => Object.freeze({ path: r.path, sha256: r.sha256, size: Buffer.from(r.body, 'base64').length }))),
    close() { fs.closeSync(source); fs.closeSync(wasm); } });
}
// Read-only mount audit. No PE loader, Wasm instantiation or guest instruction
// is invoked. Both processes resolve the real registry and all bytes through
// the exact sealed view subsequently inherited by the original.
function gameInputPreflight(frozen, { appId = 'blood2_demo', pins }) {
  const check = `const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
    const hash=b=>require('node:crypto').createHash('sha256').update(b).digest('hex');
    const packed=fs.readFileSync(process.env.LMARBLES_SOURCE_FD),length=packed.readUInt32LE();
    assert.equal(hash(packed),${JSON.stringify(frozen.sourceSHA256)});
    const index=packed.subarray(4,4+length);assert.equal(hash(index),process.env.LMARBLES_SOURCE_INDEX_SHA256);
    const inventory=JSON.parse(index).files, byPath=new Map(inventory.map(r=>[r.path,r]));
    const pins=${JSON.stringify(pins)}, expected=new Map(pins.map(r=>[r.path,r]));
    const entry=require('./lib/apps').APPS[${JSON.stringify(appId)}];assert(entry,'registered app required');
    const read=file=>{const pin=expected.get(file),row=byPath.get(file);assert(pin&&row,'missing pinned sealed media: '+file);
      assert.equal(row.sha256,pin.sha256);assert.equal(row.size,pin.size);
      const b=fs.readFileSync(path.resolve(file));assert.equal(b.length,pin.size);assert.equal(hash(b),pin.sha256);return b;};
    const manifest=JSON.parse(read(entry.localFileManifest));assert.equal(manifest.schemaVersion,1);assert(Array.isArray(manifest.files));
    const dir=path.dirname(entry.localFileManifest);
    const files=require('./lib/app-files').mergeLocalManifestFiles(entry.files,manifest.files.map(f=>({...f,url:path.join(dir,f.url)})));
    const vfs=new (require('./lib/filesystem').VirtualFS)(),seen=new Set([entry.localFileManifest]);
    for(const item of [{url:entry.exe,vfsPath:'c:\\\\'+path.basename(entry.exe)},...files]){
      assert(!seen.has(item.url),'duplicate media mapping');seen.add(item.url);const b=read(item.url);
      if(item.size!==undefined)assert.equal(b.length,item.size);
      const guest=item.vfsPath.toLowerCase().replaceAll('/','\\\\');vfs.ensureParentDirs(guest);
      vfs.files.set(guest,{data:new Uint8Array(b),attrs:32});assert.equal(hash(vfs.files.get(guest).data),expected.get(item.url).sha256);
    }
    assert.equal(seen.size,pins.length,'exact pinned closure');
    const report={pass:true,appId:${JSON.stringify(appId)},exe:entry.exe,args:entry.args,manifest:entry.localFileManifest,
      mediaFiles:seen.size-1,mountedFiles:vfs.files.size,sourceSHA256:hash(packed),indexSHA256:hash(index),
      inventory:inventory.map(({offset,...r})=>r),guestInstructionsExecuted:0};`;
  const code = check + `const {Worker}=require('node:worker_threads');
    const worker=new Worker(${JSON.stringify(check + "require('node:worker_threads').parentPort.postMessage(report);")},{eval:true});
    worker.on('message',other=>{assert.deepEqual(other,report);console.log(JSON.stringify({...report,worker:other,inventoryEqual:true}));});
    worker.on('error',e=>{console.error(e);process.exitCode=1;});worker.on('exit',n=>{if(n)process.exitCode=1;});`;
  const r=cp.spawnSync(process.execPath,['-e',code],{cwd:root,env:frozen.env,stdio:c.stdioWithFds(frozen.fds),timeout:30000,maxBuffer:4e6});
  assert.equal(r.status,0,'immutable game-input preflight failed: '+r.stderr?.toString());
  const report=JSON.parse(r.stdout.toString());assert.deepEqual(report.inventory,frozen.inventory);
  return report;
}
// This happens before any original PID or runtime clock. It instantiates the
// actual renderer and encodes/decodes a complete native raster desktop, then
// repeats in a real Node Worker inheriting the exact same frozen descriptors.
function renderingPreflight(frozen) {
  const render = `const {createCanvas}=require('./lib/canvas-compat');
    const {Win98Renderer}=require('./lib/renderer');
    const {PNG}=require('pngjs');
    const canvas=createCanvas(1024,712), renderer=new Win98Renderer(canvas);
    const ctx=canvas.getContext('2d');ctx.fillStyle='#19324b';ctx.fillRect(0,0,1024,712);
    const bytes=canvas.toBuffer('image/png');const png=PNG.sync.read(bytes);
    require('node:assert/strict').equal(png.width,1024);require('node:assert/strict').equal(png.height,712);
    require('node:assert/strict').equal(png.data[0],25);
    require('node:assert/strict').equal(png.data[(1024*712-1)*4+2],75);`;
  const code = render + `const {Worker}=require('node:worker_threads');
    const worker=new Worker(${JSON.stringify(render)}, {eval:true});
    worker.on('error', e=>{console.error(e);process.exitCode=1;});
    worker.on('exit', code=>{if(code)process.exitCode=1;else console.log('whole PNG renderer + Worker PASS');});
    (async()=>{
      const memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true});
      const module=await WebAssembly.compile(require('node:fs').readFileSync('./build/wine-assembly.wasm'));
      const ctx={getMemory:()=>memory.buffer,resourceJson:{menus:{},dialogs:{},strings:{},bitmaps:{}}};
      const imports=require('./lib/host-imports').createHostImports(ctx);imports.host.memory=memory;
      const host=new (require('./lib/guest-thread-host').GuestThreadHost)({module,memory,hostImports:imports.host,
        sigs:require('./lib/host-import-sigs.generated.json').sigs,clockIntervalMs:0,
        workerUrl:require('node:path').resolve('./lib/guest-worker.js')});
      try{await host.start();console.log('native GuestThreadHost startup PASS; no PE loaded or slices run');}
      finally{await host.stop();}
    })().catch(e=>{console.error(e);process.exitCode=1;});`;
  const r = cp.spawnSync(process.execPath, ['-e', code], { cwd: root, env: frozen.env, stdio: c.stdioWithFds(frozen.fds), timeout: 30000 });
  assert.equal(r.status, 0, 'immutable renderer preflight failed: ' + r.stderr?.toString());
  assert(r.stdout.toString().includes('whole PNG renderer + Worker PASS'));
  assert(r.stdout.toString().includes('native GuestThreadHost startup PASS'));
  return { pass: true, wholePNG: [1024, 712], nativeRendererConstructed: true, nativeWorkerStartup: true,
    guestInstructionsExecuted: 0, sourceSHA256: frozen.sourceSHA256, indexSHA256: frozen.indexSHA256,
    workerExit: 0, stdout: r.stdout.toString(), stderr: r.stderr.toString() };
}
module.exports = { collect, freeze, gameInputPreflight, renderingPreflight };
