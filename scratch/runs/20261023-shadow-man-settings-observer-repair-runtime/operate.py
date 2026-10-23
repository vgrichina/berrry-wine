"""One-shot ordinary phases; no enablement, capability or settings mutation."""
import sys,io,time,base64
from transport import *
sid=sys.argv[2] if len(sys.argv)>2 else 'session1';assert sid in ('session1','session2','session3')
F=ROOT+'/fixed/save-gameplay/'+sid;O=ROOT+'/mutable/output/save-gameplay/'+sid
phase=sys.argv[1]
def fetch(label):
 code='''import pathlib,json,base64
F=pathlib.Path(F_PATH);O=pathlib.Path(O_PATH)
paths=[p for root in [F,O] for p in root.rglob('*') if p.is_file() and p.suffix in ('.json','.jsonl','.png','.log') and p.stat().st_size<=8388608 and '/vfs/' not in str(p)]
total=sum(p.stat().st_size for p in paths);assert total<4*1024*1024
print(json.dumps({('fixed-' if p.is_relative_to(F) else 'output-')+str(p.relative_to(F if p.is_relative_to(F) else O)).replace('/','--'):base64.b64encode(p.read_bytes()).decode() for p in paths}))
'''
 # API command output is bounded to 1MiB; fetch only selected small files per request.
 code='''import pathlib,json,base64
F=pathlib.Path(F_PATH);O=pathlib.Path(O_PATH)
paths=[p for root in [F,O] for p in root.rglob('*') if p.is_file() and p.suffix in ('.json','.jsonl','.png','.log') and p.stat().st_size<=8388608 and '/vfs/' not in str(p)]
print(json.dumps([dict(path=str(p),bytes=p.stat().st_size,name=('fixed-' if p.is_relative_to(F) else 'output-')+str(p.relative_to(F if p.is_relative_to(F) else O)).replace('/','--')) for p in paths]))
'''
 r=run('F_PATH='+repr(F)+'\nO_PATH='+repr(O)+'\n'+code,sid+'-'+label+'-inventory.json',10)
 for x in json.loads(r['stdout']):
  if label=='fetch-before' and x['name'] not in ['output-launcher-before.png','fixed-launcher-live-snapshot.json','fixed-launcher-live-png.json','fixed-launcher-ready-for-inspection.json']:continue
  if label=='fetch-config' and x['name'] not in ['output-configuration.png','fixed-configuration-snapshot.json','fixed-configuration-controls.json','fixed-open-dispatch.json']:continue
  if label=='fetch-after' and x['name'] not in ['output-after-ok.png','fixed-after-ok-snapshot.json','fixed-after-ok-controls.json','fixed-ok-dispatch.json','fixed-before-ok-state.json','fixed-after-ok-state.json']:continue
  # Read in 64KiB pieces to respect the existing command-response bound.
  dest=E/(sid+'-'+x['name']);dest.write_bytes(b'')
  for off in range(0,x['bytes'],65536):
   rr=api('sandboxes/'+BOX+'/commands',dict(command='python3 -c '+__import__('shlex').quote('import pathlib,base64;f=open('+repr(x['path'])+',"rb");f.seek('+str(off)+');print(base64.b64encode(f.read(65536)).decode())'),timeoutSeconds=10))
   assert rr.get('exitCode')==0
   with dest.open('ab') as out:out.write(base64.b64decode(rr['stdout']))
  assert dest.stat().st_size==x['bytes']
