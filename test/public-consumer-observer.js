'use strict';

// Public call observations only. Neither a handler exit nor a MSG snapshot is
// a delivery receipt. Never call a guest API, poll input, or advance a clock.
function observePublicConsumers(h, getExports, buffer, translate, file) {
  const fs = require('node:fs');
  const fd = fs.openSync(file, 'wx');
  const origin = performance.now();
  let pending = null, count = 0, scheduled = false, rows = [];
  const counts = new Map();
  const nargs = {GetMessageA:4, GetMessageW:4, PeekMessageA:5, PeekMessageW:5,
    DispatchMessageA:1, DispatchMessageW:1, TranslateMessage:1, WaitMessage:0,
    GetAsyncKeyState:1, GetKeyState:1, GetKeyboardState:1, GetCursorPos:1,
    Sleep:1, GetTickCount:0, timeGetTime:0, QueryPerformanceCounter:1,
    IDirectInputDevice_GetDeviceState:3, IDirectInputDevice_GetDeviceData:5};
  function flush() {
    scheduled = false;
    if (rows.length) { fs.writeSync(fd, rows.join('')); rows = []; }
  }
  function emit(row) {
    if (count++ >= 8192) return;
    rows.push(JSON.stringify({at:Date.now(), ms:performance.now()-origin, ...row})+'\n');
    if (!scheduled) { scheduled=true; setImmediate(flush); }
  }
  const read = (e, ptr) => new DataView(buffer()).getUint32(translate(ptr>>>0,e.get_image_base(),buffer()),true);
  const log = h.log, exit = h.log_api_exit;
  h.log = function(ptr,len) {
    if(count>=8192) {pending=null;return Reflect.apply(log,this,[ptr,len]);}
    // The public dispatcher supplies the API's name, not game-owned text.
    const bytes = new Uint8Array(buffer(),ptr,Math.min(len,256));
    let name=''; for (const b of bytes) {if(!b)break;name+=String.fromCharCode(b);}
    pending=null;
    const e=getExports();
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
    }
    if(exit)return Reflect.apply(exit,this,args);
  };
  process.once('exit',()=>{flush();fs.writeSync(fd,JSON.stringify({phase:'summary',counts:Object.fromEntries(counts),seen:count,
    limit:8192,scope:'main instance only; actual CPUWorker has ordinary filtered API trace'})+'\n');fs.closeSync(fd);});
}
module.exports={observePublicConsumers};
