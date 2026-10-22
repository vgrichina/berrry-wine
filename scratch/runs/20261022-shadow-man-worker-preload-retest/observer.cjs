// Diagnostic callbacks only; preserve every guest argument and normal return.
'use strict';
if (require('worker_threads').isMainThread) {
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const ROOT='/home/user/shadow-man-tools-ready-oct22/runtime',OUT='/home/user/shadow-man-bounded-runtime/shadow-man-worker-preload-retest-oct22';
const exeArg=process.argv.find(x=>x.startsWith('--exe='));
const child=process.argv.includes('--spawned-child'),tag=child?'child':'parent';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const fd=fs.openSync(`${OUT}/${tag}-${process.pid}.jsonl`,'wx');let bytes=0,events=0,vfs,ctx,exp,mem,pending=[],stopping=false;
function emit(r){const b=JSON.stringify({tag,pid:process.pid,...r})+'\n';if(bytes+b.length>1024*1024||events>=2000)boundary('observer-quota',{});fs.writeSync(fd,b);bytes+=b.length;events++;}
function snapshot(){const out={tag,pid:process.pid,argv:process.argv,execArgv:process.execArgv,events,bytes};if(ctx&&ctx.renderer&&ctx.renderer.canvas){try{const r=ctx.renderer;r.repaint();const c=r.canvas,{PNG}=require('pngjs');const p=new PNG({width:c.width,height:c.height});p.data.set(c.getContext('2d').getImageData(0,0,c.width,c.height).data);const b=PNG.sync.write(p);const name=`${tag}-${process.pid}.png`;fs.writeFileSync(`${OUT}/${name}`,b);out.screenshot={name,bytes:b.length,sha256:sha(b)};}catch(e){out.pngError=String(e);}}fs.writeFileSync(`${OUT}/${tag}-${process.pid}-summary.json`,JSON.stringify(out,null,2));}
function boundary(reason,record){if(stopping)return;stopping=true;fs.writeFileSync(`${OUT}/stop-request.json`,JSON.stringify({reason,record,tag,pid:process.pid,time:new Date().toISOString()}));snapshot();throw Error('authorized first-boundary stop: '+reason);}
emit({kind:'preload-identity',argv:process.argv,execArgv:process.execArgv,exe:exeArg?{path:exeArg.slice(6),bytes:fs.statSync(exeArg.slice(6)).size,sha256:sha(fs.readFileSync(exeArg.slice(6)))}:null});
const host=require(ROOT+'/lib/host-imports'),base=host.createHostImports;
host.createHostImports=function(c){ctx=c;vfs=c.vfs;return base.apply(this,arguments);};
const cp=require('child_process'),fork=cp.fork;
cp.fork=function(file,args,opts){emit({kind:'fork',file,args,execArgv:process.execArgv,exeIdentity:{path:args[0].slice(6),bytes:fs.statSync(args[0].slice(6)).size,sha256:sha(fs.readFileSync(args[0].slice(6)))},moduleHash:sha(fs.readFileSync(args.find(x=>x.startsWith('--wasm=')).slice(7)))});return fork.apply(this,arguments);};
const {g2w}=require(ROOT+'/lib/mem-utils');
const api=JSON.parse(fs.readFileSync(ROOT+'/src/api_table.json')),names=new Set(api.map(x=>x.name));
const wanted=new Set(['WinExec','CreateProcessA','ShellExecuteA','LoadLibraryA','LoadLibraryExA','LoadLibraryW','GetProcAddress','CreateWindowExA','CreateWindowExW','DialogBoxParamA','DialogBoxIndirectParamA','CreateDialogParamA','ShowWindow','UpdateWindow','MessageBoxA','ExitProcess']);
const original=WebAssembly.instantiate;
WebAssembly.instantiate=async function(module,imports){if(!imports.host||!imports.host.memory)return original.apply(this,arguments);const h=imports.host;mem=h.memory;const log=h.log,exit=h.log_api_exit,spawn=h.process_spawn;
const g=a=>g2w(a>>>0,exp.get_image_base()>>>0,mem.buffer),u=a=>new DataView(mem.buffer).getUint32(g(a),true);
const str=a=>{let s='';for(let i=0;a&&i<2048;i++){const c=new Uint8Array(mem.buffer)[g(a+i)];if(!c)break;s+=String.fromCharCode(c);}return s;};
h.log=function(ptr,len){const name=Buffer.from(mem.buffer,ptr,Math.min(len,256)).toString().split('\0')[0];if(names.has(name)){if(wanted.has(name)){const sp=exp.get_esp()>>>0,args=Array.from({length:8},(_,i)=>u(sp+4+i*4)),r={kind:'entry',name,caller:u(sp),args};if(['WinExec','LoadLibraryA','LoadLibraryExA','GetProcAddress'].includes(name))r.text=str(args[name==='GetProcAddress'?1:0]);if(name==='CreateWindowExA'){r.className=args[1]>65535?str(args[1]):args[1];r.title=str(args[2]);}if(name==='MessageBoxA'){r.text=str(args[1]);r.caption=str(args[2]);}pending.push(r);emit(r);if(child&&name==='MessageBoxA')boundary('child-error-dialog-call',r);}else pending.push(null);}return log.apply(this,arguments);};
h.log_api_exit=function(){const r=pending.pop();if(r){const record={kind:'return',name:r.name,eax:exp.get_eax()>>>0,entry:r};emit(record);if(child&&r.name==='ShowWindow'&&r.args[1]!==0)boundary('first-child-show-window',record);if(child&&r.name==='UpdateWindow')boundary('first-child-update-window',record);}return exit.apply(this,arguments);};
h.process_spawn=function(cmdWa,dirWa,...rest){const command=cmdWa?Buffer.from(mem.buffer,cmdWa,2048).toString().split('\0')[0]:'',directory=dirWa?Buffer.from(mem.buffer,dirWa,2048).toString().split('\0')[0]:'';let files=[];if(vfs)for(const [name,en] of vfs.files)if(/_istmp\d+\.dir/i.test(name))files.push({path:name,size:en.data.length,sha256:sha(Buffer.from(en.data))});emit({kind:'process-spawn-entry',command,directory,rest,payloads:files});const value=spawn.apply(this,arguments);emit({kind:'process-spawn-return',command,value});return value;};
const result=await original.apply(this,arguments);exp=(result.instance||result).exports;emit({kind:'module-instance',imageBase:exp.get_image_base()>>>0,realTicks:process.argv.includes('--real-ticks')});return result;
};
process.on('exit',code=>{try{emit({kind:'node-exit',code});snapshot();}catch(e){process.stderr.write(String(e)+'\n');}fs.closeSync(fd);});
}
