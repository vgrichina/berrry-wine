"""Validate retained actual CLI/native READDIR records without running production again."""
import base64, hashlib, json, pathlib
D=pathlib.Path(__file__).resolve().parent
P=D.parents[1]
def load(n): return json.loads((D/n).read_text())
def pin(p):
 b=p.read_bytes();return dict(bytes=len(b),sha256=hashlib.sha256(b).hexdigest())
manifest=load('manifest.json');contract=load('contract.json');run=load('guards.json')
for name,want in manifest['sourcePins'].items(): assert pin(P/name)==want,name
assert pin(D/'fixture.py')==manifest['fixturePin']==run['fixturePin']
assert run['identitiesAfter'] is True and run['exit']==0 and not run['stderr']
assert run['observerCleanup']==dict(remainingMounts=[],workPathProcesses=[])
assert any(' /tmp/tvmd/domain ' in s and 'fuse.toyvm-accounting' in s for s in run['mountOwnership'])
argv=run['argv']
assert argv[:2]==['/usr/bin/python3','-B']
assert argv[2].endswith('/toyvm-bounded24-caller-wiring-oct28/qualify_accounted.py')
expected={'--domain':'tiny-fixture','--work':'/tmp/tvmd','--live-limit':'262144','--write-limit':'32768','--file-limit':'32768','--rss-limit':'67108864','--cpu-limit':'10','--wall-limit':'20','--output-limit':'8192'}
for flag,value in expected.items(): assert argv[argv.index(flag)+1]==value
assert argv[-4:-1]==['/usr/bin/python3','-B','-c']
assert argv[-1]==(D/'fixture.py').read_text()
report=run['report']; b=report['backendReceipt']
assert report['accepted'] and report['childSucceeded'] and report['accountingAccepted'] and report['cleanupComplete']
assert report['browserAllowed'] is False and not report['failures']
assert b['exit']==0 and b['stopReason'] is None and b['cleanupComplete']
assert b['filesystemCleanup']['remainingMounts']==[] and b['filesystemCleanup']['unmountExit']==0 and b['filesystemCleanup']['serverExit'] in (0,-15)
fs=b['filesystem']
for k,v in dict(live=36864,peak=36864,written=23,inodes=7,openHandles=0,failure=None).items(): assert fs[k]==v
for k,v in dict(cpuSeconds=10,wallSeconds=20,peakRSS=67108864).items(): assert 0<=b[k]<=v
assert 0<=run['groupPeakRSS']<=512*1048576
output=base64.b64decode(b['output']['data'],validate=True);assert len(output)<=8192
events=[json.loads(s) for s in output.splitlines()]
assert len(events)==11
expectedEntries=[
 {'.':1,'..':1,'a':2,'b':3},{'.':2,'..':1,'moved':4},{'.':3,'..':1},
 {'.':4,'..':2,'deep':5,'data':6},{'.':5,'..':4,'leaf':7},
 {'.':1,'..':1,'a':2,'b':3},{'.':2,'..':1},{'.':3,'..':1,'moved':4},
 {'.':4,'..':3,'deep':5,'data':6},{'.':5,'..':4,'leaf':7}]
expectedPaths=['','/a','/b','/a/moved','/a/moved/deep','','/a','/b','/b/moved','/b/moved/deep']
for e,want,path in zip(events[:10],expectedEntries,expectedPaths):
 assert e['actual']==want and e['expected']==want and e['path']=='/tmp/tvmd/domain'+path
assert events[-1]['PASS'] is True and events[-1]['backendCallbackCounters'] is False
assert events[-1]['finalTree']=={'/':1,'a':2,'b':3,'b/moved':4,'b/moved/deep':5,'b/moved/data':6,'b/moved/deep/leaf':7}
assert events[-1]['payloadHex']=={'data':b'readdir-data\n'.hex(),'deep/leaf':b'leaf-data\n'.hex()}
control=load('fixture-control.json')
assert control==dict(fixtureControl=True,productionMutant=False,mountedCallback=False,rejectedFor='READDIR entry inode invariant')
native=load('native-layout.json')
assert native['pythonPin']==run['pythonPin'] and load('preflight.json')['PASS']
assert load('preflight.json')['MemAvailable']>=2*1024**3+512*1048576
assert contract['socketBytes']==len(b'/tmp/tvmd/status.sock')==21
state=load('lifecycle.json')['sandbox'];stop=load('stop-completion.json')['stop']
assert state['id']=='bx_eg52q6x8' and state['state']=='stopped'
assert state['lastSnapshotStatus']=='completed' and state['snapshotAvailable'] and state['snapshotVerifiedAt'] and state['snapshotCompletedAt']
assert stop['status']=='completed' and stop['error'] is None and stop['forced'] is False
assert state['stop']['id']==stop['id']
print(json.dumps(dict(PASS=True,nativeREADDIRCases=10,movedInode=4,oldParent=2,newParent=3,livePeak=36864,written=23,sourceFiles=5,boat=state['id'],state=state['state'],snapshotVerifiedAt=state['snapshotVerifiedAt'],snapshotCaveat='API snapshot timestamp predates mounted run; no post-run snapshot-content claim',browserAccepted=False)))
