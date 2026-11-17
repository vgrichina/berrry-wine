'use strict';

// Public call observations only. Neither a handler exit nor a MSG snapshot is
// a delivery receipt. Never call a guest API, poll input, or advance a clock.
function observePublicConsumers(h, getExports, buffer, translate, file) {
  const fs = require('node:fs');
  const fd = fs.openSync(file, 'wx');
  const origin = performance.now();
  let pending = null, count = 0, scheduled = false, rows = [];
  const counts = new Map(), firstPolls = new Set();
  const nargs = {GetMessageA:4, GetMessageW:4, PeekMessageA:5, PeekMessageW:5,
    DispatchMessageA:1, DispatchMessageW:1, TranslateMessage:1, WaitMessage:0,
    GetAsyncKeyState:1, GetKeyState:1, GetKeyboardState:1, GetCursorPos:1,
    Sleep:1, GetTickCount:0, timeGetTime:0, QueryPerformanceCounter:1,
    IDirectInputDevice_GetDeviceState:3, IDirectInputDevice_GetDeviceData:5};
  function flush() {
    scheduled = false;
    if (rows.length) { fs.writeSync(fd, rows.join('')); rows = []; }
  }
  function emit(row, firstPoll = false) {
    if (!firstPoll && count++ >= 8192) return;
    rows.push(JSON.stringify({at:Date.now(), ms:performance.now()-origin, ...row})+'\n');
    if (!scheduled) { scheduled=true; setImmediate(flush); }
  }
  const read = (e, ptr) => new DataView(buffer()).getUint32(translate(ptr>>>0,e.get_image_base(),buffer()),true);
  const log = h.log, exit = h.log_api_exit;
  h.log = function(ptr,len) {
    // The public dispatcher supplies the API's name, not game-owned text.
    const bytes = new Uint8Array(buffer(),ptr,Math.min(len,256));
    let name=''; for (const b of bytes) {if(!b)break;name+=String.fromCharCode(b);}
    pending=null;
    // Retain bounded first ordinary USER polls even after verbose startup
    // exhausts the diagnostic trace. This is readiness, never input delivery.
    if(count>=8192 && (!/^(Get|Peek)Message[AW]$/.test(name) || firstPolls.size>=32))
      return Reflect.apply(log,this,[ptr,len]);
    const e=getExports();
    if(count>=8192 && firstPolls.has(e.get_current_thread_id()+':'+name))
      return Reflect.apply(log,this,[ptr,len]);
    counts.set(name,(counts.get(name)||0)+1);
    const args=[];
    if (Object.hasOwn(nargs,name)) for(let i=0;i<nargs[name];i++) args.push(read(e,e.get_esp()+4+i*4));
    pending={name,args,threadId:e.get_current_thread_id(),sp:e.get_esp()>>>0};
    emit({phase:'entry',...pending});
    return Reflect.apply(log,this,[ptr,len]);
  };
  h.log_api_exit = function(...args) {
    const p=pending;pending=null;
    if(p) {
      const e=getExports(), row={phase:'handler-exit',...p,eax:e.get_eax()>>>0,
        doneSp:e.get_esp()>>>0,yieldReason:e.get_yield_reason(),yieldFlag:e.get_yield_flag(),
        receipt:false,callbackReturn:'unmeasured'};
      if (/^(Get|Peek|Dispatch)Message[AW]$/.test(p.name) && p.args[0] &&
          (/^Dispatch/.test(p.name)||row.eax) && !row.yieldFlag && !row.yieldReason)
        row.publicMSG=Array.from({length:4},(_,i)=>read(e,p.args[0]+i*4));
      emit(row);
      const key=p.threadId+':'+p.name;
      if (/^(Get|Peek)Message[AW]$/.test(p.name) && !row.yieldFlag && !row.yieldReason &&
          row.doneSp===p.sp+4*(p.args.length+1) && (/^Peek/.test(p.name)||row.eax) &&
          firstPolls.size<32 && !firstPolls.has(key)) {
        firstPolls.add(key);emit({...row,phase:'input-poll-return'},true);
      }
    }
    if(exit)return Reflect.apply(exit,this,args);
  };
  process.once('exit',()=>{flush();fs.writeSync(fd,JSON.stringify({phase:'summary',counts:Object.fromEntries(counts),seen:count,
    limit:8192,scope:'main instance only; actual CPUWorker has ordinary filtered API trace'})+'\n');fs.closeSync(fd);});
}
module.exports={observePublicConsumers};
