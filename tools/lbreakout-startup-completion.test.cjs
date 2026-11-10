'use strict';
const assert=require('node:assert/strict'),cp=require('node:child_process'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),run=path.resolve(process.argv[2]);
const python=s=>cp.execFileSync('python3',['-c',"import importlib.util;s=importlib.util.spec_from_file_location('h','tools/lbreakout-case-inspection.py');h=importlib.util.module_from_spec(s);s.loader.exec_module(h);"+s],{cwd:root,encoding:'utf8'});
const scope={setTimeout,clearTimeout,Date,DataView};vm.createContext(scope);vm.runInContext(python('print(h.startup_completion_observer_source())')+';globalThis.install=installStartupCompletion;',scope);
function setup(){
 const binding={exe:0x10000,sdl:0x100000,index:0,generation:7,mappingState:2},memory={buffer:new ArrayBuffer(0x190000)},v=new DataView(memory.buffer);
 const w=(p,n)=>v.setUint32(p,n,true);let clock=0,target;
 w(32,binding.sdl);w(64,2);w(68,7);w(binding.exe+0x77150,0x140000);w(0x14001c,0x140100);w(0x140104,6);w(0x140148,0x140200);
 const e={guest_to_wasm:p=>p,get_dll_table:()=>32,get_dll_lifecycle_table:()=>64,get_dll_lifecycle_stride:()=>16,get_image_base:()=>binding.exe,get_current_thread_id:()=>1,
  set_trace_eip_range:(f,lo,hi)=>{assert(!f||hi===lo+1);target=f?lo:0;}};
 return {w,e,memory,binding,now:()=>clock,expire:()=>{clock=2000;},target:()=>target};
}
(async()=>{
 for(const mode of ['success','loading','manager-only','no-menu','module','thread','menu-change','unsupported-item']){
  const s=setup(),o=await scope.install({...s,token:'startup',expected:0}),hit=rva=>o.boundary(s.binding.exe+rva);
  assert.equal(s.target(),s.binding.exe+0x26026);
  hit(0x10849);assert(o.snapshot().active,'manager alone is insufficient');
  if(mode==='module')s.w(68,8);
  if(mode==='thread')s.e.get_current_thread_id=()=>2;
  if(['loading','no-menu'].includes(mode))s.w(s.binding.exe+0x77150,0);
  if(mode!=='manager-only')hit(0x26026);
  if(mode==='loading'){assert(o.snapshot().active);s.w(s.binding.exe+0x77150,0x140000);hit(0x26026);}
  if(mode==='menu-change')s.w(s.binding.exe+0x77150,0x140300);
  if(mode==='unsupported-item')s.w(0x140104,0);
  hit(0x10849);
  if(['manager-only','no-menu'].includes(mode)){assert(o.snapshot().active);s.expire();hit(0);}
  assert.equal(o.snapshot().reason,['success','loading'].includes(mode)?'complete':['manager-only','no-menu'].includes(mode)?'deadline':'failure',mode);
  const before=JSON.stringify(o.snapshot());hit(0x26026);hit(0x10849);assert.equal(JSON.stringify(o.snapshot()),before,'sticky terminal');o.stop('cleanup');
 }
 console.log('PASS startup original SDL/menu display ordering, absent menu, owner/generation, deadline, sticky terminal');
 const native=fs.readFileSync(run+'/browser-corrected.cjs','utf8');
 const generated=python('print(h.startup_workflow_source('+JSON.stringify(native)+'))');
 const repaired=run+'/offline-repaired';fs.mkdirSync(repaired,{recursive:true});
 fs.writeFileSync(repaired+'/browser-corrected.cjs',generated);fs.writeFileSync(repaired+'/worker-preload.js',python('print(h.pause_completion_preload_source())'));
 fs.writeFileSync(repaired+'/bound-input.cjs',fs.readFileSync(run+'/bound-input.cjs','utf8').replaceAll('../../../ops/','../../../../ops/'));
 assert(generated.indexOf("phase:'startup'")<generated.indexOf("await capture('startup')"));
 assert.throws(()=>python("print(h.startup_workflow_source('drift'))"));
 let base=fs.readFileSync(root+'/tools/lbreakout-sdl-input-controls.cjs','utf8').replace("require('path').resolve(__dirname,'..')",JSON.stringify(root));
 base=base.replace("if(s==='globalThis.__lbObserver.snapshot()'){",`if(s==='globalThis.__lbObserver.snapshot()'&&completionArm?.phase==='startup'){
   const mode=process.env.LB_STARTUP_MODE;completionPolls++;
   if(mode==='failure')throw Error('first startup observer failure');
   if(mode==='binding')return {...completionArm,token:'foreign',active:false,reason:'complete'};
   if(mode==='module')return {...completionArm,binding:{generation:99},active:false,reason:'complete'};
   if(mode==='incomplete')return {...completionArm,active:false,reason:'deadline'};
   completionReady=completionPolls>=3;
   return {...completionArm,active:!completionReady,reason:completionReady?'complete':null};
  }
  if(s==='globalThis.__lbObserver.snapshot()'){
`);
 base=base.replace("if(s.includes('__mcmPassiveInstanceV1'))return", "if(s.includes('__mcmPassiveInstanceV1')&&completionArm&&process.env.LB_STARTUP_MODE==='owner')return {endpointIdentity:'endpoint',slot:0,instance:'replacement'};\n  if(s.includes('__mcmPassiveInstanceV1'))return");
 base=base.replace("if(completionNegative==='presentation')", "if(completionNegative==='presentation'||(completionArm?.phase==='startup'&&process.env.LB_STARTUP_MODE==='presentation'))");
 fs.writeFileSync(run+'/startup-boundary.cjs',base);
 const adapter=`const Module=require('node:module'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
 const previous=Module._load,dir=path.dirname(process.argv[1]),mode=process.env.LB_STARTUP_MODE;
 let terminal=false,protocol=0,atFailure=0,edges=0;const send=WebSocket.prototype.send;
 WebSocket.prototype.send=function(raw){assert(!terminal,'zero protocol after terminal');protocol++;if(JSON.parse(raw).method==='Input.dispatchKeyEvent')edges++;return send.call(this,raw);};
 Module._load=function(name){const value=previous.apply(this,arguments);
  if(name==='node:child_process')return {...value,spawn:(...args)=>{const child=value.spawn(...args),kill=child.kill;child.kill=function(...args){terminal=true;atFailure=protocol;return kill.apply(this,args);};return child;}};
  if(name==='./transport.cjs')return {...value,consume:async(out,n,execute)=>{
   assert.equal(mode,'success');assert.equal(n,0);const latest=JSON.parse(fs.readFileSync(out+'/latest.json'));assert.equal(latest.label,'startup');
   assert(fs.existsSync(out+'/completion-startup-startup.json'));assert(fs.existsSync(out+'/presentation-startup-startup.json'));
   value.publish(out+'/startup-review.json',{...latest,decision:'continue',review:'offline boundary only; no native visual acceptance'});
   await execute({action:'quit',reviewRef:'startup'},()=>{});return true;}};
  return value;
 };
 process.on('exit',()=>{
  assert.equal(edges,0);if(mode!=='success'){assert(terminal);assert.equal(protocol,atFailure);assert(!fs.existsSync(dir+'/original/startup.png'));assert(fs.existsSync(dir+'/original/first-browser-failure.json'));
   Promise.all(['key','capture','quit'].map(action=>assert.rejects(globalThis.__startupExecute({action},()=>{}),/terminal/))).then(()=>assert.equal(protocol,atFailure)).catch(e=>{console.error(e);process.exitCode=9;});
  }
  fs.writeFileSync(dir+'/control.json',JSON.stringify({passed:true,mode,actualFullGeneratedCaller:true,zeroInput:true,noLaterProtocol:true,firstImageGated:true}));
 });`;
 fs.writeFileSync(run+'/startup-adapter.cjs',adapter);
 const controls=[];
 for(const mode of ['success','binding','module','owner','incomplete','failure','presentation']){
  const dir=run+'/startup-'+mode;fs.mkdirSync(dir);
  const exposed=generated.replace("(async()=>{\n server=", "globalThis.__startupExecute=execute;\n(async()=>{\n server=");assert.notEqual(exposed,generated);
  fs.writeFileSync(dir+'/browser.cjs',exposed.replace("path.resolve(run,'../../..')",JSON.stringify(root)));
  for(const name of ['readiness.cjs','bound-input.cjs','ordinary-keys-fixed.cjs','transport.cjs','input.cjs'])fs.writeFileSync(dir+'/'+name,fs.readFileSync(run+'/'+name,'utf8').replaceAll('../../../ops/','../../../../ops/').replaceAll('../../../tools/','../../../../tools/'));
  fs.writeFileSync(dir+'/worker-preload.js',fs.readFileSync(repaired+'/worker-preload.js'));
  const bytes=fs.readFileSync(root+'/build/wine-assembly.wasm');fs.writeFileSync(dir+'/runtime-pins.json',JSON.stringify({files:[{path:'build/wine-assembly.wasm',size:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')}],httpPins:[]}));
  const p=cp.spawnSync('node',['--require',run+'/startup-boundary.cjs','--require',run+'/startup-adapter.cjs',dir+'/browser.cjs'],{cwd:root,env:{...process.env,LB_OFFLINE_STARTUP:'1',LB_OFFLINE_PAUSE:'1',LB_STARTUP_MODE:mode,CASE_TAG:'original',BROWSER_DEADLINE:String(Date.now()+20000)},encoding:'utf8',timeout:25000});
  fs.writeFileSync(dir+'/stdout',p.stdout);fs.writeFileSync(dir+'/stderr',p.stderr);assert.equal(p.status,mode==='success'?0:1,p.stderr);
  controls.push(JSON.parse(fs.readFileSync(dir+'/control.json')));console.log('PASS full generated startup '+mode);
 }
 fs.writeFileSync(run+'/startup-controls.json',JSON.stringify(controls,null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
