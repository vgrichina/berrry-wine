'use strict';
// Read-only guest observation; only evidence files are written by this helper.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const ROOT='/home/user/shadow-man-launcher-configuration-capture-oct23';
const RT=ROOT+'/immutable/runtime';
function contained(base,dest){
 const relative=path.relative(base,dest);
 if(!relative||relative==='..'||relative.startsWith('..'+path.sep)||path.isAbsolute(relative))throw Error('unsafe diagnostic destination');
 return dest;
}
function guestRelative(name){
 if(typeof name!=='string'||!/^c:\\/.test(name)||/[\x00-\x1f\x7f/:*?"<>|%]/.test(name.slice(2)))throw Error('unsafe diagnostic guest path');
 const parts=name.slice(3).split('\\');
 if(parts.some(p=>!p||p==='.'||p==='..'||/[. ]$/.test(p)))throw Error('unsafe diagnostic guest path');
 return parts.join('/');
}
function realDirectory(dir){
 if(fs.lstatSync(dir).isSymbolicLink()||!fs.statSync(dir).isDirectory()||fs.realpathSync(dir)!==path.resolve(dir))throw Error('unsafe diagnostic destination');
}
if(require('worker_threads').isMainThread){
 const out=process.env.SHADOW_SESSION_OUTPUT,outputBase=ROOT+'/mutable/output/save-gameplay';
 if(!out||path.resolve(out)!==out)throw Error('settings evidence output outside owned quota');
 contained(outputBase,out);realDirectory(out);
 const host=require(RT+'/lib/host-imports'),original=host.createHostImports;
 let ctx,baseline;
 const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
 host.createHostImports=function(c){ctx=c;return original.apply(this,arguments);};
 globalThis.__shadowCapture=function(label){
  if(!/^[a-z0-9-]{1,40}$/.test(label)||!ctx||!ctx.vfs)throw Error('invalid diagnostic capture');
  const dir=contained(out,path.resolve(out,'state-'+label));realDirectory(out);
  const rows=[...ctx.vfs.files].map(([name,en])=>({path:name,bytes:en.data.length,sha256:sha(Buffer.from(en.data))}));
  const before=new Map((baseline||rows).map(x=>[x.path,x]));
  const changed=rows.filter(x=>!before.has(x.path)||before.get(x.path).sha256!==x.sha256);
  const destinations=new Map(rows.map(x=>[x.path,contained(path.join(dir,'vfs'),path.resolve(dir,'vfs',guestRelative(x.path)))]));
  const names=new Set(rows.map(x=>x.path));const deleted=[...before.keys()].filter(x=>!names.has(x));
  fs.mkdirSync(dir);
  for(const x of changed){
   const dest=destinations.get(x.path);fs.mkdirSync(path.dirname(dest),{recursive:true});realDirectory(path.dirname(dest));fs.writeFileSync(dest,Buffer.from(ctx.vfs.files.get(x.path).data),{flag:'wx'});
  }
  const store=require(RT+'/lib/storage').exportStore();const reg=JSON.stringify(store,null,2);
  fs.writeFileSync(dir+'/registry.json',reg);
  const result={label,process:process.pid,role:process.argv.find(x=>x.startsWith('--exe-guest-path=')),files:rows,changed,deleted,registrySHA256:sha(Buffer.from(reg)),registryBytes:Buffer.byteLength(reg),registry:store,guestMutation:false};
  fs.writeFileSync(dir+'/capture.json',JSON.stringify(result,null,2));
  if(!baseline)baseline=rows;
  return {label,files:rows.length,changed,deleted,registrySHA256:result.registrySHA256,registryBytes:result.registryBytes,guestMutation:false};
 };
}
