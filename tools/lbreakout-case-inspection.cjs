'use strict';
// Generate read-only inspection for one LBreakout browser case.
//
// Launcher completion and each stream EOF are separate records. Live log
// availability must never mask passive terminal records.
//
// Node port of the former tools/lbreakout-case-inspection.py. The browser
// JavaScript it emits is byte-identical; the launcher, handoff and case
// inspection programs it emits are now standalone Node.js (CommonJS) programs
// with the same files, JSON records and exit semantics.

const num = n => typeof n === 'number' && Number.isFinite(n);
const int = n => Number.isInteger(n);

// Decode retained state offline; sample time is never failure time.
// The frame layout belongs to the hash-pinned original EXE, at its memcpy
// import reached from stk_surface_gray's first copy. No live reads occur.
function classifyStartupFailure(receipt, failureAt) {
  const observation = receipt.lastObservation || {};
  const sample = observation.lastSample || {};
  const at = sample.at, deadline = observation.deadline;
  const result = {kind: 'unknown', sampleAt: at, failureAt, deadline,
    sampleAgeAtFailureMs: null, sampleBeforeDeadlineMs: null};
  if (![at, failureAt, deadline].every(num)) return result;
  Object.assign(result, {sampleAgeAtFailureMs: failureAt - at, sampleBeforeDeadlineMs: deadline - at});
  if (at > failureAt || sample.error) return result;
  const binding = observation.binding || {};
  if (binding.exe !== 0x400000 || (binding.media || {}).exe !==
      'cc1fd5c3d229cc1d4f910e658f5abefa80ef8ebf4b5e47801648f0be0e1ca244') return result;
  const registers = sample.registers || {}, stack = sample.stack || {}, words = stack.words || [];
  const esp = registers.esp, ebp = registers.ebp;
  if (sample.pc !== 0x451ae0 || !int(esp) || !int(ebp) || stack.address !== esp ||
      ebp - esp !== 0x3c || words.length !== 24 ||
      !words.every(w => int(w) && w >= 0 && w <= 0xffffffff)) return result;
  // Current return, original theme_load caller, then the gray arguments.
  if (words[0] !== 0x426c59 || words[16] !== 0x418687) return result;
  const [surface, x0, y0, width, height, shift] = words.slice(17, 23);
  const x = words[14], y = words[13], rowOffset = words[12], columnOffset = words[11];
  const [destination, source, size] = words.slice(1, 4);
  if (!surface || !(0 < width && width <= 65535) || !(0 < height && height <= 65535) ||
      !(0 <= x0 && x0 <= x && x < x0 + width && x0 + width <= 65535) ||
      !(0 <= y0 && y0 <= y && y < y0 + height && y0 + height <= 65535) ||
      ![1, 2, 3, 4].includes(size) || shift > 29 ||
      destination !== ebp - 0x14 || columnOffset !== x * size) return result;
  const pitch = y ? Math.floor(rowOffset / y) : null;
  if (y && (rowOffset % y || pitch < (x0 + width) * size || pitch > 65535)) return result;
  const pixelBase = source - rowOffset - columnOffset;
  if (!(0 < pixelBase && pixelBase <= source && source <= 0xffffffff)) return result;
  const processed = (y - y0) * width + x - x0;
  Object.assign(result, {kind: 'original-theme-grayscale', preMenu: sample.menu === 0,
    menu: sample.menu, dirtyCount: sample.dirtyCount,
    surface, screen: sample.screen,
    rectangle: {x: x0, y: y0, width, height},
    pixel: {x, y}, processedPixels: processed,
    remainingPixelsIncludingCurrent: width * height - processed,
    copy: {destination, source, size},
    inferredPitch: pitch, inferredPixelBase: pixelBase,
    originalReturn: words[0], originalCaller: words[16],
    limit: 'one retained sample; no native return or completion-time claim'});
  return result;
}

const LEVEL_START_DRIVER=String.raw`function createLevelStartDriver(e,boundary){
 let armed=false,target=0,next=0,advance=false,running=false,blocks=null,halt=null;
 const facade={...e};
 const restore=()=>Object.assign(facade,{run:e.run,get_last_run_blocks:e.get_last_run_blocks,get_last_run_halt:e.get_last_run_halt});
 const trace=(flag,lo,hi)=>{
  if(flag&&hi!==lo+1)throw Error('level-start requires one instruction target');
  if(flag&&!armed){
   if(e.get_bp_addr()||e.get_dbg_tier_guard())throw Error('level-start debugger conflict');
   armed=true;e.set_benchmark_chain_bp(1);
   Object.assign(facade,{run,get_last_run_blocks:()=>blocks===null?e.get_last_run_blocks():blocks,
    get_last_run_halt:()=>halt===null?e.get_last_run_halt():halt});
  }
  next=flag?lo>>>0:0;
  if(!advance){target=next;if(target)e.set_bp(target);else{e.clear_bp();e.set_benchmark_chain_bp(0);armed=false;if(!running)restore();}}
 };
 function run(n){
   if(running)throw Error('level-start recursive run');
   blocks=null;halt=null;
   if(!armed&&!advance)return e.run(n);
   running=true;let left=n;
   try{
    blocks=0;
    while(left>0){
     const stepping=advance;
     e.run(stepping?1:left);
     const ran=e.get_last_run_blocks()>>>0;blocks+=ran;left-=ran;
     halt=e.get_last_run_halt();
     if(stepping){
      advance=false;target=next;
      if(target)e.set_bp(target);else{e.clear_bp();e.set_benchmark_chain_bp(0);armed=false;}
     }else if(armed&&halt===5&&(e.get_eip()>>>0)===target){
      advance=true;boundary(target);halt=1;
      continue;
     }
     if(e.get_yield_reason()||!e.get_eip()||halt!==1)break;
    }
   }finally{
    running=false;
    // Keep this call's aggregate metrics until the next ordinary run, then
    // restore the exact native function identities on the unarmed path.
    if(!armed&&!advance)facade.run=n=>{restore();return e.run(n);};
   }
  }
 return {exports:facade,trace};
}`;

