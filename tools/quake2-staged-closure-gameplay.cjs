'use strict';
// Q2 preallocation check. Byte-complete staging alone does not establish that
// the owning browser observer accepts the CPU selected by the preparer.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const current=require('./quake2-current-module.cjs'),root=path.resolve(__dirname,'..');
const observerPath='lib/quake2-browser-load-observer.js';
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function browserBinding(files,read=name=>fs.readFileSync(path.join(root,name))){
 const declared=new Map(files.map(p=>[p.path,p]));
 function bytes(name){
  const pin=declared.get(name);assert(pin,'undeclared Q2 browser provider: '+name);
  const b=read(name);assert.equal(b.length,pin.size,'Q2 browser provider size: '+name);assert.equal(hash(b),pin.sha256,'Q2 browser provider SHA: '+name);return b;
 }
 const context=vm.createContext({});
 // Read policy from the actual provider without calling prepare, compiling a
 // CPU, attaching an observer, starting a Worker or changing any provider.
 vm.runInContext(bytes(observerPath).toString(),context,{filename:observerPath,timeout:1000});
 const observer=context.Quake2BrowserLoadObserver;
 assert(observer&&typeof observer.prepare==='function','Q2 browser prepare missing');
 const pin=declared.get(observer.CPU_PATH);assert(pin,'undeclared Q2 browser CPU: '+observer.CPU_PATH);
 bytes(observer.CPU_PATH);
 assert.equal(observer.CPU_SHA,pin.sha256,'Q2 browser canonical CPU disagrees with staged module: '+observer.CPU_PATH);
 return {path:observer.CPU_PATH,sha256:pin.sha256,size:pin.size,observerPath};
}
function validate(options){
 const closure=current.validate(options);
 return {...closure,browserBinding:browserBinding(closure.files)};
}
module.exports={validate,browserBinding};
if(require.main===module){
 try{const v=validate({moduleVersion:process.argv[2]});console.log(JSON.stringify({passed:true,version:v.version,browserBinding:v.browserBinding,nativeQualification:false,allocationAllowedByThisCheck:true}));}
 catch(e){console.error(JSON.stringify({passed:false,error:e.message,allocationAllowedByThisCheck:false,nativeQualification:false}));process.exitCode=1;}
}
