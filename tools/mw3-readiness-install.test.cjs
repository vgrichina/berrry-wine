'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const retained = path.join(root, 'scratch/runs/20261111-mw3-complete-helper-cockpit-0500');
const {prepare, keyboardWitness} = require('./mw3-readiness-install.cjs');
const {BASE, SIZE} = require('../lib/region-map.generated');
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

test('prepared ordinary owning Worker retains causal keyboard failure and preserves mouse admission', async t => {
  const out = fs.mkdtempSync('/dev/shm/mw3-readiness-');
  t.after(() => { if (!process.env.MW3_KEEP_FIXTURES) fs.rmSync(out, {recursive:true, force:true}); });
  require('node:child_process').execFileSync('python3',['-B',root+'/tools/mw3-retention-repair.py',retained,out]);
  for (const name of ['owner-start.py','collect.py','recover-watch.py'])
    assert.equal(fs.readFileSync(out+'/'+name,'utf8'),fs.readFileSync(retained+'/'+name,'utf8'));
  assert.throws(() => prepare(retained, out), /exists/);
  const source = fs.readFileSync(out+'/browser.cjs', 'utf8');
  const old = fs.readFileSync(retained+'/browser.cjs', 'utf8');
  assert.equal(source.replaceAll(out+'/worker-prefix.js', retained+'/worker-prefix.js'),
    require('./mw3-key-action-review.cjs').install(keyboardWitness(old)),
    'only the producer witness and explicit cockpit/pilot key review routing change');
  const wasm = fs.readFileSync(root+'/build/wine-assembly.wasm');
  const pe = require('../lib/pe').readPE(root+'/test/binaries/shareware/mw3/ex/Program_Files/mech3demo.exe');
  assert.equal(crypto.createHash('sha256').update(pe.buf).digest('hex'),
    'df457ee6973f6f9d557c57aa3fc14258303486ec8b8742fd37b4369c1f37dbdc');
  const mod = new WebAssembly.Module(wasm);
  const memory = new WebAssembly.Memory({initial:8192, maximum:8192, shared:true});
  const table = {};
  for (const i of WebAssembly.Module.imports(mod)) table[i.name] = i.kind==='memory' ? memory :
    () => { throw Error('unexpected import '+i.name); };
  let ticks=1000, ex;
  table.get_ticks=()=>ticks;
  table.di_keyboard_buffer=()=>0; // empty host queue, no synthetic key injection
  table.get_mouse_buttons_live=()=>0;
  for (const name of ['beep_process_begin','beep_thread_begin','midi_stream_service','log','log_i32','log_api_exit']) table[name]=()=>{};
  const logSettings=[];
  const worker=vm.createContext({URL, self:{location:{href:'http://fixture/lib/guest-worker.js'}},
    performance, Date, Uint8Array, DataView, structuredClone, crypto:crypto.webcrypto,
    endpointIdentity:'compiled-owner',workerSlot:0,
    WebAssembly:{Module:WebAssembly.Module, instantiate:async(module, imports)=>{
      assert.notEqual(imports.host.log,initialLog);
      assert.equal(typeof worker.__mw3ReadObserver,'undefined');
      const actual = new WebAssembly.Instance(module, imports).exports;
      ex = {...actual, set_api_log:value=>{logSettings.push(value);actual.set_api_log(value);}};
      return {instance:{exports:ex}};
    }}});
  vm.runInContext(fs.readFileSync(out+'/worker-prefix.js','utf8'), worker);
  // Prefix must install into imports before the actual compiled instantiation.
  const initialLog=table.log;
  await worker.WebAssembly.instantiate(mod,{host:table});
  assert.notEqual(table.log,initialLog);
  assert(worker.__mw3ImportCapture.beforeInstantiation);
  assert(worker.__mw3ImportCapture.capturedAt<=worker.__mw3ImportCapture.instantiateStartedAt);
  // The table is wrapped in place before instantiate (the prefix also clones
  // it for the existing, inactive throttle observers).
  assert.equal(typeof worker.__mw3ReadObserver.start,'function');
  ex.init_thread(0,0x400000,0x400000,0x600000,0x7500000,0x7500020,4);
  worker.instance={exports:ex};
  const d=new DataView(memory.buffer),g=a=>ex.guest_to_wasm(a)>>>0;
  const put=(a,v)=>d.setUint32(g(a),v>>>0,true);
  const bytes=(a,b)=>new Uint8Array(memory.buffer,g(a),b.length).set(b);
  const slices=[[0x4f7610,0x4f7690],[0x4f7aa0,0x4f7c30],[0x4fa160,0x4fa17b],
    [0x5633f0,0x563477],[0x5634c0,0x5634f4],[0x563c50,0x563c80]];
  for(const [a,b] of slices)bytes(a,pe.buf.subarray(pe.va2off(a),pe.va2off(b)));
  const apis=JSON.parse(fs.readFileSync(root+'/src/api_table.json'));
  const thunk=(i,name)=>{
    const id=apis.findIndex(r=>(typeof r==='string'?r:r.name)===name);assert(id>=0);
    d.setUint32(BASE.THUNK_BASE+i*8,0x80000000,true);d.setUint32(BASE.THUNK_BASE+i*8+4,id,true);
    return 0x7500000+i*8;
  };
  put(0x520028,thunk(0,'IDirectInputDevice_GetDeviceData'));
  put(0x52001c,thunk(1,'IDirectInputDevice_Acquire'));
  put(0x58671c,thunk(2,'timeGetTime'));
  const mouseThunk=thunk(3,'IDirectInputDevice_GetDeviceState');
  put(0x520100,0x520000);put(0x520104,0);
  const device=(type,format)=>[7,0,type,128,0x700,format,0,0x500].forEach((v,i)=>d.setUint32(BASE.DX_OBJECTS+i*4,v,true));
  device(1,256);put(0x5fc90c,0x520100);put(0x5fc910,0x530000);
  bytes(0x5fc8fc,[1,0,1]);put(0x5fc900,1);put(0x5fc904,2);put(0x600f84,1);
  // Labelled synthetic caller/sequence object, authentic WAIT step and clock wrapper.
  bytes(0x401000,[0xeb,0xfe]);bytes(0x4fa56c,[0xeb,0xfe]);
  put(0x540018,0x540100);put(0x540100,0x540200);put(0x540104,0);
  put(0x540204,0x563c60);put(0x54020c,0x402020);bytes(0x402020,[0xc3]);
  d.setFloat64(g(0x540008),0,true);d.setFloat32(g(0x540108),10,true);
  d.setFloat32(g(0x54010c),0,true);
  d.setFloat32(g(0x599cf0),pe.buf.readFloatLE(pe.va2off(0x599cf0)),true);
  const invoke=(address,ecx=0,args=[])=>{
    ex.set_eip(address);ex.set_esp(0x510000);ex.set_ecx(ecx);ex.clear_yield();
    [0x401000,...args].forEach((v,i)=>put(0x510000+i*4,v));ex.run(8000);
  };
  invoke(0x7500008,0,[0x520100]);
  const bound=require(retained+'/bound-input.cjs');
  const identity={workerTarget:'worker',workerInstance:vm.runInContext(bound.WORKER_READ,worker).instance,endpoint:'compiled-owner'};
  // Load the prepared arm function through its real bound-input dependency.
  const module={exports:{}};
  vm.runInThisContext('(function(exports,require){'+fs.readFileSync(out+'/dispatch-observer.cjs','utf8')+'\n})')(
    module.exports,n=>n==='./bound-input.cjs'?bound:require(n));
  const saved={};
  const save=(name,value)=>{saved[name]=value;fs.writeFileSync(out+'/'+name,JSON.stringify(value));};
  const evaluate=async expression=>JSON.parse(JSON.stringify(vm.runInContext(expression,worker)));
  const arm=()=>module.exports.arm({evaluate,workers:new Map([['worker',{targetId:'worker',sessionId:'owner'}]]),identity,save});
  const observation=await arm();
  ticks=1000;invoke(0x5634c0,0x540000);
  ticks=1100;invoke(0x5634c0,0x540000);
  let sample=await observation.read();
  assert.equal(sample.reads.length,0);
  const row=sample.keyboard.rows[0];
  assert.equal(row.first.eax,0);assert.equal(row.first.count,0);
  assert.equal(row.first.request.outerCaller,0x56340b);
  assert.equal(row.first.request.sequence.step,0x563c60);
  assert.equal(row.first.request.sequence.controllerCaller,0x401000);
  assert.equal(row.first.request.sequence.tickWords[0],1000);
  assert.equal(row.last.request.sequence.tickWords[0],1100);
  assert.notDeepEqual(row.first.request.sequence.nowWords,row.last.request.sequence.nowWords);
  assert.deepEqual(sample.keyboard.conflicts,[]);assert.deepEqual(sample.diagnostic.bindingMismatchReasons,[]);
  const settingsBefore=logSettings.slice();
  await assert.rejects(()=>require('./mw3-preclick-readiness.cjs').ready({observer:observation,
    validate:module.exports.validate,deadline:Date.now()+25,wait,save,label:'empty',checkIdentity:async()=>{}}),/deadline/);
  await observation.stop();
  assert(saved['empty-preclick-refusal.json'].snapshot.keyboard.rows.length);
  assert(saved['keyboard-readiness-final.json'].keyboard.rows.length);
  assert.deepEqual(settingsBefore,[0,1]);assert.deepEqual(logSettings,[0,1,0]);
  // Reuse the same captured imports for the next ordinary window. Keyboard
  // decode failure retains the HRESULT without changing mouse readiness.
  const second=await arm();device(1,256);d.setUint32(BASE.DX_OBJECTS+28,0x100,true);
  bytes(0x4fa810,[0xc2,4,0]);invoke(0x4f7aa0);
  sample=await second.read();
  assert.equal(sample.keyboard.rows[0].first.eax,0x8007000c);
  assert(sample.keyboard.errors.length);assert.equal(sample.active,true);
  assert.deepEqual(logSettings,[0,1,0,0,1]);
  device(2,16);put(0x520104,0);put(0x600f6c,0);
  ex.set_esp(0x510000);ex.set_eip(mouseThunk);ex.clear_yield();
  [0x4fa56c,0x520100,16,0x600f68].forEach((v,i)=>put(0x510000+i*4,v));ex.run(1);
  const success=await require('./mw3-preclick-readiness.cjs').ready({observer:second,
    validate:module.exports.validate,deadline:Date.now()+500,wait,save,label:'mouse',checkIdentity:async()=>{}});
  assert.equal(success.records.length,1);await second.stop();
  assert.deepEqual(logSettings,[0,1,0,0,1,0]);
  // Exercise the exact prepared ordinary execute(), including its initial
  // waitForReadStream/finally and real sticky command transport. Only the
  // reviewed screenshot, identity admission and native send sink are fixtures.
  const controllerResults=[];
  for (const mode of ['empty','mouse']) {
    const dir=out+'/controller-'+mode;fs.mkdirSync(dir);fs.mkdirSync(dir+'/commands');
    const events=[];let dispatched=0;
    const controllerSave=(name,v)=>{fs.writeFileSync(dir+'/'+name,JSON.stringify(v));};
    const controllerEvaluate=async expression=>{
      if(expression.includes('getBoundingClientRect'))return {left:0,top:0,width:640,height:480};
      const result=await evaluate(expression);
      if(expression.includes('__mw3ReadObserver.start')) {
        if(mode==='empty') {
          device(1,256);ticks=1200;invoke(0x5634c0,0x540000);
          ticks=1300;invoke(0x5634c0,0x540000);
        } else {
          device(2,16);ex.set_esp(0x510000);ex.set_eip(mouseThunk);ex.clear_yield();
          [0x4fa56c,0x520100,16,0x600f68].forEach((v,i)=>put(0x510000+i*4,v));ex.run(1);
        }
      }
      return result;
    };
    const ctx=vm.createContext({assert,root,out:dir,commandWorkEnd:Infinity,deadline:Date.now()+60000,
      Date,wait,process:{env:{}},preInputObserved:false,latest:{label:'review',sha256:'fixture'},
      sha:()=> 'fixture',fs:{readFileSync:()=> '{}'},save:controllerSave,
      evaluate:controllerEvaluate,workers:new Map([['w',{targetId:'worker',sessionId:'owner'}]]),
      require:n=>n==='./dispatch-observer.cjs'?module.exports:require(n),
      chain:{readLive:async()=>({identity}),admit:async(review,fn)=>fn({live:{identity}})},
      send:async(method,params)=>events.push({method,...params}),pageSession:'page',pointer:{x:320,y:240},
      ordinary:require('../ops/browser-native-input.cjs'),capture:async()=>{}});
    const begin=source.indexOf('async function execute('),end=source.indexOf('\n(async()=>{',begin);
    vm.runInContext(source.slice(begin,end),ctx);
    const runEnd=Date.now()+60000,workEnd=Date.now()+(mode==='empty'?150:1200);
    const command={id:'ordinary',action:'click',point:[0.5,0.5],label:'ordinary',reviewRef:'review',waitMs:0,
      timing:{workEnd,ackEnd:workEnd+2000,runEnd}};
    fs.writeFileSync(dir+'/execution-window.json',JSON.stringify({browserStop:new Date(runEnd).toISOString()}));
    fs.writeFileSync(dir+'/commands/0.json',JSON.stringify(command));
    const transport=require('./mw3-run-transport.cjs');
    const operation=()=>transport.consume(dir,0,c=>vm.runInContext('execute',ctx)(c,()=>dispatched++));
    if(mode==='empty') {
      await assert.rejects(operation,/deadline/);await wait(20);
      assert.equal(events.length,0);assert.equal(dispatched,0);
      const causal=JSON.parse(fs.readFileSync(dir+'/keyboard-readiness-final.json'));
      assert.equal(causal.keyboard.rows[0].last.request.sequence.tickWords[0],1300);
      assert(fs.existsSync(dir+'/first-failure.json'));
      let replay=0;await assert.rejects(()=>transport.consume(dir,0,async()=>replay++));assert.equal(replay,0);
    } else {
      await operation();assert.equal(dispatched,1);
      assert.deepEqual(events.map(e=>e.type),['mouseMoved','mousePressed','mouseReleased']);
      assert.equal(JSON.parse(fs.readFileSync(dir+'/pre-input-matched-reads.json')).records.length,1);
    }
    controllerResults.push({mode,events,dispatched});
  }
  const final=worker.__mw3ReadObserver.snapshot();
  invoke(0x4f7aa0);assert.equal(worker.__mw3ReadObserver.snapshot().keyboard.rows.length,final.keyboard.rows.length);
  assert.equal(worker.__mw3ReadObserver.restore().conflicts,0);
  t.diagnostic(JSON.stringify({out,moduleSHA256:crypto.createHash('sha256').update(wasm).digest('hex'),
    serializedBeforeInstantiation:true,logSettings,keyboard:row,mouseRecords:success.records.length,controllerResults}));
});