const LEVEL_START_OBSERVER=String.raw`async function installLevelStartCompletion({e,memory,binding,token,expected,now=()=>Date.now(),emit=()=>{}}){
 if(!token||expected!==8)throw Error('level-start command binding');
 const v=new DataView(memory.buffer),wa=p=>e.guest_to_wasm(p>>>0)>>>0;
 const u32=p=>v.getUint32(wa(p),true),u8=p=>v.getUint8(wa(p));
 const {exe,sdl,index,generation,mappingState,keys}=binding;
 const table=e.get_dll_table()>>>0,life=e.get_dll_lifecycle_table()>>>0,stride=e.get_dll_lifecycle_stride()>>>0;
 const records=[],deadline=now()+2000;let active=true,reason=null,phase='init',frame;
 const trace=pc=>e.set_trace_eip_range(1,pc,pc+1);
 const record=(kind,data={})=>{const r={kind,token,at:now(),...data};records.push(r);emit(r);};
 const valid=()=>{if(e.get_image_base()!==exe||e.get_current_thread_id()!==1||
  v.getUint32(table+index*32,true)!==sdl||v.getUint32(life+index*stride+4,true)!==generation||
  v.getUint32(life+index*stride,true)!==mappingState)throw Error('level-start module/owner changed');};
 const stop=r=>{if(!active)return;active=false;reason=r;e.set_trace_eip_range(0,0,0);record('completion-stop',{reason:r});};
 function boundary(pc=e.get_eip()>>>0){
  if(!active)return;
  try{
   valid();if(now()>=deadline)return stop('deadline');
   const esp=e.get_esp()>>>0;
   if(phase==='init'&&pc===exe+0x1f2ac){
    frame={ret:u32(esp),esp};record('local-init-entry');phase='init-return';trace(frame.ret);return;
   }
   if(phase==='init-return'&&pc===frame.ret&&esp===frame.esp+4){
    if(e.get_eax()!==1||u32(exe+0x523b0)!==8)throw Error('original local init failed');
    record('local-init-return',{state:8});phase='run';trace(exe+0x1faa0);return;
   }
   if(phase==='run'&&pc===exe+0x1faa0){
    record('game-run-entry');phase='fade-return';trace(exe+0x1faf2);return;
   }
   if(phase==='fade-return'&&pc===exe+0x1faf2){
    if(u32(exe+0x523b0)!==8)throw Error('original fade state');
    record('level-fade-return');phase='display-return';trace(exe+0x2047a);return;
   }
   if(phase==='display-return'&&pc===exe+0x2047a){
    if(u32(exe+0x523b0)!==8||u8(keys+13)!==0)throw Error('original level presentation/release incomplete');
    record('level-display-return',{state:8,releaseState:0});record('guest-complete',{state:8});stop('complete');
   }
  }catch(error){record('completion-error',{error:String(error)});stop('failure');}
 }
 const timer=setTimeout(()=>stop('deadline'),2000);if(timer.unref)timer.unref();
 valid();record('completion-arm',{binding,expected,deadline});trace(exe+0x1f2ac);
 return {boundary,stop:r=>{clearTimeout(timer);stop(r);},snapshot:()=>({token,binding,expected,deadline,active,reason,phase,records:[...records]})};
}`;

const PAUSE_OBSERVER=String.raw`async function installPauseCompletion({e,memory,binding,token,expected,now=()=>Date.now(),emit=()=>{}}){
 if(!token||![8,20].includes(expected))throw Error('completion command binding');
 const v=new DataView(memory.buffer),wa=p=>e.guest_to_wasm(p>>>0)>>>0;
 const u32=p=>v.getUint32(wa(p),true),u8=p=>v.getUint8(wa(p));
 const {exe,sdl,index,generation,mappingState,keys}=binding;
 const table=e.get_dll_table()>>>0,life=e.get_dll_lifecycle_table()>>>0,stride=e.get_dll_lifecycle_stride()>>>0;
 const records=[],started=now(),deadline=started+2000;
 let phase='keyboard',active=true,down=false,handler=false,display=false,returned=false,frame=null,reason=null;
 const trace=(lo,hi=lo+1)=>e.set_trace_eip_range(1,lo,hi);
 const record=(kind,data={})=>{if(records.length>=64){active=false;reason='record-limit';e.set_trace_eip_range(0,0,0);return;}const r={kind,token,at:now(),...data};records.push(r);emit(r);};
 const valid=()=>{if(e.get_image_base()!==exe||e.get_current_thread_id()!==1||
  v.getUint32(table+index*32,true)!==sdl||v.getUint32(life+index*stride+4,true)!==generation||
  v.getUint32(life+index*stride,true)!==mappingState)throw Error('completion module/owner changed');};
 const stop=r=>{if(!active)return;active=false;reason=r;e.set_trace_eip_range(0,0,0);record('completion-stop',{reason:r});};
 const complete=()=>{if(returned&&display&&u32(exe+0x523b0)===expected&&u8(keys+112)===0){record('guest-complete',{state:expected,releaseState:0});stop('complete');return true;}return false;};
 function boundary(pc=e.get_eip()>>>0){
  if(!active)return;
  try{
   valid();if(now()>=deadline)return stop('deadline');
   const esp=e.get_esp()>>>0;
   if(phase==='keyboard'&&pc===sdl+0x19870){
    const symbol=u32(u32(esp+8)+4);if(symbol!==112)return;
    frame={ret:u32(esp),esp,down:u8(esp+4)};record('sdl-p-entry',{down:frame.down});
    phase='keyboard-return';trace(frame.ret);return;
   }
   if(phase==='keyboard-return'&&pc===frame.ret&&esp===frame.esp+4){
    record('sdl-p-return',{down:frame.down,state:u8(keys+112)});
    if(frame.down){if(u8(keys+112)!==1)throw Error('SDL P down incomplete');down=true;phase='handler';trace(exe+0x1e406);}
    else if(!complete()){phase='keyboard';trace(sdl+0x19870);}
    return;
   }
   if(phase==='handler'&&pc===exe+0x1e406){
    if(u32(esp+4)!==112)return;
    if(!down)throw Error('handler before SDL delivery');
    if(u32(exe+0x523b0)!==(expected===20?8:20))throw Error('unsupported original pause state');
    frame={ret:u32(esp),esp};handler=true;record('pause-handler-entry',{state:u32(exe+0x523b0)});
    trace(exe+(expected===20?0x1e7b4:0x1e7ec));return;
   }
   if(phase==='handler'&&handler&&pc===exe+(expected===20?0x1e7b4:0x1e7ec)){
    if(u32(exe+0x523b0)!==expected)throw Error('original pause transition incomplete');
    display=true;record(expected===20?'pause-display-return':'resume-state-return',{state:expected});
    phase='handler-return';trace(frame.ret);return;
   }
   if(phase==='handler-return'&&pc===frame.ret&&esp===frame.esp+4){
    returned=true;record('pause-handler-return',{state:u32(exe+0x523b0)});
    if(!complete()){phase='keyboard';trace(sdl+0x19870);}return;
   }
  }catch(error){record('completion-error',{error:String(error)});stop('failure');}
 }
 const timer=setTimeout(()=>stop('deadline'),2000);if(timer.unref)timer.unref();
 valid();record('completion-arm',{binding,expected,deadline});trace(sdl+0x19870);
 return {boundary,stop:r=>{clearTimeout(timer);stop(r);},snapshot:()=>({token,binding,expected,deadline,active,reason,phase,records:[...records]})};
}`;

