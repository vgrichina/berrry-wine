"""Validate retained evidence and source structure; never launch production."""
import ast,copy,hashlib,json,pathlib
HERE=pathlib.Path(__file__).resolve().parent
REPO=HERE.parents[1]
def read(n):return json.loads((HERE/n).read_text())
d=read('dispatch.json');r=read('runtime-raw.json');oracle=read('source-phase-oracle.json')
for rel,pin in d['sourcePins'].items():
 b=(REPO/rel).read_bytes();assert len(b)==pin['bytes'] and hashlib.sha256(b).hexdigest()==pin['sha256']
for name,key in [('fixture.py','runtimeFixture'),('runtime-observer.py','runtimeObserver'),('source-phase-oracle.json','sourcePhaseOracle')]:
 b=(HERE/name).read_bytes();assert len(b)==d[key+'Pin']['bytes'] and hashlib.sha256(b).hexdigest()==d[key+'Pin']['sha256']
backend=ast.parse((REPO/'test/toyvm-kernel-profile-accounting-backend-oct28/fuse_backend.py').read_text());cls=next(x for x in backend.body if isinstance(x,ast.ClassDef))
def method(name):return next(x for x in cls.body if isinstance(x,ast.FunctionDef) and x.name==name)
create=ast.unparse(method('create'))
def ordered(s):return s.index('self.charge(4096)')<s.index('self.nodes[ino] =')<s.index("n['names'][name] = ino")
assert ordered(create)
mutation=create.replace('self.charge(4096)','pass',1).replace("n['names'][name] = ino","n['names'][name] = ino\n    self.charge(4096)")
assert not ordered(mutation)
quotaIf=next(x for x in method('__init__').body if isinstance(x,ast.If) and 'tiny fixture backend limits required' in ast.unparse(x))
predicate=compile(ast.Expression(quotaIf.test),'<production-budget-predicate>','eval')
assert eval(predicate,{},dict(live_limit=0,write_limit=65536,file_limit=8192))
assert not eval(predicate,{},dict(live_limit=12288,write_limit=65536,file_limit=8192))
assert [p['live'] for p in oracle['phases']]==[4096*i for i in range(1,5)]
assert all(p['written']==0 for p in oracle['phases'])
observer=ast.parse((HERE/'runtime-observer.py').read_text())
gate=next(x.value for x in ast.walk(observer) if isinstance(x,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='gate' for t in x.targets))
expr=compile(ast.Expression(gate),'<immutable-observer-gate>','eval')
def passes(v):
 br=v['report']['backendReceipt'];owned={(x['pid'],x['start']) for x in v['observedIdentities']}
 env=dict(safety=v['safetyCleanup'],rc=v['cliExit'],report=v['report'],br=br,fs=br['filesystem'],payload=v['fixtureOutput'],mounts=v['remainingMounts'],identities=v['observedIdentities'],identityCheck=bool(br.get('owned') and {tuple(x) for x in br['owned']}<=owned),sourceAfter=v['sourceAfter'],pins=d['sourcePins'])
 return eval(expr,env,env)
assert r['productionInvocations']==1 and passes(r)
for field in ['missing-marker','wrong-gate','forged-accepted','inserted-inode','missing-identity','safety-cleanup']:
 bad=copy.deepcopy(r)
 if field=='missing-marker':bad['fixtureOutput']=''
 if field=='wrong-gate':bad['report']['backendReceipt']['stopReason']='filesystem per-file limit'
 if field=='forged-accepted':bad['report']['accepted']=True
 if field=='inserted-inode':bad['report']['backendReceipt']['filesystem']['inodes']=4
 if field=='missing-identity':bad['observedIdentities']=[]
 if field=='safety-cleanup':bad['safetyCleanup']='external 8-second guard'
 assert not passes(bad),field
life=read('lifecycle.json');assert life['state']=='stopped' and life['snapshotAvailable'] and life['stop']['status']=='completed' and life['snapshotVerifiedAt']
assert read('runtime-canonical.json')['postReap']==oracle['postReap']
print(json.dumps(dict(PASS=True,productionInvocations=0,scope='retained actual runtime and source/control predicates; modified reports only negative gate controls')))
