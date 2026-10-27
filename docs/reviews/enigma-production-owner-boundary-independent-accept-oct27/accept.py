"""Independent offline challenges through the pinned production CLI only."""
import sys
sys.dont_write_bytecode = True
import json, os, socket, subprocess, time, hashlib
from pathlib import Path
import admin as a

TOOL=a.R/'tools/enigma-supervised-gameplay.py'
LEGACY=TOOL.with_name('enigma-frozen-gameplay-controller.py')
children=[]
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def config(name, review=0, fault=''):
 d=a.O/name;d.mkdir()
 with socket.socket() as s:
  s.bind(('127.0.0.1',0));port=s.getsockname()[1]
 c=dict(command=[sys.executable,str(a.R/'test/fixtures/enigma-controller/child_server.py'),'--port',str(port),'--root',str(d),'--fault',fault],cwd=str(a.R),url=f'http://127.0.0.1:{port}/ctl',launch_dir=str(d/'launch'),cutoff_at=time.time()+60,duration_seconds=18,ready_seconds=2,limits=dict(cpu=20,wall=21,physical=100663296,file=25165824,output=2097152),controller=dict(max_batches=100,checkpoint_batches=1,after_action_batches=1,cleanup_batches=1,max_captures=2,capture_bytes=524288,width=640,height=480,checkpoint_seconds=3,after_action_seconds=1,review_seconds=review,request_timeout=.15,cleanup_seconds=.5,decision_path=str(d/'decision.json')))
 return d,c
def launch(d,c,legacy=False):
 pth=d/('legacy.json' if legacy else 'launch.json');pth.write_text(json.dumps(c))
 p=subprocess.Popen([sys.executable,str(LEGACY if legacy else TOOL),'--config' if legacy else '--launch-config',str(pth)],stdout=subprocess.PIPE,stderr=subprocess.PIPE)
 children.append(p);return p
def finish(p,d):
 out,err=p.communicate(timeout=24);v=dict(exit=p.returncode,stdout=out.decode(),stderr=err.decode());(d/'cli-result.json').write_text(json.dumps(v));return v
def wire(d): return [json.loads(x) for x in (d/'wire.jsonl').read_text().splitlines()]
def clean(d):
 v=json.loads((d/'launch/supervisor-outcome.json').read_text());assert not v['remainingOwnedLive'],v
 assert (d/'launch/terminal.json').exists()
 for pid,ticks in v['owned']:
  try:
   raw=Path(f'/proc/{pid}/stat').read_text();fields=raw[raw.rfind(')')+2:].split()
   assert fields[19]!=ticks or fields[0] in ('Z','X'),(pid,ticks)
  except FileNotFoundError:pass
 return v
def checkpoint(group):
 a.save('checkpoint.json',dict(candidate=a.CANDIDATE,group=group,status='PASS',fixtureSHA256=sha(Path(__file__)),sourcePins=json.loads((a.O/'source-pins.json').read_text()),remaining=['positive independent CLI path'] if group=='boundary' else ['separately admitted integration and real Node/Enigma runtime']))
