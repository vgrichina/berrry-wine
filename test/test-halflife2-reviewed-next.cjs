'use strict';
const cp=require('node:child_process'),assert=require('node:assert/strict');
const p=cp.spawnSync('python3',['-B','-c',String.raw`
import importlib.util,json,pathlib
s=importlib.util.spec_from_file_location('next','tools/halflife2-reviewed-next.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
path=pathlib.Path('scratch/runs/20261117-halflife2-normal-virtual-storage-installer-startup/pinned/native/original-startup.json')
scene=json.loads(path.read_text())['snapshot'];b=next(w for w in scene['windows'] if w['hwnd']=='0x10011')
x=int(b['screenX']+b['w']/2);y=int(b['screenY']+b['h']/2)
assert m.preflight(scene,b['hwnd'],x,y,b['title'])['threadId']==1
for target,px,py,label in [('0x1000f',x,y,b['title']),('0x10010',x,y,b['title']),('0x10012',x,y,b['title']),(b['hwnd'],0,0,b['title']),(b['hwnd'],x,y,'Cancel')]:
 try:m.preflight(scene,target,px,py,label)
 except (AssertionError,KeyError):pass
 else:raise AssertionError('wrong target accepted')
for key,value in [('threadId',2),('processId',2),('generation','0'),('live',False),('visible',False),('parent','0x10002'),('style',b['style']|0x08000000)]:
 v=json.loads(json.dumps(scene));next(w for w in v['windows'] if w['hwnd']==b['hwnd'])[key]=value
 try:m.preflight(v,b['hwnd'],x,y,b['title'])
 except AssertionError:pass
 else:raise AssertionError(key)
print('PASS captured genuine Next BUTTON 0x10011 public tree/geometry/actual owner; frame, child, sibling, disabled, lifetime and owner refusals')
s=importlib.util.spec_from_file_location('runtime','tools/halflife2-current-native.py');rt=importlib.util.module_from_spec(s);s.loader.exec_module(rt)
pins=json.loads((rt.CORE_FIXTURE/'runtime-inputs.json').read_text())
import subprocess
files={n:subprocess.check_output(['git','show',pins['gitSHA']+':'+n]) for n in pins['sources'] if n.startswith(('src/','lib/')) or n in ('host.js','test/run.js','tools/vb5cce-original-runtime.py','tools/vb5cce-reviewed-control.py')}
assert rt.reusable_core(files,pins['moduleSHA256'])['freshOwnOuterRequired']
for kind in ('module','material','inventory'):
 bad=dict(files);module=pins['moduleSHA256']
 if kind=='module':module='0'*64
 elif kind=='material':bad['host.js']+=b'changed'
 else:bad.pop('host.js')
 try:rt.reusable_core(bad,module)
 except AssertionError:pass
 else:raise AssertionError('reused changed '+kind)
print('PASS exact completed published core component reuse; changed module/material/inventory refused; fresh own outer required')
`],{encoding:'utf8'});
process.stdout.write(p.stdout);process.stderr.write(p.stderr);assert.equal(p.status,0);
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
