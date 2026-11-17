'use strict';
const cp=require('node:child_process'),assert=require('node:assert/strict'),path=require('node:path');
{
 const fs=require('node:fs'),m=require('../tools/halflife2-reviewed-next.js');
 const scene=JSON.parse(fs.readFileSync('scratch/runs/20261117-halflife2-normal-virtual-storage-installer-startup/pinned/native/original-startup.json','utf8')).snapshot;
 const b=scene.windows.find(w=>w.hwnd==='0x10011');
 const x=Math.trunc(b.screenX+b.w/2),y=Math.trunc(b.screenY+b.h/2);
 assert.equal(m.preflight(scene,b.hwnd,x,y,b.title).threadId,1);
 for(const [target,px,py,label] of [['0x1000f',x,y,b.title],['0x10010',x,y,b.title],['0x10012',x,y,b.title],[b.hwnd,0,0,b.title],[b.hwnd,x,y,'Cancel']])
  assert.throws(()=>m.preflight(scene,target,px,py,label),'wrong target accepted');
 for(const [key,value] of [['threadId',2],['processId',2],['generation','0'],['live',false],['visible',false],['parent','0x10002'],['style',b.style|0x08000000]]){
  const v=structuredClone(scene);v.windows.find(w=>w.hwnd===b.hwnd)[key]=value;
  assert.throws(()=>m.preflight(v,b.hwnd,x,y,b.title),/^AssertionError/,key);
 }
 console.log('PASS captured genuine Next BUTTON 0x10011 public tree/geometry/actual owner; frame, child, sibling, disabled, lifetime and owner refusals');
 const rt=require('../tools/halflife2-current-native.js');
 const pins=JSON.parse(fs.readFileSync(path.join(rt.CORE_FIXTURE,'runtime-inputs.json'),'utf8'));
 const core=n=>n.startsWith('src/')||n.startsWith('lib/')||['host.js','test/run.js','tools/vb5cce-original-runtime.js','tools/vb5cce-reviewed-control.js'].includes(n);
 const files=Object.fromEntries(Object.keys(pins.sources).filter(core).map(n=>[n,cp.execFileSync('git',['show',pins.gitSHA+':'+n],{maxBuffer:1<<30})]));
 assert(rt.reusable_core(files,pins.moduleSHA256).freshOwnOuterRequired);
 for(const kind of ['module','material','inventory']){
  const bad={...files};let module=pins.moduleSHA256;
  if(kind==='module')module='0'.repeat(64);
  else if(kind==='material')bad['host.js']=Buffer.concat([bad['host.js'],Buffer.from('changed')]);
  else delete bad['host.js'];
  assert.throws(()=>rt.reusable_core(bad,module),/^AssertionError/,'reused changed '+kind);
 }
 console.log('PASS exact completed published core component reuse; changed module/material/inventory refused; fresh own outer required');
}
require('./test-vb5-native-dialog-identity.cjs');
// Context readiness and actual ordinary owner are separate from capabilities.
{
 const fs=require('node:fs'),{startupReadiness}=require('../lib/cli-native-scene');
 const s=JSON.parse(fs.readFileSync('scratch/runs/20261117-halflife2-normal-virtual-storage-installer-startup/pinned/native/original-startup.json')).snapshot;
 const anchor=s.windows.find(w=>w.hwnd===s.mainHwnd);
 const actor={get_process_id:()=>anchor.processId,get_current_thread_id:()=>anchor.threadId};
 const base={healthy:true,refs:{actorExports:actor}};
 assert(startupReadiness(s,base).ready);
 for(const change of [v=>v.windows.find(w=>w.hwnd===v.mainHwnd).visible=false,v=>v.focusTopLevel='0xdead',v=>v.focusWindow.threadId++,v=>v.physicalUp=false,v=>v.capture='0x1',v=>v.modalHwnd='0xdead',v=>v.quit=true]){
  const v=structuredClone(s);change(v);assert(!startupReadiness(v,base).ready);
 }
 assert(!startupReadiness(s,{...base,healthy:false}).ready);
 assert(!startupReadiness(s,{healthy:true,refs:{actorExports:{...actor,get_current_thread_id:()=>999}}}).ready);
 const unsupported=structuredClone(s);unsupported.windows.push({...anchor,hwnd:'0xdead',controlClass:999,nativeTextAvailable:false});
 assert(startupReadiness(unsupported,base).ready,'readiness must end before unsupported-control diagnosis');
 console.log('PASS passive startup actual owner/context refusals; unsupported controls do not extend readiness');
}