def boundary():
 d,c=config('original',review=8);p=launch(d,c)
 end=time.monotonic()+6
 while not (d/'launch/controller/phase.json').exists() and p.poll() is None and time.monotonic()<end:time.sleep(.01)
 assert p.poll() is None and (d/'launch/controller/phase.json').exists(),'NEW original must be LIVE at review'
 child=json.loads((d/'child.json').read_text());original=json.loads((d/'launch/controller/config.json').read_text())
 # Verify inherited alternate socket belongs to the SAME original child.
 def sockets(pid):
  out=set()
  for q in Path(f'/proc/{pid}/fd').iterdir():
   try:out.add(os.readlink(q))
   except FileNotFoundError:pass
  return {x for x in out if x.startswith('socket:')}
 holder=sockets(child['idle_pid']);owner=sockets(child['pid']);assert len(holder)==1 and holder<owner
 journal=d/'launch/authority.jsonl';before=journal.read_bytes();commands=wire(d)
 state={str(q.relative_to(d/'launch/controller')):sha(q) for q in (d/'launch/controller').rglob('*') if q.is_file()}
 a.save('boundary-before.json',dict(child=child,config=original,journal=before.decode(),wire=commands,state=state,holderSockets=list(holder),ownerSockets=list(owner)))
 # One legacy competitor: changed endpoint, identity, output and schedule.
 comp=a.O/'legacy-competitor';comp.mkdir()
 reg=Path('/tmp')/f'enigma-frozen-controller-{os.getuid()}'
 registry={q.name:sha(q) for q in reg.glob('*')}
 foreign=dict(original,url=f"http://127.0.0.1:{child['alternate_port']}/ctl",pid=child['idle_pid'],process_start_ticks='caller-controlled',evidence_dir=str(comp/'forbidden'),started_at=time.time(),deadline_at=time.time()+110,max_batches=999999,review_seconds=0)
 result=finish(launch(comp,foreign,True),comp)
 assert result['exit']==1 and 'existing-guest-attachment-retired' in result['stdout'],result
 assert not (comp/'forbidden').exists() and registry=={q.name:sha(q) for q in reg.glob('*')}
 receipts=[dict(kind='legacy-alternate',result=result)]
 # NEW CLI with fresh output cannot attach to either occupied listener.
 for label,url in [('primary',c['url']),('alternate',foreign['url'])]:
  q,cc=config('new-'+label);cc['url']=url;cc['duration_seconds']=19;cc['limits']['wall']=22;cc['controller']['max_batches']=1000
  r=finish(launch(q,cc),q);assert r['exit']==1,r
  assert not Path(cc['launch_dir']).exists() and not (q/'child.json').exists()
  receipts.append(dict(kind='new-'+label,result=r))
  assert p.poll() is None and journal.read_bytes()==before and wire(d)==commands
 after={str(q.relative_to(d/'launch/controller')):sha(q) for q in (d/'launch/controller').rglob('*') if q.is_file()}
 assert state==after and p.poll() is None and journal.read_bytes()==before and wire(d)==commands
 a.save('boundary-after.json',dict(competitors=receipts,wire=wire(d),state=after,journal=journal.read_text(),originalLive=True,HTTPdelta=0,budgetConfigUnchanged=True))
 # End naturally using reviewed-false; no new allowance or terminal injection.
 (d/'decision.json').write_text(json.dumps(dict(reviewed=False)))
 r=finish(p,d);assert r['exit']==0,r
 outcome=clean(d);assert not outcome['failed'],outcome
 a.save('boundary-outcome.json',dict(passBoundary=True,cleanup=outcome,originalExit=r,sharedState=True,legacyHTTP=0,newCompetitorHTTP=0))
 checkpoint('boundary')
def positive():
 d,c=config('positive',review=.5,fault='review');r=finish(launch(d,c),d);assert r['exit']==0,r
 rows=wire(d);cmd=[x['command'] for x in rows]
 assert all(x['pid']==json.loads((d/'child.json').read_text())['pid'] for x in rows)
 for i,x in enumerate(cmd):
  if x.get('action')=='step': assert cmd[i+1]==dict(action='snapshot')
 clicks=[i for i,x in enumerate(cmd) if 'cmd' in x];assert len(clicks)==1
 assert cmd[clicks[0]-1]==dict(action='snapshot') and cmd[-1]==dict(action='quit')
 assert sum(x.get('action')=='png' for x in cmd)==2
 outcome=clean(d);assert not outcome['failed']
 a.save('positive-outcome.json',dict(exit=r,commands=cmd,cleanup=outcome,distinctFromOriginal=json.loads((d/'child.json').read_text())['pid']!=json.loads((a.O/'original/child.json').read_text())['pid']))
 checkpoint('positive')
try:
 {'boundary':boundary,'positive':positive}[sys.argv[1]]()
 print('PASS',sys.argv[1])
except BaseException as ex:
 import traceback
 a.save('first-failure.json',dict(candidate=a.CANDIDATE,group=sys.argv[1],exception=repr(ex),traceback=traceback.format_exc()))
 raise
finally:
 for p in children:
  if p.poll() is None:p.terminate()
  p.communicate(timeout=5)
