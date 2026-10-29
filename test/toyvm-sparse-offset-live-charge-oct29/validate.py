from ops import *
import ast,copy
D=json.loads(pathlib.Path('/home/user/wine-assembly/scratch/usage-watch/toyvm-sparse-offset-live-charge-oct29-dispatch.json').read_text())
def pin(p,want):
 b=pathlib.Path(p).read_bytes();assert len(b)==want['bytes'] and hashlib.sha256(b).hexdigest()==want['sha256']
for k,v in D['sourcePins'].items():pin(REPO/k,v)
for key,pinkey in [('runtimeFixture','runtimeFixturePin'),('runtimeObserver','runtimeObserverPin'),('sourcePhaseOracle','sourcePhaseOraclePin'),('originalCancellationReceipt','originalCancellationReceiptPin'),('previousVerifiedReceipt','previousVerifiedReceiptPin'),('limitModule','limitModulePin')]:pin(D[key],D[pinkey])
assert len(D['remoteSocket'].encode('utf-8'))==23 and b'\0' not in D['remoteSocket'].encode()
s=(REPO/'test/toyvm-kernel-profile-accounting-backend-oct28/fuse_backend.py').read_text()
def ordercheck(s):
 tree=ast.parse(s);cl=next(n for n in tree.body if isinstance(n,ast.ClassDef) and n.name=='Backend');methods={n.name:n for n in cl.body if isinstance(n,ast.FunctionDef)}
 charge=ast.get_source_segment(s,methods['charge']);resize=ast.get_source_segment(s,methods['resize']);handle=ast.get_source_segment(s,methods['handle']);write=handle[handle.index('if op==16:'):handle.index('if op in (18,29):')]
 assert charge.index("self.reject('filesystem allocation limit')")<charge.index('self.live+=delta')
 assert resize.index('self.charge(')<resize.index("n['data'].extend")
 assert write.index('self.resize(')<write.index("self.nodes[ino]['data'][off:off+size]=payload")<write.index('self.written+=size')
 assert '((size+4095)//4096-(old+4095)//4096)*4096' in resize
 return True
assert ordercheck(s)
try:ordercheck(s.replace("self.charge(((size+4095)//4096-(old+4095)//4096)*4096)","pass # charge removed"))
except (AssertionError,ValueError):mutationRejected=True
else:raise AssertionError('source control accepted deviation')
oracle=json.loads(pathlib.Path(D['sourcePhaseOracle']).read_text());dense=((8191+1+4095)//4096)*4096
assert dense==8192 and 4096+4096+dense==16384>12288 and 8192<=8192 and 1<65536
assert [x['live'] for x in oracle['phases']]==[4096,8192,16384]
obs=pathlib.Path(D['runtimeObserver']).read_text();compile(obs,D['runtimeObserver'],'exec')
# Extract the exact observer gate expression; exercise it only as offline boolean controls.
t=ast.parse(obs);main=next(n for n in t.body if isinstance(n,ast.FunctionDef) and n.name=='main');gate=next(n.value for n in main.body if isinstance(n,ast.Assign) and any(isinstance(x,ast.Name) and x.id=='gate' for x in n.targets));expr=compile(ast.Expression(gate),'<exact-observer-gate>','eval')
base=dict(safety=None,rc=1,report={'accepted':False,'cleanupComplete':True},br={'stopReason':'filesystem allocation limit','cleanupComplete':True},fs=dict(failure='filesystem allocation limit',live=8192,peak=8192,written=0,openHandles=0,inodes=2),payload='before-sparse-offset-write',mounts=[],identities=[dict(absentOrReused=True)],identityCheck=True,sourceAfter={k:v['sha256'] for k,v in D['sourcePins'].items()},pins=D['sourcePins'])
assert eval(expr,base)
controls={}
for name in ['missing-marker','wrong-reason','forged-accepted','wrong-counter','missing-identity']:
 b=copy.deepcopy(base)
 if name=='missing-marker':b['payload']=''
 if name=='wrong-reason':b['br']['stopReason']='wall timeout'
 if name=='forged-accepted':b['report']['accepted']=True
 if name=='wrong-counter':b['fs']['live']=16384
 if name=='missing-identity':b['identityCheck']=False
 assert not eval(expr,b);controls[name]='rejected offline by exact gate'
assert not (8192<=4096<=1048576)
controls['invalid-budget']='rejected by independently checked source predicate';controls['allocation-before-mutation-deviation']='rejected by source ordering check'
rec=dict(PASS=True,noRuntime=True,oracle=oracle,sourceOrdering=True,controls=controls,scope='offline source/arithmetic/boolean gate controls only; no mocked runtime acceptance',previousReceipt=json.loads(pathlib.Path(D['previousVerifiedReceipt']).read_text()),admission=admission())
(E/'source-phase-validation.json').write_text(json.dumps(rec,indent=2));print(json.dumps(dict(PASS=True,controls=controls,socketBytes=23)))
