'use strict';
// The source view must hold across real Node Workers and every host read route.
// These small synthetic inputs do not run or alter the original installer.
const test=require('node:test'), assert=require('node:assert/strict');
const fs=require('node:fs'), os=require('node:os'), path=require('node:path');
const {spawnSync}=require('node:child_process'), crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'), preload=path.join(root,'tools/delphi5-source-view.cjs');
test('sealed source view serves identical bytes through reads, require and a real Worker',()=>{
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'delphi5-view-test-'));
  try {
    const body=Buffer.from('module.exports={sealedMarker:1977};\n');
    const wasm=Buffer.from('synthetic-module-fixture');
    fs.writeFileSync(path.join(temp,'view.json'),JSON.stringify({root,files:{'lib/cli-native-scene.js':body.toString('base64')}}));
    fs.writeFileSync(path.join(temp,'module'),wasm);
    const env={...process.env,NODE_OPTIONS:'--require='+preload,
      DELPHI5_SOURCE_FD:path.join(temp,'view.json'),DELPHI5_MODULE_FD:path.join(temp,'module'),
      DELPHI5_MODULE_SHA256:crypto.createHash('sha256').update(wasm).digest('hex')};
    const code=`(async()=>{
      const assert=require('node:assert/strict'),fs=require('node:fs');
      const file=${JSON.stringify(path.join(root,'lib/cli-native-scene.js'))};
      const expected=${JSON.stringify(body.toString())};
      assert.equal(fs.readFileSync(file,'utf8'),expected);
      assert.equal(await fs.promises.readFile(file,'utf8'),expected);
      assert.equal(await new Promise((ok,no)=>fs.readFile(file,'utf8',(e,b)=>e?no(e):ok(b))),expected);
      let chunks=[];for await(const b of fs.createReadStream(file))chunks.push(b);
      assert.equal(Buffer.concat(chunks).toString(),expected);
      assert.equal(require(file).sealedMarker,1977);
      assert.throws(()=>fs.readFileSync(${JSON.stringify(path.join(root,'lib/unsealed-delphi5.cjs'))}),/unsealed runtime dependency/);
      const {Worker}=require('node:worker_threads');
      const worker=new Worker('require("node:worker_threads").parentPort.postMessage(require('+JSON.stringify(file)+').sealedMarker)',{eval:true});
      assert.equal(await new Promise((ok,no)=>{worker.once('message',ok);worker.once('error',no)}),1977);
      assert.equal(await new Promise(ok=>worker.once('exit',ok)),0);
    })().catch(e=>{console.error(e);process.exitCode=1});`;
    const good=spawnSync(process.execPath,['-e',code],{env,encoding:'utf8',timeout:15000});
    assert.equal(good.status,0,good.stderr);
    const bad=spawnSync(process.execPath,['-e','throw Error("must not execute")'],{
      env:{...env,DELPHI5_MODULE_SHA256:'0'.repeat(64)},encoding:'utf8',timeout:5000});
    assert.notEqual(bad.status,0);assert.match(bad.stderr,/sealed module digest differs/);
  } finally {fs.rmSync(temp,{recursive:true,force:true});}
});

test('desktop receiver ignores an old notification until its current ready predicate holds',()=>{
  const filename=path.join(root,'lib/process-desktop.js');
  const Module=require('node:module'), mod=new Module(filename,module);
  mod.filename=filename;mod.paths=Module._nodeModulePaths(path.dirname(filename));
  // Expose the actual lexical function without replacing its wait, clock or worker.
  mod._compile(fs.readFileSync(filename,'utf8')+'\nmodule.exports.delphi5ReceiveFixture=receive;\n',filename);
  const buffer=new SharedArrayBuffer(1024*1024+8), words=new Int32Array(buffer,0,2);
  const old=Buffer.from(JSON.stringify({value:'previous request'}));
  new Uint8Array(buffer,8).set(old);Atomics.store(words,1,old.length);
  const {Worker}=require('node:worker_threads');
  const worker=new Worker(`
    const {workerData:b}=require('node:worker_threads');
    const w=new Int32Array(b,0,2);
    // A prior completion notifies after the next request has reset ready=0.
    Atomics.notify(w,0);
    setTimeout(()=>{
      const bytes=Buffer.from(JSON.stringify({value:'current request'}));
      new Uint8Array(b,8).set(bytes);Atomics.store(w,1,bytes.length);
      Atomics.store(w,0,1);Atomics.notify(w,0);
    },120);
  `,{eval:true,workerData:buffer});
  const value=mod.exports.delphi5ReceiveFixture(buffer);
  assert.equal(value,'current request');
  return new Promise((resolve,reject)=>{worker.once('exit',code=>code===0?resolve():reject(Error('worker exit '+code)));worker.once('error',reject);});
});

test('desktop receive keeps one fixed deadline despite repeated unready notifications',async()=>{
  const filename=path.join(root,'lib/process-desktop.js');
  const Module=require('node:module'), mod=new Module(filename,module);
  mod.filename=filename;mod.paths=Module._nodeModulePaths(path.dirname(filename));
  mod._compile(fs.readFileSync(filename,'utf8')+'\nmodule.exports.delphi5ReceiveFixture=receive;\n',filename);
  const b=new SharedArrayBuffer(1024*1024+8);
  const old=Buffer.from(JSON.stringify({value:'previous request'}));
  new Uint8Array(b,8).set(old);Atomics.store(new Int32Array(b,0,2),1,old.length);
  const {Worker}=require('node:worker_threads');
  const worker=new Worker(`const {workerData:b}=require('node:worker_threads');
    const timer=setInterval(()=>Atomics.notify(new Int32Array(b,0,2),0),10);
    setTimeout(()=>clearInterval(timer),3200);`,{eval:true,workerData:b});
  const started=performance.now();
  let error;try{mod.exports.delphi5ReceiveFixture(b);}catch(e){error=e;}
  const elapsed=performance.now()-started;
  await new Promise((ok,no)=>{worker.once('exit',ok);worker.once('error',no);});
  assert.equal(error?.code,'ETIMEDOUT');
  assert(elapsed>=2900 && elapsed<3300,'deadline extended or returned prematurely: '+elapsed);
});
