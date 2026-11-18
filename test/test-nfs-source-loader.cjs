'use strict';

// Self-contained: real Git inventory and native Workers, no retained run inputs.
const assert = require('node:assert/strict');
const cp = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'nfs-source-test-'));
const base = cp.execFileSync('git', ['rev-parse', 'HEAD'], {cwd: root, encoding: 'utf8'}).trim();
const env = {...process.env, NFS_SOURCE_BASE: base,
  NFS_OBSERVER_SHA256: crypto.createHash('sha256').update(fs.readFileSync(path.join(root, 'tools/nfs-public-timing.cjs'))).digest('hex'),
  NFS_SOURCE_OBSERVE: path.join(out, 'source.jsonl'),
  NODE_OPTIONS: '--require=' + path.join(root, 'tools/nfs-source-loader.cjs')};
const code = `
const assert=require('node:assert/strict'),fs=require('node:fs');
const {Worker,setEnvironmentData}=require('node:worker_threads');
const {ProcessDesktop,prepareClient}=require('./lib/process-desktop');
(async()=>{
 const start=performance.now(), desktop=new ProcessDesktop({endpoint:null,observeDirectory:null});
 const directory=desktop.directory;
 console.log(JSON.stringify({hello:true,ms:performance.now()-start}));
 try {
  assert.deepEqual(desktop.snapshot().rows,[]);
  const options={endpoint:desktop.endpoint,observeDirectory:null};
  const preparation=prepareClient(options);
  await preparation.cancel();await preparation.cancel();
  assert.throws(()=>new ProcessDesktop({...options,preparation}),e=>e.code==='EINVAL');
  const unauthorized=prepareClient({...options,endpoint:{...desktop.endpoint,token:'invalid'}});
  assert.throws(()=>new ProcessDesktop({...options,endpoint:{...desktop.endpoint,token:'invalid'},preparation:unauthorized}),e=>e.code==='EAUTH');
  const child=new ProcessDesktop({...options,preparation:prepareClient(options)});
  try {assert.notEqual(child.processId,desktop.processId);assert.deepEqual(child.snapshot().rows,[]);}finally{await child.close();}
 }finally{await desktop.close();}
 assert.equal(fs.existsSync(directory),false);
 // A lost inventory must produce a real Worker error, never a fake hello or
 // fallback to mutable source. Observe its exit before the parent finishes.
 setEnvironmentData('nfs-source-inventory:'+process.env.NFS_SOURCE_BASE,undefined);
 const broken=new Worker('throw Error("unreachable worker body")',{eval:true});
 let error;
 broken.on('error',e=>{error=e;});
 await new Promise(resolve=>broken.once('exit',resolve));
 assert.match(error.message,/missing inherited source inventory/);
 console.log('PASS hello/snapshot/authentication/cancel/Worker-error/finite cleanup');
})().catch(e=>{console.error(e);process.exitCode=1;});`;
try {
  const result = cp.spawnSync(process.execPath, ['-e', code], {cwd: root, env, timeout: 20000, encoding: 'utf8'});
  process.stdout.write(result.stdout || '');
  process.stderr.write(result.stderr || '');
  assert.equal(result.status, 0, 'native loader controls must exit normally');
  const observations = fs.readFileSync(env.NFS_SOURCE_OBSERVE, 'utf8').trim().split('\n').map(JSON.parse);
  assert.equal(observations.filter(x => x.inventoryRoute === 'git').length, 1);
  assert(observations.filter(x => x.inventoryRoute === 'inherited').length >= 4);
  assert(observations.every(x => x.base === base));
  assert.equal(new Set(observations.map(x => x.sourceCount)).size, 1);
} finally {fs.rmSync(out, {recursive: true, force: true});}