const PADDLE_OBSERVER=String.raw`async function installPaddleCompletion({e,memory,binding,token,expected,reviewed,now=()=>Date.now(),emit=()=>{}}){
 if(!token||![275,276].includes(expected)||!reviewed?.label||!/^[a-f0-9]{64}$/.test(reviewed.sha256))throw Error('paddle command/image binding');
 const v=new DataView(memory.buffer),wa=p=>e.guest_to_wasm(p>>>0)>>>0;
 const u32=p=>v.getUint32(wa(p),true),u8=p=>v.getUint8(wa(p)),x=p=>v.getFloat32(wa(p+8),true);
 const {exe,sdl,index,generation,mappingState,keys}=binding;
 const table=e.get_dll_table()>>>0,life=e.get_dll_lifecycle_table()>>>0,stride=e.get_dll_lifecycle_stride()>>>0;
 const records=[],deadline=now()+2000;let active=true,reason=null,phase='delivery',frame,paddle,poll,returned=false;
 const trace=pc=>e.set_trace_eip_range(1,pc,pc+1);
 const record=(kind,data={})=>{const r={kind,token,at:now(),...data};records.push(r);emit(r);};
 const valid=()=>{if(e.get_image_base()!==exe||e.get_current_thread_id()!==1||
  v.getUint32(table+index*32,true)!==sdl||v.getUint32(life+index*stride+4,true)!==generation||
  v.getUint32(life+index*stride,true)!==mappingState)throw Error('paddle module/owner changed');};
 const stop=r=>{if(!active)return;active=false;reason=r;e.set_trace_eip_range(0,0,0);record('completion-stop',{reason:r});};
 const complete=()=>{if(returned&&u8(keys+expected)===0){record('guest-complete',{symbol:expected,releaseState:0});stop('complete');return true;}return false;};
 function boundary(pc=e.get_eip()>>>0){
  if(!active)return;
  try{
   valid();if(now()>=deadline)return stop('deadline');
   if(records.length>=48)return stop('record-limit');
   const esp=e.get_esp()>>>0;
   if((phase==='delivery'||phase==='release')&&pc===sdl+0x19870){
    if(u32(u32(esp+8)+4)!==expected)return;
    const down=u8(esp+4);if(down!==(phase==='delivery'?1:0))return;
    frame={esp,ret:u32(esp),down};record('sdl-key-entry',{down,symbol:expected});phase='delivery-return';trace(frame.ret);return;
   }
   if(phase==='delivery-return'&&pc===frame.ret&&esp===frame.esp+4){
    if(u8(keys+expected)!==frame.down)throw Error('original SDL key delivery incomplete');
    record('sdl-key-return',{down:frame.down,symbol:expected});
    if(frame.down){phase='paddle';trace(exe+0x5904);}else complete();return;
   }
   if(phase==='paddle'&&pc===exe+0x5904){
    const pointer=u32(esp+4);
    if(u32(exe+0x523b0)!==8||u8(keys+expected)!==1||u32(pointer+60)!==0)throw Error('paddle input not consumable');
    paddle={pointer,esp,ret:u32(esp),before:x(pointer)};
    if(!Number.isFinite(paddle.before))throw Error('paddle coordinate invalid');
    record('paddle-entry',{...paddle,symbol:expected});phase='poll';trace(sdl+0x19810);return;
   }
   if(phase==='poll'&&pc===sdl+0x19810){
    poll={esp,ret:u32(esp)};record('sdl-poll-entry');phase='poll-return';trace(poll.ret);return;
   }
   if(phase==='poll-return'&&pc===poll.ret&&esp===poll.esp+4){
    if((e.get_eax()>>>0)!==keys||u8(keys+expected)!==1)throw Error('original SDL poll missed held key');
    record('sdl-poll-return',{symbol:expected,held:1});phase='paddle-return';trace(paddle.ret);return;
   }
   if(phase==='paddle-return'&&pc===paddle.ret&&esp===paddle.esp+4){
    const after=x(paddle.pointer),delta=after-paddle.before;
    if(!Number.isFinite(after)||(expected===275?delta<=0:delta>=0))throw Error('original paddle movement incomplete');
    returned=true;record('paddle-return',{pointer:paddle.pointer,before:paddle.before,after,delta});
    if(!complete()){phase='release';trace(sdl+0x19870);}return;
   }
  }catch(error){record('completion-error',{error:String(error)});stop('failure');}
 }
 const timer=setTimeout(()=>stop('deadline'),2000);if(timer.unref)timer.unref();
 valid();record('completion-arm',{binding,expected,reviewed,deadline});trace(sdl+0x19870);
 return {boundary,stop:r=>{clearTimeout(timer);stop(r);},snapshot:()=>({token,binding,expected,reviewed,deadline,active,reason,phase,records:[...records]})};
}`;

