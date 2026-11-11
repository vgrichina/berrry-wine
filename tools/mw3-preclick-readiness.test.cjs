'use strict';
// Integration harness for the retained controller's actual execute(), transport,
// observer arm/validator and full compiled dispatch. No original is launched.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const assert=require('node:assert/strict'),test=require('node:test');
const root=path.resolve(__dirname,'..'), run=process.env.MW3_REPAIR_RUN;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const {ready}=require('./mw3-preclick-readiness.cjs');

test('actual Chrome parent wait has separate stream EOF',async()=>{
 if(!process.env.MW3_PARENT_RUNTIME)return;
 const cp=require('node:child_process'),dir=path.join(process.env.MW3_PARENT_RUNTIME,'case-webgl');fs.mkdirSync(dir);
 const profile=path.join('/dev/shm','mw3-readiness-0245-'+process.pid);
 const child=cp.spawn('/usr/bin/google-chrome',['--headless=new','--no-sandbox','--disable-dev-shm-usage',
  '--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:['ignore','pipe','pipe']});
 const eof={},streams=[];
 for(const [name,source] of [['stdout',child.stdout],['stderr',child.stderr]]){
  const sink=fs.createWriteStream(dir+'/chrome.'+name);source.pipe(sink);
  source.on('end',()=>eof[name]=true);streams.push(new Promise(r=>sink.on('finish',r)));
 }
 const closed=new Promise(resolve=>child.once('close',(code,signal)=>resolve({status:code,signal,
  actualParentWait:true,separateEOF:eof,pid:child.pid})));
 let socket;
 const watchdog=setTimeout(()=>{if(child.exitCode===null)child.kill('SIGKILL')},15000);
 try{
  const ep=await require('./mw3-devtools-endpoint.cjs').waitForEndpoint(profile+'/DevToolsActivePort',child,{deadline:Date.now()+10000});
  socket=new WebSocket('ws://127.0.0.1:'+ep.debugPort+ep.browserPath);
  await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject});
  socket.send(JSON.stringify({id:1,method:'Browser.close'}));
  const receipt=await closed;await Promise.all(streams);
  fs.writeFileSync(dir+'/chrome-parent-wait.json',JSON.stringify(receipt));
  assert.equal(receipt.status,0);assert.deepEqual(eof,{stdout:true,stderr:true});
  if(process.env.MW3_EXPECT_FAILURE==='1')throw Error('intentional fixture failure after actual Chrome wait');
 }finally{clearTimeout(watchdog);socket?.close();if(child.exitCode===null)child.kill('SIGKILL');await closed;fs.rmSync(profile,{recursive:true,force:true});}
});

test('refusals preserve raw diagnostics, original errors and identity without input',async()=>{
 for(const change of [{errors:['bad']},{drops:1},{pending:1},{active:false},
   {diagnostic:{bindingMismatchReasons:['replaced']}},{records:[{}]}]){
  const snapshot={errors:[],drops:0,pending:0,active:true,records:[],...change};
  let saved;
  await assert.rejects(()=>ready({observer:{read:async()=>snapshot},deadline:Date.now()+500,
   label:'negative',save:(n,v)=>saved=v,wait,validate:()=>{throw Error('invalid record')},checkIdentity:async()=>{}}));
  assert.equal(saved.snapshot,snapshot);assert(saved.noInput&&saved.noReplay);
 }
 const fault=Error('read failed');let saved;
 await assert.rejects(()=>ready({observer:{read:async()=>{throw fault}},deadline:Date.now()+100,
  label:'read-error',save:(n,v)=>saved=v,wait,validate:()=>{},checkIdentity:()=>{}}),e=>e===fault);
 assert.equal(saved.snapshot,null);assert(saved.error.includes('read failed'));
 // Hung transport is bounded; a late reply cannot complete admission.
 await assert.rejects(()=>ready({observer:{read:()=>new Promise(()=>{})},deadline:Date.now()+20,
  label:'hung',save:()=>{},wait,validate:()=>{},checkIdentity:()=>{}}),/deadline/);
});

