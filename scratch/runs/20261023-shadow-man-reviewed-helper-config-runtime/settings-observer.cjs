'use strict';
// Read-only guest observation; only evidence files are written by this helper.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const ROOT='/home/user/shadow-man-launcher-configuration-capture-oct23';
const RT=ROOT+'/immutable/runtime';
if(require('worker_threads').isMainThread){
 const out=process.env.SHADOW_SESSION_OUTPUT;
 if(!out || !out.startsWith(ROOT+'/mutable/output/save-gameplay/'))throw Error('settings evidence output outside owned quota');
 const host=require(RT+'/lib/host-imports'),original=host.createHostImports;
 let ctx,baseline;
 const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
 host.createHostImports=function(c){ctx=c;return original.apply(this,arguments);};
 globalThis.__shadowCapture=function(label){
  if(!/^[a-z0-9-]{1,40}$/.test(label)||!ctx||!ctx.vfs)throw Error('invalid diagnostic capture');
  const dir=out+'/state-'+label;fs.mkdirSync(dir);
  const rows=[...ctx.vfs.files].map(([name,en])=>({path:name,bytes:en.data.length,sha256:sha(Buffer.from(en.data))}));
  const before=new Map((baseline||rows).map(x=>[x.path,x]));
  const changed=rows.filter(x=>!before.has(x.path)||before.get(x.path).sha256!==x.sha256);
  const names=new Set(rows.map(x=>x.path));const deleted=[...before.keys()].filter(x=>!names.has(x));
  for(const x of changed){
   if(!/^c:\\/.test(x.path)||x.path.split('\\').includes('..'))throw Error('unsafe diagnostic guest path');
   const dest=dir+'/vfs/'+x.path.slice(3).replace(/\\/g,'/');fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,Buffer.from(ctx.vfs.files.get(x.path).data));
  }
  const store=require(RT+'/lib/storage').exportStore();const reg=JSON.stringify(store,null,2);
  fs.writeFileSync(dir+'/registry.json',reg);
  const result={label,process:process.pid,role:process.argv.find(x=>x.startsWith('--exe-guest-path=')),files:rows,changed,deleted,registrySHA256:sha(Buffer.from(reg)),registryBytes:Buffer.byteLength(reg),registry:store,guestMutation:false};
  fs.writeFileSync(dir+'/capture.json',JSON.stringify(result,null,2));
  if(!baseline)baseline=rows;
  return {label,files:rows.length,changed,deleted,registrySHA256:result.registrySHA256,registryBytes:result.registryBytes,guestMutation:false};
 };
}
