"""Check retained runtime evidence only; never run the fixture or production CLI."""
import ast,hashlib,json,pathlib
HERE=pathlib.Path(__file__).resolve().parent
REPO=HERE.parents[1]
pins=json.loads((HERE/'source-pins.json').read_text())
for rel,pin in pins.items():
    raw=(REPO/rel).read_bytes()
    assert len(raw)==pin['bytes'] and hashlib.sha256(raw).hexdigest()==pin['sha256']
fixture=(HERE/'fixture.py').read_bytes()
assert len(fixture)==170 and hashlib.sha256(fixture).hexdigest()=='3c0ac10c80895e992ffe25afed67da2c60f16db97ea946633bef8c7386fb601a'
ast.parse(fixture); ast.parse((HERE/'observer.py').read_text())
case=json.loads((HERE/'case1.json').read_text())
argv=case['argv']; pos=argv.index('-c')
assert argv[pos+1].encode()==fixture
assert argv[pos+2:]==['/tmp/tvic/work/domain/f1024','1024']
assert case['exit']==1 and not case['pass'] and not case['marker']
report=case['report']; backend=report['backendReceipt']; fs=backend['filesystem']
assert report['accepted'] is False and report['cleanupComplete'] is True
assert fs['failure']=='filesystem allocation limit' and fs['written']==0
assert fs['live']==fs['peak']==8192 and fs['openHandles']==0
assert backend['filesystemCleanup']['remainingMounts']==[]
assert backend['filesystemCleanup']['unmountExit']==0
assert case['remainingMounts']==[] and case['remainingOwnedProcesses']==[]
life=json.loads((HERE/'lifecycle.json').read_text())
assert life['state']=='stopped' and life['snapshotAvailable'] is True
assert life['snapshotVerifiedAt'] and life['stopStatus']=='completed'
print(json.dumps(dict(PASS=True,scope='retained evidence consistency only',productionSources=5,case1='observed counterexample',case2='not run',snapshotStop='verified')))
