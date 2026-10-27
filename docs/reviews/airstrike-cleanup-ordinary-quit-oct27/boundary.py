import pathlib,sys,hashlib,json,importlib.util,resource
H=pathlib.Path(__file__).parent
D=pathlib.Path('/tmp/airstrike-complete-controller-main-integration-oct27/repo')
P=pathlib.Path('/home/user/wine-assembly/scratch/usage-watch/airstrike-cleanup-verified-runtime-map-oct27.json')
assert hashlib.sha256(P.read_bytes()).hexdigest()=='3b9c75b8d1115fd61a0f1106933faafcfde24b96e4191c3572302c4e65072baf'
rows=json.loads(P.read_text())['files'];pins=[]
for x in rows:
 if 'airstrike-' in x['target'] and x['target'].endswith('.py'):
  p=pathlib.Path(x['source']);assert hashlib.sha256(p.read_bytes()).hexdigest()==x['sha256']
  pins.append(dict(path=str(p),sha256=x['sha256'],bytes=p.stat().st_size))
assert len(pins)==4
spec=importlib.util.spec_from_file_location('accepted_fixture',D/'test/test-airstrike-observation-bridge.py')
t=importlib.util.module_from_spec(spec);spec.loader.exec_module(t)
import os
os.environ['AIRSTRIKE_BRIDGE_FIXTURES']=str(H)
request=t.bridge.Bridge.request
counts={'png':0,'rejectedPNG':0}
def guarded(self,action,deadline=None,**values):
 if action=='png':
  if counts['png']==8:
   counts['rejectedPNG']+=1
   raise t.bridge.Stop('task eight-capture ceiling: ninth PNG refused before dispatch')
  counts['png']+=1
 return request(self,action,deadline,**values)
t.bridge.Bridge.request=guarded
obj,result,inputs=t.Integration().exercise('exact-production-eight-cap',seconds=10)
assert result['status']=='refused' and 'ninth PNG' in result['reason'],result
assert counts=={'png':8,'rejectedPNG':1},counts
assert [x['cmd'] for x in inputs]==['keydown:27','keyup:27']+['keydown:40','keyup:40']*3,inputs
assert not any(x['cmd']=='keydown:13' for x in inputs)
q=dict(status='BLOCKED_CAPTURE_CONTRACT',fixtureOnly=True,actualGuestStarted=False,
 sourcePins=pins,runtimeMapSHA256=hashlib.sha256(P.read_bytes()).hexdigest(),
 result=result,counts=counts,inputs=inputs,evidence=str(obj.root),
 requiredReviewStates=['gameplay']+['menu-row-'+str(i) for i in range(7)],
 captureCallsPerState=2,requiredPNG=16,allowedPNG=8,
 reason='Exact accepted bridge observation() captures once; send(keydown) captures again to revalidate pixels and focus. Required gameplay/Esc plus all seven rows requires16 captures. Ninth capture rejected after row2 Down release before row3 review.',
 remaining='Actual ordinary menu Quit, guest Exit0, clean runner exit, actual focus/menu/Quit frames remain UNQUALIFIED. Coordinator must reconcile capture allowance with unchanged accepted bridge before a new guest assignment.',
 inheritedLimits={str(k):resource.getrlimit(k) for k in (resource.RLIMIT_AS,resource.RLIMIT_DATA,resource.RLIMIT_CPU,resource.RLIMIT_FSIZE)})
(H/'boundary-result.json').write_text(json.dumps(q,indent=2)+'\n')
print(json.dumps(q))
