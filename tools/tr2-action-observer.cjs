'use strict';
// Serialized into the existing owning CPU Worker by the ordinary helper.
// No guest setters, translator calls, tracing flags, breakpoint or input changes.
function install({getInstance,replaceInstance,memory,rpc,workerSlot,endpointIdentity,
  expectedEndpoint,exeSha256,maxMs=2500,maxRecords=32,defer=false,stopAfterPair=false,
  now=()=>performance.now(),schedule=setTimeout,cancel=clearTimeout}={}) {
  const SHA='0811efa84bfab8c458b9e29976088152db4c14601a99ca4910c75a2d009233aa';
  if(exeSha256!==SHA||workerSlot!==0||endpointIdentity!==expectedEndpoint||
     !Number.isSafeInteger(endpointIdentity)||endpointIdentity<1)throw Error('TR2 owner/image mismatch');
  for(const [v,max] of [[maxMs,2500],[maxRecords,32]])
    if(!Number.isSafeInteger(v)||v<1||v>max)throw Error('TR2 observation bound');
  const original=getInstance(),e=original.exports;
  if(e.get_image_base()!==0x400000||e.get_current_thread_id()!==1)throw Error('TR2 instance mismatch');
  const view=new DataView(memory.buffer);
  // Frozen direct-window ABI only. guest_to_wasm can materialize GPU data.
  function read(a,n=4){
    const p=a-0x400000+0x12000;
    if(!Number.isSafeInteger(a)||a<0x400000||n<1||n>32||p+n>0x08000000||p+n>view.byteLength)throw Error('TR2 unmapped read');
    return Array.from(new Uint8Array(memory.buffer,p,n));
  }
  const u32=a=>{const b=read(a);return (b[0]+b[1]*256+b[2]*65536+b[3]*16777216)>>>0;};
  const u16=a=>{const b=read(a,2);return b[0]+b[1]*256;};
  const pins=[[0x4471fc,'57680001000050ff5124'],[0x447206,'85c07d3e'],
    [0x447233,'ff512485c0'],[0x44d2b1,'6878b05100e8359fffff'],
    [0x44d3bf,'6a08e8bafdffff'],[0x44d3c6,'83c40485c0740783cb40895c24146a09e8a5fdffff'],
    [0x44d18a,'668b0c45147f4600'],[0x44d21d,'8b0c8540b05100']];
  function verify(){for(const [a,hex] of pins)if(read(a,hex.length/2).map(b=>b.toString(16).padStart(2,'0')).join('')!==hex)throw Error('TR2 loaded instruction mismatch');}
  verify();
  const started=now(),report={version:2,workerSlot,endpointIdentity,exeSha256,started,
    deadline:started+maxMs,status:'active',qualified:false,records:[],boundaries:0,
    workBound:'at most one run(1) per remaining caller block, deadline checked at every boundary; no lifetime boundary quota',
    scope:'owning CPU Worker JS run boundaries only; internal WAT reentry and other threads unobserved; no weapon/aim or backend qualification'};
  let armed=!defer;
  let timer,lastBlocks=null,last=null,poll=null,action=null,restored=false;
  const facade=Object.assign(Object.create(null),e),wrapped={exports:facade};
  function finish(reason){
    if(report.status!=='active')return report;
    report.status=reason;report.ended=now();report.qualified=(reason==='removed'||reason==='witnessed')&&!action&&report.records.some(r=>r.kind==='action'&&r.poll!==null);
    report.pollObserved=report.records.some(r=>r.kind==='poll');
    report.noPollUnqualified=!report.pollObserved;
    report.pending=!!action;cancel(timer);
    if(getInstance()===wrapped){replaceInstance(original);restored=true;}
    else {report.status='owner-replaced';report.qualified=false;}
    report.removed=restored;return report;
  }
  function emit(row){if(report.records.length>=maxRecords){finish('overflow');return false;}report.records.push({at:now(),wallAt:Date.now(),boundary:report.boundaries,...row});return true;}
  function bitmap(){
    const v=rpc.views(memory,workerSlot).pub,s=rpc.SLOT,g=Atomics.load(v,s.GEN);
    const keys=[17,162,163].map(k=>({vk:k,down:!!(Atomics.load(v,s.KEYS+(k>>>5))&(1<<(k&31)))}));
    if(Atomics.load(v,s.KEYS_VALID)!==1||Atomics.load(v,s.GEN)!==g)throw Error('TR2 unpublished/changing Worker bitmap');
    return {generation:g,keys,atomicSnapshot:false};
  }
  function bindings(){return {configured:u16(0x467f14+16),default:u16(0x467ef8+16),conflict:u32(0x51b040+32)};}
  function observe(){
    if(report.status!=='active'||!armed)return;
    try {
      if(now()>=report.deadline)return finish('expired');
      if(getInstance()!==wrapped||e.get_current_thread_id()!==1)return finish('owner-replaced');
      ++report.boundaries;
      const pc=e.get_eip()>>>0,esp=e.get_esp()>>>0,stamp=pc+':'+esp;
      if(stamp===last)return;last=stamp;
      if(pc===0x44d2a0){poll=null;action=null;}
      if(pc===0x447206||pc===0x447236){
        verify();
        // Wrapper saves EDI. Its caller must be this input update.
        if(u32(esp+4)!==0x44d2bb||u32(esp+8)!==0x51b078)throw Error('TR2 poll caller/buffer mismatch');
        const row={kind:'poll',pc,esp,updateEsp:esp+8,hresult:e.get_eax()>>>0,
          ctrl:[read(0x51b095,1)[0],read(0x51b115,1)[0]],bitmap:bitmap(),binding:bindings()};
        if(emit(row))poll=report.records.length-1;return;
      }
      if(pc===0x44d3c6){
        verify();action={esp,poll:poll!==null&&report.records[poll].updateEsp===esp?poll:null,
          keyResult:e.get_eax()>>>0,binding:bindings(),before:e.get_ebx()>>>0};return;
      }
      // Taken JE lands at the join; fallthrough executes OR+store+push9+CALL.
      // Both successors preserve EBX, with pinned immutable instructions.
      if(action&&(pc===0x44d3d4||(pc===0x44d180&&u32(esp)===0x44d3db&&u32(esp+4)===9))){
        const a=action;
        if(esp!==(pc===0x44d3d4?a.esp+4:a.esp-4))throw Error('TR2 Action successor stack mismatch');
        verify();const ebx=e.get_ebx()>>>0;
        if(a.before&64)throw Error('TR2 Action bit already present before slot8');
        if(ebx!==((a.before|(a.keyResult?64:0))>>>0))throw Error('TR2 Action successor EBX mismatch');
        emit({kind:'action',pc,esp,poll:a.poll,keyResult:a.keyResult,binding:a.binding,ebx,action:!!(ebx&64),orExecuted:!!a.keyResult,
          outcome:a.poll===null?'no-poll-unqualified':report.records[a.poll].hresult!==0?'poll-failed':
            !report.records[a.poll].ctrl.some(b=>b&128)?'poll-without-control':!(ebx&64)?'binding-action-clear':'action-set-weapon-aim-unqualified'});
        action=null;poll=null;
        if(stopAfterPair&&a.poll!==null)finish('witnessed');
      }
    }catch(error){report.error=String(error);finish('unobservable');}
  }
  facade.run=n=>{
    lastBlocks=0;
    const runBase=steps=>{try{e.run(steps);}finally{lastBlocks+=e.get_last_run_blocks()>>>0;}};
    try {
      // run's argument is a BLOCK budget, not an instruction count. Folds
      // may retire more than one block even with run(1); debit actual work.
      // The deadline bounds the observation lifetime, rather than spending a
      // global counter before the native hold has had time to reach a poll.
      let remaining=n|0;
      if(!armed){runBase(remaining);return;}
      if(remaining<=0){runBase(remaining);return;}
      observe();
      while(remaining>0){
        if(report.status!=='active'){
          runBase(remaining);break;
        }
        runBase(1);
        const retired=e.get_last_run_blocks()>>>0;
        remaining-=retired;
        observe();
        if(e.get_yield_reason()||!e.get_eip()||e.get_last_run_halt()!==1)break;
        // A non-progressing CPU must not turn a caller's finite budget into
        // an observation spin. Restore and forward its remaining budget once.
        if(!retired){finish('no-progress');if(remaining>0)runBase(remaining);break;}
      }
    }catch(error){finish('guest-trap');throw error;}
  };
  facade.get_last_run_blocks=()=>lastBlocks===null?e.get_last_run_blocks():lastBlocks;
  replaceInstance(wrapped);timer=schedule(()=>finish('expired'),maxMs);
  return {finish,arm(){
    if(armed||report.status!=='active')throw Error('TR2 observer cannot arm');
    if(now()>=report.deadline){finish('expired');throw Error('TR2 observer expired before arm');}
    armed=true;report.armedAt=now();report.armedWallAt=Date.now();return true;
  },status:()=>JSON.parse(JSON.stringify(report))};
}
function workerSource(options){return `(()=>{if(globalThis.__tr2Action)throw Error('TR2 observer already used');globalThis.__tr2Action=(${install.toString()})({getInstance:()=>instance,replaceInstance:v=>{instance=v},memory,rpc:GuestRpc,workerSlot,endpointIdentity,...${JSON.stringify(options)}});return globalThis.__tr2Action.status()})()`;}
// Called inside the existing reviewed/native admission. The caller's hold()
// keeps the independent release timer and its unchanged input policy.
async function observedHold({evaluate,workerSession,expectedEndpoint,exeSha256,hold,record}){
  let receipt,report,armed=false;
  await evaluate(workerSource({expectedEndpoint,exeSha256,defer:true,stopAfterPair:true}),workerSession);
  try {receipt=await hold(async()=>{
    if(armed)throw Error('TR2 hold armed twice');
    await evaluate('globalThis.__tr2Action.arm()',workerSession);armed=true;
  });}
  finally {
    report=await evaluate("globalThis.__tr2Action.finish('removed')",workerSession);
    await record('observer',report);
  }
  const polls=report.records.filter(r=>r.kind==='poll'&&r.wallAt>=receipt.started&&r.wallAt<receipt.releaseAt);
  const actions=report.records.filter(r=>r.kind==='action'&&r.poll!==null&&
    polls.includes(report.records[r.poll])&&r.wallAt>=receipt.started&&r.wallAt<receipt.releaseAt);
  const physical=receipt.samples.some(s=>s.whollyDuringHold&&s.physical?.some(k=>k.key===17&&k.state===0x8000));
  const result={receipt,report,physicalControlSample:physical,pollsDuringHold:polls.length,actionsDuringHold:actions.length,
    qualified:armed&&report.qualified&&physical&&actions.length>0,
    scope:'native delivery/actual poll/binding/Action only; weapon/aim and CPU/WebGL2 backend authority unchanged'};
  await record('correlation',result);
  return result;
}
module.exports={install,workerSource,observedHold};
