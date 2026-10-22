'use strict';
// Read-only observation through existing exports/imports. No emulated state writes.
function quitProbe({exports:e,read,emit,now=()=>new Date().toISOString()}) {
  let previous=null, recent=[], callbacks=new Set();
  function state() {
    const depth=e.get_post_queue_count()>>>0;
    if(depth>64)throw Error('queue depth bound');
    return {quit:e.get_quit_flag()>>>0,main:e.get_main_hwnd()>>>0,
      tick:e.get_tick_count()>>>0,queue:Array.from({length:depth},(_,i)=>Array.from({length:4},(_,j)=>e.post_queue_peek(i,j)>>>0))};
  }
  function sample(where,detail={}) {
    const s=state(),key=JSON.stringify([s.quit,s.main,s.queue]);
    if(key!==previous){emit({kind:'quit-transition',where,time:now(),...detail,...s,recent:recent.slice()});previous=key;}
    return s;
  }
  function target(hwnd){const p=e.wnd_get_proc_export(hwnd)>>>0;if(p&&p<0x7500000)callbacks.add(p);return p;}
  function api(name,args,caller,phase) {
    const s=sample(phase+':'+name,{caller});
    const r={kind:'quit-api',name,phase,caller,args,time:now(),...s};
    if(phase==='entry'&&/^RegisterClass/.test(name))callbacks.add(read(args[0]+(name.includes('Ex')?8:4)));
    if(name==='DispatchMessageA'||name==='DispatchMessageW') {
      r.message=Array.from({length:7},(_,i)=>read(args[0]+i*4));
      r.wndproc=target(r.message[0]);if(r.message[1]===0x113&&r.message[3])callbacks.add(r.message[3]);
    }
    if(/^(DestroyWindow|SendMessage|DefWindowProc|CallWindowProc)/.test(name))r.wndproc=target(args[name.startsWith('CallWindowProc')?1:0]);
    if(/^(PostQuitMessage|PostMessage|PostThreadMessage|DestroyWindow|CreateWindow|SetTimer|KillTimer|DispatchMessage|SendMessage|DefWindowProc|CallWindowProc|RegisterClass)/.test(name))emit(r);
  }
  return {state,sample,api,target,pc(ip,stack){
    recent.push(ip>>>0);if(recent.length>16)recent.shift();sample('pc',{pc:ip>>>0});
    if(callbacks.has(ip>>>0))emit({kind:'window-callback',pc:ip>>>0,stack:stack(),time:now(),...state()});
  },input(name,args,invoke){
    const result=invoke();if(result||name!=='check_input')emit({kind:'host-input',name,args,result,time:now(),...state()});return result;
  }};
}
function bindHostInput(h,getExports,emit) {
  for(const name of ['check_input','check_input_hwnd','check_input_lparam','check_input_wparam']){
    const original=h[name];if(original)h[name]=function(...args){const result=original.apply(this,args);if(result||name!=='check_input'){const e=getExports();emit({kind:'host-input',name,args,result,time:new Date().toISOString(),quit:e.get_quit_flag(),tick:e.get_tick_count()});}return result;};
  }
}
module.exports={quitProbe,bindHostInput};
