import os,json,pathlib,hashlib,resource
ROOT=pathlib.Path(__file__).parent.resolve();REPO=ROOT/'repo';E=ROOT/'e';E.mkdir(exist_ok=True)
def admission():
 st=os.statvfs(ROOT);mem=int(next(x.split()[1] for x in pathlib.Path('/proc/meminfo').read_text().splitlines() if x.startswith('MemAvailable:')))*1024
 allocated=sum(x.stat().st_blocks*512 for x in ROOT.rglob('*') if x.is_file())
 assert allocated<24*1048576 and st.f_bavail*st.f_frsize>=3200253952+24*1048576 and mem>=2147483648
 assert resource.getrlimit(resource.RLIMIT_DATA)==(128*1048576,128*1048576)
 return dict(freeBytes=st.f_bavail*st.f_frsize,MemAvailable=mem,allocated=allocated,childDATA=list(resource.getrlimit(resource.RLIMIT_DATA)),noSupervisorInitialization=True)
import ast,copy
D=json.loads(pathlib.Path('/home/user/wine-assembly/scratch/usage-watch/toyvm-rename-samepath-runtime-oct29-dispatch.json').read_text())
def checked(p,want):
 b=pathlib.Path(p).read_bytes();assert len(b)==want['bytes'] and hashlib.sha256(b).hexdigest()==want['sha256']
for k,v in D['sourcePins'].items():checked(REPO/k,v)
for k in ['runtimeFixture','runtimeObserver','sourcePhaseOracle','originalCancellationReceipt','previousVerifiedReceipt','limitModule']:checked(D[k],D[k+'Pin'])
assert D['remoteSocket']==D['remoteWork']+'/status.sock' and len(D['remoteSocket'].encode())==23 and '\0' not in D['remoteSocket']
s=(REPO/'test/toyvm-kernel-profile-accounting-backend-oct28/fuse_backend.py').read_text()
def sourcecheck(s):
 cl=next(x for x in ast.parse(s).body if isinstance(x,ast.ClassDef) and x.name=='Backend');h=next(x for x in cl.body if isinstance(x,ast.FunctionDef) and x.name=='handle')
 branch=next(x for x in h.body if isinstance(x,ast.If) and ast.unparse(x.test)=='op in (12, 45)');body=ast.unparse(branch)
 assert "if ino == newdir and old == new:\n        return b''" in body
 assert body.index('if ino == newdir and old == new:')<body.index('if new in dest:')<body.index("self.nodes[previous]['links'] -= 1")<body.index('dest[new] = source.pop(old)')
 assert body.index("if self.nodes[previous]['names']:")<body.index('raise OSError(errno.ENOTEMPTY,')<body.index("self.nodes[previous]['links'] -= 1")
 return True
assert sourcecheck(s)
controls={}
for name,old,new in [('missing-samepath-guard',"if ino==newdir and old==new:return b''",'pass'),('missing-nonempty-destination-guard',"if self.nodes[previous]['names']:raise OSError(errno.ENOTEMPTY,'replacement directory')",'pass')]:
 assert old in s
 try:sourcecheck(s.replace(old,new))
 except (AssertionError,StopIteration,SyntaxError,ValueError):controls[name]='rejected source mutation'
 else:raise AssertionError(name+' accepted')
f=pathlib.Path(D['runtimeFixture']).read_text();compile(f,D['runtimeFixture'],'exec');assert '/tmp/tvrs/w/domain/D' in f and 'current.st_ino==before[x]' in f
obs=pathlib.Path(D['runtimeObserver']).read_text();compile(obs,D['runtimeObserver'],'exec');main=next(x for x in ast.parse(obs).body if isinstance(x,ast.FunctionDef) and x.name=='main');gate=next(x.value for x in main.body if isinstance(x,ast.Assign) and any(isinstance(v,ast.Name) and v.id=='gate' for v in x.targets));expr=compile(ast.Expression(gate),'<gate>','eval')
baseline=dict(safety=None,rc=0,report={'accepted':True,'cleanupComplete':True},br={'stopReason':None,'cleanupComplete':True},fs=dict(failure=None,live=12288,peak=12288,written=0,inodes=3,openHandles=0),payload=json.dumps(dict(checkpoint='rename-samepath-preserved',errno=39,nodesPreserved=True,directoryInodes={'0': 2, '1': 3})),mounts=[],identities=[dict(absentOrReused=True)],identityCheck=True,sourceAfter={k:v['sha256'] for k,v in D['sourcePins'].items()},pins=D['sourcePins'])
assert eval(expr,dict(baseline,json=json))
for name in ['wrong-counter','cleanup-failed','stale-identity','missing-marker']:
 b=copy.deepcopy(baseline)
 if name=='wrong-errno':b['payload']=b['payload'].replace('39','2')
 if name=='wrong-counter':b['fs']['live']=8192
 if name=='cleanup-failed':b['br']['cleanupComplete']=False
 if name=='stale-identity':b['identities'][0]['absentOrReused']=False
 if name=='missing-marker':b['payload']='{}'
 assert not eval(expr,dict(b,json=json));controls[name]='rejected offline exact-gate control'
rec=dict(PASS=True,noRuntime=True,sourceOrdering=True,fixtureCompiled=True,controls=controls,admission=admission(),scope='Source/fixture and offline boolean gate preflight only; not runtime acceptance')
(E/'source-phase-validation.json').write_text(json.dumps(rec,indent=2));print(json.dumps(dict(PASS=True,controls=controls)))
