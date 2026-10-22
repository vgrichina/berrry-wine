'use strict';
// Focused native delay-resolution diagnostic. Host reads only, instance bound.
module.exports=function(emit,region){
 let seq=0,active=false,done=false;const quotas=new Map(),returns=new Set(),pending=[];
 const delta=0x69b10000-0x1766000,rt=a=>a-delta;
 const ranges=[[0x69b584f4,0x69b58568],[0x69b2ab1f,0x69b2aca7],[0x69b23ae4,0x69b23c90],[0x69b79f71,0x69b7a0d8],[0x69b733c0,0x69b7340b],[0x69b820e8,0x69b82130],[0x69b82247,0x69b82310]].map(([a,b])=>[rt(a),rt(b)]);
 const points=new Set([0x8e98b7,0x8e98bf,0x8e98ca,0x8e98dc,0x8e98fb,0x8e9904,0x8e990d,0x489ece,0x17702b6]);
 const names=new Set(['GetProcAddress','GetModuleHandleA','GetModuleHandleW','LoadLibraryA','LoadLibraryW','LoadLibraryExA','LoadLibraryExW','RaiseException','RtlUnwind','GetLastError','CoCreateInstance','ReadFile']);
 function view(e,m,tr){const d=new DataView(m.buffer),base=e.get_image_base()>>>0,wa=a=>tr(a>>>0,base,m.buffer);const u32=a=>d.getUint32(wa(a),true),bytes=(a,n)=>Array.from({length:n},(_,i)=>d.getUint8(wa(a+i))),str=(a,w=false)=>{if(!a)return null;let t='';for(let i=0;i<160;i++){let c=w?d.getUint16(wa(a+2*i),true):d.getUint8(wa(a+i));if(!c)break;t+=String.fromCharCode(c);}return t;},safe=f=>{try{return f();}catch(x){return {unreadable:String(x.message)};}};const regs={};for(const r of ['eax','ebx','ecx','edx','esi','edi','ebp','esp','eip'])regs[r]=e['get_'+r]()>>>0;return {u32,bytes,str,safe,regs,stack:Array.from({length:64},(_,i)=>safe(()=>u32(regs.esp+i*4)))};}
 function send(x,key,limit=12){let n=quotas.get(key)||0;if(n>=limit)return;quotas.set(key,n+1);emit({seq:++seq,...x});}
 function snapshot(v){const {regs:r,stack,safe,bytes,u32,str}=v;return {regs:r,stack,code:safe(()=>bytes(r.eip,32)),frame:safe(()=>bytes(r.ebp-0x60,128)),eaxBytes:safe(()=>bytes(r.eax,48)),esiBytes:safe(()=>bytes(r.esi,64)),edxBytes:safe(()=>bytes(r.edx,64))};}
 function block(ip,e,m,tr){ip>>>=0;if(ip===0x8e98fb&&!done)active=true;const wanted=points.has(ip)||(active&&(returns.has(ip)||ranges.some(([a,b])=>ip>=a&&ip<b)));if(!wanted)return;let v=view(e,m,tr),x={kind:'block',ip,active,...snapshot(v)};
 if(ip===0x8e98bf){x.object=v.safe(()=>v.u32(v.regs.esp+0x14));x.vtable=v.safe(()=>v.u32(x.object));x.vtableBytes=v.safe(()=>v.bytes(x.vtable,96));}
 if(ip===0x8e98fb)x.url=v.safe(()=>v.str(v.regs.eax,true));
 if(ip===rt(0x69b23af5)){x.descriptor=v.safe(()=>v.bytes(v.stack[1],32));x.iatSlot=v.stack[2];}
 if(ip===rt(0x69b733f1)||ip===rt(0x69b733f9)){x.exceptionObject=v.safe(()=>v.bytes(v.regs.eax,48));}
 send(x,'block:'+ip,24);if(ip===0x8e9904){active=false;done=true;}}
 function api(name,e,m,tr,phase){if(!active||!names.has(name))return;const v=view(e,m,tr),{regs:r,stack:s,safe,u32,str,bytes}=v;
 if(phase==='entry'){const p={name,ret:s[0],args:s.slice(1,12)};returns.add(p.ret);const x={kind:'api-entry',...p,...snapshot(v)};
 if(name==='GetProcAddress')x.request=s[2]<65536?{ordinal:s[2]}:{name:safe(()=>str(s[2]))};
 if(/^LoadLibrary|^GetModuleHandle/.test(name))x.request=safe(()=>str(s[1],name.endsWith('W')));
 if(name==='RaiseException'){x.exceptionArguments=safe(()=>Array.from({length:Math.min(s[3],8)},(_,i)=>u32(s[4]+4*i)));x.delayInfo=safe(()=>{let a=u32(s[4]);return {pointer:a,words:Array.from({length:9},(_,i)=>u32(a+4*i)),dll:str(u32(a+12)),procedure:u32(a+16)?str(u32(a+20)):u32(a+20)};});}
 pending.push(p);send(x,'entry:'+name+':'+p.ret,64);
 }else{let i=pending.map(x=>x.name).lastIndexOf(name),p=i<0?null:pending.splice(i,1)[0];send({kind:'api-exit',name,entry:p,phaseBoundary:'host API handler exit; actual guest continuation recorded separately',...snapshot(v)},'exit:'+name+':'+(p&&p.ret),64);}}
 return {block,api};
};
