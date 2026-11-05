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
// First-fault discriminator: run the exact original 80,400-entry initializer,
// including all three input-type branches. Only data/registers are synthetic;
// a debugger breakpoint stops before the following original helper CALL.
async function initializer({e,memory}){
 const b=new Uint8Array(memory.buffer),dv=new DataView(memory.buffer),wa=a=>g2w(a,0x400000,memory);
 const object=0xfb4d08,count=0x13a10,from=object+0x165160,to=object+0x52480;
 const codeBefore=hash(b.subarray(wa(0x4ec4e8),wa(0x4ec526)));
 assert.equal(codeBefore,hash(original(0x4ec4e8,0x4ec526-0x4ec4e8)));
 const guard=0xa55a,baseValue=0xfffe;
 dv.setUint32(wa(0x8ed448),baseValue,true);
 for(let i=0;i<count;i++)dv.setUint32(wa(from+i*4),[16,32,99][i%3],true);
 dv.setUint16(wa(to-2),guard,true);dv.setUint16(wa(to+count*2),guard,true);
 b.fill(0xcc,wa(to),wa(to+count*2));
 e.set_esi(object);e.set_esp(0x7408000);e.set_eip(0x4ec4e8);e.set_bp(0x4ec526);
 const attachment=globalThis.__strongholdPresetAttachment;
 if(workerData.observed)attachment.invoke('start',{command:11});
 if(workerData.observed||workerData.trace)e.set_trace_esp(1,0,0);
 let pending;
 const slice=n=>new Promise((resolve,reject)=>{pending={resolve,reject};parentPort.postMessage({t:'fixtureSlice',steps:n});});
 workerData.port.on('message',m=>{if(m.t==='slice'){const p=pending;pending=null;m.value.trapped?p.reject(Error(m.value.trapped)):p.resolve(m.value.blocks);}});
 const started=performance.now(),checkpoints=[];
 for(let i=0;i<16;i++){
  const blocks=await slice(64000);
  checkpoints.push({blocks,pc:e.get_eip()>>>0,remaining:e.get_edi()>>>0});
  if(e.get_eip()>>>0===0x4ec526)break;
 }
 const elapsedMs=performance.now()-started;
 assert.equal(e.get_eip()>>>0,0x4ec526,'original fixed-count initializer must exit');
 assert.equal(e.get_edi()>>>0,0);assert.equal(e.get_eax()>>>0,to+count*2);assert.equal(e.get_edx()>>>0,from+count*4);
 for(let i=0;i<count;i++)assert.equal(dv.getUint16(wa(to+i*2),true),[0xfffe,0xffff,0][i%3], 'entry '+i);
 for(const a of [to-2,to+count*2])assert.equal(dv.getUint16(wa(a),true),guard);
 assert.equal(hash(b.subarray(wa(0x4ec4e8),wa(0x4ec526))),codeBefore,'original code remains unchanged');
 let observation=null;if(workerData.observed){observation=attachment.report().report;assert.equal(observation.status,'running');assert.equal(observation.fault,null);attachment.invoke('finish',{reason:'offline-initializer-complete'});}
 e.set_trace_esp(0,0,0);e.clear_bp();
 parentPort.postMessage({pass:true,initializer:true,elapsedMs,checkpoints,outputSHA256:hash(b.subarray(wa(to),wa(to+count*2))),
  codeSHA256:codeBefore,observation,workerSourceSHA:globalThis.fixtureWorkerSHA,
  limits:'Synthetic data/registers; exact original fragment only, not historical register recovery or full setup/game execution'});
}
async function physical(){
 const {e,memory,host}=globalThis.fixtureAccess,b=new Uint8Array(memory.buffer),dv=new DataView(memory.buffer);
 const wa=a=>g2w(a,0x400000,memory),put=(a,v)=>b.set(v,wa(a)),u32=(a,v)=>dv.setUint32(wa(a),v>>>0,true);
 b.set(exe,e.get_staging());assert(e.load_pe(exe.length));e.set_api_log(0);
 if(workerData.control)return controlFixture({e,memory,host});
 if(workerData.draw)return drawFixture({e,memory,host});
 if(workerData.initializer)return initializer({e,memory,host});
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
  rejects('oversizedBoundaryBudget',{maxBoundaries:50000001},/maxBoundaries/);
  let budget=fresh();assert.equal(budget.report.limits.maxBoundaries,50000000);assert.equal(budget.report.limits.maxMs,360000);budget.finish();
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
  x=start({maxBoundaries:1});e.set_trace_esp(1,0,0);await assert.rejects(execute(7),/overflow/);assert.match(x.report.fault,/overflow/);assert.equal(x.report.blocks,2);assert.notEqual(e.get_eip()>>>0,stop);negatives.boundaries=x.report.fault;e.set_trace_esp(0,0,0);
  x=start({maxRecords:1});e.set_trace_esp(1,0,0);await assert.rejects(execute(7),/overflow/);assert.notEqual(e.get_eip()>>>0,stop);assert.equal(x.report.records.length,1);negatives.nativeRecords=x.report.fault;e.set_trace_esp(0,0,0);
  x=start();e.set_current_thread_id(2);x.check();assert.match(x.report.fault,/thread/);e.set_current_thread_id(1);negatives.thread=x.report.fault;
  const val=b[wa(0x430e10)];b[wa(0x430e10)]^=1;x=start();assert.match(x.report.fault,/bytes/);b[wa(0x430e10)]=val;negatives.bytesChanged=x.report.fault;
  x=start({memory:new WebAssembly.Memory({initial:1})});assert.match(x.report.fault,/memory/);negatives.memory=x.report.fault;
  x=start({getExports:()=>({...e})});assert.equal(x.report.status,'running');x.check();assert.match(x.report.fault,/instance/);negatives.instance=x.report.fault;
  // Real original setup entry without a preceding callback must be rejected.
  x=start();e.set_trace_esp(1,0,0);await assert.rejects(execute(7,0x429100),/history/);assert.match(x.report.fault,/history/);negatives.setupHistory=x.report.fault;e.set_trace_esp(0,0,0);
  let time=0;x=start({now:()=>time,deadline:10});time=10;x.check();const first=x.report.fault;x.finish('later');x.annotate({});assert.equal(x.report.fault,first);negatives.earliestFault=first;
  time=0;x=start({now:()=>time,deadline:10});time=10;e.set_trace_esp(1,0,0);await assert.rejects(execute(7),/deadline/);assert.equal(x.report.blocks,0);assert.notEqual(e.get_eip()>>>0,stop);negatives.nativeExpiry=x.report.fault;e.set_trace_esp(0,0,0);
 }
 parentPort.postMessage({pass:true,segments,observation,negatives,workerSourceSHA:globalThis.fixtureWorkerSHA,
  limits:'Synthetic dependency returns and setup epilogue; no original full setup/game execution claim'});
}
// Deliberately synthetic data/caller, executed original instructions. The
// unobserved and trace-only arms independently seal every memory page and CPU
// register after the same shipped-Worker slice commands, including failures.
async function controlFixture({e,memory,host}){
 const b=new Uint8Array(memory.buffer),dv=new DataView(memory.buffer),wa=a=>g2w(a,0x400000,memory);
 const put=(a,v)=>b.set(v,wa(a)),u32=(a,v)=>dv.setUint32(wa(a),v>>>0,true),get=a=>dv.getUint32(wa(a),true);
 const caller=0x580000,stop=caller+64,stack=0x7408000,manager=0x692f48,child=0x5ba6b8;
 put(stop,[0xeb,0xfe]);
 // Original initializer establishes the owner/callback links; widget geometry
 // and sprite metadata below are explicit fixture inputs, never gameplay.
  for(const [a,v]of [[0x1681318,99],[0x995678,0],[0x657abc,0],[0x657ab0,0],[0x657ab4,1],[0x8ed440,0]])u32(a,v);
 dv.setInt16(wa(0x7eb740),12,true);dv.setInt16(wa(0x7eb742),12,true);
 const attachment=globalThis.__strongholdPresetAttachment;
 if(workerData.observed)attachment.invoke('start',{command:1});
 e.set_trace_esp(workerData.observed||workerData.trace?1:0,0,0);
 let pending,submitted=0;const slice=n=>new Promise((resolve,reject)=>{submitted++;pending={resolve,reject};parentPort.postMessage({t:'fixtureSlice',steps:n});});
 workerData.port.on('message',m=>{if(m.t==='slice'){const p=pending;pending=null;m.value.trapped?p.reject(Error(m.value.trapped)):p.resolve(m.value.blocks);}});
 const snapshot=()=>({registers:Object.fromEntries(['eip','esp','eax','ebx','ecx','edx','esi','edi','ebp','flag_op','flag_a','flag_b','flag_res','flag_sign_shift','yield_reason'].map(n=>[n,e['get_'+n]()>>>0])),
  pages:Array.from({length:b.length/65536},(_,i)=>hash(b.subarray(i*65536,(i+1)*65536)))});
 const segments=[];
 async function execute(name,target,arg=0,ecx=0){
  put(caller,[0x68,...le(arg),0xb9,...le(ecx),0xb8,...le(target),0xff,0xd0,0x83,0xc4,4,0xe9,...le(stop-(caller+25))]);
  e.invalidate_code_range(caller,25);e.set_eip(caller);e.set_esp(stack);
  const slices=[];for(let i=0;i<1000&&(e.get_eip()>>>0)!==stop;i++)slices.push(await slice(64));
  assert.equal(e.get_eip()>>>0,stop,name);segments.push({name,slices,...snapshot()});
  if(workerData.observed)assert.equal(attachment.report().report.status,'running',JSON.stringify(attachment.report().report));
 }
 // The initializer's ret4 cleans the pushed descriptor. Use an exact fixture
 // CALL, not execute()'s cdecl cleanup, to keep caller ESP identical.
 put(caller,[0x68,...le(0x5ba528),0xb9,...le(manager),0xb8,...le(0x4e9280),0xff,0xd0,0xe9,...le(stop-(caller+22))]);
 e.invalidate_code_range(caller,22);e.set_eip(caller);e.set_esp(stack);
 for(let i=0;i<100&&(e.get_eip()>>>0)!==stop;i++)await slice(64);
 assert.equal(e.get_eip()>>>0,stop);assert.equal(get(child+0x4c),manager);assert.equal(get(child+0x14),0x42d880);
 u32(manager+0x38,child);
 u32(0x69332c,7);u32(0x1681318,0);await execute('hover-mode-rejected',0x42d850,1);assert.equal(get(0x69332c),7);
 u32(0x1681318,0);await execute('activation-mode-rejected',0x42d880,1);
 u32(0x1681318,99);u32(0x69165c,2);await execute('activation-pending-rejected',0x42d880,1);assert.equal(get(0x69165c),2);
 for(const [suppressed,hover,press] of [[0,1,0],[1,1,0],[0,0,1],[0,0x8000,2]]){
  u32(0xd138b0,suppressed);u32(0x69332c,9);dv.setUint16(wa(child+0x32),hover,true);dv.setUint16(wa(child+0x34),press,true);
  dv.setUint16(wa(child+0x36),0,true);dv.setUint16(wa(child+0x38),0,true);
  await execute('widget-feedback-'+suppressed+'-'+hover+'-'+press,0x4e9e30,0,child);assert.equal(get(0x995674),suppressed?0:((hover<<16>>16)|(press<<16>>16))>>>0);assert.equal(get(0x69332c),suppressed?9:1);
 }
 for(const [label,offset]of [['hidden',0x36],['disabled',0x38]]){
  dv.setUint16(wa(child+offset),1,true);await execute('widget-'+label,0x4e9e30,0,child);dv.setUint16(wa(child+offset),0,true);
 }
 const childFlags=get(child);
 for(const [label,flag]of [['hiddenFlag',0x80000000],['drawMode1ExcludedFlag',0x800000]]){
  u32(child,childFlags|flag);await execute('widget-'+label,0x4e9e30,0,child);u32(child,childFlags);
 }
 // Independent original traversal oracle: exact flag/mode branches decide
 // whether the normal draw CALL block is reached. Stop before that CALL;
 // arbitrary caller/registers are fixture inputs, never a natural UI claim.
 const visibilityDecisions=[];
 for(const [flag,mode,target]of [[0,1,0x4e95b9],[0x80000000,1,0x4e95c9],[0x800000,1,0x4e95c9],[0x800000,3,0x4e95b9]]){
  u32(child,childFlags|flag);e.set_esi(child);e.set_edi(mode);e.set_ebx(manager);e.set_esp(stack);e.set_eip(0x4e9579);
  const slices=[];for(let i=0;i<16&&![0x4e95b9,0x4e95c9].includes(e.get_eip()>>>0);i++)slices.push(await slice(1));
  assert.equal(e.get_eip()>>>0,target,'original flag/mode traversal');visibilityDecisions.push({flag,mode,target,slices});
 }
 u32(child,childFlags);segments.push({name:'original-widget-visibility-branches',...snapshot()});
 const inputDecisions=[];
 for(const [hidden,disabled,target]of [[0,0,0x4e964b],[1,0,0x4e9e18],[0,1,0x4e9e18]]){
  dv.setUint16(wa(child+0x36),hidden,true);dv.setUint16(wa(child+0x38),disabled,true);
  e.set_ecx(child);e.set_esp(stack);e.set_eip(0x4e9620);
  const slices=[];for(let i=0;i<8&&![0x4e964b,0x4e9e18].includes(e.get_eip()>>>0);i++)slices.push(await slice(1));
  assert.equal(e.get_eip()>>>0,target,'original hidden/disabled input branch');inputDecisions.push({hidden,disabled,target,slices});
 }
 dv.setUint16(wa(child+0x36),0,true);dv.setUint16(wa(child+0x38),0,true);
 segments.push({name:'original-widget-input-gates',...snapshot()});
 u32(manager+0x38,child+4);await execute('foreign-selected-identity',0x42d850,1);u32(manager+0x38,child);
 u32(0x69165c,1);u32(0x1bd26a4,0);u32(0x691bd0,0);await execute('updater-no-edge',0x42db40);
 for(const [a,v]of [[0x69165c,4],[0x1bd26a4,1],[0xfb4620,0],[0xdbbd30,0],[0xfb464c,0],[0xfb4638,0]])u32(a,v);
 await execute('updater-application',0x42db40);assert.equal(get(0x69165c),0);
 for(const [held,previous,entry]of [[1,0,0x468b39],[1,1,0x468b2f],[0,1,0x468b39]]){
  u32(0x1bd26b0,held);u32(0x1bd26bc,previous);u32(0x1bd26a4,99);
  e.set_esi(0x1bd2670);e.set_edi(0);e.set_ebx(1);e.set_ebp(0);e.set_esp(stack);e.set_eip(entry);
  const slices=[];for(let i=0;i<8&&(e.get_eip()>>>0)!==0x468b58;i++)slices.push(await slice(1));
  assert.equal(e.get_eip()>>>0,0x468b58);slices.push(await slice(1));assert.equal(get(0x1bd26a4),held&&!previous?1:0);
  segments.push({name:'mouse-edge-'+held+'-'+previous,slices,...snapshot()});
 }
 // Leave an actual original choice-1 invocation pending at its UI helper.
 u32(0x1681318,99);u32(0x69165c,0);
 put(caller,[0x68,...le(1),0xb8,...le(0x42d880),0xff,0xd0,0xeb,0xfe]);e.invalidate_code_range(caller,14);e.set_eip(caller);e.set_esp(stack);
 const slices=[];for(let i=0;i<4096&&(e.get_eip()>>>0)!==0x46cbe0;i++)slices.push(await slice(1));
 assert.equal(e.get_eip()>>>0,0x46cbe0);slices.push(await slice(1));assert.equal(get(0x69165c),1);assert.equal(get(0x690f7c),1);
 segments.push({name:'partial-queued-activation',slices,...snapshot()});
 const paritySlices=submitted;let observation=null;const negatives={};
 if(workerData.observed){
  const r=attachment.report().report;assert.equal(r.status,'running',JSON.stringify(r));
  for(const kind of ['preset-hover-entry','preset-hover-return','preset-activation-entry','preset-activation-return','preset-widget-draw-entry','preset-widget-draw-return','preset-widget-feedback','preset-edge-decision','preset-edge-accepted','preset-application-entry','preset-application-return','preset-pending-cleared','native-press-edge-sampled','preset-queued'])assert(r.records.some(x=>x.kind===kind),kind);
  assert(r.records.some(x=>x.kind==='preset-widget-feedback'&&x.suppression===1&&x.after===0));
  assert(r.records.some(x=>x.kind==='preset-widget-feedback'&&x.suppression===0&&x.after===1));
  assert(r.records.some(x=>x.kind==='preset-hover-entry'&&x.widgetRelation?.pointer===child));
  assert(r.records.some(x=>x.kind==='preset-edge-decision'&&x.edge===0&&x.pending===1));
  assert(r.records.some(x=>x.kind==='preset-activation-entry'&&x.state.mode===0));
  assert(r.records.some(x=>x.kind==='preset-activation-entry'&&x.state.pending69165c===2));
  for(const key of ['hiddenFlag','drawMode1ExcludedFlag'])assert(r.records.some(x=>x.state.selectedWidget[key]===true),key);
  assert(r.records.some(x=>x.state.selectedWidget.pointer===child+4&&x.state.selectedWidget.identity.startsWith('unknown')));
  for(const key of ['hidden36','disabled38'])assert(r.records.some(x=>x.state.selectedWidget[key]===1),key);
  assert.equal(r.records.filter(x=>x.kind==='preset-queued').length,1);assert.equal(r.records.filter(x=>x.kind==='preset-application-entry').length,1);
  assert(r.records.every(x=>x.epoch===epoch));assert.equal(r.presentation.readinessGranted,false);assert.equal(r.presentation.hostRelation,null);
  // Synthetic host ACK receipt tests report composition only. It is not an
  // actual 64-step guest/browser ACK, input delivery or completed frame.
  attachment.invoke('annotate',{kind:'ACK',requested:64,before:0,steps:64,
   source:'synthetic host receipt; no native delivery or completed-frame claim',
   guests:[{requested:64,ran:64,steps:64,running:true,frozen:true,tickMs:16}]});
  const ack=r.records.at(-1);assert.equal(ack.annotation.kind,'ACK');
  assert(ack.nativeFrames.some(x=>x.name==='preset-activation'));assert(!ack.nativeFrames.some(x=>x.name==='preset-application'));
  assert.equal(ack.lastNativePC,r.lastNativePC);
  attachment.invoke('finish',{reason:'fixture-partial-pending'});observation=attachment.report().report;
  assert(observation.pending.some(x=>x.name==='preset-activation'));assert(!observation.records.some(x=>x.kind==='draw-return'));
 }
 e.set_trace_esp(0,0,0);
 const options={host,getExports:()=>e,translate:g2w,memory,workerSlot:0,endpointIdentity:1,epoch,exeSha256:api.EXE_SHA256,
  wasmSha256:workerData.wasmHash,workerURL:URL,expectedWorkerURL:URL,deadline:performance.now()+10000};
 if(workerData.observed){
  function fresh(extra={}){const x=api.attach({...options,...extra});x.start();return x;}
  async function negative(name,target,alter,pattern){
   const x=fresh();e.set_eip(target);e.set_esp(stack);u32(stack,stop);alter?.(x);e.set_trace_esp(1,0,0);
   await assert.rejects(slice(1),pattern);e.set_trace_esp(0,0,0);assert.match(x.report.fault,pattern);
   const first=x.report.fault,stopped=snapshot(),records=structuredClone(x.report.records);x.annotate({epoch:'foreign',command:2,kind:'begin'});x.finish('later');x.check();
   assert.equal(x.report.fault,first);assert.deepEqual(x.report.records,records);assert.deepEqual(snapshot(),stopped);negatives[name]=first;
  }
  await negative('applicationWithoutUpdater',0x42e490,null,/history/);
  await negative('returnWithoutApplication',0x42db77,null,/history/);
  await negative('edgeWithoutUpdater',0x42db5b,null,/history/);
  await negative('feedbackWithoutWidget',0x4e9ef9,()=>e.set_esi(child),/history/);
  await negative('wrongWidgetOwner',0x4e9e30,()=>{e.set_ecx(child);u32(child+0x4c,manager+4);},/owner/);u32(child+0x4c,manager);
  await negative('wrongMouseObject',0x468b39,()=>e.set_esi(0x1bd2674),/object/);
  await negative('wrongThread',0x42d850,()=>e.set_current_thread_id(2),/thread/);e.set_current_thread_id(1);
  const z=fresh();u32(0x1681318,0);e.set_eip(0x42d850);e.set_esp(stack);u32(stack,stop);e.set_trace_esp(1,0,0);
  await slice(1);u32(stack,stop+1);await assert.rejects(slice(1),/caller/);e.set_trace_esp(0,0,0);negatives.changedSavedCaller=z.report.fault;
  const proxy={...e,get_eip:()=>((e.get_eip()>>>0)+1)>>>0};
  const badPC=fresh({getExports:()=>proxy});e.set_eip(0x42d850);e.set_esp(stack);u32(stack,stop);e.set_trace_esp(1,0,0);
  await assert.rejects(slice(1),/registers/);e.set_trace_esp(0,0,0);negatives.wrongPC=badPC.report.fault;
  const pin=b[wa(0x4e9ee0)];const x=fresh();b[wa(0x4e9ee0)]^=1;e.set_eip(0x42d850);e.set_trace_esp(1,0,0);
  await assert.rejects(slice(1),/bytes/);e.set_trace_esp(0,0,0);b[wa(0x4e9ee0)]=pin;negatives.changedFeedbackBytes=x.report.fault;
  for(const [name,extra]of [['recordOverflow',{maxRecords:1}],['byteOverflow',{maxBytes:1}]]){const x=fresh(extra);if(x.report.status==='running')x.annotate({epoch,command:1,kind:'begin'});assert.match(x.report.fault,/overflow/);negatives[name]=x.report.fault;}
  const y=fresh();y.annotate({epoch:'foreign',command:1,kind:'begin'});assert.match(y.report.fault,/epoch/);negatives.foreignEpoch=y.report.fault;
 }
 parentPort.postMessage({pass:true,controls:true,paritySlices,segments,visibilityDecisions,inputDecisions,observation,negatives,limits:'Synthetic caller/data and original instruction fragments; no original gameplay, draw completion, host publication or readiness claim'});
}

