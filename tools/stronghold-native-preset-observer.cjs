'use strict';

// Run-preload import observer. No guest execution, guest writes, trace arming,
// instruction-watch mode, recognizer, input or scheduler changes live here.
(() => {
const EXE_SHA256='9024c533095f2227b0105b7e8a9e4cf28ec4fb206b165629787b2c97cf99f13f';
const PINS=Object.freeze([
  [0x42d850,'833d18136801637517a17456990085c074098b442404a32c336900e920580300c3'],
  [0x42d880,'a1181368015683f8630f85e8010000a15c16690033f63bc60f85d90100008b442408480f8435010000'],
  [0x42d9de,'e8edfdffff'],
  [0x42d9e3,'8b0d8026bd018b15989750016a012bca8b158426bd015656890d5828bd018b0d9c975001685901000056562bd16a0268f9000000b9f8c0cb00c7055c16690001000000c7057c0f69000100000089350c10690089155c28bd018935d01b69008935fc2d6900c705c0266900e7ffffffe889f10300'],
  [0x42da62,'a3fc2d6900c7054c226900010000008935a426bd015ec3'],
  [0x42db40,'51a15c1669005333db563bc3be010000007434391da426bd01742c536affb92046fb00e8b80b0700a15c1669003bc3741650e81909000083c40433c0a35c1669008935042469008b0dd01b6900'],
  [0x42e490,'8b44240453480f84db000000487478480f8516010000'],
  [0x42e5bc,'5bc3'],
  [0x468b39,'8b46408b4e4c3bc1897e34897e28740f3bc7895e087405895e34eb03895e28']
].map(([pc,hex])=>Object.freeze({pc,hex})));
const CUTS=Object.freeze({hover:0x42d850,activate:0x42d880,choice1:0x42d9de,
  queueBefore:0x42d9e3,queueAfter:0x46cbe0,clearBefore:0x42da62,
  update:0x42db40,edge:0x42db53,edgeAccepted:0x42db5b,recheck:0x42db68,
  applyCall:0x42db71,apply:0x42e490,applyReturned:0x42db77,updateJoin:0x42db87,
  mouseBefore:0x468b39,mouseChanged:0x468b49,mouseSet:0x468b50,mouseAfter:0x468b58});
const ENTRIES=new Map([[CUTS.hover,'hover'],[CUTS.activate,'activation'],[CUTS.update,'updater'],[CUTS.apply,'application']]);
const STATES=Object.freeze({pending69165c:0x69165c,saved690f7c:0x690f7c,description69332c:0x69332c,
  mode1681318:0x1681318,feedback995674:0x995674,inputSuppressiond138b0:0xd138b0,mouse34:0x1bd26a4,mouse40:0x1bd26b0,mouse4c:0x1bd26bc});
const CONTROL_PINS=Object.freeze([[4623151,"c786cc010000fdffffff"],[4348368,"6828a55b00b9482f6900e8a1380c00c3"],[5149375,"8b10895848"],[5149481,"8b48108b78188d504c33f6f6420302741c837a14007503894a14837a1c007503897a1c83c25046f642030275e4"],[5150073,"8b06a90000008075472500008000740583ff03741785c0750583ff01740985ff740583ff027529"],[5150240,"83ec245355568bf15733ed8b3e81e7ffff7f0066396e36897c242c0f85d707000066396e380f85cd070000"],[5152304,"51535556578bf133ff66397e360f854b020000"],[5152459,"0fbf46340fbf4e320bc1893d80569900a374569900a1b038d1000fbf56383bc78915885699007406893d745699008b464c8b48143bcf747f"],[5152825,"83f801750c8b4e1851ff561c83c404eb1783f80375128b561852ff561ca17c56990083c404894648"],[5150627,"396e2c740fa19846fb0085c075068b564c897238"],[6006396,"80d84200"],[6006404,"50d84200"]].map(([pc,hex])=>Object.freeze({pc,hex})));

// Shared by the composed owning observer. This factory has no host hooks,
// timers, exports that mutate the guest, or independent resource budget.
// Its events use the owning observer's existing first-fault and finite caps.
function controlFactory({read,u32,getExports,emit,sequence,signatures}) {
 const manager=0x692f48,descriptor=0x5ba528,children=[0x5ba6b8,0x5ba708,0x5ba758];
 const cuts=new Set([0x42d850,0x42d880,0x42d9de,0x42d9e3,0x46cbe0,0x42da62,
  0x42db40,0x42db53,0x42db5b,0x42db68,0x42db71,0x42e490,0x42db77,0x42db87,
  0x468b2f,0x468b39,0x468b49,0x468b50,0x468b55,0x468b58,0x4e9e30,0x4e9ef3,0x4e9ef9,0x4e9f03,0x4e9f82]);
 const entries=new Map([[0x42d850,'preset-hover'],[0x42d880,'preset-activation'],
  [0x42db40,'preset-updater'],[0x42e490,'preset-application']]);
 const frames=[];let prior=null,mouse=null;
 const u16=a=>{const b=read(a,2);return b[0]+256*b[1];};
 function widget(pointer){
  const index=children.indexOf(pointer);
  if(index<0)return {pointer,identity:'unknown; not a numbered preset child'};
  const owner=u32(pointer+0x4c),root=u32(manager),argument=u32(pointer+0x18),flags=u32(pointer);
  const valid=owner===manager&&root===descriptor&&argument===index+1&&(flags&0x7fffff)===3&&
   u32(pointer+0x14)===0x42d880&&u32(pointer+0x1c)===0x42d850;
  return {pointer,owner,descriptor:root,argument,flags,identity:valid?'scene20-numbered-preset':'unknown; widget owner/descriptor/callback mismatch',
   hiddenFlag:!!(flags&0x80000000),drawMode1ExcludedFlag:!!(flags&0x800000),
   hidden36:u16(pointer+0x36),disabled38:u16(pointer+0x38),hover32:u16(pointer+0x32),press34:u16(pointer+0x34),
   selected:u32(manager+0x38)===pointer,visiblePixels:null,readinessGranted:false};
 }
 function state(){
  const root=u32(manager),selected=u32(manager+0x38);
  return {pending69165c:u32(0x69165c),feedback995674:u32(0x995674),description69332c:u32(0x69332c),
   mouse34:u32(0x1bd26a4),mouse40:u32(0x1bd26b0),mouse4c:u32(0x1bd26bc),
   selectedWidget:{manager,descriptor:root,pointer:selected,
    ...(root===descriptor&&selected?widget(selected):{identity:'unknown; no matching setup selection'})}};
 }
 function boundary(pc,esp){
  const ex=getExports(),top=frames.at(-1);
  if(top&&u32(top.esp)!==top.caller)throw Error('control saved caller changed');
  if(!cuts.has(pc)&&pc!==top?.caller){prior=pc;return;}
  signatures();
  let f=top,returned=null;
  if(f&&pc===f.caller){
   if(esp!==f.esp+4||u32(f.esp)!==f.caller)throw Error('control return stack/caller history mismatch');
   emit(f.name+'-return',{entrySequence:f.sequence,argument:f.argument,eax:ex.get_eax()>>>0});
   returned=f;frames.pop();f=frames.at(-1);
   if(returned.name==='preset-application'){if(f?.name!=='preset-updater')throw Error('application updater history missing');f.applicationReturned=true;}
  }
  if(entries.has(pc)){
   const name=entries.get(pc),caller=u32(esp),argument=name==='preset-updater'?null:u32(esp+4);
   if(!caller||frames.length>=8)throw Error('control saved return/nesting missing');
   if(name==='preset-application'&&(!f||f.name!=='preset-updater'||prior!==0x42db71||caller!==0x42db77||esp!==f.esp-20||argument!==u32(0x69165c)||!f.edgeAccepted))throw Error('application call/updater history missing');
   const widgetRelation=name==='preset-hover'&&f?.name==='preset-widget-draw'&&caller===0x4ea056&&prior===0x4ea04f&&(ex.get_esi()>>>0)===f.pointer?{entrySequence:f.sequence,pointer:f.pointer}:null;
   emit(name+'-entry',{caller,argument,widgetRelation});
   frames.push({name,caller,argument,esp,sequence:sequence()});f=frames.at(-1);
  }
  if([0x42d9de,0x42d9e3,0x42da62].includes(pc)&&f?.name!=='preset-activation')throw Error('activation history missing');
  if(pc===0x42d9e3)f.queueBefore=state();
  if(pc===0x46cbe0&&f?.queueBefore){
   if(f.name!=='preset-activation'||f.argument!==1||prior!==0x42d9e3||esp!==f.esp-40||u32(esp)!==0x42da57||u32(0x69165c)!==1||u32(0x690f7c)!==1)throw Error('preset queue history mismatch');
   emit('preset-queued',{entrySequence:f.sequence,before:f.queueBefore});delete f.queueBefore;
  }
  if([0x42db53,0x42db5b,0x42db68,0x42db71,0x42db77,0x42db87].includes(pc)){
   if(f?.name!=='preset-updater')throw Error('updater history missing');
   if(pc===0x42db53){f.edge=u32(0x1bd26a4);emit('preset-edge-decision',{entrySequence:f.sequence,edge:f.edge,pending:u32(0x69165c)});}
   if(pc===0x42db5b){if(prior!==0x42db53||!f.edge||u32(0x1bd26a4)!==f.edge)throw Error('native edge decision history missing');f.edgeAccepted=true;emit('preset-edge-accepted',{entrySequence:f.sequence});}
   if(pc===0x42db71&&(!f.edgeAccepted||prior!==0x42db68||!u32(0x69165c)||(ex.get_eax()>>>0)!==u32(0x69165c)))throw Error('application recheck history missing');
   if(pc===0x42db77&&!returned)throw Error('application return history missing');
   if(pc===0x42db87&&f.applicationReturned){
    if(prior!==0x42db77||u32(0x69165c)!==0||u32(0x692404)!==1)throw Error('application clear history mismatch');
    emit('preset-pending-cleared',{entrySequence:f.sequence});
   }
  }
  if(pc===0x468b2f||pc===0x468b39){
   if((ex.get_esi()>>>0)!==0x1bd2670||(ex.get_edi()>>>0)!==0||(ex.get_ebx()>>>0)!==1)throw Error('native mouse object/constants mismatch');
   mouse={sourcePC:pc,held:u32(0x1bd26b0),previous:u32(0x1bd26bc),esp};
  }
  if(mouse&&[0x468b49,0x468b50,0x468b55].includes(pc)){
   if(pc===0x468b49&&![0x468b2f,0x468b39].includes(prior)||pc!==0x468b49&&prior!==0x468b49)throw Error('native mouse branch history missing');
  }
  if(pc===0x468b58&&mouse){
   if((ex.get_esi()>>>0)!==0x1bd2670||esp!==mouse.esp||u32(0x1bd26b0)!==mouse.held||u32(0x1bd26bc)!==mouse.previous||
    ![0x468b2f,0x468b39,0x468b50,0x468b55].includes(prior)||u32(0x1bd26a4)!==(mouse.held!==mouse.previous&&mouse.held!==0?1:0))throw Error('native mouse edge history mismatch');
   emit('native-press-edge-sampled',{...mouse,edge:u32(0x1bd26a4)});mouse=null;
  }
  if(pc===0x4e9e30&&children.includes(ex.get_ecx()>>>0)){
   const w=widget(ex.get_ecx()>>>0),caller=u32(esp);
   if(w.identity!=='scene20-numbered-preset'||!caller||frames.length>=8)throw Error('widget owner/descriptor/caller mismatch');
   emit('preset-widget-draw-entry',{widget:w,caller});frames.push({name:'preset-widget-draw',pointer:w.pointer,caller,esp,sequence:sequence(),
    feedback:{suppression:u32(0xd138b0),before:((w.hover32<<16>>16)|(w.press34<<16>>16))>>>0}});f=frames.at(-1);
  }
  if([0x4e9ef3,0x4e9ef9,0x4e9f03,0x4e9f82].includes(pc)&&children.includes(ex.get_esi()>>>0)){
   if(f?.name!=='preset-widget-draw'||f.pointer!==(ex.get_esi()>>>0)||esp!==f.esp-20||u32(f.esp)!==f.caller||widget(f.pointer).identity!=='scene20-numbered-preset')throw Error('widget feedback history/owner mismatch');
   if(f.feedback){
    if(pc===(f.feedback.suppression?0x4e9ef3:0x4e9ef9))f.feedback.path=pc;
    if(pc===0x4e9f03||pc===0x4e9f82){
     if(!f.feedback.path||![0x4e9ef3,0x4e9ef9].includes(prior)||u32(0xd138b0)!==f.feedback.suppression||u32(0x995674)!==(f.feedback.suppression?0:f.feedback.before))throw Error('widget feedback suppression history mismatch');
     emit('preset-widget-feedback',{entrySequence:f.sequence,widget:widget(f.pointer),...f.feedback,after:u32(0x995674)});delete f.feedback;
    }
   }
  }
  prior=pc;
 }
 return {state,boundary,pending:()=>[...frames.map(f=>({...f})),...(mouse?[{name:'native-mouse-edge',...mouse}]:[])]};
}

const attached=new WeakSet();
function attach({host,getExports,workerSlot,exeSha256,wasmSha256,workerURL,expectedWorkerURL,
  deadline,now=()=>performance.now(),maxMs=10000,maxRecords=2048,maxBoundaries=1000000}={}) {
  if(workerSlot!==0||exeSha256!==EXE_SHA256||!(/^[a-f0-9]{64}$/).test(wasmSha256||'')||
    !workerURL||workerURL!==expectedWorkerURL)throw Error('unsupported Worker/module/media identity');
  if(typeof host?.log_block!=='function'||typeof getExports!=='function'||attached.has(host))throw Error('missing or occupied import owner');
  for(const [n,v,max]of [['maxMs',maxMs,10000],['maxRecords',maxRecords,4096],['maxBoundaries',maxBoundaries,2000000]])
    if(!Number.isSafeInteger(v)||v<1||v>max)throw Error('invalid '+n);
  const installed=now();if(!Number.isFinite(installed)||!Number.isFinite(deadline)||deadline<=installed)throw Error('expired/invalid original deadline');
  let end=deadline;const original=host.log_block,frames=[];
  let ex=null,active=false,lastPC=null,command=null,event=null,queueBefore=null,edgeBefore=null,timer=null;
  const report={version:1,status:'installed',exeSha256,wasmSha256,workerURL,workerSlot,installed,start:null,deadline:end,
    sequence:0,records:[],pending:[],history:'Before start unknown; no absence or gameplay readiness claim',
    evidence:'Actual owning import block boundaries; entry/return intervals are not certified CALL/RET events',
    correlation:'Command/drainage/capture annotations are caller evidence, never inferred native delivery',
    moduleBinding:'wasmSha256 is an external compile/send pin; independently verify the original page-to-Worker Module binding before arming',
    coverage:{blocks:0,entries:0,returns:0,queues:0,edgeDecisions:0,applications:0}};
  function finish(reason='explicit-stop') {
    if(!['installed','running'].includes(report.status))return report;
    active=false;clearTimeout(timer);report.status=reason;report.pending=frames.map(f=>({...f}));report.stop=now();
    if(host.log_block===wrapped)host.log_block=original;attached.delete(host);return report;
  }
  function fail(error){report.error=String(error?.message||error);return finish('unsupported-or-unobservable');}
  function read(a,n=4) {
    if(!Number.isSafeInteger(a)||a<=0||a+n>0x100000000||n<1||n>128)throw Error('invalid native read');
    const b=new Uint8Array(ex.memory.buffer),out=[];
    for(let i=0;i<n;i++){const w=ex.guest_to_wasm(a+i)>>>0;if(w===0xf0||w>=b.length)throw Error('unmapped native read');out.push(b[w]);}return out;
  }
  const u32=a=>{const b=read(a);return(b[0]+256*b[1]+65536*b[2]+16777216*b[3])>>>0;};
  function identity() {
    const e=getExports();if(!e||ex&&ex!==e)throw Error('foreign instance');ex=e;
    if(ex.get_current_thread_id()!==1||ex.get_image_base()!==0x400000)throw Error('foreign thread/loader');
    if(u32(0x40003c)!==0x118||u32(0x400118)!==0x4550||u32(0x40014c)!==0x400000||
      u32(0x400168)!==0x199e000)throw Error('foreign original PE header');
  }
  function signatures(){for(const {pc,hex}of PINS)if(read(pc,hex.length/2).map(b=>b.toString(16).padStart(2,'0')).join('')!==hex)throw Error('pinned original bytes changed');}
  const snapshot=()=>Object.fromEntries(Object.entries(STATES).map(([k,a])=>[k,u32(a)]));
  function emit(kind,extra={}) {
    if(!active)return false;
    if(report.records.length>=maxRecords){finish('record-limit');return false;}
    report.records.push({kind,sequence:++report.sequence,block:report.coverage.blocks,pc:ex.get_eip()>>>0,
      esp:ex.get_esp()>>>0,thread:1,command,event,state:snapshot(),...extra});return true;
  }
  function live() {
    if(!active)return false;
    if(now()>=end){finish('deadline-expired');return false;}
    identity();if(host.log_block!==wrapped)throw Error('import owner replaced');return true;
  }
  function boundary(pc,esp) {
    if(!live())return;
    if(report.coverage.blocks>=maxBoundaries){finish('boundary-limit');return;}
    report.coverage.blocks++;
    pc>>>=0;esp>>>=0;
    if(pc!==(ex.get_eip()>>>0)||esp!==(ex.get_esp()>>>0))throw Error('wrong native block registers');
    const relevant=Object.values(CUTS).includes(pc)||frames.at(-1)?.caller===pc;
    if(!relevant){lastPC=pc;return;}
    signatures();
    let f=frames.at(-1),returnedApplication=false;
    if(f&&pc===f.caller){
      if(esp!==f.esp+4)throw Error('return stack/history mismatch');
      if(!emit('native-return',{name:f.name,entrySequence:f.sequence,eax:ex.get_eax()>>>0}))return;
      returnedApplication=f.name==='application';frames.pop();report.coverage.returns++;f=frames.at(-1);
    }
    if(ENTRIES.has(pc)){
      if(frames.length>=8)throw Error('native nesting bound');
      const name=ENTRIES.get(pc),argument=name==='updater'?null:u32(esp+4),caller=u32(esp);
      if(name==='application'&&(!f||f.name!=='updater'||lastPC!==CUTS.applyCall||caller!==CUTS.applyReturned))throw Error('application prior updater/call history missing');
      if(!caller)throw Error('missing saved return');
      if(!emit('native-entry',{name,argument,caller}))return;
      frames.push({name,argument,caller,esp,sequence:report.sequence});report.coverage.entries++;
      if(name==='application')report.coverage.applications++;
    }
    f=frames.at(-1);
    if([CUTS.choice1,CUTS.queueBefore,CUTS.clearBefore].includes(pc)&&f?.name!=='activation')throw Error('activation prior history missing');
    if(pc===CUTS.queueBefore)queueBefore=snapshot();
    if(pc===CUTS.queueAfter&&queueBefore){
      if(f?.name!=='activation'||u32(STATES.pending69165c)!==1||u32(STATES.saved690f7c)!==1)throw Error('queue transition/history mismatch');
      if(!emit('preset-queued',{before:queueBefore}))return;queueBefore=null;report.coverage.queues++;
    }
    if([CUTS.edge,CUTS.edgeAccepted,CUTS.recheck,CUTS.applyCall,CUTS.applyReturned,CUTS.updateJoin].includes(pc)&&f?.name!=='updater')throw Error('updater prior history missing');
    if(pc===CUTS.applyReturned&&!returnedApplication)throw Error('application return prior history missing');
    if(pc===CUTS.edge){edgeBefore=snapshot();if(!emit('native-edge-decision',{edge:edgeBefore.mouse34,pending:edgeBefore.pending69165c}))return;report.coverage.edgeDecisions++;}
    if(pc===CUTS.edgeAccepted){if(lastPC!==CUTS.edge||!edgeBefore?.mouse34)throw Error('edge decision history missing');emit('native-edge-accepted');}
    if(relevant)emit('native-block',{label:Object.entries(CUTS).find(([,v])=>v===pc)?.[0]||'saved-return'});
    lastPC=pc;
  }
  function wrapped(pc,esp,...rest){
    try{boundary(pc,esp);}catch(error){fail(error);}
    // Diagnostic failures never change the normal import result/throw.
    try{return Reflect.apply(original,this,[pc,esp,...rest]);}
    catch(error){finish('normal-import-failed');throw error;}
  }
  host.log_block=wrapped;attached.add(host);
  return {report,
    start(){
      if(report.status!=='installed')throw Error('observer terminal/already started');
      try{identity();signatures();report.start=now();end=Math.min(deadline,report.start+maxMs);report.deadline=end;
        active=true;report.status='running';if(!live())return report;emit('baseline');
        const expire=()=>{if(!active)return;if(now()>=end)finish('deadline-expired');else {timer=setTimeout(expire,Math.max(1,end-now()));timer.unref?.();}};
        timer=setTimeout(expire,Math.max(1,end-now()));timer.unref?.();
      }catch(error){fail(error);}return report;
    },
    check(){try{if(live()&&report.coverage.blocks===0)throw Error('mandatory trace delivery missing');}catch(error){fail(error);}return report;},
    annotate(row){
      try{
        if(!live())return report;
        if(!row||!Number.isSafeInteger(row.command)||row.command<0||!['begin','DOWN-enqueued','DOWN-consumed','UP-enqueued','UP-consumed','ACK','capture','success','failed'].includes(row.kind))throw Error('invalid command annotation');
        if(JSON.stringify(row).length>4096)throw Error('command annotation size bound');
        if(row.kind==='begin'){if(command!==null)throw Error('unfinished command history');command=row.command;event=null;}
        else if(row.command!==command)throw Error('command history missing');
        if(row.kind==='DOWN-enqueued'){if(event!==null)throw Error('duplicate/reordered DOWN');event=row.kind;}
        if(row.kind==='DOWN-consumed'){if(event!=='DOWN-enqueued')throw Error('DOWN history missing');event=row.kind;}
        if(row.kind==='UP-enqueued'){if(event!=='DOWN-consumed')throw Error('UP before DOWN consumption');event=row.kind;}
        if(row.kind==='UP-consumed'){if(event!=='UP-enqueued')throw Error('UP history missing');event=row.kind;}
        if(row.kind==='capture'&&!/^[a-f0-9]{64}$/.test(row.sha256||''))throw Error('capture digest missing');
        emit('host-annotation',{annotation:JSON.parse(JSON.stringify(row))});
        if(row.kind==='failed')finish('command-failed');
        if(row.kind==='success'){if(event!=='UP-consumed')throw Error('balanced consumption history missing');command=null;event=null;}
      }catch(error){fail(error);}return report;
    },finish};
}
// Invoke in the selected, paused owning Worker before its entrypoint runs.
// The existing page compile/send evidence must independently bind wasmSha256
// to the one init Module. A WebAssembly.Module cannot be hashed after transfer.
function installPreload(options={}) {
  if(typeof document!=='undefined')throw Error('owning Worker preload only');
  const listen=options.listen|| (fn=>addEventListener('message',fn));
  const realmURL=options.realmURL||globalThis.location?.href;
  if(realmURL!==options.expectedWorkerURL)throw Error('wrong Worker realm URL');
  const original=WebAssembly.instantiate,entries=[];let incoming=null,closed=false;
  listen(event=>{if(event.data?.module instanceof WebAssembly.Module){
    if(incoming||entries.length){closed=true;for(const e of entries)e.observer?.finish('module-replaced');}
    incoming={module:event.data.module,slot:event.data.slot,type:event.data.t};
  }});
  async function wrapped(module,imports,...rest) {
    // Leave unrelated modules/Workers alone, while recording the exact gap.
    if(closed||!incoming||incoming.module!==module||incoming.slot!==0||incoming.type!=='init'){
      entries.push({error:'unbound/wrong init Module or Worker slot',observer:null});
      return Reflect.apply(original,this,[module,imports,...rest]);
    }
    let instance;
    const entry={installedBeforeInstantiation:true,slot:incoming.slot,getExports:()=>instance?.exports};entries.push(entry);
    try{
      const deadline=performance.now()+options.deadlineEpochMs-Date.now();
      entry.observer=attach({...options,host:imports.host,getExports:()=>instance?.exports,
        workerSlot:incoming.slot,workerURL:realmURL,deadline});
    }catch(error){entry.error=String(error.message||error);}
    try{const result=await Reflect.apply(original,this,[module,imports,...rest]);instance=result.instance||result;return result;}
    catch(error){entry.observer?.finish('instantiation-failed');throw error;}
  }
  WebAssembly.instantiate=wrapped;
  return {entries,
    start(){
      if(closed||entries.length!==1||!entries[0].observer||entries[0].error)throw Error('single owning instance prerequisite missing');
      return entries[0].observer.start();
    },
    // The caller owns existing trace diagnostics and the original deadline;
    // this installer deliberately never arms/restores any WASM export.
    finish(reason){closed=true;for(const e of entries)e.observer?.finish(reason);if(WebAssembly.instantiate===wrapped)WebAssembly.instantiate=original;}
  };
}
const api={EXE_SHA256,PINS,CONTROL_PINS,CUTS,STATES,controlFactory,attach,installPreload};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else globalThis.StrongholdNativePresetObserver=api;
})();