test('exact full controller delayed-completion before/after and permanent-empty sticky refusal',{skip:!run},async()=>{
 assert(run,'MW3_REPAIR_RUN required');
 const prior=path.join(root,'scratch/runs/20261111-mw3-inflight-observed-throttle-0210');
 const old=fs.readFileSync(prior+'/browser.cjs','utf8'),fixed=fs.readFileSync(run+'/browser.cjs','utf8');
 const {BASE,SIZE}=require('../lib/region-map.generated');
 const {createHostImports}=require('../lib/host-imports');
 const {attachDispatch}=require('./mw3-live-mouse-observation.cjs');
 const decoder=require('./mw3-relative-motion.cjs');
 const memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true});
 const hostContext={getMemory:()=>memory.buffer,resourceJson:{},onExit(){}};
 const imports=createHostImports(hostContext);imports.host.memory=memory;
 let ex;
 const recorder=attachDispatch(imports.host,{getExports:()=>ex,memory,...decoder,
  layout:{objectsBase:BASE.DX_OBJECTS,objectsSize:SIZE.DX_OBJECTS,stateBase:BASE.DX_SURF_STATE},importNames:['get_mouse_buttons_live']});
 const bytes=fs.readFileSync(root+'/build/wine-assembly.wasm');
 ex=new WebAssembly.Instance(new WebAssembly.Module(bytes),imports).exports;hostContext.exports=ex;
 ex.init_thread(0,0x400000,0x400000,0x600000,0x7500000,0x7500010,2);
 const d=new DataView(memory.buffer),put=(a,v)=>d.setUint32(a,v>>>0,true),g=a=>ex.guest_to_wasm(a)>>>0;
 put(BASE.THUNK_BASE,0x80000000);put(BASE.THUNK_BASE+4,1093);
 [7,0,2,0,0x700,16,0,0x400].forEach((v,i)=>put(BASE.DX_OBJECTS+i*4,v));put(g(0x520004),0);
 new Uint8Array(memory.buffer,g(0x4fa56c),2).set([0xeb,0xfe]);
 function complete(){ex.set_esp(0x510000);ex.set_eip(0x7500000);ex.clear_yield();
  [0x4fa56c,0x520000,16,0x600f68].forEach((v,i)=>put(g(0x510000+i*4),v));ex.run(1);}
 const bound=require(prior+'/bound-input.cjs'),obs=require(run+'/dispatch-observer.cjs');
 const worker=vm.createContext({instance:{exports:ex},endpointIdentity:'exact-fixture',workerSlot:0,
  __mw3ReadObserver:recorder,__mw3ImportCapture:{beforeInstantiation:true},crypto:require('node:crypto').webcrypto});
 const initial=vm.runInContext(bound.WORKER_READ,worker);
 const identity=Object.fromEntries(bound.FIELDS.map(n=>[n,n]));
 Object.assign(identity,{workerTarget:'worker-target',workerInstance:initial.instance,endpoint:initial.endpointIdentity});
 const results=[];
 for(const [mode,source,delay] of [['before',old,650],['after',fixed,650],['empty',fixed,null],['identity',fixed,650],['instance',fixed,650]]){
  const dir=path.join(process.env.MW3_PARENT_RUNTIME||run,'controller-'+mode+'-'+Date.now());fs.mkdirSync(dir);fs.mkdirSync(dir+'/commands');
  const saves={},events=[];let completeTimer,armAt,identityChanged=false;
  const save=(n,v)=>{saves[n]=v;fs.writeFileSync(dir+'/'+n,JSON.stringify(v,null,2))};
  const evaluate=async(expression,session)=>{
   if(session==='worker-session'){
    const value=vm.runInContext(expression,worker);
    if(expression.includes('__mw3ReadObserver.start')){
     armAt=Date.now();if(delay!==null)completeTimer=setTimeout(()=>{complete();identityChanged=mode==='identity';if(mode==='instance')worker.instance={exports:ex}},delay);
    }
    return JSON.parse(JSON.stringify(value));
   }
   if(expression.includes('getBoundingClientRect'))return {left:0,top:0,width:640,height:480};
   if(expression==='globalThis.__nativeEvidence')return events;
   throw Error('unexpected page evaluate '+expression);
  };
  const chain={readLive:async()=>({identity:{...identity,...(identityChanged?{epoch:'changed'}:{})}}),
   admit:async(review,fn)=>fn({live:{identity}})};
  const workerMap=new Map([['w',{targetId:'worker-target',sessionId:'worker-session',closed:false}]]);
  const scopedRequire=name=>{
   if(name.endsWith('/dispatch-observer.cjs'))return {...(mode==='before'?require(prior+'/dispatch-observer.cjs'):obs),
    correlate:()=>({fixtureOnly:true,meaning:'native send sink; no trusted DOM/consumption claim'})};
   if(name.endsWith('/target.cjs'))return {click(){}}; // fixture cursor, no game state
   if(name.endsWith('/input.cjs'))return require(prior+'/input.cjs');
   return require(name.startsWith('.')?path.resolve(run,name):name);
  };
  const latest={label:'reviewed',sha256:'fixture-sha'};
  const ctx=vm.createContext({require:scopedRequire,process:{env:{}},root,run,out:dir,assert,
   Date,Promise,setTimeout,clearTimeout,wait,save,evaluate,chain,bound,
   workers:workerMap,send:async(method,params)=>events.push({method,...params,at:Date.now()}),
   pageSession:'page',pointer:{x:320,y:240},deadline:Date.now()+60000,
   commandWorkEnd:Infinity,preInputObserved:true,latest,sha:()=>latest.sha256,
   fs:{...fs,readFileSync:file=>file.endsWith('-review.json')?'{}':file.endsWith('.png')?Buffer.from('fixture'):fs.readFileSync(file)},
   readCursor:async()=>({}),ordinary:scopedRequire('./input.cjs'),capture:async()=>{},captureRaw:async()=>{}});
  const start=source.indexOf('async function execute('),end=source.indexOf('\n(async()=>{',start);
  assert(start>0&&end>start);vm.runInContext(source.slice(start,end),ctx);
  const transport=require('./mw3-run-transport.cjs');
  fs.writeFileSync(dir+'/execution-window.json',JSON.stringify({browserStop:new Date(Date.now()+60000).toISOString()}));
  const workEnd=Date.now()+(mode==='empty'?450:2500),runEnd=JSON.parse(fs.readFileSync(dir+'/execution-window.json')).browserStop;
  const c={id:'accept-select',action:'click',label:'accept-select',menuWitness:true,guestPoint:[320,240],reviewRef:'reviewed',waitMs:0,
   timing:{workEnd,ackEnd:workEnd+2000,runEnd:Date.parse(runEnd)}};
  fs.writeFileSync(dir+'/commands/0.json',JSON.stringify(c));
  let error;
  try{await transport.consume(dir,0,vm.runInContext('execute',ctx));}catch(e){error=String(e);}
  // The transport's immutable deadline timer can settle one event turn first.
  // The passive helper still publishes refusal and cannot issue input late.
  await wait(20);
  clearTimeout(completeTimer);recorder.stop();
  if(mode==='after'){
   assert(!error,error);assert.deepEqual(events.map(e=>e.type),['mousePressed','mouseReleased']);
   assert(events[0].at-armAt>=delay);assert(saves['accept-select-preclick-ready.json'].snapshot.records.length);
  }else{
   assert(error);assert.equal(events.length,0);
   assert(fs.existsSync(dir+'/first-failure.json'));
   if(mode!=='before')assert(saves['accept-select-preclick-refusal.json']);
   let later=0;await assert.rejects(()=>transport.consume(dir,0,async()=>later++));assert.equal(later,0);
   await assert.rejects(()=>transport.request(dir,'later',{action:'capture',waitMs:0}));
  }
  results.push({mode,error:error??null,nativeEvents:events,armAt,rawSnapshotRetained:!!saves['accept-select-preclick-refusal.json']});
 }
 fs.writeFileSync(run+'/controller-results.json',JSON.stringify({passed:true,fullModuleSHA256:require('node:crypto').createHash('sha256').update(bytes).digest('hex'),results},null,2));
});