async function drawFixture({e,memory,host}){
 const b=new Uint8Array(memory.buffer),dv=new DataView(memory.buffer),wa=a=>g2w(a,0x400000,memory);
 const put=(a,v)=>b.set(v,wa(a)),u32=(a,v)=>dv.setUint32(wa(a),v>>>0,true),get=a=>dv.getUint32(wa(a),true);
 const caller=0x580000,stop=caller+64,stack=0x7408000,tick=caller+112,clock=caller+160,clockCalls=clock+4;
 const jump=(from,to)=>put(from,[0xe9,...le(to-from-5)]);
 // Every tested native branch window is intact. Only unrelated composite UI
 // work is jumped; dependencies return normally through their genuine CALLs.
 // Clock values/data/caller remain synthetic fixture inputs, never game proof.
 const windows=[[0x42971b,0x4297b0],[0x429ad4,0x429b0e]];
 const intact=()=>windows.map(([a,z])=>{const bytes=b.subarray(wa(a),wa(z));assert.deepEqual(Buffer.from(bytes),original(a,z-a));return {from:a,to:z,sha256:hash(bytes)};});
 const branchWindows=intact();
 put(0x455240,[0xc2,12,0]);put(0x489180,[0xc3]);put(0x479fb0,[0xc3]);
 put(0x47a000,[0xc3]);put(0x449780,[0xc3]);
 jump(0x4293c2,0x42971b);jump(0x4297b0,0x429ad4);jump(0x429b0e,0x42a207);
 put(tick,[0xa1,...le(clock),0x83,0x05,...le(clock),100,0xff,0x05,...le(clockCalls),0xc3]);u32(0x5841c8,tick);
 put(caller,[0xb8,...le(0x4292c0),0xff,0xd0,0xe9,...le(stop-caller-12)]);put(stop,[0xeb,0xfe]);
 e.invalidate_code_range(0x400000,0x180000);
 const attachment=globalThis.__strongholdPresetAttachment;
 if(workerData.observed)attachment.invoke('start',{command:1});
 e.set_trace_esp(workerData.observed||workerData.trace?1:0,0,0);
 let pending,submitted=0;const slice=n=>new Promise((resolve,reject)=>{submitted++;pending={resolve,reject};parentPort.postMessage({t:'fixtureSlice',steps:n});});
 workerData.port.on('message',m=>{if(m.t==='slice'){const p=pending;pending=null;m.value.trapped?p.reject(Error(m.value.trapped)):p.resolve(m.value.blocks);}});
 const cases=[{gap:1280,fade:32,direction:-3,refresh:1},
  ...[0,16,32,39,40,80,1280].map(gap=>({gap,fade:32,direction:-3,refresh:0})),
  {gap:80,fade:31,direction:3,refresh:0},{gap:80,fade:0,direction:0,refresh:0},
  {gap:80,fade:1,direction:-3,refresh:0,previous:0xfffffff0},
  {gap:80,fade:31,direction:-3,refresh:0,alternate:1},
  {gap:80,fade:31,direction:-3,refresh:1,alternate:0x80000000},
  {gap:80,fade:31,direction:-3,refresh:2}].filter(c=>!process.env.STRONGHOLD_CALLBACK_BRANCH||(c.alternate?'alternate':c.refresh?'late':'refresh-zero')===process.env.STRONGHOLD_CALLBACK_BRANCH||c.refresh&&!c.alternate);
 const results=[];
 let prefix=[];
 for(const c of cases){
  const route=c.alternate?'alternate':c.refresh?'late':'refresh-zero';
  const previous=c.previous??1000,entry=(previous+c.gap)>>>0;
  for(const [a,v]of [[0xd13764,20],[0xd13770,20],[0x1681318,99],[0x692e18,c.fade],[0x690e54,c.direction],[0x175f9fc,c.refresh],[0x6921b8,previous],[0xd138b0,0],[0xd1375c,0xffffffff],[0xdbbd30,c.alternate||0],[0x691844,0x7fffffff],[clock,entry],[clockCalls,0]])u32(a,v);
  e.set_edi(0);e.set_eip(caller);e.set_esp(stack);const slices=[],checkpoints=[];
  // The same original invocation crosses queued slices without changing
  // guest data/registers between checkpoints. Breakpoints also hold the tier
  // guard identically in all parity arms; no observer history is seeded.
  for(const pc of [0x4293c2,0x42971b,route==='alternate'?0x429b04:0x42976a,route==='late'?0x429aee:0x429b0e,0x42a207,stop]){
   e.set_bp(pc);
   try{slices.push(await slice(64));}catch(error){throw Error(JSON.stringify({case:c,route,error:String(error),clockCalls:get(clockCalls),timestamp:get(0x6921b8),records:attachment?.report?.().report?.records?.slice(-12)}));}
   assert.equal(e.get_eip()>>>0,pc);checkpoints.push({pc,esp:e.get_esp()>>>0,clockCalls:get(clockCalls),timestamp:get(0x6921b8)});
   // Re-enter the SAME breakpoint once, consuming its documented skip-once
   // state before moving it. This executes one original block normally.
   try{slices.push(await slice(1));}catch(error){throw Error(JSON.stringify({case:c,route,error:String(error),clockCalls:get(clockCalls),timestamp:get(0x6921b8),records:attachment?.report?.().report?.records?.slice(-12)}));}
   e.clear_bp();
   if(workerData.observed){const r=attachment.report().report;assert.equal(r.status,'running');assert.deepEqual(r.records.slice(0,prefix.length),prefix);prefix=structuredClone(r.records);}
  }
  assert.equal(e.get_eip()>>>0,stop);
  // Independent division oracle; no multiply-high implementation shared with
  // production observer or native instructions.
  const advancing=c.direction!==0&&!c.refresh,delta=advancing?Math.trunc(c.gap/40)*Math.sign(c.direction):0;
  const fade=Math.max(0,Math.min(32,c.fade+delta));
  assert.equal(get(0x692e18),fade);assert.equal(get(0x690e54)|0,advancing&&c.direction<0&&fade===0?0:c.direction);
  const calls=route==='late'?2:1,timestamp=route==='late'?(entry+100)>>>0:previous;
  assert.equal(get(clockCalls),calls,'independent guest clock CALL counter');assert.equal(get(clock),(entry+100*calls)>>>0);
  assert.equal(get(0x6921b8),timestamp);assert.equal(get(0xd138b0),advancing?1:0);
  assert.equal(get(0x175f9fc),c.alternate?c.refresh:0);assert.equal(e.get_esp()>>>0,stack);
  assert.deepEqual(intact(),branchWindows);
  results.push({case:c,route,slices,checkpoints,clockCalls:calls,fade,timestamp,registers:Object.fromEntries(['eip','esp','eax','ebx','ecx','edx','esi','edi','ebp','flag_op','flag_a','flag_b','flag_res'].map(n=>[n,e['get_'+n]()>>>0]))});
 }
 // Execute all four original conditional Blt call blocks with initialized
 // synthetic COM objects and a stdcall result stub; no real surfaces exist.
 const manager=0x5a0000,object=0x5a1000,vtable=0x5a2000,target=0x5a3000;
 const beforeEarlyReturn=workerData.observed?attachment.report().report.records.length:null;
 u32(manager,0);u32(stack,stop);u32(stack+4,0);e.set_ecx(manager);e.set_esp(stack);e.set_eip(0x467b90);
 const earlySlices=[];for(let i=0;i<20;i++){earlySlices.push(await slice(64));if(e.get_eip()>>>0===stop)break;}
 assert.equal(e.get_eip()>>>0,stop);assert.equal(e.get_esp()>>>0,stack+8);
 if(workerData.observed)assert.equal(attachment.report().report.records.length,beforeEarlyReturn,'routine return alone creates no presentation witness');
 results.push({routineEarlyReturn:true,slices:earlySlices});
 u32(manager+0xb0,object);u32(manager+0xb4,0x5a4000);u32(manager+0xb8,0x5a5000);u32(object,vtable);u32(vtable+0x14,target);
 for(const [start,ret,result]of [[0x467cfd,0x467d20,0],[0x467d91,0x467db4,0x80004005],[0x467e28,0x467e4b,0],[0x467f35,0x467f58,0]]){
  put(target,[0xb8,...le(result),0xc2,24,0]);jump(ret,stop);e.invalidate_code_range(0x467b90,0x400);e.invalidate_code_range(target,8);
  e.set_esi(manager);e.set_ebp(0);e.set_esp(stack);e.set_eip(start);
  const slices=[];for(let i=0;i<20;i++){slices.push(await slice(64));if(e.get_eip()>>>0===stop)break;}
  assert.equal(e.get_eip()>>>0,stop);assert.equal(e.get_eax()>>>0,result);results.push({surfaceStart:start,result,slices});
 }
 let observation=workerData.observed?attachment.report().report:null;
 if(observation){assert.equal(observation.status,'running',JSON.stringify(observation));assert.equal(observation.records.filter(r=>r.kind==='draw-return').length,cases.length);
  for(const [i,r]of observation.records.filter(r=>r.kind==='draw-return').entries()){
   const expected=results[i];assert.equal(r.state.timestamp6921b8,expected.timestamp);
   const rows=observation.records.filter(x=>x.entrySequence===r.entrySequence);
   if(expected.route==='late'){assert.equal(r.state.timestamp6921b8,r.lateTime);assert.equal((r.lateTime-r.entryTime)>>>0,100);assert.equal(rows.filter(x=>x.kind==='draw-late-clock').length,1);}
   else{assert.equal(r.lateTime,undefined);assert.equal(rows.filter(x=>x.kind==='draw-late-clock').length,0);assert.equal(rows.filter(x=>x.kind==='draw-clock-bypass').length,1);assert.equal(rows.filter(x=>x.kind==='draw-timestamp-preserved').length,1);}
  }
  assert.equal(observation.records.filter(r=>r.kind==='surface-return').length,4);
  assert.deepEqual(observation.records.filter(r=>r.kind==='surface-return').map(r=>r.result),[0,0x80004005,0,0]);
  assert(observation.records.filter(r=>r.kind==='surface-return').every(r=>r.object===object&&r.vtable===vtable&&r.target===target&&r.precedingDrawReturn));
  assert.deepEqual(observation.presentation,{status:'pending',hostRelation:null,readinessGranted:false});}
 // Exercise a real shipped Blt API thunk as well. $run dispatches it before
 // log_block; an owning import must recover the exact original CALL stack.
 // Only objects/table/DIB/rectangles are synthetic; no real window or pixels.
 const thunkObservation=workerData.observed?{get report(){return attachment.report().report;},
  finish:reason=>attachment.invoke('finish',{reason})}:null;
 e.init_dx_com_thunks();e.seal_thunks();let blt=0;
 const bltId=require('../src/api_table.json').findIndex(r=>r.name==='IDirectDrawSurface_Blt');assert(bltId>0);
 for(let a=e.get_thunk_base();a<e.get_thunk_end();a+=8)if(e.thunk_word(a,1)===bltId){blt=a;break;}
 assert(blt,'actual Blt thunk');u32(vtable+0x14,blt);u32(object+4,3);
 const regions=require('../lib/region-map.generated.js'),table=regions.BASE.DX_OBJECTS,dib=regions.BASE.DIB_BACKING_BASE;
 for(const [slot,obj,flags,offset]of [[3,object,1,0],[4,0x5a4000,4,64]]){
  u32(obj+4,slot);for(const [o,value]of [[0,2],[4,1],[12,4|(4<<16)],[16,16|(8<<16)],[20,dib+offset],[28,flags]])dv.setUint32(table+slot*32+o,value,true);
 }
 for(const offset of [16,32])for(const [i,value]of [0,0,4,4].entries())u32(stack+offset+i*4,value);
 e.set_trace_esp(workerData.observed||workerData.trace?1:0,0,0);
 e.set_esi(manager);e.set_ebp(0);e.set_esp(stack);e.set_eip(0x467cfd);
 const thunkSlices=[];for(let i=0;i<20;i++){thunkSlices.push(await slice(64));if(e.get_eip()>>>0===stop)break;}
 assert.equal(e.get_eip()>>>0,stop);assert.equal(e.get_eax()>>>0,0);assert.equal(e.get_esp()>>>0,stack);
 if(thunkObservation){
  assert.equal(thunkObservation.report.status,'running',JSON.stringify(thunkObservation.report));
  const rows=thunkObservation.report.records,entry=rows.find(r=>r.kind==='surface-target-entry'&&r.target===blt);
  assert.equal(entry.target,blt);assert.equal(entry.entryEvidence,'owning-import-entry');
  assert(rows.some(r=>r.kind==='surface-return'&&r.result===0));
  for(const name of ['dx_trace','gdi_surface_attach','gdi_surface_upload'])assert(rows.some(r=>r.kind==='surface-import-request'&&r.name===name),name);
 }
 results.push({actualBltThunk:blt,slices:thunkSlices,registers:Object.fromEntries(['eip','esp','eax','ebx','ecx','edx','esi','edi','ebp','flag_op','flag_a','flag_b','flag_res'].map(n=>[n,e['get_'+n]()>>>0]))});
 e.set_trace_esp(0,0,0);
 const memorySHA256=hash(b),negatives={};
 if(workerData.observed){
  observation=structuredClone(attachment.report().report);
  const options={host,getExports:()=>e,translate:g2w,memory,workerSlot:0,endpointIdentity:1,epoch,exeSha256:api.EXE_SHA256,
   wasmSha256:workerData.wasmHash,workerURL:URL,expectedWorkerURL:URL,deadline:performance.now()+10000};
  const fresh=(extra={})=>{const h=api.attach({...options,...extra});h.start();assert.equal(h.report.status,'running');return h;};
  function reset(){u32(0xdbbd30,0);u32(0x175f9fc,0);e.set_eip(caller);e.set_esp(stack);e.set_trace_esp(1,0,0);}
  const stopped=()=>({pc:e.get_eip()>>>0,esp:e.get_esp()>>>0,calls:get(clockCalls),timestamp:get(0x6921b8),submitted});
  // This is the actual serialized production assert-live operation used by
  // createAttachment.beforeStep, after an executed native provenance fault.
  jump(0x4293c2,0x429b04);e.invalidate_code_range(0x4293c2,5);reset();
  await assert.rejects(slice(64),/provenance/);
  const originalFault=attachment.report().report.fault,beforeGate=stopped();
  await assert.rejects((async()=>{attachment.invoke('assert-live');await slice(64);})(),/terminal/);
  assert.deepEqual(stopped(),beforeGate);assert.equal(attachment.report().report.fault,originalFault);
  negatives.serializedNextSlice={fault:originalFault,stopped:beforeGate,nextSliceSent:false};
  jump(0x4293c2,0x42971b);e.invalidate_code_range(0x4293c2,5);
  const guardedSlice=async(h,n=64)=>{h.assertLive();if(h.report.status!=='running')throw Error(h.report.fault||'observer terminal');return slice(n);};
  async function rejected(h,name,pattern){
   assert.match(h.report.fault,pattern);assert.equal(h.report.status,'unsupported-or-unobservable');
   const first=h.report.fault,before=stopped(),rows=h.report.records.length,blocks=h.report.blocks;
   await assert.rejects(guardedSlice(h),pattern);h.finish('later');h.annotate({epoch:'stale',command:9,kind:'begin'});h.check();
   assert.deepEqual(stopped(),before);assert.equal(h.report.fault,first);assert.equal(h.report.records.length,rows);assert.equal(h.report.blocks,blocks);
   negatives[name]={fault:first,pc:before.pc,blocks,records:rows,nextSliceSent:false};
  }
  async function park(h,pc,refresh=0){reset();u32(0x175f9fc,refresh);e.set_bp(stop);for(let i=0;i<80&&(e.get_eip()>>>0)!==pc;i++)await guardedSlice(h,1);assert.equal(e.get_eip()>>>0,pc);e.clear_bp();}
  for(const [name,pc,next]of [['missingEntryClock',0x4292cd,0x429306],['missingUpdateBefore',0x429306,0x4293c2],['missingUpdateAfter',0x4293c2,0x42971b],['skippedDrawRET',0x42a207,caller+7]]){
   const x=fresh();await park(x,pc);e.set_eip(next);await assert.rejects(guardedSlice(x),/history|stack/);await rejected(x,name,/history|stack/);
  }
  for(const [name,pc,alter,pattern]of [
   ['wrongESP',0x42971b,()=>e.set_esp((e.get_esp()>>>0)+4),/stack/],
   ['wrongCaller',0x42971b,()=>u32(stack-4,caller+17),/caller/],
   ['wrongBranchSuccessor',0x42976a,()=>e.set_eip(0x429af5),/provenance/],
   ['preservedTimestamp',0x429b0e,()=>u32(0x6921b8,get(0x6921b8)^1),/timestamp/],
   ['skippedClockRET',tick,()=>e.set_eip(0x4292cd),/stack/]]){
   const x=fresh();await park(x,pc);alter();await assert.rejects(guardedSlice(x),pattern);await rejected(x,name,pattern);
  }
  let x=fresh();await park(x,0x429ad4,1);e.set_eip(0x429aee);
  await assert.rejects(guardedSlice(x),/CALL\/return/);await rejected(x,'skippedLateClockCALL',/CALL\/return/);
  x=fresh();await park(x,0x42976a);await guardedSlice(x,1);assert.equal(e.get_eip()>>>0,0x429af5);u32(0x175f9fc,1);
  await assert.rejects(guardedSlice(x),/provenance/);await rejected(x,'changedBranchOperand',/provenance/);
  for(const pc of [0x429723,0x429770]){
   x=fresh();await park(x,0x42971b);const byte=b[wa(pc)];b[wa(pc)]^=1;
   await assert.rejects(guardedSlice(x),/bytes/);await rejected(x,'branchByte'+pc.toString(16),/bytes/);b[wa(pc)]=byte;e.invalidate_code_range(pc,1);
  }
  const changedPins=api.PINS.map(([pc,hex])=>[pc,pc===0x42971b?'90'+hex.slice(2):hex]);
  x=api.observerFactory(api.EXE_SHA256,changedPins).attach(options);x.start();await rejected(x,'wrongBranchPins',/bytes/);
  x=fresh();await park(x,0x42971b);e.set_current_thread_id(2);x.assertLive();await rejected(x,'pendingOwner',/thread/);e.set_current_thread_id(1);
  x=fresh();await park(x,0x42971b);x.annotate({epoch:'stale',command:1,kind:'begin'});await rejected(x,'pendingEpoch',/epoch/);
  x=fresh();reset();e.set_eip(0x429af5);await assert.rejects(guardedSlice(x),/entry history/);await rejected(x,'staleBypassHistory',/entry history/);
  x=fresh();reset();const callByte=b[wa(caller+6)];b[wa(caller+6)]=0xe0;u32(stack,0);e.invalidate_code_range(caller,12);
  await assert.rejects(guardedSlice(x),/saved return/);await rejected(x,'skippedDrawCALL',/saved return/);b[wa(caller+6)]=callByte;e.invalidate_code_range(caller,12);
  let monotonic=0;x=fresh({now:()=>monotonic,deadline:100000,maxMs:100000});await park(x,0x42971b);const prefix=structuredClone(x.report.records);
  monotonic=50000;x.assertLive();assert.equal(x.report.status,'running');assert.deepEqual(x.report.records,prefix);
  monotonic=100000;x.assertLive();await rejected(x,'fixedDeadlineAcrossCheckpoints',/deadline/);
  x=fresh({maxRecords:6});reset();await assert.rejects(guardedSlice(x),/overflow/);await rejected(x,'branchRecordOverflow',/overflow/);
  let h=fresh();jump(0x4293c2,0x42a207);e.invalidate_code_range(0x4293c2,5);reset();
  await assert.rejects(slice(64),/history/);assert.match(h.report.fault,/history/);negatives.missingClock=h.report.fault;
  jump(0x4293c2,0x42971b);e.invalidate_code_range(0x4293c2,5);
  h=fresh();e.set_bp(0x42a207);reset();await slice(64);assert.equal(e.get_eip()>>>0,0x42a207);
  h.finish('fixture-missing-return');assert(h.report.pending.some(f=>f.name==='draw'));const count=h.report.records.length;
  assert.throws(()=>h.start(),/terminal/);h.annotate({epoch,command:1,kind:'begin'});assert.equal(h.report.records.length,count);negatives.missingReturnTerminal=true;e.clear_bp();
  h=fresh();h.annotate({epoch:'stale',command:1,kind:'begin'});assert.match(h.report.fault,/epoch/);negatives.staleEpoch=true;
  h=fresh();e.set_current_thread_id(2);h.check();assert.match(h.report.fault,/thread/);e.set_current_thread_id(1);negatives.wrongOwner=true;
  h=fresh();u32(0xd13770,99);reset();await assert.rejects(slice(64),/scene owner/);assert.match(h.report.fault,/scene owner/);u32(0xd13770,20);negatives.wrongSceneOwner=true;
  for(const [name,extra]of [['recordLimit',{maxRecords:1}],['countLimit',{maxBoundaries:1}]]){
   h=fresh(extra);reset();await assert.rejects(slice(64),/overflow/);assert.match(h.report.fault,/overflow/);negatives[name]=true;
  }
  h=api.attach({...options,maxBytes:1});h.start();assert.match(h.report.fault,/overflow/);negatives.byteLimit=true;
  const pin=b[wa(0x429335)];b[wa(0x429335)]^=1;h=api.attach(options);h.start();assert.match(h.report.fault,/bytes/);b[wa(0x429335)]=pin;negatives.drawBytePin=true;
 }
 parentPort.postMessage({pass:true,draw:true,results,observation,negatives,memorySHA256,branchWindows,
  limits:'Original instruction fragments with synthetic clocks/data/caller, background stub and UI jumps; no actual game draw/presentation witness'});
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
 // Read each existing module once for this process. Shared builds may replace
 // the path between parity arms; one in-memory fixture keeps their identity
 // exact without copying/restoring modules or asserting historical closure.
 const fixtureModules=new Map();
 async function one(variant,observed,trace=false,badBinding=false,init=false,forwardGuestLogs=false,draw=false,control=false){
  if(!fixtureModules.has(variant))fixtureModules.set(variant,fs.readFileSync(path.join(ROOT,'build',variant)));
  const bytes=fixtureModules.get(variant),memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true});
  const {port1,port2}=new MessageChannel(),sigs=require('../lib/host-import-sigs.generated.json').sigs;
  let brokerLogBlocks=0;
  const broker=require('../lib/guest-rpc').createMainBroker(memory,Object.fromEntries(Object.keys(sigs).map(n=>[n,()=>{
   if(!['log_block','log','log_i32','beep_process_begin','beep_thread_begin','midi_stream_service','dx_trace','gdi_surface_create','gdi_surface_attach','gdi_surface_upload'].includes(n))throw Error('unexpected fixture broker '+n);if(n==='log_block')brokerLogBlocks++;return n.startsWith('gdi_surface_')?1:0;
  }])),sigs);
  const module=await WebAssembly.compile(bytes),w=new Worker(__filename,{workerData:{port:port2,observed,trace,badBinding,initializer:init,draw,control,wasmHash:hash(bytes)},transferList:[port2]});
  return new Promise((resolve,reject)=>{let seq=0,done=false;const commands=[];
   const end=async(error,value)=>{if(done)return;done=true;clearTimeout(timer);await w.terminate();port1.close();error?reject(error):resolve({...value,commands,brokerLogBlocks,moduleSHA:hash(bytes)});};
   const timer=setTimeout(()=>end(Error('fixture Worker deadline')),40000);w.on('error',e=>end(e));
   w.on('message',m=>{
    if(m.t==='ready')port1.postMessage({start:true});else if(m.t==='rpc')broker.serveRpc(m.slot,m.waitEntry);
    else if(m.t==='call')broker.serveCall(m);else if(m.t==='calls')broker.serveCalls(m);
    else if(m.t==='fixtureSlice'){const c={t:'slice',seq:++seq,steps:m.steps};commands.push(c);w.postMessage(c);}
    else if(m.t==='sliceDone')port1.postMessage({t:'slice',value:m});
    else if(m.failure||m.t==='error')end(Error(JSON.stringify(m)));else if(m.pass)end(null,m);
   });w.postMessage({t:'init',seq:0,module,memory,sigs,slot:0,endpointIdentity:badBinding?2:1,forwardGuestLogs});
  });
 }
 async function composition(){
  const run=path.resolve(process.env.STRONGHOLD_CALLBACK_RUN||'scratch/runs/20261104-stronghold-first-script-cause-onward/observer-composition'),pins=path.join(run,'pins.json');fs.mkdirSync(run,{recursive:true});
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
 function blockForwardingControls(){
  const rpc=require('../lib/guest-rpc'),memory={buffer:new SharedArrayBuffer(8192*65536)},sigs={log_block:{params:['i32','i32'],results:[]}};
  for(const opts of [{},{forwardGuestLogs:false},{forwardGlLogs:false},{forwardGuestLogs:true},{forwardGlLogs:true},{forwardGuestLogs:false,forwardGlLogs:true}]){
   const expected=opts.forwardGuestLogs===undefined?!!opts.forwardGlLogs:!!opts.forwardGuestLogs,seen=[],errors=[];
   let posts=0,throws=false;
   const broker=rpc.createMainBroker(memory,{log_block:(...args)=>{if(throws)throw Error('forwarded block failure');seen.push(args);}},sigs,{onError:(_n,e)=>errors.push(e.message)});
   const worker=rpc.createWorkerImports(memory,sigs,m=>{posts++;assert.equal(m.t,'rpc');broker.serveRpc(m.slot,m.waitEntry);},{slot:0,...opts});
   worker.imports.host.log_block(0x4ec4f9,0x7408000);worker.flushAsync();
   assert.equal(posts,expected?1:0);assert.deepEqual(seen,expected?[[0x4ec4f9,0x7408000]]:[]);
   if(expected){throws=true;assert.throws(()=>worker.imports.host.log_block(1,2),/host import log_block threw/);assert.deepEqual(errors,['forwarded block failure']);}
  }
  console.log('PASS default/explicit/legacy block forwarding and synchronous exception semantics');
 }
 async function drawFixtures(){
   const results=[];
   for(const variant of (process.env.STRONGHOLD_CALLBACK_VARIANT?[process.env.STRONGHOLD_CALLBACK_VARIANT]:['wine-assembly.wasm','wine-assembly.compat.wasm'])){
    assert(['wine-assembly.wasm','wine-assembly.compat.wasm'].includes(variant));
    const control=await one(variant,false,false,false,false,false,true),trace=await one(variant,false,true,false,false,false,true),observed=await one(variant,true,false,false,false,false,true);
    for(const arm of [trace,observed]){assert.equal(arm.moduleSHA,control.moduleSHA,'same current module fixture');assert.deepEqual(arm.results,control.results);assert.deepEqual(arm.commands.slice(0,control.commands.length),control.commands);assert.equal(arm.memorySHA256,control.memorySHA256);}
    results.push({variant,control,trace,observed});console.log('PASS original draw instruction fragments, independent arithmetic oracle and full memory/register/command parity',variant);
   }
   return results;
 }
 async function hostPipelineControls(){
  // Independent host pipeline: no observer emit/annotate functions are called
  // by the producer. Normal imports, broker and drawing calls drive hooks.
  function fixture({observe=true,...extra}={}){
   const memory={buffer:new ArrayBuffer(4096)},canvas={},display={},calls=[],hwnd=65537,sid=0x200003;
   const presentation={canvas,directDraw:true,targetHwnd:hwnd,version:0,
    surface:{storage:new Uint8Array(memory.buffer),storageOffset:128}};
   const renderer={canvas:display,ctx:{canvas:display,drawImage(source){calls.push(['draw',this===renderer.ctx,source===canvas]);return 71;}},
    windows:{[hwnd]:{_backCanvas:canvas}},_immutablePublicationSequence:0,
    repaint(mode){calls.push(['repaint',this===renderer,mode]);
     if(mode==='throw')throw failure;
     this.ctx.drawImage(canvas,0,0);this._immutablePublicationSequence++;return 19;}};
   const failure=Error('independent original failure');let resolve,originalPromise;
   const imports={gdi_surface_upload(id,l,t,r,b){calls.push(['upload',this===imports,id,l,t,r,b]);
    if(l===-1)throw failure;if(l===-2)return 0;
    if(l===-3)return originalPromise=new Promise(done=>{resolve=()=>{presentation.version++;done(1);};});
    if(l===-4)return originalPromise=Promise.reject(failure);
    presentation.version++;return 1;}};
   const broker={serveCall(msg){return imports.gdi_surface_upload(...msg.args);},
    serveCalls(msg){return msg.args.map(args=>imports.gdi_surface_upload(...args));},serveRpc(slot,...args){return imports.gdi_surface_upload(...args);}};
   const instance={},owner={memory,instance,processId:1000,renderer,_hostImports:imports,hostCtx:{sharedGdi:{surfacePresentations:new Map([[sid,presentation]])}},guestWorker:{broker}};
   Object.assign(renderer.windows[hwnd],{wasm:instance,wasmMemory:memory,processId:1000});
   let current=owner,clock=0;
   const originals={upload:imports.gdi_surface_upload,repaint:renderer.repaint,draw:renderer.ctx.drawImage,serve:broker.serveCall};
   const h=observe?api.hostPresentationFactory().attach({getHost:()=>current,epoch,now:()=>clock,deadline:10000,...extra}):null;
   return {h,owner,renderer,imports,broker,presentation,calls,failure,originals,sid,hwnd,
    replace:()=>{current={...owner};},expire:()=>{clock=10001;},resolve:()=>resolve(),originalPromise:()=>originalPromise,
    upload:(l=0)=>broker.serveCall({slot:0,args:[sid,l,0,4,4]})};
  }
  const f=fixture();assert.equal(f.upload(),1);assert.equal(f.renderer.repaint('normal'),19);
  const off=fixture({observe:false});assert.equal(off.upload(),1);assert.equal(off.renderer.repaint('normal'),19);
  assert.deepEqual(f.calls,off.calls);assert.equal(f.presentation.version,off.presentation.version);
  assert.equal(f.renderer._immutablePublicationSequence,off.renderer._immutablePublicationSequence);
  assert.equal(hash(Buffer.from(f.owner.memory.buffer)),hash(Buffer.from(off.owner.memory.buffer)));
  assert.deepEqual(f.calls,[['upload',true,f.sid,0,0,4,4],['repaint',true,'normal'],['draw',true,true]]);
  f.h.capture(f.h.token(),'a'.repeat(64),'fresh');
  const host=structuredClone(f.h.report),native={epoch,status:'running',fault:null,records:[]};
  function row(kind,data){native.records.push({kind,epoch,sequence:native.records.length+1,...data});}
  row('surface-target-entry',{object:100,source:200,target:300});
  row('surface-import-request',{entrySequence:1,name:'dx_trace',args:[12,3,4,0,0],slot:3,sourceSlot:4});
  row('surface-import-request',{entrySequence:1,name:'dx_trace',args:[5,3,16,128,0],slot:3,sourceSlot:4});
  row('surface-import-request',{entrySequence:1,name:'gdi_surface_attach',args:[f.sid,f.hwnd],slot:3,sourceSlot:4});
  row('surface-import-request',{entrySequence:1,name:'gdi_surface_upload',args:[f.sid,0,0,4,4],slot:3,sourceSlot:4});
  row('surface-return',{entrySequence:1,hresultZero:true,result:0});
  const linked=api.linkPresentation(native,host);assert.equal(linked.relations.length,1);
  assert.equal(linked.relations[0].capture.sha256,'a'.repeat(64));
  assert.equal(linked.operationCompletion,null);assert.equal(linked.freshPixels,null);assert.equal(linked.readinessGranted,false);
  const negatives=[];
  for(const [name,mutate]of [
   ['foreign epoch',(_n,h)=>h.epoch='foreign'],['foreign row epoch',(_n,h)=>h.records[0].epoch='foreign'],
   ['failed HRESULT',n=>n.records.at(-1).hresultZero=false],['failed HRESULT value',n=>n.records.at(-1).result=0x80004005],['wrong native surface',n=>n.records[4].slot=8],
   ['wrong source',n=>n.records[1].args[2]=8],['wrong native target HWND',n=>n.records[3].args[1]++],
   ['wrong upload surface',(_n,h)=>h.records[0].id++],['wrong window',(_n,h)=>h.records[0].window++],
   ['wrong HWND',(_n,h)=>h.records[0].hwnd++],['wrong owner',(_n,h)=>h.records[0].slot=1],
   ['unknown owner',(_n,h)=>h.records[0].slot=null],['failed upload',(_n,h)=>h.records[0].result=0],
   ['wrong memory',(_n,h)=>h.records[0].owningMemory=false],['wrong storage',(_n,h)=>h.records[0].storageOffset++],
   ['foreign window process',(_n,h)=>h.records[0].owningWindow=false],
   ['stale version',(_n,h)=>h.records[1].draws[0].version++],['wrong canvas',(_n,h)=>h.records[1].draws[0].canvas++],
   ['wrong destination',(_n,h)=>h.records[1].displayCanvas++],['unattached',(_n,h)=>h.records[0].attached=false],
   ['pending async',(_n,h)=>h.pending=1],['terminal',(_n,h)=>h.status='terminal'],
   ['native terminal',n=>n.status='terminal'],['no completed present',(_n,h)=>h.records.splice(1,1)]]){
   const n=structuredClone(native),h=structuredClone(host);mutate(n,h);assert.equal(api.linkPresentation(n,h).relations.length,0,name);negatives.push(name);
  }
  const failed=fixture();assert.throws(()=>failed.upload(-1),e=>e===failed.failure);assert.equal(failed.upload(-2),0);
  assert.throws(()=>failed.renderer.repaint('throw'),e=>e===failed.failure);
  assert(!failed.h.report.records.some(r=>r.kind==='renderer-completed'));failed.h.finish();
  const foreign=fixture();foreign.renderer.windows[foreign.hwnd].processId++;
  foreign.upload();foreign.renderer.repaint();assert.equal(foreign.h.report.records[0].owningWindow,false);
  assert.equal(foreign.h.report.records[1].draws[0].owningWindow,false);foreign.h.finish();
  const replaced=fixture(),replacement=()=>77;replaced.imports.gdi_surface_upload=replacement;
  replaced.h.check();assert.match(replaced.h.report.fault,/owner replaced/);assert.equal(replaced.imports.gdi_surface_upload,replacement);
  const pending=fixture(),promise=pending.upload(-3);assert(promise instanceof Promise);assert.equal(promise,pending.originalPromise());assert.equal(pending.h.report.pending,1);
  assert.equal(pending.h.report.records.length,0);pending.resolve();assert.equal(await promise,1);await Promise.resolve();
  assert.equal(pending.h.report.pending,0);assert.equal(pending.h.report.records[0].result,1);pending.h.finish();
  const rejected=fixture(),rejection=rejected.upload(-4);assert.equal(rejection,rejected.originalPromise());
  await assert.rejects(rejection,e=>e===rejected.failure);await Promise.resolve();assert.equal(rejected.h.report.pending,0);
  assert(!rejected.h.report.records.some(r=>r.kind==='host-upload-completed'));rejected.h.finish();
  const late=fixture(),latePromise=late.upload(-3);late.h.finish('uninstall-pending');late.resolve();assert.equal(await latePromise,1);
  await Promise.resolve();assert.equal(late.h.report.records.length,0);
  for(const mode of ['stale','epoch','pending','no-frame']){
   const s=fixture();if(mode!=='no-frame'){s.upload();s.renderer.repaint();}
   const token=s.h.token();if(mode==='stale')s.upload();if(mode==='epoch')token.epoch='wrong';if(mode==='pending')token.pending=1;
   s.h.capture(token,'b'.repeat(64),'stale');assert.match(s.h.report.fault,/capture/);s.h.finish();
  }
  for(const [name,extra,trigger]of [['records',{maxRecords:1},s=>{s.upload();s.upload();}],['bytes',{maxBytes:1},s=>s.upload()],
   ['owner',{},s=>{s.replace();s.upload();}],['deadline',{},s=>{s.expire();s.upload();}]]){
   const s=fixture(extra);trigger(s);assert(s.h.report.fault,name);assert.equal(s.imports.gdi_surface_upload,s.originals.upload);
  }
  f.h.finish();assert.equal(f.imports.gdi_surface_upload,f.originals.upload);assert.equal(f.renderer.repaint,f.originals.repaint);
  assert.equal(f.renderer.ctx.drawImage,f.originals.draw);assert.equal(f.broker.serveCall,f.originals.serve);
  const count=f.h.report.records.length;f.upload();f.renderer.repaint();assert.equal(f.h.report.records.length,count);
  console.log('PASS independent passive host pipeline identity/failure/async/cleanup/bounds controls; '+negatives.length+' structural join negatives; operation/fresh pixels remain unknown');
 }
 (async()=>{
  blockForwardingControls();
  await hostPipelineControls();
  if(process.argv.includes('--draw-only')){
   const results=await drawFixtures();
   if(process.env.STRONGHOLD_CALLBACK_RESULT)fs.writeFileSync(process.env.STRONGHOLD_CALLBACK_RESULT,JSON.stringify({passed:true,offlineOnly:true,fixtureOnly:true,results},null,2)+'\n');return;
  }
  if(process.argv.includes('--controls-only')){
   const evidence=await composition(),results=[];
   const runtime=require('../tools/stronghold-local-runtime.cjs'),run=path.resolve(process.env.STRONGHOLD_CALLBACK_RUN||'scratch/runs/20261104-stronghold-first-script-cause-onward/observer-composition'),pins=path.join(run,'pins.json');
   const local=runtime.prepare({run,pins});new vm.Script(local.source);new vm.Script(local.route);
   base.compileClosure(local.source.slice(0,local.source.lastIndexOf('main().catch(')),local.driver,local.route,local.evidence.retainedClosure);
   assert.equal(local.evidence.callbackObserver.passiveControls.readinessGranted,false);
   assert.equal(local.evidence.callbackObserver.passiveControls.presentation,'unknown');
   assert.throws(()=>runtime.acceptedRuntimePins(),/unknown runtime dependency mismatch/,'historical original binding stays closed after observer change');
   evidence.localRuntime={compositionSHA256:local.evidence.compositionSHA256,routeCompositionSHA256:local.evidence.routeCompositionSHA256,historicalBindingAccepted:false};
   for(const variant of ['wine-assembly.wasm','wine-assembly.compat.wasm']){
    const arms=[];for(const [observed,trace]of [[false,false],[false,true],[true,false]])arms.push(await one(variant,observed,trace,false,false,false,false,true));
    const [control,trace,observed]=arms;
    assert.deepEqual(observed.visibilityDecisions,control.visibilityDecisions);assert.deepEqual(trace.visibilityDecisions,control.visibilityDecisions);
    assert.deepEqual(observed.inputDecisions,control.inputDecisions);assert.deepEqual(trace.inputDecisions,control.inputDecisions);
    assert.deepEqual(observed.segments,trace.segments,'trace-only complete memory/register parity');
    assert.deepEqual(observed.segments,control.segments,'independent unobserved complete memory/register parity');
    assert.deepEqual(observed.commands.slice(0,observed.paritySlices),control.commands);assert.deepEqual(trace.commands,control.commands);
    for(const arm of arms)for(const segment of arm.segments)delete segment.pages;
    results.push({variant,control,trace,observed});console.log('PASS composed owning Worker passive preset/control fixtures; independent all-page/register/command parity',variant);
   }
   if(process.env.STRONGHOLD_CALLBACK_RESULT)fs.writeFileSync(process.env.STRONGHOLD_CALLBACK_RESULT,JSON.stringify({passed:true,fixtureOnly:true,offlineOnly:true,evidence,results},null,2)+'\n');return;
  }
  if(process.argv.includes('--initializer-only')){
   const results=[];
   for(const variant of ['wine-assembly.wasm','wine-assembly.compat.wasm']){
    const control=await one(variant,false,false,false,true),trace=await one(variant,false,true,false,true),observed=await one(variant,true,false,false,true),forwarded=await one(variant,true,false,false,true,true);
    for(const arm of [trace,observed,forwarded]){
     assert.equal(arm.outputSHA256,control.outputSHA256);assert.equal(arm.codeSHA256,control.codeSHA256);
     assert.deepEqual(arm.checkpoints,control.checkpoints);assert.deepEqual(arm.commands,control.commands);
    }
    assert.equal(trace.brokerLogBlocks,0,'quiet trace must not broker the default no-op log_block');
    assert.equal(observed.brokerLogBlocks,0,'local native observer retains all boundaries without no-op RPC');
    assert.equal(observed.observation.blocks,294800);assert.equal(forwarded.observation.blocks,observed.observation.blocks);
    assert.deepEqual(observed.observation,forwarded.observation,'native history and all finite observer guards are identical');
    assert.equal(forwarded.brokerLogBlocks,294800,'explicitly forwarded block diagnostics retain every synchronous call');
    results.push({variant,control,trace,observed,forwarded});console.log('PASS exact original 80400-entry initialization, all branches, fixed exit, output/counter/Worker-command parity; quiet no-op RPC removed, explicit forwarding retained',variant);
   }
   if(process.env.STRONGHOLD_CALLBACK_RESULT)fs.writeFileSync(process.env.STRONGHOLD_CALLBACK_RESULT,JSON.stringify({passed:true,offlineOnly:true,results,media:{path:EXE,sha256:api.EXE_SHA256}},null,2)+'\n');
   return;
  }
  const evidence=await composition(),drawResults=await drawFixtures(),results=[];
  for(const variant of ['wine-assembly.wasm','wine-assembly.compat.wasm']){
   const control=await one(variant,false),trace=await one(variant,false,true),observed=await one(variant,true);
   assert.equal(observed.workerSourceSHA,control.workerSourceSHA);assert.equal(trace.workerSourceSHA,control.workerSourceSHA);
   assert.deepEqual(observed.segments,trace.segments,'trace-armed full memory/register/return parity');
   assert.deepEqual(control.commands,trace.commands);assert.deepEqual(observed.commands.slice(0,control.commands.length),control.commands);
   const differences=observed.segments.map((s,i)=>{
    assert.deepEqual(s.registers,control.segments[i].registers);assert.deepEqual(s.returned,control.segments[i].returned);
    const d=s.pages.flatMap((v,j)=>v!==control.segments[i].pages[j]?[j*65536]:[]);assert.deepEqual(d,[]);return d;
   });
   for(const arm of [control,trace,observed])for(const s of arm.segments)delete s.pages;
   results.push({variant,control,trace,observed,differences});console.log('PASS executable owning Worker callback/branch/scene/setup fixtures and parity',variant);
  }
  const wrongInit=[];for(const variant of ['wine-assembly.wasm','wine-assembly.compat.wasm']){
   const rejected=await one(variant,true,false,true);assert(rejected.badBindingRejected);assert.equal(rejected.commands.length,0);wrongInit.push({variant,...rejected});
  }
  const out={passed:true,offlineOnly:true,fixtureOnly:true,evidence,results,drawResults,wrongInit,media:{path:EXE,sha256:api.EXE_SHA256}};
  if(process.env.STRONGHOLD_CALLBACK_RESULT)fs.writeFileSync(process.env.STRONGHOLD_CALLBACK_RESULT,JSON.stringify(out,null,2)+'\n');
 })().catch(e=>{console.error(e.stack);process.exitCode=1;});
}
