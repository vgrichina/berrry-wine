'use strict';
// Executable offline fixtures in the shipped OS Worker. Synthetic caller,
// initialized data, and explicit dependency stubs; never game evidence.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {Worker,MessageChannel,isMainThread,parentPort,workerData}=require('node:worker_threads');
const api=require('../tools/stronghold-owning-callback-observer.cjs');
const base=require('../tools/stronghold-preset-driver-attachment.cjs');
const {g2w}=require('../lib/mem-utils');
const ROOT=path.resolve(__dirname,'..'),hash=base.hash,EXE=base.MEDIA,exe=fs.readFileSync(path.join(ROOT,EXE));
assert.equal(hash(exe),api.EXE_SHA256);
const pe=exe.readUInt32LE(60),opt=pe+24,sections=opt+exe.readUInt16LE(pe+20);
function original(a,n){for(let i=0;i<exe.readUInt16LE(pe+6);i++){
 const s=sections+i*40,va=exe.readUInt32LE(s+12)+0x400000,size=exe.readUInt32LE(s+16);
 if(a>=va&&a+n<=va+size){const p=exe.readUInt32LE(s+20)+a-va;return exe.subarray(p,p+n);}}
 throw Error('unmapped PE');}
for(const [pc,hex]of api.PINS)assert.equal(original(pc,hex.length/2).toString('hex'),hex);
const le=n=>[n&255,n>>>8&255,n>>>16&255,n>>>24&255];
const URL='http://fixture/lib/guest-worker.js?v=fixture',epoch='fixture-target/fixture-session';
async function physical(){
 const {e,memory,host}=globalThis.fixtureAccess,b=new Uint8Array(memory.buffer),dv=new DataView(memory.buffer);
 const wa=a=>g2w(a,0x400000,memory),put=(a,v)=>b.set(v,wa(a)),u32=(a,v)=>dv.setUint32(wa(a),v>>>0,true);
 b.set(exe,e.get_staging());assert(e.load_pe(exe.length));e.set_api_log(0);
 const caller=0x580000,stop=caller+64,stack=0x7408000,string=caller+96,tick=caller+112;
 put(stop,[0xeb,0xfe]);put(string,[0]);put(tick,[0x31,0xc0,0xc3]);u32(0x5841c8,tick);
 // Full original callback and scene manager retained. Test-only dependencies
 // return deterministically. Setup executes its original prologue+first CALL,
 // then a synthetic epilogue; this is not original setup completion proof.
 for(const [a,v]of [[0x409790,[0xc2,4,0]],[0x478710,[0xc3]],
  [0x46ae40,[0xb8,...le(string),0xc2,4,0]],[0x47f610,[0xc2,4,0]],
  [0x4e1320,[0xc3]],[0x42910c,[0x5d,0x5b,0xc3]]])put(a,v);
 e.invalidate_code_range(0x400000,0x180000);
 const setupHash=hash(b),attachment=globalThis.__strongholdPresetAttachment;
 if(workerData.badBinding){assert.match(attachment.report().entryError,/binding/);assert.throws(()=>attachment.invoke('start',{command:1}),/prerequisite/);
  parentPort.postMessage({pass:true,badBindingRejected:true,report:attachment.report()});return;}
 const h=workerData.observed?{get report(){return attachment.report().report;},finish:reason=>attachment.invoke('finish',{reason})}:null;
 if(workerData.observed){assert(attachment.report().installedBeforeInstantiation,'pre-instantiation observer');
  assert.equal(attachment.report().slot,0);assert.equal(attachment.report().endpointIdentity,1);assert.equal(attachment.report().thread,1);
  attachment.invoke('start',{command:1});assert.equal(h.report.status,'running',JSON.stringify(h.report));}
 assert.equal(hash(b),setupHash,'observer start is read only');
 e.set_trace_esp(workerData.observed||workerData.trace?1:0,0,0);
 let pending;const slice=n=>new Promise((resolve,reject)=>{pending={resolve,reject};parentPort.postMessage({t:'fixtureSlice',steps:n});});
 workerData.port.on('message',m=>{if(m.t==='slice'){const p=pending;pending=null;m.value.trapped?p.reject(Error(m.value.trapped)):p.resolve(m.value.blocks);}});
 const options={host,getExports:()=>e,translate:g2w,memory,workerSlot:0,endpointIdentity:1,epoch,exeSha256:api.EXE_SHA256,
  wasmSha256:workerData.wasmHash,workerURL:URL,expectedWorkerURL:URL,deadline:performance.now()+10000};
 const snapshot=()=>({registers:Object.fromEntries(['eip','esp','eax','ebx','ecx','edx','esi','edi','ebp','flag_op','flag_a','flag_b','flag_res','flag_sign_shift','yield_reason'].map(n=>[n,e['get_'+n]()>>>0])),
  pages:Array.from({length:b.length/65536},(_,i)=>hash(b.subarray(i*65536,(i+1)*65536)))});
 async function execute(arg,target=0x430e10){
  u32(0xd13764,arg===1?57:20);u32(0xd13770,99);
  const code=[0x68,...le(arg),0xb8,...le(target),0xff,0xd0,0x83,0xc4,4,0xe9,...le(stop-(caller+20))];
  put(caller,code);e.invalidate_code_range(caller,20);e.set_esp(stack);e.set_eip(caller);
  const returned=[];for(let i=0;i<1000;i++){returned.push(await slice(64));if(e.get_eip()>>>0===stop)break;}
  assert.equal(e.get_eip()>>>0,stop,'fixture caller return');return {arg,returned,...snapshot()};
 }
 const segments=[];for(const arg of [7,1,2])segments.push(await execute(arg));
 if(h){assert.equal(h.report.status,'running',JSON.stringify(h.report));
  for(const [kind,arg]of [['callback-entry',7],['callback-entry',1],['callback-entry',2],['scene-request-entry',57],['scene-request-entry',20]])
   assert(h.report.records.some(r=>r.kind===kind&&r.argument===arg),kind+' '+arg);
  for(const kind of ['callback-branch','scene-request-return','setup-entry','setup-return','custom-path-completed'])assert(h.report.records.some(r=>r.kind===kind),kind);
  assert(h.report.records.some(r=>r.kind==='scene-request-return'&&r.state.requestedScene===20));
 }
 h?.finish('fixture-complete');e.set_trace_esp(0,0,0);
 const observation=h?.report,negatives={};
 if(workerData.observed){
  function fresh(extra={}){return api.attach({...options,...extra});}
  function start(extra={}){const x=fresh(extra);x.start();return x;}
  function rejects(name,extra,pattern){assert.throws(()=>fresh(extra),pattern);negatives[name]=true;}
  rejects('slot',{workerSlot:1},/binding/);rejects('endpoint',{endpointIdentity:2},/binding/);
  rejects('media',{exeSha256:'0'.repeat(64)},/binding/);rejects('url',{workerURL:'foreign'},/binding/);
  rejects('epoch',{epoch:''},/binding/);rejects('deadline',{deadline:0},/deadline/);
  const before=hash(b);let x=start();x.check();assert.match(x.report.fault,/missing trace/);assert.equal(hash(b),before);negatives.missing=x.report.fault;
  const checks=[['foreignEpoch',{epoch:'foreign',command:1,kind:'begin'},/epoch/],
   ['inputOrder',{epoch,command:1,kind:'UP-consumed'},/order/],
   ['badACK',{epoch,command:1,kind:'ACK',requested:64,before:0,steps:63},/ACK/]];
  for(const [name,row,pattern]of checks){x=start();x.annotate({epoch,command:1,kind:'begin'});x.annotate(row);assert.match(x.report.fault,pattern);negatives[name]=x.report.fault;}
  x=start();x.annotate({epoch,command:1,kind:'begin'});const guest={requested:64,ran:64,steps:64,running:true,frozen:true,tickMs:16};
  x.annotate({epoch,command:1,kind:'ACK',requested:64,before:0,steps:64,guests:[guest]});
  x.annotate({epoch,command:1,kind:'capture',sha256:'a'.repeat(64),steps:0});assert.match(x.report.fault,/stale/);negatives.stale=x.report.fault;
  x=start();x.annotate({epoch,command:1,kind:'begin'});
  x.annotate({epoch,command:1,kind:'ACK',requested:64,before:0,steps:64,guests:[guest]});
  x.annotate({epoch,command:1,kind:'ACK',requested:64,before:128,steps:192,guests:[{...guest,steps:192}]});assert.match(x.report.fault,/ACK/);negatives.skippedACK=x.report.fault;
  // Host receipt controls are explicitly synthetic. Only the native rows
  // above are emitted by executed WASM; these do not assert guest dispatch.
  x=start();x.annotate({epoch,command:1,kind:'begin'});
  const input=(msg,mask)=>({msg,hwnd:65537,mouseX:543,mouseY:292,mouseButtons:mask,wParam:msg===132?0:mask,lParam:19137055});
  x.annotate({epoch,command:1,kind:'DOWN-enqueued',steps:0,mask:1,input:[input(132,1),input(513,1)]});
  x.annotate({epoch,command:1,kind:'ACK',requested:64,before:0,steps:64,guests:[guest]});
  x.annotate({epoch,command:1,kind:'DOWN-consumed',steps:64,mask:1,input:[],activeInput:null,lastInput:null});
  x.annotate({epoch,command:1,kind:'UP-enqueued',steps:64,mask:0,input:[input(514,0)]});
  x.annotate({epoch,command:1,kind:'ACK',requested:64,before:64,steps:128,guests:[{...guest,steps:128}]});
  x.annotate({epoch,command:1,kind:'UP-consumed',steps:128,mask:0,input:[],activeInput:null,lastInput:null});
  x.annotate({epoch,command:1,kind:'capture',steps:128,sha256:'a'.repeat(64)});assert.equal(x.report.status,'running');x.finish('balanced-control');
  for(const [name,delta,pattern]of [['wrongPoint',{input:[{...input(132,1),mouseX:542},input(513,1)]},/receipt/],
   ['staleInput',{steps:0},/stale/]]){
   x=start();x.annotate({epoch,command:1,kind:'begin'});x.annotate({epoch,command:1,kind:'ACK',requested:64,before:0,steps:64,guests:[guest]});
   x.annotate({epoch,command:1,kind:'DOWN-enqueued',steps:64,mask:1,input:[input(132,1),input(513,1)],...delta});assert.match(x.report.fault,pattern);negatives[name]=x.report.fault;
  }
  x=start({maxRecords:1});x.annotate({epoch,command:1,kind:'begin'});assert.match(x.report.fault,/overflow/);negatives.records=x.report.fault;
  x=start({maxBytes:1});assert.match(x.report.fault,/overflow/);negatives.bytes=x.report.fault;
  x=start({maxBoundaries:1});e.set_trace_esp(1,0,0);await execute(7);assert.match(x.report.fault,/overflow/);negatives.boundaries=x.report.fault;e.set_trace_esp(0,0,0);
  x=start();e.set_current_thread_id(2);x.check();assert.match(x.report.fault,/thread/);e.set_current_thread_id(1);negatives.thread=x.report.fault;
  const val=b[wa(0x430e10)];b[wa(0x430e10)]^=1;x=start();assert.match(x.report.fault,/bytes/);b[wa(0x430e10)]=val;negatives.bytesChanged=x.report.fault;
  x=start({memory:new WebAssembly.Memory({initial:1})});assert.match(x.report.fault,/memory/);negatives.memory=x.report.fault;
  x=start({getExports:()=>({...e})});assert.equal(x.report.status,'running');x.check();assert.match(x.report.fault,/instance/);negatives.instance=x.report.fault;
  // Real original setup entry without a preceding callback must be rejected.
  x=start();e.set_trace_esp(1,0,0);await execute(7,0x429100);assert.match(x.report.fault,/history/);negatives.setupHistory=x.report.fault;e.set_trace_esp(0,0,0);
  let time=0;x=start({now:()=>time,deadline:10});time=10;x.check();const first=x.report.fault;x.finish('later');x.annotate({});assert.equal(x.report.fault,first);negatives.earliestFault=first;
 }
 parentPort.postMessage({pass:true,segments,observation,negatives,workerSourceSHA:globalThis.fixtureWorkerSHA,
  limits:'Synthetic dependency returns and setup epilogue; no original full setup/game execution claim'});
}
if(!isMainThread){
 if(workerData.observed){
  // Execute the exact serialized production Worker attachment, with only the
  // Node/browser event API adapter. No observer callback is invoked by tests.
  globalThis.location={href:URL};globalThis.memUtils={g2w};globalThis.addEventListener=(name,fn)=>{
   assert.equal(name,'message');parentPort.on('message',data=>fn({data}));
  };
  vm.runInThisContext(api.workerSource({observeSource:'',options:{targetId:'fixture-target',sessionId:'fixture-session',expectedWorkerURL:URL,
   exeSha256:api.EXE_SHA256,wasmSha256:workerData.wasmHash,deadlineEpochMs:Date.now()+20000}}));
 }
 const instantiate=WebAssembly.instantiate;
 WebAssembly.instantiate=async function(module,imports,...rest){
  const host={...imports.host};imports.host.log_block=(...a)=>host.log_block(...a);
  const r=await Reflect.apply(instantiate,this,[module,imports,...rest]);globalThis.fixtureAccess={e:(r.instance||r).exports,memory:imports.host.memory,host};return r;
 };
 const filename=path.join(ROOT,'lib/guest-worker.js'),Module=require('node:module'),m=new Module(filename,module),src=fs.readFileSync(filename);
 globalThis.fixtureWorkerSHA=hash(src);m.filename=filename;m.paths=module.paths;m._compile(src.toString(),filename);
 workerData.port.once('message',()=>physical().catch(e=>parentPort.postMessage({failure:e.stack})));
}else{
 async function one(variant,observed,trace=false,badBinding=false){
  const bytes=fs.readFileSync(path.join(ROOT,'build',variant)),memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true});
  const {port1,port2}=new MessageChannel(),sigs=require('../lib/host-import-sigs.generated.json').sigs;
  const broker=require('../lib/guest-rpc').createMainBroker(memory,Object.fromEntries(Object.keys(sigs).map(n=>[n,()=>{
   if(!['log_block','log','log_i32','beep_process_begin','beep_thread_begin','midi_stream_service'].includes(n))throw Error('unexpected fixture broker '+n);return 0;
  }])),sigs);
  const module=await WebAssembly.compile(bytes),w=new Worker(__filename,{workerData:{port:port2,observed,trace,badBinding,wasmHash:hash(bytes)},transferList:[port2]});
  return new Promise((resolve,reject)=>{let seq=0,done=false;const commands=[];
   const end=async(error,value)=>{if(done)return;done=true;clearTimeout(timer);await w.terminate();port1.close();error?reject(error):resolve({...value,commands,moduleSHA:hash(bytes)});};
   const timer=setTimeout(()=>end(Error('fixture Worker deadline')),40000);w.on('error',e=>end(e));
   w.on('message',m=>{
    if(m.t==='ready')port1.postMessage({start:true});else if(m.t==='rpc')broker.serveRpc(m.slot,m.waitEntry);
    else if(m.t==='call')broker.serveCall(m);else if(m.t==='calls')broker.serveCalls(m);
    else if(m.t==='fixtureSlice'){const c={t:'slice',seq:++seq,steps:m.steps};commands.push(c);w.postMessage(c);}
    else if(m.t==='sliceDone')port1.postMessage({t:'slice',value:m});
    else if(m.failure||m.t==='error')end(Error(JSON.stringify(m)));else if(m.pass)end(null,m);
   });w.postMessage({t:'init',seq:0,module,memory,sigs,slot:0,endpointIdentity:badBinding?2:1});
  });
 }
 async function composition(){
  const run=path.resolve('scratch/runs/20261104-stronghold-acknowledged-menu-onward/observer-composition'),pins=path.join(run,'pins.json');fs.mkdirSync(run,{recursive:true});
  fs.writeFileSync(pins,JSON.stringify({files:[{path:'build/wine-assembly.wasm',sha256:hash(fs.readFileSync('build/wine-assembly.wasm'))}]}));
  const p=api.prepare({run,pins});new vm.Script(p.source);new vm.Script(p.route);
  const cut=p.source.lastIndexOf('main().catch(');base.compileClosure(p.source.slice(0,cut),p.driver,p.route,p.evidence.retainedClosure);
  const bundle=api.workerSource({observeSource:'',options:{targetId:'fixture-target',sessionId:'fixture-session',expectedWorkerURL:URL}});new vm.Script(bundle);
  const control=originalAttachmentControl();await control;
  await owningDiscoveryControl();
  assert(p.source.includes('installBeforeFirstScript'));assert(p.route.includes('shellSamples>=4'));assert(p.route.includes("assertHistoricalShell(cap.png)"));
  assert.deepEqual(p.evidence.callbackObserver.caps,{arrival:3072,route:4096,navigation:16384,shellSamples:4,perACK:64});
  const audit=require('../tools/stronghold-unavailable-scene.cjs');api.assertHistoricalShell(audit.read(ROOT,audit.RECOVERED+'route-native-boundary-7.png'));
  assert.throws(()=>api.assertHistoricalShell(audit.read(ROOT,'scratch/runs/20261104-stronghold-browser-village/review/zephyr-ready.png')),/shell/);
  await routeControls(p.route);
  return p.evidence;
 }
 async function routeControls(source){
  const audit=require('../tools/stronghold-unavailable-scene.cjs'),native=require('../scratch/runs/20261104-stronghold-explicit-idle-input/native-start-boundary.cjs');
  const shell=audit.read(ROOT,audit.RECOVERED+'route-native-boundary-7.png');
  async function fixture({firstAt=256,unknown=false,complete=false,stale=false,deadline=false,max=4096}={}){
   const state=structuredClone(JSON.parse(audit.read(ROOT,audit.RECOVERED+'route-native-boundary-7.json')).state);
   let image=Buffer.from('choose-type'),phase='choose',after=0,expired=false;const events=[],steps=[],annotations=[];
   const telemetry=()=>Object.assign(state.main.inputTelemetry.hostRendererFields,{active:state.main.activeInput,queue:state.main.inputQueue,mask:state.main.mouseButtonsMask});
   function input(msg,mask,p){const m=state.main,e=t=>({msg:t,hwnd:65537,mouseX:p.x,mouseY:p.y,mouseButtons:mask,wParam:t===132?0:mask,lParam:(p.y<<16)|p.x});
    m.inputQueue=msg===513?[e(132),e(msg)]:[e(msg)];m.mouseButtonsMask=mask;m.inputTelemetry.mouseButtons=mask;telemetry();events.push(msg);
    if(msg===512)image=Buffer.from('choose-type-custom-hover');if(msg===514){phase='arrival';if(firstAt===0)image=shell;}}
   const io={state:async()=>state,controls:()=>({keys:[],buttons:[]}),move:async p=>input(512,0,p),down:async p=>input(513,1,p),up:async p=>input(514,0,p)};
   class Base{
    constructor(io,o){this.io=io;this.max=o.maxSteps;this.used=0;}
    async step(){if(expired)throw Error('original deadline');if(this.used+64>this.max)throw Error('aggregate step cap');this.used+=64;steps.push(64);state.main.tick.steps+=64;
     state.main.inputQueue=[];state.main.activeInput=null;state.main.lastInput=null;telemetry();if(phase==='arrival'){after+=64;if(after>=firstAt)image=unknown?Buffer.from('unknown'):complete?Buffer.from('actual-scene20-observation'):shell;}}
    async capture(){const s=structuredClone(state);return {png:image,state:s,geometry:s.main.geometry};}
   }
   const deps={
    '../20261104-stronghold-explicit-idle-input/native-start-boundary.cjs':{...native,NativeStartDriver:Base,pageAdapter:()=>io},
    './navigation.cjs':{scene:b=>b===shell?'demo-selection-unavailable':b.toString(),routes:{'choose-type':{x:543,y:292}}},
    './integer-route-point.cjs':{integerRoutePoint:(_g,x,y)=>({x,y})},'./presentation.cjs':{qualifiedIO:x=>x},
    './freshness.cjs':{assertFresh:(a,b)=>{assert.equal(hash(a.png),hash(b.png));if(stale&&phase==='arrival')throw Error('stale scene');}},
    './independent-layout.cjs':{classify:b=>b.toString()}
   },m={exports:{}};
   vm.runInNewContext('(function(require,module){'+source+'\n})',{Buffer})(id=>deps[id]||require(id),m);
   const driver=m.exports.createRouteDriver({maxSteps:max,page:{},state:io.state,controls:io.controls,shot:()=>{},boundary:{run:f=>f()},
    live:()=>{if(expired)throw Error('original deadline');},review:async c=>({personallyViewed:true,observation:'synthetic IO',sha256:c.sha256,scene:c.scene}),
    presetAttachment:{event:async(kind,s)=>annotations.push({kind,steps:s.main.tick.steps})}});
   const dispatch=action=>driver.dispatch({action});
   for(const a of ['route-review-choose','route-review-hover','route-gesture'])await dispatch(a);
   if(deadline)expired=true;
   let error;for(let i=0;i<20;i++){try{await dispatch('route-arrival');}catch(e){error=e;break;}}
   assert(error,'bounded stop');const count=steps.length;await assert.rejects(dispatch('route-arrival'),/terminal/);assert.equal(steps.length,count);
   assert.deepEqual(events,[512,513,514]);assert.deepEqual(annotations.map(x=>x.kind),['DOWN-enqueued','DOWN-consumed','UP-enqueued','UP-consumed']);
   return {error:String(error),steps:steps.length*64,after};
  }
  const delayed=await fixture();assert.match(delayed.error,/shell diagnostic complete/);assert.equal(delayed.after,1088); // release ACK plus four 256-step samples
  const immediate=await fixture({firstAt:0});assert.match(immediate.error,/shell diagnostic complete/);assert.equal(immediate.after,832); // release consumes one 64-step ACK
  assert.match((await fixture({unknown:true})).error,/unexpected/);
  assert.match((await fixture({complete:true})).error,/no readiness grant/);
  assert.match((await fixture({firstAt:2816})).error,/arrival diagnostic cap/);
  assert.match((await fixture({deadline:true})).error,/deadline/);
  assert.match((await fixture({max:512})).error,/aggregate/);
 }
 async function originalAttachmentControl(){
  const wasm='a'.repeat(64),calls=[],events=[{kind:'compiled',sha256:wasm},{kind:'sent-module',workerURL:'lib/guest-worker.js?v=fixture',sha256:wasm,slot:0,type:'init'}];
  const report={targetId:'t',sessionId:'s',workerURL:URL,entries:1,installedBeforeInstantiation:true,entryError:null,slot:0,endpointIdentity:1,thread:1,
   events:[{kind:'received-module',type:'init',slot:0},{kind:'instantiated',incoming:{type:'init',slot:0}}]};
  const entry={session:{send:async(method,args)=>{calls.push(args.expression);return {result:{value:JSON.stringify(report)}};}},sessionId:'s',info:{url:URL},expectedWorkerURL:URL,preloadVerified:true};
  const options={sessions:new Map([['t',entry]]),save:()=>{},log:()=>{},wasmSha256:wasm,pageState:async()=>({main:{href:'http://fixture/index.html',observation:{events}}})};
  let h=api.createAttachment(options);await h.begin({action:'route-press-preset'},1);assert(!h.active);
  await h.begin({action:'route-gesture'},2);assert(h.active);await h.success({action:'route-gesture'});assert(h.active,'retains arrival scope');await h.finish('fixture');
  h=api.createAttachment(options);await h.begin({action:'route-gesture'},2);
  await assert.rejects(h.ack({requested:64,ran:63},64,0),/ACK/);
  report.sessionId='foreign';h=api.createAttachment(options);await assert.rejects(h.begin({action:'route-gesture'},2),/foreign/);
  report.sessionId='s';events.push({...events[1]});h=api.createAttachment(options);await assert.rejects(h.begin({action:'route-gesture'},2),/binding/);events.pop();
  events[1].sha256='b'.repeat(64);h=api.createAttachment(options);await assert.rejects(h.begin({action:'route-gesture'},2),/binding/);
 }
 async function owningDiscoveryControl(){
  const run=path.resolve('scratch/runs/20261104-stronghold-acknowledged-menu-onward');
  const file=path.join(run,'browser/final-state.json');if(!fs.existsSync(file))return;
  const actual=JSON.parse(fs.readFileSync(file)),wasm=JSON.parse(fs.readFileSync(path.join(run,'composition.json'))).wasmSha256;
  assert.equal(actual.workers.length,4);assert.equal(actual.main.tick.steps,8832);
  const slots=actual.workers.map(w=>w.observation.events.find(e=>e.kind==='received-module').slot);
  assert.deepEqual(slots,[0,1,2,3]);
  const negatives=[];
  async function replay(mode){
   const starts=[],reports=new Map(),page=structuredClone(actual),sessions=new Map();
   for(const w of page.workers){
    const slot=w.observation.events.find(e=>e.kind==='received-module').slot;
    const r={targetId:w.id,sessionId:'offline-'+w.id,workerURL:w.info.url,entries:1,
     installedBeforeInstantiation:slot===0,entryError:slot===0?null:'wrong original Module/memory/slot/endpoint binding',
     events:w.observation.events};
    // Getter results are fixture assumptions, not historical runtime evidence.
    if(slot===0)Object.assign(r,{slot:0,endpointIdentity:1,thread:1});
    reports.set(w.id,r);
    const entry={sessionId:r.sessionId,info:w.info,expectedWorkerURL:w.info.url,preloadVerified:true,
     session:{send:async(_method,args)=>{
      if(args.expression.includes('invoke("start"'))starts.push(w.id);
      return {result:{value:JSON.stringify(r)}};
     }}};
    sessions.set(w.id,entry);
   }
   const owner=reports.get(page.workers[0].id),aux=reports.get(page.workers[1].id);
   if(mode==='endpoint')owner.endpointIdentity=2;
   if(mode==='thread')owner.thread=2;
   if(mode==='late')owner.installedBeforeInstantiation=false;
   if(mode==='foreign')owner.sessionId='foreign';
   if(mode==='missing')sessions.delete(owner.targetId);
   if(mode==='duplicate-owner'){
    Object.assign(aux,{slot:0,endpointIdentity:1,thread:1,installedBeforeInstantiation:true,entryError:null});
    aux.events=structuredClone(owner.events);
   }
   if(mode==='replaced')owner.events.push({...owner.events[0]});
   if(mode==='aux-malformed')aux.events=[];
   if(mode==='duplicate-send')page.main.observation.events.push({...page.main.observation.events.find(e=>e.kind==='sent-module'&&e.slot===0)});
   const options={sessions,save:()=>{},log:()=>{},wasmSha256:wasm,pageState:async()=>page};
   if(mode==='accepted'){
    const legacy=base.createAttachment(options);
    await assert.rejects(legacy.begin({action:'route-press-preset'},11),/single exact preloaded Worker/);
    assert.equal(starts.length,0);
   }
   const h=api.createAttachment(options);
   if(mode==='accepted'){
    await h.begin({action:'route-gesture'},11);assert(h.active);
    assert.deepEqual(starts,[owner.targetId]);await h.finish('offline-only');
   }else{
    await assert.rejects(h.begin({action:'route-gesture'},11),/prerequisite|discovery|foreign|binding/);
    assert.equal(starts.length,0,mode+' must reject before arming');negatives.push(mode);
   }
  }
  await replay('accepted');
  for(const mode of ['endpoint','thread','late','foreign','missing','duplicate-owner','replaced','aux-malformed','duplicate-send'])await replay(mode);
  console.log('PASS recorded four-Worker/six-send topology old rejection/new exact-owner selection; nine discovery negatives before arming (offline reports only)');
 }
 (async()=>{
  const evidence=await composition(),results=[];
  for(const variant of ['wine-assembly.wasm','wine-assembly.compat.wasm']){
   const control=await one(variant,false),trace=await one(variant,false,true),observed=await one(variant,true);
   assert.equal(observed.workerSourceSHA,control.workerSourceSHA);assert.equal(trace.workerSourceSHA,control.workerSourceSHA);
   assert.deepEqual(observed.segments,trace.segments,'trace-armed full memory/register/return parity');
   assert.deepEqual(control.commands,trace.commands);assert.deepEqual(observed.commands.slice(0,control.commands.length),control.commands);
   const rpc=require('../lib/region-map.generated').BASE.THREAD_RPC;
   const differences=observed.segments.map((s,i)=>{
    assert.deepEqual(s.registers,control.segments[i].registers);assert.deepEqual(s.returned,control.segments[i].returned);
    const d=s.pages.flatMap((v,j)=>v!==control.segments[i].pages[j]?[j*65536]:[]);assert.deepEqual(d,[rpc]);return d;
   });
   for(const arm of [control,trace,observed])for(const s of arm.segments)delete s.pages;
   results.push({variant,control,trace,observed,differences});console.log('PASS executable owning Worker callback/branch/scene/setup fixtures and parity',variant);
  }
  const wrongInit=await one('wine-assembly.wasm',true,false,true);assert(wrongInit.badBindingRejected);assert.equal(wrongInit.commands.length,0);
  const out={passed:true,offlineOnly:true,fixtureOnly:true,evidence,results,wrongInit,media:{path:EXE,sha256:api.EXE_SHA256}};
  if(process.env.STRONGHOLD_CALLBACK_RESULT)fs.writeFileSync(process.env.STRONGHOLD_CALLBACK_RESULT,JSON.stringify(out,null,2)+'\n');
 })().catch(e=>{console.error(e.stack);process.exitCode=1;});
}