const MENU_OBSERVER=String.raw`async function installMenuCompletion({e,memory,binding,token,expected,reviewed,now=()=>Date.now(),emit=()=>{}}){
 if(!token||expected!==13||!reviewed?.label||!/^[a-f0-9]{64}$/.test(reviewed.sha256))throw Error('menu command/image binding');
 const v=new DataView(memory.buffer),wa=p=>e.guest_to_wasm(p>>>0)>>>0;
 const u32=p=>v.getUint32(wa(p),true),u8=p=>v.getUint8(wa(p));
 const {exe,sdl,index,generation,mappingState,keys}=binding;
 const table=e.get_dll_table()>>>0,life=e.get_dll_lifecycle_table()>>>0,stride=e.get_dll_lifecycle_stride()>>>0;
 const before=u32(exe+0x77150),item=before&&u32(before+28),target=item&&u32(item+72);
 if(!item||u32(item+4)!==6||!target||target===before)throw Error('menu Enter requires selected original submenu link');
 const records=[],deadline=now()+2000;let active=true,reason=null,phase='delivery',frame,event,handler;
 const trace=pc=>e.set_trace_eip_range(1,pc,pc+1);
 const record=(kind,data={})=>{const r={kind,token,at:now(),...data};records.push(r);emit(r);};
 const valid=()=>{if(e.get_image_base()!==exe||e.get_current_thread_id()!==1||
  v.getUint32(table+index*32,true)!==sdl||v.getUint32(life+index*stride+4,true)!==generation||
  v.getUint32(life+index*stride,true)!==mappingState)throw Error('menu module/owner changed');};
 const stop=r=>{if(!active)return;active=false;reason=r;e.set_trace_eip_range(0,0,0);record('completion-stop',{reason:r});};
 const complete=()=>{if(u32(exe+0x77150)!==target)throw Error('menu target changed');record('guest-complete',{before,target,releaseState:0});stop('complete');};
 function boundary(pc=e.get_eip()>>>0){
  if(!active)return;
  try{
   valid();if(now()>=deadline)return stop('deadline');if(records.length>=48)return stop('record-limit');
   const esp=e.get_esp()>>>0;
   if((phase==='delivery'||phase==='release')&&pc===sdl+0x19870){
    if(u32(u32(esp+8)+4)!==13||u8(esp+4)!==(phase==='delivery'?1:0))return;
    frame={esp,ret:u32(esp),down:u8(esp+4)};record('sdl-enter-entry',{down:frame.down});phase='delivery-return';trace(frame.ret);return;
   }
   if(phase==='delivery-return'&&pc===frame.ret&&esp===frame.esp+4){
    if(u8(keys+13)!==frame.down)throw Error('original SDL Enter delivery incomplete');
    record('sdl-enter-return',{down:frame.down});
    if(!frame.down){complete();return;}phase='poll-return';trace(exe+0x105f6);return;
   }
   if(phase==='poll-return'&&pc===exe+0x105f6){
    event=u32(esp);if(e.get_eax()!==1||u8(event)!==2||u32(event+8)!==13)return;
    record('menu-poll-return',{event,symbol:13});phase='handler';trace(exe+0xc36a);return;
   }
   if(phase==='handler'&&pc===exe+0xc36a){
    if(u32(esp+4)!==before||u32(esp+8)!==event||u8(event)!==2||u32(event+8)!==13||u32(before+28)!==item||u32(item+72)!==target||u32(item+4)!==6||u32(exe+0x77150)!==before)throw Error('menu handler binding changed');
    handler={esp,ret:u32(esp)};if(handler.ret!==exe+0x107b2)throw Error('menu caller changed');
    record('menu-enter-handler',{before,item,target,event});phase='handler-return';trace(handler.ret);return;
   }
   if(phase==='handler-return'&&pc===handler.ret&&esp===handler.esp+4){
    if(u32(exe+0x77150)!==target||e.get_eax()!==0)throw Error('original Enter link transition incomplete');
    record('menu-handler-return',{target});phase='display';trace(exe+0x26026);return;
   }
   if(phase==='display'&&pc===exe+0x26026){
    if(u32(exe+0x77150)!==target)throw Error('menu presentation target changed');
    record('menu-sdl-display-return',{target});phase='display-return';trace(exe+0x10849);return;
   }
   if(phase==='display-return'&&pc===exe+0x10849){
    record('menu-display-return',{target});if(u8(keys+13)===0)complete();else{phase='release';trace(sdl+0x19870);}return;
   }
  }catch(error){record('completion-error',{error:String(error)});stop('failure');}
 }
 const timer=setTimeout(()=>stop('deadline'),2000);if(timer.unref)timer.unref();
 valid();record('completion-arm',{binding,expected,reviewed,before,item,target,deadline});trace(sdl+0x19870);
 return {boundary,stop:r=>{clearTimeout(timer);stop(r);},snapshot:()=>({token,binding,expected,reviewed,deadline,active,reason,phase,records:[...records]})};
}`;

