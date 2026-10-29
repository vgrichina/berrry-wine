from ops import *
import ast
admission('preflight')
d=json.loads(pathlib.Path('/home/user/wine-assembly/scratch/usage-watch/toyvm-directory-remove-metadata-reuse-oct29-dispatch.json').read_text())
record('dispatch',d)
checks={}
for rel,pin in d['sourcePins'].items():
 b=(REPO/rel).read_bytes();assert len(b)==pin['bytes'] and hashlib.sha256(b).hexdigest()==pin['sha256'];checks[rel]=pin
for key,pin in [('runtimeFixture','runtimeFixturePin'),('runtimeObserver','runtimeObserverPin'),('sourcePhaseOracle','sourcePhaseOraclePin'),('limitModule','limitModulePin'),('originalCancellationReceipt','originalCancellationReceiptPin')]:
 b=pathlib.Path(d[key]).read_bytes();assert len(b)==d[pin]['bytes'] and hashlib.sha256(b).hexdigest()==d[pin]['sha256']
for opt,want in [('--show-toplevel',str(REPO)),('--absolute-git-dir',str(REPO/'.git')),('HEAD',d['candidate']),('--abbrev-ref','HEAD')]:
 args=['rev-parse',opt]+([want] if opt=='--abbrev-ref' else [])
 rc,out,err=git(args,name='identity-'+opt.replace('/','_'))
 assert rc==0
 if opt=='--abbrev-ref':assert out.strip()=='task/'+d['task']
 else:assert out.strip()==want
oracle=json.loads((OWN/'source-phase-oracle.json').read_text())
assert oracle['phases']==[{'phase':p,'live':v} for p,v in [('root',4096),('D',8192),('D/E',12288),('rmdir-E',8192),('D/F',12288)]]
assert oracle['postReap']==dict(live=12288,peak=12288,written=0,inodes=3,openHandles=0)
backend=(REPO/'test/toyvm-kernel-profile-accounting-backend-oct28/fuse_backend.py').read_text()
fixture=(OWN/'fixture.py').read_text();observer=(OWN/'runtime-observer.py').read_text()
def source_gate(b,f,o,pins=True):
 return (pins and "if op in (10,11):" in b and "del n['names'][name];self.nodes[child]['links']-=1;self.collect(child)" in b and "if not n['links'] and not n['opens']:" in b and "self.live-=4096+" in b and "stat.S_ISDIR(os.stat('/tmp/tvdr/w/domain/D/E').st_mode)" in f and "except FileNotFoundError:pass" in f and "stat.S_ISDIR(os.stat('/tmp/tvdr/w/domain/D/F').st_mode)" in f and "br.get('cleanupComplete') is True" in o and "all(x['absentOrReused'] for x in identities)" in o)
assert source_gate(backend,fixture,observer)
controls={
 'missingCollect':not source_gate(backend.replace(';self.collect(child)',''),fixture,observer),
 'noRefund':not source_gate(backend.replace('self.live-=4096+','self.live+=4096+'),fixture,observer),
 'wrongDirectoryProof':not source_gate(backend,fixture.replace('stat.S_ISDIR','stat.S_ISREG'),observer),
 'pinMismatch':not source_gate(backend,fixture,observer,False),
 'cleanupMissing':not source_gate(backend,fixture,observer.replace("br.get('cleanupComplete') is True",'True'))}
assert all(controls.values())
sock=os.fsencode(d['remoteSocket']);assert len(sock)==23 and len(sock)<108 and b'\0' not in sock
record('source-phase-independent',dict(PASS=True,oracle=oracle,controls=controls,scope='static source/fixture/observer contract checks; no backend replay or mocked runtime acceptance',pins=checks,socketBytes=len(sock)))
old=json.loads(pathlib.Path('/home/user/wine-assembly/scratch/usage-watch/toyvm-real-cli-descendant-timeout-qualification-oct29/retained-evidence/launch-configuration.json').read_text())
assert old['sourcePins']==d['sourcePins'] and old['mountArgv']==[] and old['intendedMountFiles']==[] and old['gitSSH']==SSH
record('launch-configuration',dict(reusedReceipt='toyvm-real-cli-descendant-timeout-qualification-oct29/retained-evidence/launch-configuration.json',receiptSHA256=hashlib.sha256(json.dumps(old,sort_keys=True).encode()).hexdigest(),mountArgv=[],intendedMountFiles=[],canonicalGuestParser='not applicable: unchanged empty guest mount argv; Boat file staging separately enumerated',gitSSH=SSH))
print(json.dumps(dict(PASS=True,controls=controls,pins=len(checks),socketBytes=len(sock))))
