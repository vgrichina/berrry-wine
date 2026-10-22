// Launch-only observation. Wraps existing host callbacks; original WASM/runner
// bytes and arguments/returns remain unchanged. No replacement guest behavior.
'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const ROOT='/home/user/shadow-man-original-oct22/runtime';
const OUT='/home/user/shadow-man-observer-corrected-capture-oct22';
const NAMES=new Set(['CreateFileA','ReadFile','WriteFile','SetFilePointer','CloseHandle','GetLastError','LoadStringA','MessageBoxA','PeekMessageA','DispatchMessageA','GetMessageA','CreateProcessA','WinExec','ShellExecuteA']);
const PCS=new Set([0x404278,0x404334,0x40434b,0x40436b,0x4043b3,0x4046da,0x404739,0x40473e,0x404748,0x404750,0x404779,0x404789,0x40478e,0x404798,0x4051a2,0x4051a3,0x4051a8,0x405ea1,0x4064e6,0x40656c,0x406571,0x406575,0x406577,0x40657c,0x4065b5,0x40626f,0x40636f,0x4065bc,0x4065f2]);
function makeObserver({memory,exports:e,translate,emit,stop,findFile}){
  let pending=[],seq=0,pcs=new Map(),errors=[];
  const g=a=>translate(a>>>0,e.get_image_base()>>>0,memory.buffer);
  const u=a=>new DataView(memory.buffer).getUint32(g(a),true);
  const str=a=>{let s='';for(let i=0;a&&i<1024;i++){const c=new Uint8Array(memory.buffer)[g(a+i)];if(!c)break;s+=String.fromCharCode(c);}return s;};
  const bytes=(a,n)=>{if(n>65536)throw Error('observer buffer bound');const b=Buffer.alloc(n);let spans=[];for(let i=0;i<n;i++){const wa=g(a+i);b[i]=new Uint8Array(memory.buffer)[wa];const p=spans[spans.length-1];if(p&&p.wasm+p.length===wa)p.length++;else spans.push({guest:(a+i)>>>0,wasm:wa,length:1});}return {sha256:crypto.createHash('sha256').update(b).digest('hex'),length:n,spans};};
  const regs=()=>Object.fromEntries(['eax','ecx','edx','ebx','esp','ebp','esi','edi','eip'].filter(n=>e['get_'+n]).map(n=>[n,e['get_'+n]()>>>0]));
  const state=()=>({status:u(0x4107f4)|0,count:u(0x4107e8),savedLastError:u(0x4107ec)});
  function entry(name){
    if(!NAMES.has(name)){pending.push(null);return;}
    const esp=e.get_esp()>>>0,args=Array.from({length:8},(_,i)=>u(esp+4+i*4)),caller=u(esp);
    // Message-pump traffic is only relevant while inside extractor callbacks.
    if(/^(PeekMessage|DispatchMessage|GetMessage)/.test(name)&&!(caller>=0x404278&&caller<=0x406600)){pending.push(null);return;}
    const r={kind:'entry',seq:++seq,name,caller,args,regs:regs(),...state()};
    const frames=[];let bp=e.get_ebp()>>>0;
    for(let i=0;i<12&&bp;i++){const next=u(bp);frames.push({ebp:bp,return:u(bp+4)});if(next<=bp||next-bp>1048576)break;bp=next;}r.frames=frames;
    if(name==='CreateFileA')r.path=str(args[0]);
    if(name==='MessageBoxA'){r.text=str(args[1]);r.caption=str(args[2]);}
    if(['CreateProcessA','WinExec','ShellExecuteA'].includes(name)){emit(r);stop('child-attempt',r,true);return;}
    if(['ReadFile','WriteFile','SetFilePointer','CloseHandle'].includes(name))r.file=findFile(args[0]);
    if(name==='WriteFile'&&caller===0x404779)r.buffer=bytes(args[1],args[2]);
    pending.push(r);emit(r);
    if(name==='MessageBoxA')stop('first-dialog',r,false);
  }
  function exit(){
    // log_api_exit is before thunk auto-return: EIP still names the thunk.
    // Balance every API, including filtered ones, to preserve nested ownership.
    const r=pending.pop();if(!r)return;
    const out={kind:'return',seq:r.seq,name:r.name,caller:r.caller,args:r.args,eax:e.get_eax()>>>0,regs:regs(),...state()};
    if(['ReadFile','WriteFile'].includes(r.name)){
      out.actual=u(r.args[3]);out.file=findFile(r.args[0]);
      if(r.name==='ReadFile'&&r.caller===0x404583)out.buffer=bytes(r.args[1],Math.min(out.actual,r.args[2]));
      if(r.name==='WriteFile'&&(out.eax===0||out.actual!==r.args[2]))out.firstMismatch=true;
    }
    if(r.name==='LoadStringA')out.text=str(r.args[2]);
    if(/^(PeekMessage|GetMessage)/.test(r.name)&&r.args[0])out.message=Array.from({length:7},(_,j)=>u(r.args[0]+j*4));
    emit(out);
  }
  function pc(ip){
    ip>>>=0;if(!PCS.has(ip))return;
    const n=(pcs.get(ip)||0)+1;pcs.set(ip,n);
    // Retain first four and every nonzero status; counts retain filtered hits.
    if(n<=4||u(0x4107f4)!==0){
      const stack=Array.from({length:12},(_,i)=>u((e.get_esp()>>>0)+i*4));
      const r={kind:'pc',pc:ip,hit:n,regs:regs(),stack,...state()};
      if(ip===0x404278)r.extractor={container:stack[1],member:str(stack[2]),memberRecord:stack[2],output:str(stack[3]),return:stack[0]};
      // Resource call instructions may be inside a block. Callee entry gives
      // their unambiguous return PC (4051ad versus406581) and resource ID.
      if(ip===0x405ea1)r.resourceCall={return:stack[0],resource:stack[1],argument:stack[2]};
      emit(r);
    }
  }
  // Instrumentation faults invalidate capture and request supervisor shutdown;
  // they must never replace a successful guest API return with a JS exception.
  const guard=(phase,fn)=>(...a)=>{try{return fn(...a);}catch(err){const r={kind:'observer-fault',phase,error:String(err)};errors.push(r);try{emit(r);stop('observer-fault',r,false);}catch(_){} }};
  return {entry:guard('entry',name=>{const depth=pending.length;try{return entry(name);}catch(err){if(pending.length===depth)pending.push(null);throw err;}}),exit:guard('exit',exit),pc:guard('pc',pc),summary:()=>Object.fromEntries(pcs),errors:()=>errors};
}
function quotaSink(write,{maxBytes=4*1024**2,maxEvents=6000,onQuota}={}){
  let bytes=0,events=0,exhausted=false;
  return {emit(r){if(exhausted)return false;const line=JSON.stringify(r)+'\n',n=Buffer.byteLength(line);if(bytes+n>maxBytes||events+1>maxEvents){exhausted=true;if(onQuota)onQuota({bytes,events});return false;}write(line);bytes+=n;events++;return true;},counts:()=>({bytes,events,exhausted})};
}
function bindAttribution(filesystem,host,onVfs,onContext){
  const open=filesystem.VirtualFS.prototype.createFileResult;
  filesystem.VirtualFS.prototype.createFileResult=function(...args){onVfs(this);return open.apply(this,args);};
  const create=host.createHostImports;
  host.createHostImports=function(ctx){onContext(ctx);const result=create.apply(this,arguments);if(ctx.vfs)onVfs(ctx.vfs);return result;};
}
function outputSnapshot(vfs,write){
  if(!vfs)throw Error('VFS attribution missing');
  const rows=[];let total=0;
  for(const [name,en] of vfs.files){if(!/_istmp\d+\.dir/i.test(name))continue;const data=Buffer.from(en.data);if(total+data.length>2*1024**2){rows.push({path:name,length:data.length,omitted:'output cap'});continue;}total+=data.length;const dest='output-'+rows.length+'.bin';write(dest,data);rows.push({path:name,length:data.length,sha256:crypto.createHash('sha256').update(data).digest('hex'),artifact:dest});}
  write('outputs.json',JSON.stringify(rows,null,2));return rows;
}
function pngFallback(ctx,PNG,write){
  if(!ctx||!ctx.renderer||!ctx.renderer.canvas)throw Error('renderer missing');
  const r=ctx.renderer;if(r.repaint)r.repaint();const c=r.canvas,w=c.width|0,h=c.height|0;
  if(w<=0||h<=0||w*h>1920*1080)throw Error('PNG dimension bound');
  const img=c.getContext('2d').getImageData(0,0,w,h),png=new PNG({width:w,height:h});png.data.set(img.data);
  const data=PNG.sync.write(png);write('fallback.png',data);return {width:w,height:h,bytes:data.length,scope:'composited canvas at observer snapshot'};
}
module.exports={makeObserver,quotaSink,bindAttribution,outputSnapshot,pngFallback,PCS};
if(process.env.SHADOW_CAPTURE_OBSERVER==='1'){
  // All diagnostic file writes are checked before committing bytes. Reserve
  // 256KiB for supervisor stdout plus 64KiB for final receipts. Originals are
  // outside this prefix and are never intercepted.
  const rawWriteFile=fs.writeFileSync;
  function allocated(dir){let n=0;for(const d of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,d.name);n+=d.isDirectory()?allocated(p):fs.statSync(p).size;}return n;}
  fs.writeFileSync=function(target,data,...rest){if(typeof target==='string'&&target.startsWith(OUT+'/')){const old=fs.existsSync(target)?fs.statSync(target).size:0;const size=typeof data==='string'?Buffer.byteLength(data):data.byteLength;if(allocated(OUT)-old+size>8*1024**2-320*1024)throw Error('capture aggregate byte quota');}return rawWriteFile.call(this,target,data,...rest);};
  const fd=fs.openSync(path.join(OUT,'observer.jsonl'),'wx');
  const stop=(reason,record,abort)=>{const f=path.join(OUT,'stop-request.json');if(!fs.existsSync(f))fs.writeFileSync(f,JSON.stringify({reason,record,time:new Date().toISOString()}));if(abort)throw Error('bounded capture stop: '+reason);};
  const sink=quotaSink(line=>fs.writeSync(fd,line),{onQuota:r=>stop('observer-quota',r,false)});
  const {g2w}=require(ROOT+'/lib/mem-utils');
  const api=JSON.parse(fs.readFileSync(ROOT+'/src/api_table.json'));
  const apiNames=new Set(api.map(x=>x.name));
  let vfs=null,ctx=null,observer=null,original=WebAssembly.instantiate;
  bindAttribution(require(ROOT+'/lib/filesystem'),require(ROOT+'/lib/host-imports'),v=>vfs=v,c=>ctx=c);
  const file=h=>{if(!vfs)return null;const f=vfs.getOpenFile(h);if(!f)return {handle:h,invalid:true};const en=vfs.files.get(f.path);return {handle:h,path:f.path,position:f.pos,length:en?en.data.length:null};};
  let outputsSaved=false;
  const snapshotOutputs=()=>{if(outputsSaved)return;outputSnapshot(vfs,(n,b)=>fs.writeFileSync(path.join(OUT,n),b,{flag:'wx'}));outputsSaved=true;};
  globalThis.__shadowCaptureSnapshot=()=>{const r={quota:sink.counts(),pcHits:observer?observer.summary():null,errors:observer?observer.errors():[],missing:[]};try{snapshotOutputs();}catch(e){r.missing.push('output: '+e.message);}try{if(!fs.existsSync(path.join(OUT,'fallback.png')))r.png=pngFallback(ctx,require('pngjs').PNG,(n,b)=>fs.writeFileSync(path.join(OUT,n),b));}catch(e){r.missing.push('PNG: '+e.message);}try{fs.writeFileSync(path.join(OUT,'observer-summary.json'),JSON.stringify(r));}catch(e){process.stderr.write('observer summary missing: '+e.message+'\n');}return r;};
  WebAssembly.instantiate=async function(module,imports){
    if(!imports.host||!imports.host.memory)return original.call(this,module,imports);
    if(observer)throw Error('unexpected second module instance');
    const h=imports.host,log=h.log,exit=h.log_api_exit,spawn=h.process_spawn;
    h.log=function(ptr,len){const name=Buffer.from(h.memory.buffer,ptr,Math.min(len,256)).toString().split('\0')[0];if(apiNames.has(name))observer.entry(name);return log.apply(this,arguments);};
    h.log_api_exit=function(){observer.exit();return exit.apply(this,arguments);};
    h.log_eip=ip=>observer.pc(ip);
    h.process_spawn=function(){stop('child-host-attempt',{args:Array.from(arguments)},true);};
    const result=await original.call(this,module,imports),inst=result.instance||result,e=inst.exports;
    observer=makeObserver({memory:h.memory,exports:e,translate:g2w,emit:sink.emit,stop,findFile:file});
    e.set_trace_eip_range(1,0x404000,0x406600);
    process.on('exit',()=>{globalThis.__shadowCaptureSnapshot();fs.closeSync(fd);});
    return result;
  };
}