const STARTUP_OBSERVER=String.raw`async function installStartupCompletion({e,memory,binding,token,expected,now=()=>Date.now(),emit=()=>{}}){
 if(!token||expected!==0)throw Error('startup completion binding');
 const v=new DataView(memory.buffer),wa=p=>e.guest_to_wasm(p>>>0)>>>0,u32=p=>v.getUint32(wa(p),true);
 const {exe,sdl,index,generation,mappingState}=binding;
 const table=e.get_dll_table()>>>0,life=e.get_dll_lifecycle_table()>>>0,stride=e.get_dll_lifecycle_stride()>>>0;
 const deadline=now()+2000,records=[];let active=true,reason=null,phase='sdl-display-return',menu,lastSample=null;
 const trace=pc=>e.set_trace_eip_range(1,pc,pc+1);
 const record=(kind,data={})=>{const r={kind,token,at:now(),...data};records.push(r);emit(r);};
 const valid=()=>{if(e.get_image_base()!==exe||e.get_current_thread_id()!==1||
  v.getUint32(table+index*32,true)!==sdl||v.getUint32(life+index*stride+4,true)!==generation||
  v.getUint32(life+index*stride,true)!==mappingState)throw Error('startup module/owner changed');};
 // Only enrich the caller's existing snapshot. No extra protocol, tracing,
 // timers, guest calls or writes. Keep the last sample after terminal stop.
 const sample=()=>{
  const r={at:now(),pc:e.get_eip()>>>0};
  try{
   valid();
   const read=(p,n)=>{const a=wa(p);if(!p||a===0xf0||a+n>memory.buffer.byteLength)throw Error('startup sample unmapped');return a;};
   const words=(p,n)=>{const a=read(p,n*4);return Array.from({length:n},(_,i)=>v.getUint32(a+i*4,true));};
   r.registers={};for(const name of ['eax','ebx','ecx','edx','esi','edi','ebp','esp'])r.registers[name]=e['get_'+name]()>>>0;
   r.stack={address:r.registers.esp,words:words(r.registers.esp,24)};
   r.menu=u32(exe+0x77150);r.dirtyCount=u32(exe+0x52468);r.screen=u32(exe+0x52464);
   if(r.menu){const a=read(r.menu,32),item=v.getUint32(a+28,true);r.selectedItem={pointer:item};if(item){const b=read(item,76);Object.assign(r.selectedItem,{type:v.getUint32(b+4,true),target:v.getUint32(b+72,true)});}}
   const surface=p=>{if(!p)return null;const a=read(p,40);return {pointer:p,flags:v.getUint32(a,true),format:v.getUint32(a+4,true),width:v.getUint32(a+8,true),height:v.getUint32(a+12,true),pitch:v.getUint16(a+16,true),pixels:v.getUint32(a+20,true)};};
   r.screenSurface=surface(r.screen);
   // The retained prior PC is SDL_FillRect's 32-bit software row loop.
   // Here ESI holds width/4; the surface is the local at ESP+0x1c.
   if(r.pc>=sdl+0x208c8&&r.pc<sdl+0x2092a){
    r.fillSurface=surface(r.stack.words[7]);
    const a=read(r.registers.ebp,8);r.fillRect={pointer:r.registers.ebp,x:v.getInt16(a,true),y:v.getInt16(a+2,true),width:v.getUint16(a+4,true),height:v.getUint16(a+6,true)};
   }
  }catch(error){r.error=String(error);}
  return r;
 };
 const stop=r=>{if(!active)return;active=false;reason=r;e.set_trace_eip_range(0,0,0);record('completion-stop',{reason:r});};
 function boundary(pc=e.get_eip()>>>0){
  if(!active)return;
  try{
   valid();if(now()>=deadline)return stop('deadline');
   if(phase==='sdl-display-return'&&pc===exe+0x26026){
    // A loading splash can present before the original menu exists.
    menu=u32(exe+0x77150);if(!menu)return;
    record('startup-sdl-display-return',{menu});phase='manager-display-return';trace(exe+0x10849);return;
   }
   if(phase==='manager-display-return'&&pc===exe+0x10849){
    if(u32(exe+0x77150)!==menu)throw Error('startup menu changed during display');
    const item=u32(menu+28);
    if(!item||u32(item+4)!==6||!u32(item+72))throw Error('startup selected submenu unavailable');
    record('startup-menu-display-return',{menu,item,target:u32(item+72)});
    record('guest-complete');stop('complete');
   }
  }catch(error){record('completion-error',{error:String(error)});stop('failure');}
 }
 const timer=setTimeout(()=>stop('deadline'),2000);if(timer.unref)timer.unref();
 valid();record('completion-arm',{binding,expected,deadline});trace(exe+0x26026);
 return {boundary,stop:r=>{clearTimeout(timer);stop(r);},snapshot:()=>{
  if(active)lastSample=sample();
  return {token,binding,expected,deadline,active,reason,phase,lastPC:lastSample?.pc??e.get_eip()>>>0,lastSample,records:[...records]};
 }};
}`;

const STARTUP_BEFORE=String.raw` await evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve({presented:true}))))');await capture('startup');`;

const STARTUP_AFTER_PREFIX=String.raw` if(!process.env.LOCAL_PRODUCTION_FIXTURE){
  const a=await armObservation({id:'startup',phase:'startup',expected:0});
  await completion(a);
 }
`;

const PRELOAD_TAIL=String.raw`
(()=>{
 const instantiate=WebAssembly.instantiate;
 WebAssembly.instantiate=async function(source,imports){
  imports.host.log_eip=pc=>globalThis.__lbObserver?.boundary(pc>>>0);
  const r=await instantiate.call(WebAssembly,source,imports),native=r.instance||r;
  const driver=createLevelStartDriver(native.exports,pc=>globalThis.__lbObserver?.boundary(pc));
  // A facade preserves the actual instance and its exports for all unarmed
  // calls. Both dedicated completion observers use targeted breakpoints.
  const exports=driver.exports;
  const instance=new Proxy(native,{get:(o,k)=>k==='exports'?exports:Reflect.get(o,k,o)});
  globalThis.__lbNative={instance,memory:imports.host.memory,driver};
  return r.instance?{...r,instance}:instance;
 };
 globalThis.__lbArm=async c=>{
  if(globalThis.__lbObserver?.snapshot().active)throw Error('completion already armed');
  if(!globalThis.LBreakoutInputObserver)importScripts('/lib/lbreakout-input-observer.js');
  const media='/binaries/candidates/lbreakout2-251/game/LBREAKOUT/';
  const [exeBytes,sdlBytes]=await Promise.all(['lbreakout2.exe','SDL.dll'].map(async n=>new Uint8Array(await(await fetch(media+n)).arrayBuffer())));
  const {instance,memory}=globalThis.__lbNative,e=instance.exports;
  const validator=await LBreakoutInputObserver.install({enabled:true,validateOnly:true,exports:e,memory,exeBytes,sdlBytes,durationMs:2000});
  const {binding}=validator.snapshot();validator.stop('validated');
  // Relocation-free instruction anchors from this exact original EXE.
  const bytes=new Uint8Array(memory.buffer),hex=(pc,n)=>Array.from(bytes.subarray(e.guest_to_wasm(pc),e.guest_to_wasm(pc)+n),x=>x.toString(16).padStart(2,'0')).join('');
  for(const [rva,h] of [[0x1e406,'5589e583ec18'],[0x1e7b4,'83c410eb36'],[0x7b2a,'e8c7e40100']])
   if(hex(binding.exe+rva,h.length/2)!==h)throw Error('original pause instruction mismatch');
  if(c.phase==='level-start')for(const [rva,h] of [[0x1f2ac,'5589e55383ec14'],[0x1faa0,'5589e5575653'],[0x1faf2,'83c410'],[0x20475,'e87c5b0000']])
   if(hex(binding.exe+rva,h.length/2)!==h)throw Error('original level-start instruction mismatch');
  const observed={...e,set_trace_eip_range:globalThis.__lbNative.driver.trace};
  if(['menu','startup'].includes(c.phase))for(const [rva,h] of [[0xc36a,'5589e583ec38'],[0xc4d6,'8b4508'],[0x105f1,'e84af90300'],[0x107ad,'e8b8bbffff'],[0x10844,'e8ad570100'],[0x26021,'e89aa00200']])
   if(hex(binding.exe+rva,h.length/2)!==h)throw Error('original menu instruction mismatch');
  globalThis.__lbObserver=await (c.phase==='startup'?installStartupCompletion:c.phase==='menu'?installMenuCompletion:c.phase==='paddle'?installPaddleCompletion:c.phase==='level-start'?installLevelStartCompletion:installPauseCompletion)({e:observed,memory,binding,...c,emit:r=>console.log('LB_OBSERVER',JSON.stringify(r))});
  return {armed:true,...__lbObserver.snapshot()};
 };
})();
`;

