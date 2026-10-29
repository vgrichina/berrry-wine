import os,json,pathlib,hashlib,resource
ROOT=pathlib.Path(__file__).parent.resolve();REPO=ROOT/'repo';E=ROOT/'e';E.mkdir(exist_ok=True)
def admission():
 st=os.statvfs(ROOT);mem=int(next(x.split()[1] for x in pathlib.Path('/proc/meminfo').read_text().splitlines() if x.startswith('MemAvailable:')))*1024
 allocated=sum(x.stat().st_blocks*512 for x in ROOT.rglob('*') if x.is_file())
 assert allocated<24*1048576 and st.f_bavail*st.f_frsize>=3200253952+24*1048576 and mem>=2147483648
 assert resource.getrlimit(resource.RLIMIT_DATA)==(128*1048576,128*1048576)
 return dict(freeBytes=st.f_bavail*st.f_frsize,MemAvailable=mem,allocated=allocated,childDATA=list(resource.getrlimit(resource.RLIMIT_DATA)),noSupervisorInitialization=True)
import ast,copy
D=json.loads(pathlib.Path('/home/user/wine-assembly/scratch/usage-watch/toyvm-nonempty-rmdir-runtime-oct29-dispatch.json').read_text())
def checked(p,want):
 b=pathlib.Path(p).read_bytes();assert len(b)==want['bytes'] and hashlib.sha256(b).hexdigest()==want['sha256']
for k,v in D['sourcePins'].items():checked(REPO/k,v)
for k in ['runtimeFixture','runtimeObserver','sourcePhaseOracle','originalCancellationReceipt','previousVerifiedReceipt','limitModule']:checked(D[k],D[k+'Pin'])
assert D['remoteSocket']==D['remoteWork']+'/status.sock' and len(D['remoteSocket'].encode())==23 and '\0' not in D['remoteSocket']
s=(REPO/'test/toyvm-kernel-profile-accounting-backend-oct28/fuse_backend.py').read_text()
def sourcecheck(s):
 cl=next(x for x in ast.parse(s).body if isinstance(x,ast.ClassDef) and x.name=='Backend');h=next(x for x in cl.body if isinstance(x,ast.FunctionDef) and x.name=='handle')
 removal=next(x for x in h.body if isinstance(x,ast.If) and ast.unparse(x.test)=='op in (10, 11)');body=[ast.unparse(x) for x in removal.body]
 guard=next(i for i,x in enumerate(body) if 'op == 11' in x and 'ENOTEMPTY' in x)
 assert guard < next(i for i,x in enumerate(body) if x=="del n['names'][name]") < next(i for i,x in enumerate(body) if x=="self.nodes[child]['links'] -= 1") < next(i for i,x in enumerate(body) if x=='self.collect(child)')
 return True
assert sourcecheck(s)
controls={}
old="if op==11 and self.nodes[child]['names']:raise OSError(errno.ENOTEMPTY,'directory not empty')"
assert old in s
for name,mut in [('missing-nonempty-guard',s.replace(old,'pass')),('late-nonempty-guard',s.replace(old,'pass').replace("del n['names'][name]", "del n['names'][name];"+old))]:
 try:sourcecheck(mut)
 except (AssertionError,StopIteration,SyntaxError,ValueError):controls[name]='rejected source mutation'
 else:raise AssertionError(name+' accepted')
f=pathlib.Path(D['runtimeFixture']).read_text();compile(f,D['runtimeFixture'],'exec');assert "D='/tmp/tvne/w/domain/D';E=D+'/E'" in f and 'error.errno==errno.ENOTEMPTY' in f and 'current.st_ino==before[x]' in f
obs=pathlib.Path(D['runtimeObserver']).read_text();compile(obs,D['runtimeObserver'],'exec');main=next(x for x in ast.parse(obs).body if isinstance(x,ast.FunctionDef) and x.name=='main');gate=next(x.value for x in main.body if isinstance(x,ast.Assign) and any(isinstance(v,ast.Name) and v.id=='gate' for v in x.targets));expr=compile(ast.Expression(gate),'<gate>','eval')
baseline=dict(safety=None,rc=0,report={'accepted':True,'cleanupComplete':True},br={'stopReason':None,'cleanupComplete':True},fs=dict(failure=None,live=12288,peak=12288,written=0,inodes=3,openHandles=0),payload=json.dumps(dict(checkpoint='nonempty-rmdir-preserved',errno=39,childPreserved=True,directoryInodes={'D':2,'E':3})),mounts=[],identities=[dict(absentOrReused=True)],identityCheck=True,sourceAfter={k:v['sha256'] for k,v in D['sourcePins'].items()},pins=D['sourcePins'])
assert eval(expr,dict(baseline,json=json))
for name in ['wrong-errno','wrong-counter','cleanup-failed','stale-identity','missing-marker']:
 b=copy.deepcopy(baseline)
 if name=='wrong-errno':b['payload']=b['payload'].replace('39','2')
 if name=='wrong-counter':b['fs']['live']=8192
 if name=='cleanup-failed':b['br']['cleanupComplete']=False
 if name=='stale-identity':b['identities'][0]['absentOrReused']=False
 if name=='missing-marker':b['payload']='{}'
 assert not eval(expr,dict(b,json=json));controls[name]='rejected offline exact-gate control'
rec=dict(PASS=True,noRuntime=True,sourceOrdering=True,fixtureCompiled=True,controls=controls,admission=admission(),scope='Source/fixture and offline boolean gate preflight only; not runtime acceptance')
(E/'source-phase-validation.json').write_text(json.dumps(rec,indent=2));print(json.dumps(dict(PASS=True,controls=controls)))
