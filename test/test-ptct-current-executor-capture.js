'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),cp=require('node:child_process');
const ROOT=process.env.PTCT_TEST_ROOT||path.resolve(__dirname,'..');
const helper=process.env.PTCT_TEST_HELPER||path.join(ROOT,'tools/ptct-current-executor-capture.cjs');
const {installExecutorObserver,overlay,qualifyExecutor,sameExecutor,chooserComplete,attestModule,sha}=require(helper);
const SoftwareExec=require(path.join(ROOT,'lib/gpu-stream-software.js'));
const WebGLExec=require(path.join(ROOT,'lib/gpu-stream-webgl.js'));
function fixture(){
  const root={crypto:require('node:crypto').webcrypto,performance,WebAssembly},o=installExecutorObserver(root);
  const module=new WebAssembly.Module(Buffer.from('0061736d01000000','hex'));
  const instance=new WebAssembly.Instance(module),memory=new WebAssembly.Memory({initial:1});
  o.bind(module,instance,memory,'render');
  const executor=new SoftwareExec.Executor({getExports:()=>instance.exports,getMemory:()=>memory.buffer});
  const options={instance,memory,backend:'software'},args={executor,backend:null,closed:false,ringAddr:8,options,SoftwareExec,WebGLExec};
  o.track(executor);executor.execute({op:33,seq:1,fields:{},name:'MARK'});
  const row=()=>({id:7,generation:2,api:'gl-gps',...o.observe(args)});
  const proof=r=>({object:r.moduleObject,instance:r.instanceObject,role:'render',targetId:'actual-test-target',sha256:'a'.repeat(64),exportFunctionScriptId:'unit-mock-only'});
  const qualify=r=>qualifyExecutor(r,{endpoint:7,generation:2,requestedSelector:options.backend,expectedExecutor:'software',moduleProof:proof(r)});
  return {root,o,module,instance,memory,executor,options,args,row,proof,qualify};
}
test('real software Executor completion and unchanged MARK behavior; no backend string supplies class identity',()=>{
  const f=fixture(),r=f.row();assert.equal(r.actualExecutor,'software');assert.equal(r.completed,1);assert.equal(r.records[0].op,33);assert.equal(f.executor.stats().marks,1);f.qualify(r);
  const plain=new SoftwareExec.Executor({getExports:()=>f.instance.exports,getMemory:()=>f.memory.buffer});plain.execute({op:33,seq:1,fields:{},name:'MARK'});assert.equal(plain.stats().marks,f.executor.stats().marks);
  assert.throws(()=>f.o.observe({...f.args,executor:{actualExecutor:'webgl',execute(){}}}),/class/);
});
test('legitimate software fallback recorded but cannot qualify requested WebGL',()=>{
  const f=fixture();f.options.backend='webgl';const r=f.row();assert.equal(r.fallback,true);assert.equal(r.actualExecutor,'software');
  assert.throws(()=>qualifyExecutor(r,{endpoint:7,generation:2,requestedSelector:'webgl',expectedExecutor:'webgl',moduleProof:f.proof(r)}),/executor mismatch/);
  assert.equal(f.executor.closed,false);f.qualify(r);
});
test('wrong role, instance, memory, closed executor, and missing actual Module all refuse',()=>{
  for(const mutate of [f=>f.o.bind(f.module,f.instance,f.memory,'guest'),f=>f.options.instance={},f=>f.options.memory={},f=>f.executor.close(),f=>f.o.bind({},f.instance,f.memory,'render')]){
    const f=fixture();mutate(f);assert.throws(f.row,/live render/);
  }
});
test('module rebind and endpoint/executor generation changes cannot reuse capture identity',()=>{
  const f=fixture(),a=f.qualify(f.row());f.o.bind(f.module,f.instance,f.memory,'render');assert.throws(()=>sameExecutor(a,f.qualify(f.row())),/moduleGeneration/);
  for(const key of ['id','generation','executorObject','contextObject','moduleObject','targetId','moduleSha256'])assert.throws(()=>sameExecutor(a,{...a,[key]:'replacement'}),/lifetime/);
});
test('failed execution is recorded after original exception; never counted complete',()=>{
  const f=fixture();assert.throws(()=>f.executor.execute({op:999,seq:2,fields:{},name:'bad'}));const r=f.row();assert.equal(r.completed,1);assert.equal(r.failed,1);assert.throws(()=>f.qualify(r),/completed execution/);
});
test('module bytecode hash without actual export-function/object join refuses',()=>{
  const f=fixture(),r=f.row();for(const change of [{object:'other'},{instance:'other'},{role:'guest'},{exportFunctionScriptId:null}])assert.throws(()=>qualifyExecutor(r,{endpoint:7,generation:2,requestedSelector:'software',expectedExecutor:'software',moduleProof:{...f.proof(r),...change}}),/instance export/);
});
test('chooser audit permits exactly one completed ordinary command1 and no duplicate or failed call',()=>{
  const r={route:'scheduleStartupDialogDismiss/send_message',message:0x111,command:1,hwnd:10,status:'complete',at:1,completedAt:2};chooserComplete([r]);
  for(const rows of [[],[r,r],[{...r,status:'pending'}],[{...r,status:'failed'}],[{...r,command:2}],[{...r,route:'manual'}]])assert.throws(()=>chooserComplete(rows));
});
test('immutable current Git overlays parse and refuse changed pins or ambiguous anchors',()=>{
  const names=['lib/d3d-render-worker.js','lib/guest-worker.js','lib/gpu-stream-render-worker.js','lib/browser-shell.js'];
  const files=new Map(names.map(n=>[n,cp.execFileSync('git',['show','HEAD:'+n],{cwd:ROOT,maxBuffer:8*1024*1024})]));
  const pins=Object.fromEntries([...files].map(([n,b])=>[n,sha(b)]));const result=overlay(files,pins);assert.equal(result.changes.length,4);
  for(const [n,b]of result.files){new vm.Script(b.toString(),{filename:n});assert.equal(sha(files.get(n)),pins[n]);}
  assert.throws(()=>overlay(files,{...pins,'lib/guest-worker.js':'bad'}),/immutable pin/);
});
test('CDP module binding collector joins actual export script bytes and rechecks lifetime (protocol mock only)',async()=>{
  const pin={role:'render',moduleObject:'module',instanceObject:'instance'},bytes=Buffer.from('0061736d01000000','hex'),calls=[];
  const send=async(method,p,s)=>{calls.push(method);assert.equal(s,'session');
    if(method==='Runtime.evaluate')return p.returnByValue?{result:{value:pin}}:{result:{objectId:'export-function'}};
    if(method==='Runtime.getProperties')return {internalProperties:[{name:'[[FunctionLocation]]',value:{value:{scriptId:'wasm-script'}}}]};
    if(method==='Debugger.getScriptSource'){assert.equal(p.scriptId,'wasm-script');return {bytecode:bytes.toString('base64')};}
    if(method==='Runtime.releaseObject')return {};throw Error(method);
  };
  const r=await attestModule({send,sessionId:'session',targetId:'target',role:'render',expectedSha256:sha(bytes)});assert.equal(r.object,'module');assert.equal(r.sha256,sha(bytes));assert.equal(calls.filter(c=>c==='Runtime.evaluate').length,3);
});
test('actual overlaid scheduler takes ordinary command1 exactly once; healthy production route stays identical (unit shell)',async()=>{
  const names=['lib/d3d-render-worker.js','lib/guest-worker.js','lib/gpu-stream-render-worker.js','lib/browser-shell.js'];
  const files=new Map(names.map(n=>[n,cp.execFileSync('git',['show','HEAD:'+n],{cwd:ROOT,maxBuffer:8*1024*1024})]));
  const pins=Object.fromEntries([...files].map(([n,b])=>[n,sha(b)]));const output=overlay(files,pins).files;
  async function run(source){
    const begin=source.indexOf('    function scheduleStartupDialogDismiss(app, wine) {');
    const end=source.indexOf('\n    // A few period games',begin);assert(begin>0&&end>begin);
    const app={dismissStartupDialog:{command:1}},calls=[],callbacks=[],clears=[];
    const wine={hasGuestExport:()=>true,callGuest:(...args)=>{calls.push(args);return Promise.resolve(1);}};
    const context={apps:{ptct:app},sharedRenderer:{windows:{1:{visible:true,isDialog:true,hwnd:11}}},runningApps:[{name:'ptct',wine}],
      setInterval:fn=>{callbacks.push(fn);return 1;},clearInterval:id=>clears.push(id),Date,Promise};
    vm.runInNewContext(source.slice(begin,end)+'\nglobalThis.run=scheduleStartupDialogDismiss;',context);
    context.run(app,wine);callbacks[0]();callbacks[0]();await new Promise(resolve=>setImmediate(resolve));
    assert.equal(calls.length,1);assert.deepEqual(calls[0],['send_message',11,0x111,1,0]);assert.equal(clears[0],1);
    return {context,calls};
  }
  const plain=await run(files.get('lib/browser-shell.js').toString()),observed=await run(output.get('lib/browser-shell.js').toString());
  assert.deepEqual(observed.calls,plain.calls);assert.equal(plain.context.__ptctChooserCalls,undefined);
  const {CHOOSER_READ}=require(helper);const rows=vm.runInNewContext(CHOOSER_READ,observed.context);chooserComplete(rows);
  observed.context.runningApps[0].wine={};assert.throws(()=>vm.runInNewContext(CHOOSER_READ,observed.context),/owner changed/);
});
test('UNKNOWN during export bytecode lookup performs no subsequent endpoint cleanup or replay',async()=>{
  const calls=[];const send=async(method)=>{calls.push(method);
    if(method==='Runtime.evaluate')return {result:{value:{role:'render'},objectId:'function'}};
    throw Error('UNKNOWN transport permanently closed');
  };
  await assert.rejects(attestModule({send,sessionId:'s',targetId:'t',role:'render',expectedSha256:'a'.repeat(64)}),/UNKNOWN/);
  assert.deepEqual(calls,['Runtime.evaluate','Runtime.evaluate','Runtime.getProperties']);
});
test('diagnostic failure never changes a successful production execute return/throw behavior',()=>{
  const f=fixture();f.root.performance={now(){throw Error('diagnostic clock unavailable');}};
  assert.doesNotThrow(()=>f.executor.execute({op:33,seq:2,fields:{},name:'MARK'}));assert.equal(f.executor.stats().marks,2);assert.throws(f.row,/completion observation/);
});
test('capture gateway reuses existing chain and closes on UNKNOWN before any ticket or later request',async()=>{
  const {createCapture}=require(helper);let reads=0,captures=0,evals=0;
  const chain={closed:false,readLive:async()=>{reads++;throw Error('UNKNOWN existing binding');},capture:async()=>{captures++;}};
  const gateway=createCapture({binding:{createChain:cfg=>{assert.equal(cfg.app,'ptct');assert.deepEqual(cfg.expectedModules,['a'.repeat(64)]);return chain;}},
    evaluate:async()=>{evals++;},send:async()=>{},workers:new Map(),expectedSha256:'a'.repeat(64),requestedSelector:'webgl',expectedExecutor:'webgl'});
  await assert.rejects(gateway.capture('beam-a'),/UNKNOWN/);assert.equal(gateway.closed,true);await assert.rejects(gateway.capture('beam-b'),/closed/);
  assert.equal(reads,1);assert.equal(captures,0);assert.equal(evals,0);
});
test('PTCT whole-browser host consent pins this app, all owner fields, reviewed geometry and freshness',()=>{
  const binding=require(path.join(ROOT,'tools/gltron-browser-binding.cjs'));
  const {reviewHostConsent}=require(helper),owner=Object.fromEntries(binding.HOST_FIELDS.map(k=>[k,k]));
  Object.assign(owner,{name:'ptct',running:true,stopped:false,guestWorker:true});
  const live={page:{isolated:true,apps:[owner]},fullscreen:null,wrap:'wrap',viewport:{width:1280,height:960},
    strip:{visible:true,text:'App is using the full page',object:'strip'},
    button:{object:'button',label:'Use browser fullscreen',enabled:true,visible:true,hit:true,contained:true,x:500,y:168,box:{x:480,y:150,width:40,height:36}}};
  const scene={at:100,sha256:'a'.repeat(64),observation:structuredClone(live)},review={sha256:scene.sha256,hostOnly:true,observation:'Whole browser: native triangle and host fullscreen button'};
  assert.deepEqual(reviewHostConsent(binding,scene,review,live,200),{x:500,y:168});
  for(const mutate of [v=>v.page.apps[0].name='gltron',v=>v.page.apps[0].renderGeneration='replacement',v=>v.button.x++,v=>v.button.hit=false,v=>v.fullscreen='other']){
    const changed=structuredClone(live);mutate(changed);assert.throws(()=>reviewHostConsent(binding,scene,review,changed,200));
  }
  assert.throws(()=>reviewHostConsent(binding,scene,review,live,30100),/fresh/);
  assert.throws(()=>reviewHostConsent(binding,scene,{...review,hostOnly:false},live,200),/personal/);
});
test('PREBIND delegates the fixed deadline; refusal closes before tickets or subsequent requests',async()=>{
  const {createCapture}=require(helper),calls=[],observe=()=>{};
  const gateway=createCapture({binding:{createChain:()=>({closed:false,
    prepareStartup:async(deadline,onObservation)=>{calls.push({deadline,onObservation});throw Error('UNKNOWN startup owner');},
    readLive:async()=>{throw Error('must not read after closure');},capture:async()=>{throw Error('must not request a ticket');}})},
    expectedSha256:'a'.repeat(64),evaluate:async()=>{throw Error('unexpected evaluate');}});
  await assert.rejects(gateway.prepareStartup(12345,observe),/UNKNOWN startup owner/);
  assert.equal(gateway.closed,true);assert.deepEqual(calls,[{deadline:12345,onObservation:observe}]);
  await assert.rejects(gateway.prepareStartup(12346,observe),/closed/);
  await assert.rejects(gateway.capture('late'),/closed/);assert.equal(calls.length,1);
});
