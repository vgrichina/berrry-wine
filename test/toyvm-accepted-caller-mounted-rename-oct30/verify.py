"""Verify retained mounted receipts only. Does not execute production or remount."""
import base64,hashlib,json,pathlib
HERE=pathlib.Path(__file__).resolve().parent
REPO=HERE.parents[1]
def pin(p):
 b=p.read_bytes();return dict(bytes=len(b),sha256=hashlib.sha256(b).hexdigest())
m=json.loads((HERE/'manifest.json').read_text())
for rel,want in m['sourcePins'].items():assert pin(REPO/rel)==want,rel
assert pin(HERE/'fixture.py')==m['fixturePin']
g=json.loads((HERE/'guards.json').read_text());r=g['report'];b=r['backendReceipt']
assert g['exit']==0 and not g['stderr'] and r['accepted'] and r['childSucceeded']
assert r['accountingAccepted'] and r['cleanupComplete'] and not r['browserAllowed']
assert g['identitiesAfter'] and g['mountOwnership']
assert g['observerCleanup']==dict(remainingMounts=[],workPathProcesses=[])
assert all(b['filesystem'][k]==v for k,v in dict(live=32768,peak=32768,written=26,inodes=6,openHandles=0,failure=None).items())
assert b['cleanupComplete'] and b['stopReason'] is None and b['exit']==0
assert b['filesystemCleanup']['remainingMounts']==[] and b['filesystemCleanup']['unmountExit']==0
assert b['filesystemCleanup']['serverExit'] in [0,-15]
out=base64.b64decode(b['output']['data']).decode()
rows=[json.loads(s) for s in out.splitlines() if s.startswith('{')]
initial=rows[0];cases=rows[1:]
assert initial['event']=='initial' and len(initial['tree'])==6
assert [x['name'] for x in cases]==['file-to-dir','dir-to-file','absent-parent','nondirectory-parent','descendant-cycle','same-path']
assert [x['actual'] for x in cases]==[21,20,2,20,22,0]
assert all(x['actual']==x['expected'] and x['unchanged'] for x in cases)
assert len({x['treeSHA256'] for x in cases})==1
assert cases[0]['treeSHA256']==hashlib.sha256(json.dumps(initial['tree']).encode()).hexdigest()
assert out.endswith('MOUNTED_RENAME_GUARDS_COMPLETED\n')
assert b['peakRSS']<=64*1048576 and b['cpuSeconds']<=10 and b['wallSeconds']<=20
assert g['groupPeakRSS']<=512*1048576 and len(out.encode())<=8192
p=json.loads((HERE/'preflight.json').read_text());assert p['PASS'] and p['landlockABI']>=3 and p['MemAvailable']>=2*1024**3
assert p['fuseOpened'] and p['libfuse'] and p['procFDseccomp'] and p['socketBytes']<108
life=json.loads((HERE/'lifecycle.json').read_text())['sandbox']
assert life['id']=='bx_w5kuxjed' and life['state']=='stopped' and life['snapshotAvailable']
assert life['lastSnapshotStatus']=='completed' and life['stop']['status']=='completed'
print('PASS: six mounted syscall cases, final accounting, pinned sources, cleanup, and completed snapshot-stop; callback coverage unobserved')
