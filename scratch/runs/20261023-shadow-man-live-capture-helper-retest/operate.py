"""Explicit single-use phases, all remote receipts and logs are unique."""
import sys,json,io,base64,pathlib
from transport import *
F=ROOT+'/fixed/retest-oct23';O=ROOT+'/mutable/output/retest-oct23'
phase=sys.argv[1]
if phase=='prepare':
 assert json.loads((E/'offline-fixture.json').read_text())['passAll']
 code='SEALS_JSON='+repr((E/'final-remote-integrity.json').read_text())+'\n'+(E/'prepare_remote.py').read_text()
 r=run(code,'fresh-gate-api.json');save('fresh-gate.json',json.loads(r['stdout']))
 b=(E/'live_operator.py').read_bytes();save('helper-upload.json',upload_stream(io.BytesIO(b),len(b),F+'/live_operator.py'))
elif phase=='launch':
 assert not (E/'single-launch-api.json').exists()
 code='import threading,runpy\nt=threading.Thread(target=lambda:runpy.run_path('+repr(F+'/live_operator.py')+',run_name="__main__"),daemon=True)\nt.start()\nrunpy.run_path('+repr(F+'/launch_once.py')+',run_name="__main__")\nt.join(timeout=1)'
 run(code,'single-launch-api.json',100)
elif phase=='fetch-before':
 r=run('import pathlib,json,base64;F=pathlib.Path('+repr(F)+');O=pathlib.Path('+repr(O)+');print(json.dumps(dict(files={p.name:base64.b64encode(p.read_bytes()).decode() for p in [O/"launcher-before.png",F/"launcher-live-snapshot.json",F/"launcher-live-png.json",F/"endpoint-ready.json"] if p.exists()})))','before-fetch-api.json')
 for n,b in json.loads(r['stdout'])['files'].items():(E/n).write_bytes(base64.b64decode(b))
elif phase=='input':
 assert (E/'image-reviewed.json').exists() and not (E/'input-api.json').exists()
 code='''import pathlib,json,subprocess,time
F=pathlib.Path(F_PATH);O=pathlib.Path(O_PATH);R=pathlib.Path(ROOT_PATH)
g=json.loads((F/'gate.json').read_text());assert (O/'launcher-before.png').exists() and not (F/'input-dispatched.json').exists()
def ctl(args,label):
 p=subprocess.run(['node',str(R/'immutable/runtime/tools/ctl.js'),'-s',':'+str(g['controlPort']),*args],capture_output=True,text=True,timeout=3,env=g['environment']);r=dict(args=args,exit=p.returncode,stdout=p.stdout,stderr=p.stderr,time=time.time());(F/(label+'.json')).write_text(json.dumps(r,indent=2));assert p.returncode==0;return r
dispatch=dict(time=time.time(),command=['cmd','dlg-cmd:1024']);(F/'input-dispatched.json').write_text(json.dumps(dispatch))
try:
 ctl(['cmd','dlg-cmd:1024'],'ordinary-dispatch');time.sleep(.5)
 ctl(['snapshot'],'configuration-response-state');ctl(['png',str(O/'config-after.png')],'configuration-response-png')
 (F/'response-recorded.json').write_text(json.dumps(dict(time=time.time(),elapsed=time.time()-dispatch['time'])))
finally:(F/'operator-stop.json').write_text(json.dumps(dict(reason='ordinary-action-response-complete')))
'''
 run('F_PATH='+repr(F)+'\nO_PATH='+repr(O)+'\nROOT_PATH='+repr(ROOT)+'\n'+code,'input-api.json',20)
