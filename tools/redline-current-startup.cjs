'use strict';
// Redline-only adapter: retain the production caller's admission algorithm.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const Module=require('node:module'),crypto=require('node:crypto');
const policy=require('../lib/redline-current-startup-v1.js');
const {version,SELECTED,publishedModuleCommit}=policy;
const root=path.resolve(__dirname,'..');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function optin(selected){assert.equal(selected,version,'unknown Redline startup version');}
function replace(source,before,after){assert.equal(source.split(before).length,2,'unique current startup seam: '+before);return source.replace(before,after);}
function launchSource(){
 let source=fs.readFileSync(path.join(__dirname,'redline-startup.cjs'),'utf8');
 source=replace(source,"require('../lib/redline-startup-admission.js')","require('../lib/redline-current-startup-v1.js')");
 return replace(source,'RedlineStartupAdmission.install({WineAssembly,deadline:${cap}});',
  'RedlineStartupAdmission.install({WineAssembly,deadline:${cap},version:'+JSON.stringify(version)+'});');
}
let retained;
async function launch(options){
 optin(options.version);
 if(!retained){const filename=path.join(__dirname,'redline-startup.cjs'),m=new Module(filename,module);m.filename=filename;m.paths=module.paths;m._compile(launchSource(),filename);retained=m.exports;}
 // Both page programs are staged and checked by the outer caller before launch.
 const provider=fs.readFileSync(path.join(root,'lib/redline-current-startup-v1.js'),'utf8');
 return retained.launch({...options,source:provider+'\n'+options.source});
}
function integrate(source){
 source=replace(source,"require(root+'/tools/redline-startup.cjs').launch({evaluate,send,workers,pageSession,",
  "require(root+'/tools/redline-current-startup.cjs').launch({evaluate,send,workers,pageSession,version:pins.startupVersion,");
 return source;
}
function admissionPins(){
 const pins={'lib/redline-startup-admission.js':{path:'lib/redline-startup-admission.js',size:6161,sha256:'bd39c71fb2a331554d74568cca1916fb0750fa19a11bef1614d66456735a875f'}};
 for(const name of ['lib/redline-current-startup-v1.js','tools/redline-current-startup.cjs']){
  const bytes=fs.readFileSync(path.join(root,name));pins[name]={path:name,size:bytes.length,sha256:sha(bytes)};
 }
 return pins;
}
module.exports={admissionPins,version,SELECTED,publishedModuleCommit,optin,launch,integrate,launchSource,sha};