def action(kind):
 assert kind in ('open','ok','inspect','stop','play','quit')
 code='''import pathlib,json,subprocess,time
R=pathlib.Path(ROOT_PATH);F=pathlib.Path(F_PATH);O=pathlib.Path(O_PATH);g=json.loads((F/'gate.json').read_text())
def ctl(args,label):
 p=subprocess.run(['node',str(R/'immutable/runtime/tools/ctl.js'),'-s',':'+str(g['controlPort']),*args],capture_output=True,text=True,timeout=4,env=g['environment']);r=dict(args=args,exit=p.returncode,stdout=p.stdout,stderr=p.stderr,time=time.time());(F/(label+'.json')).write_text(json.dumps(r,indent=2));assert p.returncode==0,label;return r
def state(label):
 ctl(['snapshot'],label+'-snapshot')
 ctl(['eval',"(()=>{const rows=[];for(let slot=0;slot<256;slot++){const h=exports.wnd_slot_hwnd(slot);if(!h)continue;rows.push({hwnd:h>>>0,id:exports.ctrl_get_id(h)|0,cls:exports.ctrl_get_class(h)|0,parent:exports.wnd_get_parent(h)>>>0,style:exports.wnd_get_style_export(h)>>>0,x:exports.wnd_window_screen_x(h)|0,y:exports.wnd_window_screen_y(h)|0,wh:exports.ctrl_get_wh(h)>>>0});}return {windows:Object.values(renderer.windows).map(w=>({hwnd:w.hwnd,title:w.title,visible:w.visible,isChild:w.isChild,isDialog:w.isDialog,x:w.x,y:w.y,w:w.w,h:w.h})),controls:rows};})()"],label+'-controls')
 ctl(['png',str(O/(label+'.png'))],label+'-png')
if KIND=='open':
 assert not (F/'open-dispatch.json').exists()
 ctl(['cmd','dlg-cmd:1024'],'open-dispatch');time.sleep(.4);state('configuration')
elif KIND=='inspect':state('inspect')
elif KIND=='ok':
 assert not (F/'ok-dispatch.json').exists()
 controls=json.loads(json.loads((F/'configuration-controls.json').read_text())['stdout'])['controls']
 # Actual original control at the visually inspected OK location, not an invented ID.
 candidates=[x for x in controls if x['id']==1 and x['cls']==1 and 0<x['x']<100 and 230<x['y']<290 and x['style']&0x10000000 and not x['style']&0x08000000]
 assert len(candidates)==1,candidates
 ctl(['eval',"globalThis.__shadowCapture('before-ok')"],'before-ok-state')
 ctl(['cmd','dlg-cmd:'+str(candidates[0]['id'])],'ok-dispatch');time.sleep(.5)
 state('after-ok');ctl(['eval',"globalThis.__shadowCapture('after-ok')"],'after-ok-state')
elif KIND=='play':
 assert not (F/'play-dispatch.json').exists()
 ctl(['cmd','dlg-cmd:1025'],'play-dispatch');time.sleep(.5);state('after-play')
elif KIND=='quit':ctl(['quit'],'host-quit')
elif KIND=='stop':(F/'operator-stop.json').write_text(json.dumps(dict(reason='bounded-observation-complete',time=time.time())))
'''
 run('ROOT_PATH='+repr(ROOT)+'\nF_PATH='+repr(F)+'\nO_PATH='+repr(O)+'\nKIND='+repr(kind)+'\n'+code,sid+'-'+kind+'-api.json',20)
if phase=='launch':
 assert not (E/(sid+'-launch-api.json')).exists()
 L=pathlib.Path('/home/user/wine-assembly-shadow-man-live-capture-helper-retest-oct23/scratch/runs/20261023-shadow-man-live-capture-helper-retest')
 s=(L/'fixed-live_operator.py').read_text().replace('fixed/retest-oct23','fixed/save-gameplay/'+sid).replace('output/retest-oct23','output/save-gameplay/'+sid)
 (E/(sid+'-live_operator.py')).write_text(s);save(sid+'-operator-upload.json',upload_stream(io.BytesIO(s.encode()),len(s.encode()),F+'/live_operator.py'))
 code='import sys,threading,runpy\nsys.argv=["session_runner.py",'+repr(sid)+']\nt=threading.Thread(target=lambda:runpy.run_path('+repr(F+'/live_operator.py')+',run_name="__main__"),daemon=True)\nt.start()\nrunpy.run_path('+repr(ROOT+'/fixed/session_runner-repaired.py')+',run_name="__main__")\nt.join(timeout=1)'
 run(code,sid+'-launch-api.json',100)
elif phase.startswith('fetch'):fetch(phase)
else:action(phase)
