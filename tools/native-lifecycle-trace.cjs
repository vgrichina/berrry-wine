'use strict';
// Optional passive import-boundary observer. Per-thread monotonic sequence is
// written synchronously, independently of the runner's buffered API log.
const fs=require('node:fs'),path=require('node:path');
const {threadId}=require('node:worker_threads');
const APIS=new Set(['EndDialog','DestroyWindow','PostQuitMessage','ExitProcess','CreateProcessA','CreateProcessW','WinExec','ShellExecuteA','ShellExecuteExA','CreateWindowExA','CreateWindowExW','CreateDialogParamA','CreateDialogIndirectParamA','DialogBoxParamA','DialogBoxIndirectParamA','SendMessageA','SendMessageW','PostMessageA','PostMessageW','DispatchMessageA','DispatchMessageW']);
for (const name of ['GetMessageA', 'GetMessageW']) APIS.add(name);
function observer({write,limit=4096,clock=()=>process.hrtime.bigint().toString()}){
 let e,memory,sequence=0,lastState='',lastButton='',saturated=false;
 const emit=(kind,data={})=>{
  if(saturated)return;
  if(sequence>=limit){saturated=true;write({kind:'trace-limit',sequence:++sequence,monoNs:clock(),limit});return;}
  write({kind,sequence:++sequence,monoNs:clock(),...data});
 };
 const read=ga=>e.guest_read32(ga)>>>0;
 function title(h){const p=e.get_window_title_ptr?.(h)>>>0,n=Math.min(e.get_window_title_len?.(h)>>>0,256);return p&&n?Buffer.from(memory.buffer,p,n).toString('latin1'):'';}
 function state(){return {guestThread:e.get_current_thread_id?.()>>>0,guestProcess:e.get_process_id?.()>>>0,eip:e.get_eip?.()>>>0,quit:e.get_quit_flag?.()>>>0,main:e.get_main_hwnd?.()>>>0,focus:e.get_focus_hwnd?.()>>>0};}
 function sample(boundary){
  if(!e||!e.get_quit_flag||saturated)return;
  const s=state(),key=JSON.stringify([s.guestThread,s.quit,s.main,s.focus]);
  if(key!==lastState){lastState=key;emit('state',{boundary,...s});}
  if(e.native_button_receipt){const b=Array.from({length:10},(_,i)=>String(e.native_button_receipt(i))),key=b.join(',');if(b[0]!=='0'&&key!==lastButton){lastButton=key;emit('button-receipt',{boundary,fields:b,target:{hwnd:Number(b[2]),title:title(Number(b[2])),controlId:e.ctrl_get_id?.(Number(b[2]))>>>0},...s});}}
 }
 function api(ptr,len){
  if(!e||saturated)return;
  const name=Buffer.from(memory.buffer,ptr,Math.min(len,256)).toString('latin1').split('\0')[0];
  if(!APIS.has(name))return;
  // Message pumps can run millions of times before the transition of interest.
  // Retain raw quit/windowless retrievals without saturating on ordinary idle.
  if(name.startsWith('GetMessage')&&!e.get_quit_flag?.()&&e.get_main_hwnd?.())return;
  if(name.startsWith('DispatchMessage')){const p=read((e.get_esp()>>>0)+4),msg=read(p+4);if(![1,2,0x10,0x12,0x82,0x100,0x101,0x110,0x111,0x201,0x202].includes(msg))return;}
  sample('before:'+name);
  const esp=e.get_esp()>>>0,args=Array.from({length:12},(_,i)=>read(esp+4+i*4));
  const data={name,args,returnPC:read(esp),...state()};
  if(['EndDialog','DestroyWindow','SendMessageA','SendMessageW','PostMessageA','PostMessageW'].includes(name))data.target={hwnd:args[0],title:title(args[0]),proc:e.wnd_get_proc_export?.(args[0])>>>0};
  if(name.startsWith('DispatchMessage'))data.message=Array.from({length:4},(_,i)=>read(args[0]+i*4));
  emit('api-enter',data);
 }
 function imports(original){
  if(!original?.host?.memory)return original;
  memory=original.host.memory;
  const host={...original.host};
  for(const [name,fn]of Object.entries(host))if(typeof fn==='function'&&['log','log_api_exit','exit','process_spawn','create_window','destroy_window','check_input','invalidate'].includes(name))host[name]=function(...args){
   if(name==='log')api(...args);
   if(['exit','process_spawn','create_window','destroy_window'].includes(name))emit('host-enter',{name,args,...(e?state():{})});
   const result=Reflect.apply(fn,this,args);
   sample('after:'+name);
   if(['exit','process_spawn','create_window','destroy_window'].includes(name))emit('host-return',{name,result,...(e?state():{})});
   return result;
  };
  return {...original,host};
 }
 return {imports,attach(instance){e=instance.exports;sample('attached');},sample,emit};
}
function install(directory){
 fs.mkdirSync(directory,{recursive:true});
 const file=path.join(directory,`lifecycle-${process.pid}-${threadId}.jsonl`),fd=fs.openSync(file,'ax');
 const write=row=>fs.writeSync(fd,JSON.stringify({pid:process.pid,nodeThread:threadId,at:Date.now(),...row})+'\n');
 let instanceId=0;
 const create=()=>{const id=++instanceId;return observer({write:r=>write({instance:id,...r})});};
 const instantiate=WebAssembly.instantiate,Instance=WebAssembly.Instance;
 WebAssembly.instantiate=async function(module,imports,...rest){const o=create();const result=await instantiate.call(this,module,o.imports(imports),...rest);o.attach(result.instance||result);return result;};
 WebAssembly.Instance=new Proxy(Instance,{construct(target,args,newTarget){const o=create();const instance=Reflect.construct(target,[args[0],o.imports(args[1])],newTarget===WebAssembly.Instance?target:newTarget);o.attach(instance);return instance;}});
 write({kind:'observer-armed',limitPerInstance:4096,passive:true});
 process.once('exit',code=>{write({kind:'observer-eof',code});fs.closeSync(fd);});
}
module.exports={observer,install,APIS};
if(process.env.WINE_NATIVE_LIFECYCLE_TRACE)install(process.env.WINE_NATIVE_LIFECYCLE_TRACE);
