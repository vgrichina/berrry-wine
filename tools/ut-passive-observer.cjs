'use strict';
// Task-owned UT diagnostic; guest input and capture guards are unchanged.
// Observer graph decoder retained from 20261121-ut-practice-hit-target.
const createObserver=function createObserver({emit,deadline,now=Date.now,maxRows=4096,fixture=null}={}){
 if(typeof emit!=='function'||!Number.isFinite(deadline)||deadline<=now()||deadline>now()+900000)throw Error('observer bounds');
 let active=true,rows=0,unrelated=0,selected=0;const contexts=[];
 const sites=new Map(fixture?.sites||[[0x964f,'branch-test'],[0x966b,'DI-acquired'],[0x967a,'state-return'],[0x96a6,'state-result'],[0x972c,'axisX-return'],[0x974a,'axisY-return'],[0x97b5,'buffer-return'],[0x98f3,'post-DI-common'],[0xb2e7,'WM_MOUSEMOVE-device-test'],[0xb303,'WM_MOUSEMOVE-no-acquired-DI'],[0xb311,'WM_MOUSEMOVE-clientrect-common'],[0xb33a,'WM_MOUSEMOVE-uncaptured-USER'],[0xb3b6,'WM_MOUSEMOVE-captured-USER']]);
 const functions=new Set(['KeyEvent','RenderUWindow','MoveMouse','DrawMouse','FindWindowUnder','WindowEvent','Notify','StartPressed','LMouseDown','LMouseUp']);
 const fields=['MouseX','MouseY','MouseScale','Root','Viewport','Console','MouseWindow','bMouseCapture','GUIScale','bWindowsMouseAvailable','WindowsMouseX','WindowsMouseY','StartButton','WinLeft','WinTop','WinWidth','WinHeight','bWindowVisible','bUWindowActive','bDisabled','ParentWindow','LastChildWindow','PrevSiblingWindow'];
 function stop(reason,error){if(!active)return;active=false;for(const c of contexts)c.e?.set_trace_eip_range(0,0,0);emit({kind:'stop',reason,error:error?String(error):null,rows,selected,unrelated});}
 function record(c,kind,data,always=false){const sig=JSON.stringify(data),key=kind+':'+(data.function||data.site||'')+':'+(data.graph?.self?.pointer||data.viewport||0);if(!always&&c.last.get(key)===sig)return;
  if(rows>=maxRows)return stop('UNKNOWN:row-bound');c.last.set(key,sig);emit({kind,instance:c.id,sequence:++rows,...data});}
 function wrapImports(imports){const h=imports?.host;if(!h?.memory)return i=>i;
  const c={id:contexts.length+1,e:null,core:0,windrv:0,last:new Map(),viewport:0,initialized:false,retired:false};contexts.push(c);if(contexts.length>32)throw Error('instance bound');
  const v=new DataView(h.memory.buffer);
  const address=(p,n=4)=>{if(!p)throw Error('null read');const a=c.e.guest_to_wasm(p>>>0)>>>0;if(a===0xf0||a+n>v.byteLength)throw Error('unmapped '+p.toString(16));return a;};
  const u=p=>v.getUint32(address(p),true),f=p=>v.getFloat32(address(p),true);
  const text=p=>{let s='';for(let i=0;i<128;i++){const ch=v.getUint16(address(p+i*2,2),true);if(!ch)return s;s+=String.fromCharCode(ch);}throw Error('name length');};
  function name(p){if(!p)return null;const a=c.core+(fixture?.namesRVA??0x193848),i=u(p+0x20),count=u(a+4);if(i>=count||count>131072)throw Error('name index');return text(u(u(a)+i*4)+12);}
  const identity=p=>p?{pointer:p,name:name(p),class:name(u(p+0x24))}:null;
  function properties(cls){const result=new Map(),seen=new Set();for(let depth=0;cls;cls=u(cls+0x28)){
   if(++depth>64||seen.has(cls))throw Error('super chain');seen.add(cls);let n=0;
   for(let p=u(cls+0x38);p;p=u(p+0x2c)){
    if(++n>2048)throw Error('field chain');const pn=name(p),type=name(u(p+0x24));if(!type?.endsWith('Property')||result.has(pn))continue;
    const offset=u(p+0x48);if(offset>1048576)throw Error('field offset');result.set(pn,{pointer:p,type,offset,mask:type==='BoolProperty'?u(p+0x5c):null});
   }
  }return result;}
  function values(p,cls,wanted){if(!p)return null;const out={},props=properties(cls);for(const n of wanted){const d=props.get(n);if(!d)continue;const a=p+d.offset;
    const raw=u(a),value=d.type==='FloatProperty'?f(a):d.type==='BoolProperty'?!!(raw&d.mask):d.type==='ByteProperty'?v.getUint8(address(a,1)):d.type==='ObjectProperty'?identity(raw):raw;
    out[n]={...d,raw,value};}return out;}
  const object=p=>p?{...identity(p),fields:values(p,u(p+0x24),fields)}:null;
  function tree(p){const pending=[p],seen=new Set(),out=[];while(pending.length){const q=pending.pop();if(seen.has(q))throw Error('widget tree cycle');seen.add(q);if(seen.size>512)throw Error('widget tree bound');
    const row=object(q);out.push(row);let child=row.fields.LastChildWindow?.raw||0,siblings=new Set();while(child){if(siblings.has(child)||siblings.size>=512)throw Error('sibling chain bound');siblings.add(child);pending.push(child);child=values(child,u(child+0x24),['PrevSiblingWindow']).PrevSiblingWindow?.raw||0;}
   }return out;}
  function graph(p,fn){const root=object(p),out={self:root};if(!root)return out;
   for(const key of ['Root','Console','Viewport','MouseWindow','StartButton']){const ptr=root.fields[key]?.raw;if(ptr)out[key]=object(ptr);}
   if(out.Root){for(const key of ['MouseWindow','Console']){const ptr=out.Root.fields[key]?.raw;if(ptr)out['Root.'+key]=object(ptr);}}
   if(fn==='DrawMouse'){const t=out.Root||root;out.widgetTree=tree(t.pointer);out.startButtons=out.widgetTree.filter(w=>w.fields.StartButton?.raw).map(w=>({owner:identity(w.pointer),button:object(w.fields.StartButton.raw),matchesMouseWindow:w.fields.StartButton.raw===t.fields.MouseWindow?.raw}));}
   return out;
  }
  function refresh(){if(fixture){c.core=fixture.core;c.windrv=fixture.windrv;return;}
   const e=c.e,table=e.get_dll_table(),count=e.get_dll_count();if(count>64)throw Error('module count');
   for(let i=0;i<count;i++){const base=v.getUint32(table+i*32,true),rva=v.getUint32(table+i*32+8,true);if(!base||!rva)continue;
    const p=base+u(base+rva+12);let s='';for(let j=0;j<64;j++){const b=v.getUint8(address(p+j,1));if(!b)break;s+=String.fromCharCode(b);}
    if(s.toLowerCase()==='core.dll')c.core=base;if(s.toLowerCase()==='windrv.dll')c.windrv=base;
   }
  }
  function observe(pc){if(!active||!c.e||!c.initialized||c.retired)return;const wrva=pc-c.windrv,corePC=c.core+(fixture?.processInternalRVA??0x3e510);
   if((!c.windrv||!sites.has(wrva))&&(!c.core||pc!==corePC)){unrelated++;return;}
   try{if(now()>=deadline)return stop('UNKNOWN:deadline');const e=c.e,sp=e.get_esp()>>>0;
    if(c.windrv&&sites.has(wrva)){selected++;const p=e[fixture?.viewportRegister||'get_esi']()>>>0;c.viewport=p;
     record(c,'input-branch',{site:sites.get(wrva),pc,thread:e.get_current_thread_id(),viewport:p,device:u(p+0x190),acquired:u(p+0x1c0),state:[u(p+0x198),u(p+0x19c)],previous:[u(p+0x1a8),u(p+0x1ac)],eax:e.get_eax()>>>0});return;
    }
    const frame=u(sp+4),node=u(frame+4),fn=name(node);if(!functions.has(fn)){unrelated++;return;}
    const p=e.get_ecx()>>>0,id=identity(p);if(!/^(U?Window|U?Menu|UT|Tournament)/.test(id.class||'')){unrelated++;return;}
    selected++;const locals=u(frame+0x10),params=values(locals,node,['X','Y','Key','Action','Delta','Msg','C','E','k']);
    record(c,'script',{function:fn,pc,thread:e.get_current_thread_id(),node:identity(node),frame,params,graph:graph(p,fn)},['Notify','StartPressed','LMouseDown','LMouseUp'].includes(fn));
   }catch(error){stop('UNKNOWN:observation-error',error);}
  }
  const original=h.log_eip;h.log_eip=function(pc,...args){observe(pc>>>0);return Reflect.apply(original,this,[pc,...args]);};
  return instance=>{c.e=instance.exports;const exports=Object.create(null);
   for(const [n,value]of Object.entries(c.e))Object.defineProperty(exports,n,{enumerable:true,value:['load_dll','init_thread','load_pe'].includes(n)?function(...args){const r=Reflect.apply(value,c.e,args);
    // DLL tables are shared but guest_to_wasm uses this instance's image base.
    // Binding a cold helper must never walk a table initialized by another CPU.
    if(n==='init_thread'||(n==='load_pe'&&r))c.initialized=true;
    if(active&&c.initialized&&!c.retired){try{refresh();c.e.set_trace_eip_range(1,1,0xffffffff);}catch(e){stop('UNKNOWN:setup',e);}}return r;}:value});
  c.instance=instance;c.facade=exports;c.refresh=refresh;return new Proxy(instance,{get(t,k){return k==='exports'?exports:Reflect.get(t,k,t);}});
  };
 }
 return {wrapImports,stop,probe(){let read=0;for(const c of contexts)if(active&&c.initialized&&!c.retired){c.refresh();read++;}return read;},retire(instance){const c=contexts.find(c=>c.instance===instance||c.e===instance.exports||c.facade===instance.exports);if(!c)throw Error('unknown instance');c.retired=true;c.e.set_trace_eip_range(0,0,0);},summary:()=>({active,rows,selected,unrelated,instances:contexts.length,contexts:contexts.map(c=>({id:c.id,initialized:c.initialized,retired:c.retired,core:c.core,windrv:c.windrv}))})};
};
const install=function install(observer,wasm=WebAssembly){const Original=wasm.Instance,instantiate=wasm.instantiate;
 wasm.Instance=new Proxy(Original,{construct(t,a,n){const bind=observer.wrapImports(a[1]);return bind(Reflect.construct(t,a,n===wasm.Instance?t:n));}});
 wasm.instantiate=async function(source,imports){const bind=observer.wrapImports(imports),r=await Reflect.apply(instantiate,this,[source,imports]);return r.instance?{...r,instance:bind(r.instance)}:bind(r);};
 return ()=>{wasm.Instance=Original;wasm.instantiate=instantiate;};
};
function prefix(){return ';(()=>{const createObserver='+createObserver.toString()+',install='+install.toString()+';const o=createObserver({deadline:Date.now()+600000,emit:row=>console.info("UT_OBSERVER "+JSON.stringify(row))});install(o);})();\n';}
module.exports={createObserver,install,prefix};
