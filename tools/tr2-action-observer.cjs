'use strict';
// Serialized into the existing owning CPU Worker by the ordinary helper.
// No guest setters, translator calls, tracing flags, breakpoint or input changes.
function mappingLayout(){
  const {BASE,SIZE}=require('../lib/region-map.generated');
  return {pageTable:BASE.GUEST_PAGE_TABLE,pageTableSize:SIZE.GUEST_PAGE_TABLE,
    lazyShared:BASE.D3DIM_LAZY_SHARED};
}
function install({getInstance,replaceInstance,memory,rpc,workerSlot,endpointIdentity,
  expectedEndpoint,exeSha256,maxMs=2500,maxRecords=32,defer=false,stopAfterPair=false,
  weapon=false,untilShot=false,readLayout,now=()=>performance.now(),schedule=setTimeout,cancel=clearTimeout}={}) {
  const SHA='0811efa84bfab8c458b9e29976088152db4c14601a99ca4910c75a2d009233aa';
  if(exeSha256!==SHA||workerSlot!==0||endpointIdentity!==expectedEndpoint||
     !Number.isSafeInteger(endpointIdentity)||endpointIdentity<1)throw Error('TR2 owner/image mismatch');
  for(const [v,max] of [[maxMs,2500],[maxRecords,32]])
    if(!Number.isSafeInteger(v)||v<1||v>max)throw Error('TR2 observation bound');
  const original=getInstance(),e=original.exports;
  if(e.get_image_base()!==0x400000||e.get_current_thread_id()!==1)throw Error('TR2 instance mismatch');
  const view=new DataView(memory.buffer);
  // Mirror the selected CPU's direct -> DIB -> packed-PTE lookup, using
  // metadata loads only. guest_to_wasm may materialize GPU data or fault/page
  // in a sparse miss. Neither is permissible during observation.
  const words=new Int32Array(memory.buffer);
  let readContext=null;
  function read(a,n=4,field='guest'){
    const fail=reason=>{
      const error=Error('TR2 unmapped read');
      error.readFailure={address:a,length:n,field,reason,...readContext};throw error;
    };
    if(!Number.isSafeInteger(a)||a<0||a>0xffffffff||!Number.isSafeInteger(n)||n<1||n>32||a+n>0x100000000)fail('invalid-span');
    const out=[],ptes=new Map();let dib=false;
    function lazy(){
      if(!readLayout||!Number.isSafeInteger(readLayout.lazyShared)||readLayout.lazyShared<0||
         readLayout.lazyShared%4||readLayout.lazyShared+32>view.byteLength)fail('mapping-layout-unavailable');
      // A pending DIB may contain stale bytes. Refuse conservatively instead
      // of calling a materializer, even if this particular span is disjoint.
      const p=readLayout.lazyShared/4;
      if(Atomics.load(words,p)||Atomics.load(words,p+1)||Atomics.load(words,p+4))fail('dib-pending');
    }
    for(let i=0;i<n;i++){
      const ga=a+i,direct=ga-0x400000+0x12000;
      let p;
      if(direct>=0&&direct<0x08000000)p=direct;
      else if(ga>=0x50000000&&ga<0x53f00000){
        if(!dib){lazy();dib=true;}p=0x1c000000+ga-0x50000000;
      }else{
        if(!readLayout||readLayout.pageTable!==0x1bc00000||readLayout.pageTableSize!==0x400000||
           readLayout.pageTable+readLayout.pageTableSize>view.byteLength)fail('mapping-layout-unavailable');
        const cell=(readLayout.pageTable+(ga>>>12)*4)/4;
        const pte=Atomics.load(words,cell)>>>0;
        if(!(pte&0x800))fail('pte-not-present');
        if(ptes.has(cell)&&ptes.get(cell)!==pte)fail('mapping-changed');ptes.set(cell,pte);
        p=((pte&0xfffff000)>>>0)+(ga&0xfff);
        // Reject corrupt PTEs into emulator-private storage. Sparse backing
        // is the fixed pool or the optional extension above initial memory.
        if(!((p>=0x08000000&&p<0x1a000000)||p>=0x20000000))fail('invalid-pte-backing');
      }
      if(p>=view.byteLength)fail('backing-out-of-bounds');
      out.push(view.getUint8(p));
    }
    for(const [cell,pte] of ptes)if((Atomics.load(words,cell)>>>0)!==pte)fail('mapping-changed');
    if(dib)lazy();
    return out;
  }
  const u32=(a,field)=>{const b=read(a,4,field);return (b[0]+b[1]*256+b[2]*65536+b[3]*16777216)>>>0;};
  const u16=(a,field)=>{const b=read(a,2,field);return b[0]+b[1]*256;};
  const pins=[[0x4471fc,'57680001000050ff5124'],[0x447206,'85c07d3e'],
    [0x447233,'ff512485c0'],[0x44d2b1,'6878b05100e8359fffff'],
    [0x44d3bf,'6a08e8bafdffff'],[0x44d3c6,'83c40485c0740783cb40895c24146a09e8a5fdffff'],
    [0x44d18a,'668b0c45147f4600'],[0x44d21d,'8b0c8540b05100']];
  function verify(){for(const [a,hex] of pins)if(read(a,hex.length/2).map(b=>b.toString(16).padStart(2,'0')).join('')!==hex)throw Error('TR2 loaded instruction mismatch');}
  verify();
  if(typeof weapon!=='boolean')throw Error('TR2 weapon option');
  if(typeof untilShot!=='boolean'||(untilShot&&!weapon))throw Error('TR2 untilShot option requires weapon');
  // Exact original windows: publication, callers, dispatch, arm/shot gates.
  const weaponPins=[
    [0x44dd55,'8b5424145f33c05ea0f8924d005d891578b151005b83c454'],
    [0x44dd63,'891578b151005b83c454c39090e82b8b0000a1a8b151006a'],
    [0x44d494,'a12cae4d0085c0741533c0891d78b15100a0f8924d005f5e'],
    [0x44d49f,'891d78b15100a0f8924d005f5e5d5b83c454c3f6057ab051'],
    [0x41427a,'e821900300393d18874d000f85c00200008b7424183bf774'],
    [0x411fd3,'e8c8b2030085c00f8527010000a178b15100a8400f852a01'],
    [0x4220a2,'e8f9b10200a120894d003bc5a178b15100741d3bc50f858a'],
    [0x42e640,'53555633f666393508175200577e0766ff0d081752006639'],
    [0x42e68d,'0fbf056216520083f8050f87a7020000ff248528eb420066'],
    [0x42e775,'a11c175200b2403bc6740f841578b151000fbf0572305200'],
    [0x42e803,'39307f358b0d3c1752005683c1348930516a30e8550b0100'],
    [0x42e807,'8b0d3c1752005683c1348930516a30e8550b010083c40c68'],
    [0x42e83c,'0fbfc18d48ff83f9060f87f900000033d28a91a4eb4200ff'],
    [0x42e85a,'50e8d0eaffff83c4045f5e5d5bc350e802d4ffff83c4045f'],
    [0x42eb28,'76e84200e7e84200a4e6420019e7420075e742006be74200'],
    [0x42eb98,'5ae8420068e8420044e94200000000010101019090909090'],
    [0x42eba4,'000000010101019090909090a08a165200b9a06c4600a804'],
    [0x4275a7,'e8947000008b47646a0050e8b9dafeff83c4085f5ec3e87e'],
    [0x4275bd,'e87e7000005f5ec39090909090909090909090a178b15100'],
    [0x431752,'e8e9ceffff8b4e646a0051e80e39feff83c4085f5ec39090'],
    [0x43210c,'e82fc5ffff8b57646a0052e8542ffeff83c4085f5e5dc390'],
    [0x42d330,'56578b7c240c8d047fc1e0032bc78d3445d06a4600a078b1'],
    [0x42d345,'a078b15100a840740b56e8dc19000083c404eb0ac705e016'],
    [0x42d452,'57e86800000083c40466833d0817520000750a66833d1a17'],
    [0x42d4c0,'51538b5c240c8b0de0165200558d045b56668b350e175200'],
    [0x42d4df,'66392d121752005766897424188d3c45d06a4600a078b151'],
    [0x42d4f3,'a078b151007550a840740485c974486683fe187c0ac74424'],
    [0x42d502,'6683fe187c0ac744241804000000eb0f6685f67e0f6683fe'],
    [0x42d54a,'6685f67c0f6683fe047d0dff442418e9030100006683fe04'],
    [0x42d562,'0f85a7000000a8407475a13c175200668b50426603151417'],
    [0x42d56c,'a13c175200668b5042660315141752006689542410668b15'],
    [0x42d595,'e8d61c000083c41085c07433668b472a8b0d3c17520066a3'],
    [0x42d59a,'83c41085c07433668b472a8b0d3c17520066a31a17520083'],
    [0x42d60f,'6683fe187c5183fb0375238b153c1752006a000fbf472c83'],
    [0x42d680,'a078b1510083c40866833d00175200007545a840740485c9'],
    [0x42d69a,'6683fe187c07be04000000eb0c6685f67e076683fe047f01'],
    [0x42d6d7,'6685f67c0c6683fe047d0a46e9f10000006683fe040f85a5'],
    [0x42d6ec,'0f85a5000000a8407473a13c175200668b50426603150217'],
    [0x42d6f6,'a13c175200668b5042660315021752006689542410668b15'],
    [0x42d71f,'e84c1b000083c41085c07437668b472a6685ed66a3081752'],
    [0x42d724,'83c41085c07437668b472a6685ed66a30817520075198b0d'],
    [0x42d797,'6683fe187c3c83fb0375238b153c1752006a000fbf472c83'],
    [0x42ed30,'8b0de016520083ec245633f63bce75216689351217520066'],
    [0x42eed0,'83ec3ca13c1752005355568b483457894c242c8b483881e9'],
    [0x42f270,'8b54240481ec54020000538d42fe555683f803577773ff24'],
    [0x42f2f9,'b81c175200c7051c175200e80300008b0833db3bcb0f8ead'],
    [0x42f308,'8b0833db3bcb0f8ead0200004989088d0452c1e0032bc28b'],
    [0x42f5c1,'5f5e89185d33c05b81c454020000c38df24200a8f24200de'],
    [0x42ea88,'663d04000f85f4fbfffff70578b151000000080074186897'],
    [0x42eab6,'a078b15100668b0d64165200a820755666390d6616520075'],
    [0x42eb1c,'66893d62165200e965fbffff76e84200e7e84200a4e64200'],
    [0x42edec,'668b4c240e668b54240c83c40885c00f84a20000008b4424'],
    [0x42ee40,'66393500175200741f663b50087c12663b500a7f0c663b48'],
    [0x42eea3,'6689351217520066893500175200668915e416520066890d'],
    [0x42e7ba,'841578b15100747a0fbfc183c0fe83f8057731ff248580eb'],
    [0x42eb80,'dbe74200e2e74200d4e74200f7e74200e9e74200f0e74200'],
    [0x42f505,'e8d600000083c40cb8010000005f5e5d5b81c454020000c3'],
    [0x42f5e0,'568b742408578b7c2414668b46226685c07e0e0fbfc03bc7'],
    [0x42f4f0,'8b5424148d4c241c8b42208b94246c020000505152'],
    [0x42f601,'8b44241066297e22804e461085c07422'],
    [0x42f673,'5f5ec3']];
  function verifyWeapon(){for(const [a,hex] of weaponPins)if(read(a,hex.length/2).map(b=>b.toString(16).padStart(2,'0')).join('')!==hex)throw Error('TR2 loaded weapon instruction mismatch');}
  if(weapon)verifyWeapon();
  const started=now(),report={version:2,workerSlot,endpointIdentity,exeSha256,started,
    deadline:started+maxMs,status:'active',qualified:false,records:[],boundaries:0,
    workBound:'at most one run(1) per remaining caller block, deadline checked at every boundary; no lifetime boundary quota',
    weapon,untilShot,completedCycles:0,scope:'owning CPU Worker JS boundaries; internal WAT reentry/other threads unobserved; snapshots and exact caller links only, no hit/kill/effective aim/backend qualification'};
  let armed=!defer;
  let timer,lastBlocks=null,last=null,poll=null,action=null,restored=false;
  let chain=null,gun=null,shot=null,publicationGeneration=null;
  const seen=new Set();
  const s16=(a,field)=>(u16(a,field)<<16)>>16;
  // Native ITEM pointer plus object number, not an inferred actor name/index.
  const targetState=p=>p?{pointer:p,objectNumber:s16(p+0xc,'shot.objectNumber'),health:s16(p+0x22,'shot.targetHealth')}:null;
  function state(){
    const item=u32(0x52173c,'item'),target=u32(0x5216e0,'target');
    return {input:u32(0x51b178,'input'),gunStatus:s16(0x521662,'gunStatus'),gunType:s16(0x521664,'gunType'),requested:s16(0x521666,'requested'),
      lastType:s16(0x521668,'lastType'),water:s16(0x52166c,'water'),waterDistance:u32(0x52168c,'waterDistance')|0,target,targetAngles:[s16(0x5216e4,'targetYaw'),s16(0x5216e6,'targetPitch')],
      arms:[0x5216f8,0x52170a].map((a,i)=>({frame:s16(a+4,`arms[${i}].frame`),lock:s16(a+8,`arms[${i}].lock`),yaw:s16(a+10,`arms[${i}].yaw`),pitch:s16(a+12,`arms[${i}].pitch`),flash:s16(a+16,`arms[${i}].flash`)})),
      ammo:[0x52171c,0x521720,0x521724,0x521728,0x52172c,0x521730,0x521734].map((a,i)=>u32(a,`ammo[${i}]`)),
      targetHealth:target?s16(target+0x22,'targetHealth'):null,
      item,itemState:item?{health:s16(item+0x22,'itemState.health'),animation:s16(item+0x14,'itemState.animation'),frame:s16(item+0x16,'itemState.frame'),bodyState:s16(item+0xe,'itemState.bodyState'),yaw:s16(item+0x42,'itemState.yaw')}:null};
  }
  function weaponRow(kind,pc,esp,extra={}){
    verifyWeapon();
    // Keep five rows per ordinary cycle, reserving useful capacity for later
    // readiness and shot linkage. Call/stack validation still runs at gates.
    if(untilShot&&!['input-published','weapon-entry','weapon-return','shot-entry','shot-return'].includes(kind))return true;
    if(seen.has(pc))return true;
    readContext={kind,pc,esp};
    try{
      const snapshot=state();
      seen.add(pc);return emit({kind,pc,esp,actionRecord:chain?.index??null,...extra,state:snapshot});
    }finally{readContext=null;}
  }

  const facade=Object.assign(Object.create(null),e),wrapped={exports:facade};
  function finish(reason){
    if(report.status!=='active')return report;
    report.status=reason;report.ended=now();
    const shotDone=untilShot&&reason==='witnessed'&&report.records.at(-1)?.kind==='shot-return';
    report.qualified=(reason==='removed'||reason==='witnessed')&&!action&&!shot&&(!gun||shotDone)&&(!untilShot||shotDone)&&report.records.some(r=>r.kind==='action'&&r.poll!==null);
    report.consumptionQualified=weapon&&report.qualified&&report.records.some(r=>{
      const a=report.records[r.actionRecord],p=a&&report.records[a.poll];
      return (r.kind==='weapon-return'||(shotDone&&r.kind==='shot-return'))&&a?.action&&a.keyResult&&p?.hresult===0&&p.ctrl.some(b=>b&128);
    });
    report.shotQualified=!!(shotDone&&report.qualified&&report.records.some(r=>{
      const a=report.records[r.actionRecord],p=a&&report.records[a.poll];
      return r.kind==='shot-return'&&a?.action&&a.keyResult&&p?.hresult===0&&p.ctrl.some(b=>b&128);
    }));
    report.pollObserved=report.records.some(r=>r.kind==='poll');
    report.noPollUnqualified=!report.pollObserved;
    report.pending=!!action;report.pendingWeapon=!!gun;report.pendingShot=!!shot;cancel(timer);
    if(getInstance()===wrapped){replaceInstance(original);restored=true;}
    else {report.status='owner-replaced';report.qualified=false;report.consumptionQualified=false;report.shotQualified=false;}
    report.removed=restored;return report;
  }
  function emit(row){if(report.status!=='active')return false;if(report.records.length>=maxRecords){finish('overflow');return false;}report.records.push({at:now(),wallAt:Date.now(),boundary:report.boundaries,...row});return true;}
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
      if(untilShot){
        const v=rpc.views(memory,workerSlot).pub,s=rpc.SLOT,g=Atomics.load(v,s.GEN)>>>0;
        // GEN advances on ordinary publications (including clock updates).
        // Accept forward/wrap progress, refuse rollback or invalid publication.
        if(Atomics.load(v,s.KEYS_VALID)!==1||(publicationGeneration!==null&&((g-publicationGeneration)>>>0)>0x7fffffff))return finish('stale-generation');
        publicationGeneration=g;
      }
      ++report.boundaries;
      const pc=e.get_eip()>>>0,esp=e.get_esp()>>>0,stamp=pc+':'+esp;
      if(stamp===last)return;last=stamp;
      if(pc===0x44d2a0){
        if((chain&&(!untilShot||!chain.complete))||(untilShot&&(action||gun||shot||poll!==null)))return finish('superseded');
        poll=null;action=null;chain=null;gun=null;shot=null;seen.clear();
      }
      if(weapon&&chain){
        if(untilShot){
          if([0x447206,0x447236,0x44d3c6].includes(pc))return finish('superseded');
          if(gun&&u32(0x51b178)!==chain.mask)throw Error('TR2 input changed during weapon update');
        }
        // Caller return is observable even when the straight store/RET epilogue
        // folds inside one run block. Match this update's exact saved stack.
        if([0x41427f,0x411fd8,0x4220a7].includes(pc)){
          if(untilShot&&chain.published)throw Error('TR2 repeated input return');
          if(pc!==chain.caller||esp!==chain.esp+0x6c)throw Error('TR2 input return stack mismatch');
          if((u32(0x51b178)&64)!==(report.records[chain.index].ebx&64))throw Error('TR2 published Action mismatch');
          if(!weaponRow('input-published',pc,esp))return;
          chain.published=true;chain.mask=u32(0x51b178);
        }
        if(pc===0x42e640&&chain.published){
          if(untilShot&&chain.complete)throw Error('TR2 completed weapon cycle reused');
          if(gun)throw Error('TR2 nested weapon update');
          const caller=u32(esp);
          if(![0x4275ac,0x4275c2,0x431757,0x432111].includes(caller))throw Error('TR2 weapon caller mismatch');
          if(u32(0x51b178)!==chain.mask)throw Error('TR2 input changed before weapon entry');
          gun={esp,caller,paired:false,aim:false};weaponRow('weapon-entry',pc,esp);
        }
        if(gun){
          if([0x42ea88,0x42eab6,0x42eb1c,0x42e68d,0x42e775,0x42e803,0x42e807,0x42e83c].includes(pc))weaponRow('weapon-gate',pc,esp);
          if([0x42edec,0x42ee40,0x42eea3].includes(pc))weaponRow('aim-gate',pc,esp,{losResult:pc===0x42edec?e.get_eax()>>>0:null});
          if(pc===0x42d330){
            if(u32(esp)!==0x42e860||esp!==gun.esp-24)throw Error('TR2 paired-arm caller mismatch');
            gun.paired=true;weaponRow('paired-arm-entry',pc,esp,{type:u32(esp+4)});
          }
          if(pc===0x42d4c0){
            if(!gun.paired||u32(esp)!==0x42d458||esp!==gun.esp-40)throw Error('TR2 arm caller mismatch');
            gun.aim=true;weaponRow('aim-updated',pc,esp);
          }
          if([0x42d502,0x42d54a,0x42d562,0x42d56c,0x42d60f,0x42d69a,0x42d6d7,0x42d6ec,0x42d6f6,0x42d797].includes(pc))weaponRow('arm-gate',pc,esp);
          if(pc===0x42f270){
            const caller=u32(esp);
            if(!gun.aim||![0x42d59a,0x42d724].includes(caller)||esp!==gun.esp-80)throw Error('TR2 shot caller mismatch');
            if(shot)throw Error('TR2 nested shot');
            const target=u32(esp+8),entryTarget=targetState(target);
            shot={esp,caller,target,entryTarget,damage:null,index:report.records.length};seen.delete(pc);
            weaponRow('shot-entry',pc,esp,{caller,type:u32(esp+4),target,entryTarget,source:u32(esp+12),angles:read(u32(esp+16,'shot.anglesPointer'),4,'shot.angles')});
          }
          // The one native hitscan damage call inside this shot. Keep evidence
          // in the existing return row: no additional record capacity or work.
          if(pc===0x42f5e0&&shot){
            verifyWeapon();
            if(shot.damage||esp!==shot.esp-0x274||u32(esp)!==0x42f50a||!shot.target||u32(esp+4)!==shot.target)
              throw Error('TR2 damage caller/target mismatch');
            shot.damage={entryBoundary:report.boundaries,esp,caller:0x42f50a,target:targetState(shot.target),amount:u32(esp+12)|0,returned:false};
          }
          if(pc===0x42f50a&&shot){
            const d=shot.damage;
            if(!d||d.returned||esp!==d.esp+4)throw Error('TR2 damage return stack mismatch');
            verifyWeapon();
            d.after=targetState(shot.target);d.returned=true;d.returnBoundary=report.boundaries;
            d.sameIdentity=d.target.objectNumber===d.after.objectNumber&&shot.entryTarget.objectNumber===d.after.objectNumber;
            d.healthDelta=d.target.health-d.after.health;
            d.expectedHealth=((d.target.health-d.amount)<<16)>>16;
            // Evidence of this synchronous subtraction only. A kill-counter
            // increment or crossing zero does not establish an observed kill.
            d.subtractionObserved=d.sameIdentity&&d.after.health===d.expectedHealth;
            d.positiveDamageObserved=d.subtractionObserved&&d.amount>0&&d.healthDelta>0;
          }
          if(shot&&pc===shot.caller){
            if(esp!==shot.esp+4)throw Error('TR2 shot return stack mismatch');
            if(shot.damage&&!shot.damage.returned)throw Error('TR2 pending damage at shot return');
            // Retain both arms even though the shared entry PC is identical.
            const returnTarget=targetState(shot.target);
            seen.delete(pc);const recorded=weaponRow('shot-return',pc,esp,{shotRecord:shot.index,result:e.get_eax()>>>0,target:shot.target,targetHealth:returnTarget?.health??null,
              entryTarget:shot.entryTarget,returnTarget,damage:shot.damage,
              targetHealthDelta:shot.entryTarget&&returnTarget&&shot.entryTarget.objectNumber===returnTarget.objectNumber?shot.entryTarget.health-returnTarget.health:null,
              damageScope:'only exact 42f5e0 -> 42f50a nested call observed here; absent boundary is unknown, raw EAX/ammo/target presence alone is not damage'});shot=null;
            if(untilShot&&recorded){finish('witnessed');return;}
          }else if(untilShot&&[0x42d59a,0x42d724].includes(pc)){
            throw Error('TR2 unlinked shot return');
          }
          if(pc===gun.caller){
            if(esp!==gun.esp+4||shot)throw Error('TR2 weapon return stack mismatch');
            weaponRow('weapon-return',pc,esp);gun=null;chain.complete=true;++report.completedCycles;
            if(stopAfterPair&&!untilShot)finish('witnessed');
          }
        }
        if(report.status!=='active')return;
      }
      // Once paired, spend the same finite interval on its downstream path.
      if(weapon&&chain)return;
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
        if(weapon&&report.status==='active'&&a.poll!==null){
          const caller=u32(a.esp+0x68);
          if(![0x41427f,0x411fd8,0x4220a7].includes(caller))throw Error('TR2 input caller mismatch');
          chain={index:report.records.length-1,esp:a.esp,caller,published:false};
        }
        action=null;poll=null;
        if(stopAfterPair&&!weapon&&a.poll!==null)finish('witnessed');
      }
    }catch(error){report.error=String(error);if(error.readFailure)report.readFailure={...error.readFailure,boundary:report.boundaries,pc:e.get_eip()>>>0,esp:e.get_esp()>>>0};finish('unobservable');}
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
function workerSource(options){return `(()=>{if(globalThis.__tr2Action)throw Error('TR2 observer already used');globalThis.__tr2Action=(${install.toString()})({getInstance:()=>instance,replaceInstance:v=>{instance=v},memory,rpc:GuestRpc,workerSlot,endpointIdentity,...${JSON.stringify({readLayout:mappingLayout(),...options})}});return globalThis.__tr2Action.status()})()`;}
// Called inside the existing reviewed/native admission. The caller's hold()
// keeps the independent release timer and its unchanged input policy.
async function observedHold({evaluate,workerSession,expectedEndpoint,exeSha256,hold,record,weapon=false,untilShot=false}){
  let receipt,report,armed=false;
  await evaluate(workerSource({expectedEndpoint,exeSha256,defer:true,stopAfterPair:true,weapon,untilShot}),workerSession);
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
  const consumption=report.records.filter(r=>r.kind==='weapon-return'&&actions.includes(report.records[r.actionRecord])&&r.wallAt>=receipt.started&&r.wallAt<receipt.releaseAt);
  const shots=report.records.filter(r=>{
    const entry=report.records[r.shotRecord];
    return r.kind==='shot-return'&&entry?.kind==='shot-entry'&&entry.actionRecord===r.actionRecord&&actions.includes(report.records[r.actionRecord])&&
      entry.wallAt>=receipt.started&&entry.wallAt<receipt.releaseAt&&r.wallAt>=receipt.started&&r.wallAt<receipt.releaseAt;
  });
  const result={receipt,report,physicalControlSample:physical,pollsDuringHold:polls.length,actionsDuringHold:actions.length,consumptionsDuringHold:consumption.length,shotsDuringHold:shots.length,
    qualified:armed&&report.qualified&&physical&&actions.length>0&&(!weapon||(report.consumptionQualified&&(untilShot?report.shotQualified&&shots.length>0:consumption.length>0))),
    scope:untilShot?'native poll/Action through first exact linked shot return; raw result only, no hit/kill/effective aim/backend proof':weapon?'native poll/Action through exact linked weapon return; recorded shot/aim state only, no hit/kill/effective aim/backend proof':'native delivery/actual poll/binding/Action only; weapon/aim and CPU/WebGL2 backend authority unchanged'};
  await record('correlation',result);
  return result;
}
module.exports={install:options=>install({readLayout:mappingLayout(),...options}),workerSource,observedHold};
