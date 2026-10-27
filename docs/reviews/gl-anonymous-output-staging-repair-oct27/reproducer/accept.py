import ast,hashlib,importlib.util,json,os,pathlib,resource,subprocess,sys
from unittest import mock
P=pathlib.Path;H=P(__file__).resolve().parent.parent;R=H/'repo';O=H/'ops'
REPRO=R/'test/test-gl-output-namespace-independent.py';RUNNER=R/'test/fixtures/gl-transient-accounting/remote-run.py'
NODE='/home/user/.nvm/versions/node/v24.18.1/bin/node';FLAGS=['--max-old-space-size=512']
def sha(p):
 h=hashlib.sha256()
 with p.open('rb') as f:
  for b in iter(lambda:f.read(65536),b''):h.update(b)
 return h.hexdigest()
def load():
 assert sha(REPRO)=='c2af1d21e96800230e2bd7b266936979feb3d011fec8797e13c21c4203a5b628'
 tree=ast.parse(REPRO.read_bytes()); changed=[]
 for n in tree.body:
  if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='RUNNER_SHA' for t in n.targets):
   assert n.value.value=='a520830a87b04086cd1994b9513e43314df91942b18295c4d8227bde69eba6ab'
   n.value.value=sha(RUNNER);changed.append(n.lineno)
 assert len(changed)==1
 ns={'__file__':str(REPRO),'__name__':'independent_loaded'};exec(compile(tree,str(REPRO),'exec'),ns)
 ns['NODE']=NODE
 # Function globals remain this dictionary, so executable selection is explicit.
 return ns
def startup():
 assert sha(P(NODE))=='f3432a45b03b2da0d270095fdd8813dc34cbea73f5fc8b18c7a384b7cf9b333a'
 assert resource.getrlimit(resource.RLIMIT_DATA)==(-1,-1)
 assert resource.getrlimit(resource.RLIMIT_AS)==(-1,-1)
 code='const fs=require("fs");console.log(JSON.stringify({execPath:process.execPath,version:process.version,flags:process.execArgv,environment:process.env,limits:fs.readFileSync("/proc/self/limits","utf8"),startup:true}))'
 cmd=[NODE,*FLAGS,'-e',code];j=json.loads(subprocess.check_output(cmd))
 assert j['execPath']==NODE and j['version']=='v24.18.1' and j['startup']
 (O/'node-startup.json').write_text(json.dumps({'command':cmd,'result':j,'parentLimits':P('/proc/self/limits').read_text(),'executableSHA256':sha(P(NODE)),'physicalCap':128*1048576,'heapIsNotPhysicalCap':True},indent=2))
 print('PASS real Node exact executable/heap512/environment DATA/AS unlimited startup')
def first():
 i=load();t=i['t'];exercise=t.exercise;seen=[]
 def observe(source,*a,**kw):
  r=exercise(source,*a,**kw)
  targets=list(O.glob('gl-independent-*/outside-runner-accounting.log'));assert len(targets)==1
  p=targets[0];seen.append({'result':r,'externalBytes':p.stat().st_size,'externalAllocated':p.stat().st_blocks*512})
  return r
 with mock.patch.object(t,'exercise',observe):
  try:i['main']()
  except TypeError as exc:historical=str(exc)
  else:raise AssertionError('original success-shaped reproducer unexpectedly completed')
 assert len(seen)==1
 j=seen[0];r=j['result']
 assert j['externalBytes']==j['externalAllocated']==0
 assert r['children']==[] and r['collected'] is None
 assert r['error'] and r['collectorError'] and 'single-link regular' in r['error'] and 'single-link regular' in r['collectorError']
 assert not r['artifacts'].get('remote-final-accounting.json',{}).get('accountingComplete')
 j.update({'historicalAssertionException':historical,'originalInjectionUnchanged':True,'runnerSHA256':sha(RUNNER),'reproducerSHA256':sha(REPRO),'interpretation':'Safe refusal before child execution; no collected bytes; external target empty. Historical main expects success so its None indexing raises.'})
 (O/'first-production-boundary.json').write_text(json.dumps(j,indent=2));print('PASS unchanged original injection against exact production runner/collector: no child, no external bytes, no collection, no complete accounting')
if __name__=='__main__':{'startup':startup,'first':first}[sys.argv[1]]()
