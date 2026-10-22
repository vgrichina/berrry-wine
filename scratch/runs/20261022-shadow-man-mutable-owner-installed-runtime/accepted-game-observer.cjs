require('/home/user/shadow-man-streamed-installed-runtime-oct22/fixed/compile-guard.cjs');
// Diagnostic callbacks only; preserve every guest argument and normal return.
'use strict';
// Pure diagnostic predicate, also exercised by the offline fixture.
function captureReady(w,pid,role,now) {
 return !!(w && w.ownerPid===pid && role==='installer' &&
  !(w.style & 0x40000000) && (w.style & 0x10000000) &&
  Number.isFinite(w.shownAt) && now-w.shownAt>=400);
}
if (require('worker_threads').isMainThread) {
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const ROOT='/home/user/shadow-man-streamed-installed-runtime-oct22/immutable/runtime',OUT='/home/user/shadow-man-streamed-installed-runtime-oct22/mutable/output';
const exeArg=process.argv.find(x=>x.startsWith('--exe='));
const child=process.argv.includes('--spawned-child'),tag=child?'child':'parent';
const guestPath=process.argv.find(x=>x.startsWith('--exe-guest-path='))||'';
const role=/d3dconfigutility\.exe$/i.test(guestPath)?'config':/shadowman\.exe$/i.test(guestPath)?'game':!child?'parent':/_ins5576\._mp$/i.test(guestPath)?'installer':/_isdel\.exe$/i.test(guestPath)?'cleanup-helper':'unknown-child';
const windows=new Map();let settleTimer;
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const fd=fs.openSync(`${OUT}/${tag}-${process.pid}.jsonl`,'wx');let bytes=0,events=0,vfs,ctx,exp,mem,pending=[],stopping=false;
function emit(r){const b=JSON.stringify({tag,pid:process.pid,...r})+'\n';if(bytes+b.length>2*1024*1024||events>=4000)boundary('observer-quota',{});fs.writeSync(fd,b);bytes+=b.length;events++;}
function snapshot(){const out={tag,pid:process.pid,argv:process.argv,execArgv:process.execArgv,events,bytes,role,windows:[...windows.values()]};if(vfs)out.vfs=[...vfs.files].map(([name,en])=>({path:name,size:en.data.length,sha256:sha(Buffer.from(en.data))}));if(ctx&&ctx.renderer&&ctx.renderer.canvas){try{const r=ctx.renderer;r.repaint();const c=r.canvas,{PNG}=require('pngjs');const p=new PNG({width:c.width,height:c.height});p.data.set(c.getContext('2d').getImageData(0,0,c.width,c.height).data);const b=PNG.sync.write(p);const name=`${tag}-${process.pid}.png`;fs.writeFileSync(`${OUT}/${name}`,b);out.screenshot={name,bytes:b.length,sha256:sha(b)};}catch(e){out.pngError=String(e);}}fs.writeFileSync(`${OUT}/${tag}-${process.pid}-summary.json`,JSON.stringify(out,null,2));}
function boundary(reason,record){if(stopping)return;stopping=true;fs.writeFileSync(`${OUT}/stop-request.json`,JSON.stringify({reason,record,tag,pid:process.pid,time:new Date().toISOString()}));snapshot();throw Error('authorized first-boundary stop: '+reason);}
emit({kind:'preload-identity',role,guestPath,argv:process.argv,execArgv:process.execArgv,exe:exeArg?{path:exeArg.slice(6),bytes:fs.statSync(exeArg.slice(6)).size,sha256:sha(fs.readFileSync(exeArg.slice(6)))}:null});
const host=require(ROOT+'/lib/host-imports'),base=host.createHostImports;
host.createHostImports=function(c){ctx=c;vfs=c.vfs;return base.apply(this,arguments);};
const cp=require('child_process'),fork=cp.fork;
cp.fork=function(file,args,opts){
 if(!args.includes('--real-ticks'))throw Error('diagnostic child forwarding missing --real-ticks');
 if(args.some(x=>x.startsWith('--control=')))throw Error('unexpected inherited control port');
 const port=Number(cp.execFileSync('python3',['-c',"import socket;s=socket.socket();s.bind(('127.0.0.1',0));print(s.getsockname()[1]);s.close()"],{encoding:'utf8'}).trim());
 args=[...args,'--control='+port];emit({kind:'child-control-target',port,guestPath:args.find(x=>x.startsWith('--exe-guest-path=')),propagated:false});
 emit({kind:'fork',file,args,execArgv:process.execArgv,exeIdentity:{path:args[0].slice(6),bytes:fs.statSync(args[0].slice(6)).size,sha256:sha(fs.readFileSync(args[0].slice(6)))},moduleHash:sha(fs.readFileSync(args.find(x=>x.startsWith('--wasm=')).slice(7)))});
 const c=fork.call(this,file,args,opts);c.on('exit',(code,signal)=>emit({kind:'child-os-exit',childPid:c.pid,code,signal}));return c;
};
// Both actual CreateProcess input and parent/child exports call this module.
const ve=require(ROOT+'/lib/vfs-export'),saveOriginal=ve.saveVfsToHost;
ve.saveVfsToHost=function(v,d,...rest){
 const resolved=path.resolve(d);if(!resolved.startsWith('/home/user/shadow-man-streamed-installed-runtime-oct22/mutable/'))throw Error('export outside hard quota');
 const st=fs.statfsSync(OUT),copy=[...v.files.values()].reduce((n,en)=>n+Math.ceil(en.data.length/4096)*4096,0);
 const isInput=resolved.endsWith('/in'),need=copy*(isInput?3:1)+67108864+16777216;
 emit({kind:'actual-export-admission',route:isInput?'CreateProcess-input-plus-parent-and-child-exports':'parent-or-child-export',path:resolved,copyBytes:copy,requiredFree:need,available:st.bavail*st.bsize});
 if(need>st.bavail*st.bsize)boundary('allocation-before-actual-export',{path:resolved,need,available:st.bavail*st.bsize});
 return saveOriginal.call(this,v,d,...rest);
};
const {g2w}=require(ROOT+'/lib/mem-utils');
const api=JSON.parse(fs.readFileSync(ROOT+'/src/api_table.json')),names=new Set(api.map(x=>x.name));
const wanted=new Set(['WinExec','CreateProcessA','ShellExecuteA','LoadLibraryA','LoadLibraryExA','LoadLibraryW','GetProcAddress','CreateWindowExA','CreateWindowExW','DialogBoxParamA','DialogBoxIndirectParamA','CreateDialogParamA','ShowWindow','UpdateWindow','MessageBoxA','ExitProcess','BeginPaint','EndPaint']);
function refresh(w){
 if(exp.wnd_get_style_export)w.style=exp.wnd_get_style_export(w.hwnd)>>>0;
 if(exp.wnd_get_parent)w.actualParent=exp.wnd_get_parent(w.hwnd)>>>0;
 return w;
}
function arm(w){
 refresh(w);
 if(role!=='installer'||(w.style&0x40000000)||!(w.style&0x10000000))return;
 if(!Number.isFinite(w.shownAt))w.shownAt=performance.now();
 // Observe paint/visibility; no welcome-only stop and no async settle timer.
}
const original=WebAssembly.instantiate;
WebAssembly.instantiate=async function(module,imports){if(!imports.host||!imports.host.memory)return original.apply(this,arguments);const h=imports.host;mem=h.memory;const log=h.log,exit=h.log_api_exit,spawn=h.process_spawn;
const check=h.check_input,inputHwnd=h.check_input_hwnd;
if(check)h.check_input=function(){const value=check.apply(this,arguments);if(value)emit({kind:'guest-input-dequeued',role,value:value>>>0,message:value&65535,wParam:h.check_input_wparam?h.check_input_wparam():null,lParam:h.check_input_lparam?h.check_input_lparam():null});return value;};
if(inputHwnd)h.check_input_hwnd=function(){const value=inputHwnd.apply(this,arguments);if(value)emit({kind:'guest-input-target',role,hwnd:value>>>0});return value;};

const g=a=>g2w(a>>>0,exp.get_image_base()>>>0,mem.buffer),u=a=>new DataView(mem.buffer).getUint32(g(a),true);
const str=a=>{let s='';for(let i=0;a&&i<2048;i++){const c=new Uint8Array(mem.buffer)[g(a+i)];if(!c)break;s+=String.fromCharCode(c);}return s;};
h.log=function(ptr,len){const name=Buffer.from(mem.buffer,ptr,Math.min(len,256)).toString().split('\0')[0];if(names.has(name)){if(wanted.has(name)){const sp=exp.get_esp()>>>0,args=Array.from({length:9},(_,i)=>u(sp+4+i*4)),r={kind:'entry',name,caller:u(sp),args};if(['WinExec','LoadLibraryA','LoadLibraryExA','GetProcAddress'].includes(name))r.text=str(args[name==='GetProcAddress'?1:0]);if(name==='CreateWindowExA'){r.className=args[1]>65535?str(args[1]):args[1];r.title=str(args[2]);}if(name==='MessageBoxA'){r.text=str(args[1]);r.caption=str(args[2]);}pending.push(r);emit(r);if(name==='MessageBoxA')boundary('child-error-dialog-call',r);}else pending.push(null);}return log.apply(this,arguments);};
h.log_api_exit=function(){const r=pending.pop();if(r){const record={kind:'return',name:r.name,eax:exp.get_eax()>>>0,entry:r};emit(record);if(r.name==='CreateWindowExA'||r.name==='CreateWindowExW'){
 if(record.eax){const w={hwnd:record.eax,ownerPid:process.pid,style:r.args[3]>>>0,createdStyle:r.args[3]>>>0,parent:r.args[8]||0,className:r.className,title:r.title};windows.set(w.hwnd,w);refresh(w);emit({kind:'window-identity',role,window:{...w}});if(w.style&0x10000000)arm(w);}
 }
 if(r.name==='ShowWindow'||r.name==='UpdateWindow'){
 const w=windows.get(r.args[0]);if(w){refresh(w);emit({kind:'window-visibility-return',role,window:{...w},api:r.name,eax:record.eax,showCommand:r.args[1]});if(r.name==='UpdateWindow'||r.args[1]!==0)arm(w);}
 }
 if((r.name==='LoadLibraryA'||r.name==='LoadLibraryW'||r.name==='LoadLibraryExA')&&!record.eax)boundary('loader-return-zero',record);
 if(r.name==='EndPaint'){const w=windows.get(r.args[0]);if(w){w.paintedAt=performance.now();emit({kind:'real-end-paint-return',role,window:{...refresh(w)}});arm(w);if(role==='config'&&(w.style&0x10000000)&&!(w.style&0x40000000))snapshot();}}}return exit.apply(this,arguments);};
h.process_spawn=function(cmdWa,dirWa,...rest){const command=cmdWa?Buffer.from(mem.buffer,cmdWa,2048).toString().split('\0')[0]:'',directory=dirWa?Buffer.from(mem.buffer,dirWa,2048).toString().split('\0')[0]:'';let files=[];if(vfs)for(const [name,en] of vfs.files)if(/_istmp\d+\.dir/i.test(name))files.push({path:name,size:en.data.length,sha256:sha(Buffer.from(en.data))});emit({kind:'process-spawn-entry',command,directory,rest,payloads:files});const value=spawn.apply(this,arguments);emit({kind:'process-spawn-return',command,value});return value;};
const result=await original.apply(this,arguments);exp=(result.instance||result).exports;emit({kind:'module-instance',imageBase:exp.get_image_base()>>>0,realTicks:process.argv.includes('--real-ticks')});return result;
};
process.on('exit',code=>{try{emit({kind:'node-exit',code});snapshot();const save=process.argv.find(x=>x.startsWith('--save-vfs='));if(vfs&&save&&!fs.existsSync(save.slice(11))){const needed=[...vfs.files.values()].reduce((n,en)=>n+Math.ceil(en.data.length/4096)*4096,0)+4*1024*1024;const st=fs.statfsSync(OUT);if(needed<=st.bavail*st.bsize){const rows=require(ROOT+'/lib/vfs-export').saveVfsToHost(vfs,save.slice(11));emit({kind:'diagnostic-output-preservation',files:rows.length,path:save.slice(11),guestSuccessClaim:false});}else emit({kind:'diagnostic-output-preservation-refused',needed,available:st.bavail*st.bsize});}}catch(e){process.stderr.write(String(e)+'\n');}fs.closeSync(fd);});
}
