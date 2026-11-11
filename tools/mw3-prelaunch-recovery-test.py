"""Actual prepared controller pre-Chrome HTTP refusal and parent wait regression."""
from pathlib import Path
import json, os, runpy, subprocess, sys, time, importlib.util, hashlib
ROOT=Path(__file__).resolve().parents[1]
R=Path(sys.argv[1]).resolve(); R.mkdir(exist_ok=True)
S=ROOT/'scratch/runs/20261111-mw3-complete-helper-cockpit-0500'
subprocess.run([sys.executable,'-B',str(ROOT/'tools/mw3-retention-repair.py'),str(S),str(R)],check=True)
# Ordinary installer retains its small input contract and prepares the pin entry.
assert 'mw3-preparation.cjs' in (R/'pin.py').read_text()
(R/'owner.py').write_bytes((ROOT/'scratch/runs/20261111-mw3-cockpit-motion-space-response-0840/owner.py').read_bytes())
for name in ['transport.cjs','seal.cjs']:(R/name).write_bytes((S/name).read_bytes())
# Nested fixture directory; production run itself remains at scratch/runs/<id>.
for name in ['owner.py','owner-start.py','collect.py','browser.cjs','transport.cjs']:
 p=R/name;s=p.read_text().replace("R.parents[2]","Path("+repr(str(ROOT))+")").replace("Path(__file__).resolve().parents[3]","Path("+repr(str(ROOT))+")").replace("path.resolve(run,'../../..')",json.dumps(str(ROOT)))
 # Preserve Path division expressions for the explicit fixture root.
 s=s.replace(repr(str(ROOT))+"/","Path("+repr(str(ROOT))+")/")
 s=s.replace("../../../tools/",str(ROOT/"tools")+"/")
 s=s.replace("../20261110-mw3-complete-fixture-closure-combat-2135/",str(ROOT/'scratch/runs/20261110-mw3-complete-fixture-closure-combat-2135')+'/')
 p.write_text(s)
# Controller's ordinary HTTP guard fails before any Chrome spawn. No guest exists.
(R/'runtime-pins.json').write_text(json.dumps(dict(files=[],httpPins=[dict(url='/index.html',size=0,sha256='0'*64)])))
fixed=time.time()+800
for attempt in range(2):
 p=subprocess.Popen([sys.executable,'-B',str(R/'owner-start.py')],env=dict(os.environ,MW3_DEADLINE=str(fixed),MW3_TEST_FIXTURE='1'),stdout=subprocess.PIPE,stderr=subprocess.PIPE)
 out,err=p.communicate(timeout=25)
 (R/f'launcher-{attempt}.json').write_text(json.dumps(dict(status=p.returncode,actualWait=True,stdoutEOF=True,stderrEOF=True,stderr=err.decode())))
 assert p.returncode==1,err.decode()
 runtime=R/'runtime'
 outer=json.loads((runtime/'owner-terminal-manifest.json').read_bytes());assert outer['actualOuterFinalization']
 spec=importlib.util.spec_from_file_location('collect_prelaunch',R/'collect.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
 collector=m.Collector('http://unused','unused','unused',str(runtime),R/f'recovered-{attempt}')
 # Exact completed manifest from actual owner; all local raw hashes verified.
 for row in json.loads((runtime/'terminal-manifest.json').read_bytes())['rows']+outer['rows']:
  b=(runtime/row['path']).read_bytes();assert hashlib.sha256(b).hexdigest()==row['sha256'] and len(b)==row['size']
  collector.verified[row['path']]=dict(row,local=str(runtime/row['path']))
 collector.validate_waits();assert collector.recoverablePreChrome
 marker='case-webgl/chrome-not-started.json'
 proof=collector.verified.pop(marker)
 try:
  collector.validate_waits();raise RuntimeError('unknown Chrome accepted')
 except AssertionError:pass
 collector.verified[marker]=proof
 for name in ['process.json','chrome-spawn-attempt.json','chrome.stdout','chrome-parent-wait.json','launch.json']:
  collector.verified['case-webgl/'+name]={}
  try:
   collector.validate_waits();raise RuntimeError('started/uncertain Chrome accepted')
  except AssertionError:pass
  del collector.verified['case-webgl/'+name]
 node=runtime/'node-actual-wait.json';raw=node.read_bytes();v=json.loads(raw);v['separateEOF']['stderr']=False;node.write_text(json.dumps(v))
 try:
  collector.validate_waits();raise RuntimeError('incomplete EOF accepted')
 except AssertionError:pass
 node.write_bytes(raw)
 assert not (runtime/'case-webgl/chrome-parent-wait.json').exists()
 runtime.rename(R/f'failed-runtime-{attempt}')
 assert time.time()<fixed-600
# Recover-watch must leave confirmed recoverable failure live, without finish/stop.
watch=(R/'recover-watch.py').read_text()
assert "if result.get('recoverablePreChrome')" in watch
start=watch.index("if result.get('recoverablePreChrome')")
class Control:
 R=R
 def save(self,name,v):
  assert name=='recoverable-prechrome.json';self.value=v
 def stop(self,*args):raise RuntimeError('recoverable box stopped')
c=Control()
try:exec(watch[start:],dict(c=c,result=dict(passed=True,recoverablePreChrome=True,paths=17),time=time,due=fixed,sys=sys))
except SystemExit as e:assert e.code==0
assert c.value['noStop'] and c.value['allocationDeadline']==fixed
f=runpy.run_path(str(ROOT/'tools/mw3-prelaunch-recovery.py'))['child_deadline']
for now,allocation in [(100,2800),(100,1900),(100,1000)]:
 d=f(allocation,now);assert now+120<d<now+1800 and d<=allocation-600
for allocation in [700,float('inf'),float('nan')]:
 try:f(allocation,100);raise RuntimeError('bad deadline accepted')
 except AssertionError:pass
print('PASS actual failed HTTP controller, Node/outer waits and EOF, explicit no-Chrome, retained failures, same fixed deadline retry; started/unknown/EOF negatives')