const COMPLETION_REPLACEMENTS=[[String.raw`async function armObservation(){const s=await owningWorker();return evaluate('globalThis.__lbArm()',s);}`,
String.raw`async function armObservation(c){
 const s=await owningWorker(),owner=await evaluate(bound.WORKER_READ,s),token=c.id+'-'+c.phase;
 assert(owner?.instance&&owner?.endpointIdentity,'completion immutable instance binding');
 const reviewed=['paddle','menu'].includes(c.phase)?{label:latest.label,sha256:latest.sha256}:undefined;
 const arm=await evaluate('globalThis.__lbArm('+JSON.stringify({token,expected:c.expected,phase:c.phase,reviewed})+')',s);
 assert(arm.armed&&arm.token===token,'completion arm binding');
 if(reviewed){assert.equal(arm.expected,c.expected,'paddle arm key binding');assert.deepEqual(arm.reviewed,reviewed,'paddle arm image binding');}
 return {session:s,owner,token,expected:c.expected,reviewed,deadline:arm.deadline,binding:arm.binding};
}
async function completion(a){
 let lastObservation=null;
 try{
  while(true){
   assert(!terminal,'terminal: completion closed');assert(Date.now()<Math.min(deadline,a.deadline),'guest completion deadline');
   // The same immutable instance owns the same module bytes. Avoid fetching
   // the entire Wasm over CDP on every snapshot. Full byte/owner validation
   // precedes arming and brackets capture; the observer checks DLL generation.
   assert(workers.has(a.session)&&!workers.get(a.session).closed,'completion owner closed');
   assert.deepEqual(await evaluate(bound.WORKER_READ,a.session),a.owner,'completion owner binding');
   const r=await evaluate('globalThis.__lbObserver.snapshot()',a.session);
   assert.equal(r.token,a.token,'completion command binding');assert.equal(r.expected,a.expected);
   assert.deepEqual(r.binding,a.binding,'completion module binding');
   if(a.reviewed)assert.deepEqual(r.reviewed,a.reviewed,'completion reviewed image binding');
   lastObservation=r;
   if(!r.active){
    assert.equal(r.reason,'complete','guest completion incomplete');save('completion-'+a.token+'.json',r);
    const remaining=Math.min(deadline,a.deadline)-Date.now();assert(remaining>0,'presentation deadline');
    const presented=await evaluate(${'`'}new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('presentation deadline')),${'${'}remaining});requestAnimationFrame(()=>requestAnimationFrame(()=>{clearTimeout(timer);resolve({presented:true})}));})${'`'});
    assert(presented?.presented&&Date.now()<Math.min(deadline,a.deadline),'presentation completion');
    save('presentation-'+a.token+'.json',{token:a.token,presented:true,at:Date.now()});return;
   }
   await wait(10);
  }
 }catch(e){
  try{if(!terminal)save('completion-failure-'+a.token+'.json',{token:a.token,error:String(e),lastObservation});}
  finally{fail(e);}
  throw e;
 }
}`],
[String.raw`if(c.observe){save('observer-arm-'+c.id+'.json',await armObservation());}`,
String.raw`let completionArm;
   if(c.completion==='paddle'){assertPaddleCompletion(c);completionArm=await armObservation({...c,phase:'paddle',expected:c.key==='ArrowRight'?275:276});}
   else if(c.completion==='level-start'){assert(c.action==='key'&&c.key==='Enter','level-start requires native Enter');completionArm=await armObservation({...c,phase:'level-start',expected:8});}
   else if(c.action==='key'&&c.key==='Enter'){assert(c.id&&c.reviewRef&&Number.isInteger(c.holdMs)&&c.holdMs>=80&&c.holdMs<=300,'menu Enter command binding');completionArm=await armObservation({...c,phase:'menu',expected:13});}
   else if(c.action==='key'&&c.key==='p'){
    const expected=c.expected??20;assert([8,20].includes(expected),'supported pause transition');
    if(expected===8)assert.equal(c.pauseConfirmed,latest.label,'reviewed visible pause required');
    completionArm=await armObservation({...c,phase:'pause',expected});
   }`],
[String.raw`     const k=require('./input.cjs').key('p'),{text,...release}=k;`,
String.raw`     const a=await armObservation({...c,phase,expected:phase==='resume'?8:20});
     const k=require('./input.cjs').key('p'),{text,...release}=k;`],
[String.raw`save:r=>save('input-'+c.id+'-'+phase+'.json',r)});`,
String.raw`save:r=>save('input-'+c.id+'-'+phase+'.json',r)});
     await completion(a);`],
[String.raw`   }else await pulse({down,up,deadline,onFailure:fail,holdMs:c.holdMs??100,save:r=>save('input-'+c.id+'-pulse.json',r)});`,
String.raw`   }else await pulse({down,up,deadline,onFailure:fail,holdMs:c.holdMs??100,save:r=>save('input-'+c.id+'-pulse.json',r)});
   if(completionArm)await completion(completionArm);`]];

const PADDLE_KEY_ADMISSION=String.raw`function assertPaddleCompletion(c){
 if(c.completion==='paddle'&&(c.action!=='key'||!['ArrowLeft','ArrowRight'].includes(c.key)))
  throw Error('paddle completion requires one original direction');
 if(c.action==='play'||(c.action==='key'&&['ArrowLeft','ArrowRight'].includes(c.key)&&
  (c.completion!=='paddle'||c.observe!==true||!c.id||!c.reviewRef||!Number.isInteger(c.holdMs)||c.holdMs<80||c.holdMs>300)))
  throw Error('paddle input lacks original guest-completion observer');
}`;

const WORKFLOW_REPLACEMENTS=[[String.raw` if(c.action!=='capture'){`,
String.raw` assertPaddleCompletion(c);
 if(c.action!=='capture'){`],
[String.raw`['capture','click','key','quit']`,
String.raw`['capture','click','key','play','quit']`],
[String.raw`'Enter','Space'].includes(c.key)`,
String.raw`'Enter','Space','p'].includes(c.key)`],
[String.raw`   await pulse({down,up,deadline,onFailure:fail,holdMs:c.holdMs??100,save:r=>save('input-'+c.id+'-pulse.json',r)});`,
String.raw`   if(c.action==='play'){
    assert.equal(c.pauseConfirmed,latest.label,'reviewed visible pause required');
    assert(['ArrowLeft','ArrowRight','Space'].includes(c.key),'supported play key');
    assert(Number.isInteger(c.holdMs)&&c.holdMs>=0&&c.holdMs<=300,'short play hold');
    assert(Number.isInteger(c.playMs)&&c.playMs>=c.holdMs&&c.playMs<=500,'short play interval');
    const toggle=async phase=>{
     assert(!terminal,'terminal: no later pause input');
     const k=require('./input.cjs').key('p'),{text,...release}=k;
     await pulse({down:()=>send('Input.dispatchKeyEvent',{type:'keyDown',...k},pageSession),up:()=>send('Input.dispatchKeyEvent',{type:'keyUp',...release},pageSession),deadline,onFailure:fail,holdMs:80,save:r=>save('input-'+c.id+'-'+phase+'.json',r)});
    };
    await toggle('resume');
    assert(!terminal,'terminal: no later play input');
    await pulse({down,up,deadline,onFailure:fail,holdMs:c.holdMs,save:r=>save('input-'+c.id+'-pulse.json',r)});
    await wait(c.playMs-c.holdMs);
    await toggle('pause');
   }else await pulse({down,up,deadline,onFailure:fail,holdMs:c.holdMs??100,save:r=>save('input-'+c.id+'-pulse.json',r)});`]];

const OWNING_WORKER=String.raw`async function owningWorker(){
 const live=await chain.readLive();
 const owner=workers.get(live.worker.sessionId);
 assert(owner&&!owner.closed&&owner.url.includes('guest-worker'),'live bound owning guest Worker');
 assert.equal(owner.targetId,live.identity.workerTarget,'bound owning Worker target');
 return live.worker.sessionId;
}`;

// Use existing target-aware chain exits, without changing the module.
// A breakpoint's skip-once belongs to its old address. Retire that one
// original block before moving the breakpoint; otherwise the next target
// would silently consume the skip. All blocks remain in the caller's budget.
const levelStartDriverSource = () => LEVEL_START_DRIVER;
// Original local init -> fade-in -> first gameplay SDL presentation return.
const levelStartCompletionObserverSource = () => LEVEL_START_OBSERVER;
// Passive single-target boundaries using the compiled breakpoint driver.
// Range tracing disables fast execution globally, including surface_gray.
// Move the target from keyboard entry/return to handler entry, display return,
// and caller without changing guest work, clocks or instruction budgets.
const pauseCompletionObserverSource = () => PAUSE_OBSERVER;
// Bound original SDL delivery/poll and one original paddle invocation.
const paddleCompletionObserverSource = () => PADDLE_OBSERVER;
// Original queued SDL Enter -> selected link -> menu display submission.
const menuCompletionObserverSource = () => MENU_OBSERVER;
// Read-only original menu display completion before the FIRST image.
// Worker construction and page animation frames do not establish a guest
// presentation. Follow the same original SDL and menu-manager display
// returns as the Enter observer, without sending any input.
const startupCompletionObserverSource = () => STARTUP_OBSERVER;

const count = (source, needle) => source.split(needle).length - 1;
const replaceAll = (source, before, after) => source.split(before).join(after);

// Apply to the full title caller; accepted fixture path stays unchanged.
function startupWorkflowSource(source) {
  if (source.includes("phase:'startup',expected:0")) throw Error('startup completion already composed');
  if (count(source, STARTUP_BEFORE) !== 1) throw Error('unsupported first-image startup template');
  return replaceAll(source, STARTUP_BEFORE, STARTUP_AFTER_PREFIX + STARTUP_BEFORE);
}

function pauseCompletionPreloadSource() {
  return levelStartDriverSource() + '\n' + pauseCompletionObserverSource() + '\n' +
    levelStartCompletionObserverSource() + '\n' + paddleCompletionObserverSource() + '\n' +
    menuCompletionObserverSource() + '\n' + startupCompletionObserverSource() + PRELOAD_TAIL;
}

function applyReplacements(source, replacements, message) {
  // Check the complete template before changing any of it. Drift is offline.
  for (const [before] of replacements)
    if (count(source, before) !== 1) throw Error(message + before);
  for (const [before, after] of replacements) source = replaceAll(source, before, after);
  return source;
}

// Apply to pauseWorkflowSource output; completion precedes FIRST image.
const pauseCompletionSource = source =>
  applyReplacements(source, COMPLETION_REPLACEMENTS, 'unsupported completion template: ');

// Fail closed until ordinary paddle pulses have guest completion evidence.
// Native CDP down/up acknowledgements alone do not establish that the
// original paddle consumed a pulse before the returned image. In particular,
// repeated pulses must not be treated as completed gameplay input.
const paddleKeyAdmissionSource = () => PADDLE_KEY_ADMISSION;

// Extend the actual bound browser caller with ordinary local-game P input.
// Original EXE cc1fd5c3: handle_default_key 0x41e474 tests SDLK_p;
// 0x41e75c..0x41e7ef toggles local states 8 and 20. No guest calls/writes.
// A play command attests that its reviewed image visibly showed pause.
// Pair this caller with pauseCompletionPreloadSource().
function pauseWorkflowSource(source) {
  source = applyReplacements(source, WORKFLOW_REPLACEMENTS, 'unsupported bound browser template: ');
  return paddleKeyAdmissionSource() + '\n' + pauseCompletionSource(source);
}

// Select the module-bound process owner, allowing real secondary threads.
const owningWorkerSource = () => OWNING_WORKER;

const J = JSON.stringify;
// Generated programs pause synchronously, like the former time.sleep().
const SLEEP = "const sleep=ms=>Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,ms);\n";

function inspectionSource(root, run, kase) {
  if (!['fixture', 'original'].includes(kase)) throw Error('unsupported LBreakout case');
  return `'use strict';
const fs=require('node:fs'),path=require('node:path');
const read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const p=path.resolve(${J(String(root))},${J(String(run))});
const out=path.join(p,${J(kase)});
const log=path.join(p,${J(kase)}+'.log');
const markers=['first-browser-failure.json','first-failure.json','cleanup.json','chrome-exit.json'];
const terminal={};for(const n of markers)if(fs.existsSync(path.join(out,n)))terminal[n]=read(path.join(out,n));
const wait=path.join(p,(${J(kase)}==='fixture'?'fixture-launcher':'launcher')+'-wait.json');
if(fs.existsSync(wait))terminal.launcherWait=read(wait);
for(const stream of ['stdout','stderr']){
 const eof=path.join(path.dirname(wait),path.basename(wait).split('-wait.json').join('-'+stream+'-eof.json'));
 if(fs.existsSync(eof))terminal[stream+'EOF']=read(eof);
}
const latest=path.join(out,'latest.json'),logAvailable=fs.existsSync(log);
console.log(JSON.stringify({case:${J(kase)},files:fs.existsSync(out)?fs.readdirSync(out).sort():[],latest:fs.existsSync(latest)?read(latest):null,terminal,logPath:log,logAvailable,output:logAvailable?fs.readFileSync(log,'utf8').slice(-4000):null}));
`;
}

// One parent owns wait and two independent pipe drains; publish atomically.
function launcherSource(root, run, kase, command, env = null, deadlineFromLifecycle = false) {
  if (!['fixture', 'original'].includes(kase)) throw Error('unsupported LBreakout case');
  const prefix = kase === 'fixture' ? 'fixture-launcher' : 'launcher';
  return `'use strict';
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),os=require('node:os');
const root=path.resolve(${J(String(root))}),run=path.resolve(root,${J(String(run))});
const caseName=${J(kase)},prefix=${J(prefix)};
function put(name,value){
 const p=path.join(run,name),base=path.basename(p),ext=path.extname(base),tmp=path.join(path.dirname(p),base.slice(0,base.length-ext.length)+'.tmp');
 fs.writeFileSync(tmp,JSON.stringify(value));fs.renameSync(tmp,p);
}
const env={...process.env,...${J(env || {})}};
if(${J(!!deadlineFromLifecycle)})env.BROWSER_DEADLINE=String(JSON.parse(fs.readFileSync(path.join(run,'lifecycle.json'),'utf8')).browserDeadline);
const command=${J(command)};
const p=cp.spawn(command[0],command.slice(1),{cwd:root,env,stdio:['inherit','pipe','pipe']});
p.once('error',e=>{throw e;});
p.once('spawn',()=>{
 put(prefix+'.json',{pid:p.pid,parentPid:process.pid});
 for(const [stream,suffix] of [[p.stdout,'stdout'],[p.stderr,'stderr']]){
  const out=fs.openSync(path.join(run,caseName+(suffix==='stderr'?'-stderr':'')+'.log'),'w');
  stream.on('data',b=>fs.writeSync(out,b));
  stream.once('end',()=>{fs.closeSync(out);put(prefix+'-'+suffix+'-eof.json',{pid:p.pid,eof:true,stream:suffix,at:Date.now()/1000});});
 }
 p.once('exit',(code,signal)=>put(prefix+'-wait.json',{pid:p.pid,code:code!==null?code:-os.constants.signals[signal],actualWait:true,at:Date.now()/1000}));
});
`;
}

// Actual close -> bounded parent completion/EOF -> one original creation.
// A close ACK or cleanup marker alone cannot release the launch. Missing
// publication is pending until the deadline; a negative record is terminal.
function handoffSource(root, run, originalSource, closeCommand = null, timeout = 15) {
  if (!(0 < timeout && timeout <= 60)) throw Error('bounded parent completion timeout required');
  return `'use strict';
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
${SLEEP}const root=path.resolve(${J(String(root))}),run=path.resolve(root,${J(String(run))});
const exists=n=>fs.existsSync(path.join(run,n)),read=n=>JSON.parse(fs.readFileSync(path.join(run,n),'utf8'));
const closeCommand=${J(closeCommand)};
if(closeCommand!==null){
 const r=cp.spawnSync(closeCommand[0],closeCommand.slice(1),{cwd:root,stdio:'inherit',timeout:${J(timeout * 1000)}});
 if(r.error)throw r.error;
 if(r.status!==0)throw Error('close command failed: '+(r.status??r.signal));
}
const due=performance.now()+${J(timeout * 1000)};
let value;
while(true){
 for(const name of ['first-browser-failure.json','first-failure.json'])
  if(exists('fixture/'+name))throw Error('terminal fixture '+name);
 const cleanup=exists('fixture/cleanup.json');
 if(cleanup){
  value=read('fixture/cleanup.json');
  if(value.closed===false||![0,null].includes(value.code??0))throw Error('failed fixture cleanup');
 }
 if(exists('fixture-launcher-wait.json')){
  value=read('fixture-launcher-wait.json');
  if(value.actualWait!==true||value.code!==0)throw Error('failed fixture actual parent wait');
  let ready=cleanup;
  for(const stream of ['stdout','stderr']){
   const eof='fixture-launcher-'+stream+'-eof.json';
   if(!exists(eof)){ready=false;continue;}
   const record=read(eof);
   if(record.eof!==true||record.stream!==stream||record.pid!==value.pid)throw Error('invalid fixture separate EOF '+stream);
  }
  if(ready)break;
 }
 if(performance.now()>=due)throw Error('fixture parent completion/separate EOF unpublished');
 sleep(20);
}
// This is the sole creation point, reached only after actual wait and both EOFs.
const p=cp.spawn(process.execPath,['-e',${J(originalSource)}],{cwd:root,stdio:'ignore',detached:true});p.unref();
fs.writeFileSync(path.join(run,'original-parent.json'),JSON.stringify({pid:p.pid,fixtureWait:value,stdoutEOF:true,stderrEOF:true}));
console.log(JSON.stringify({parentPid:p.pid,fixtureParentCompleted:true,separateEOF:true}));
`;
}

// Compose the real original launcher without text substitution of env keys.
function originalWorkflowSource(root, run, command, closeCommand = null, timeout = 15) {
  const parent = launcherSource(root, run, 'original', command, {CASE_TAG: 'original'}, true);
  return handoffSource(root, run, parent, closeCommand, timeout);
}

module.exports = {classifyStartupFailure, levelStartDriverSource, levelStartCompletionObserverSource,
  pauseCompletionObserverSource, paddleCompletionObserverSource, menuCompletionObserverSource,
  startupCompletionObserverSource, startupWorkflowSource, pauseCompletionPreloadSource, pauseCompletionSource,
  paddleKeyAdmissionSource, pauseWorkflowSource, owningWorkerSource, inspectionSource, launcherSource,
  handoffSource, originalWorkflowSource};
