import pathlib,json,hashlib,struct,os
E=pathlib.Path(__file__).resolve().parent
j=lambda p:json.loads((E/p).read_text())
g=j('fixed/gate.json');x=j('fixed/launch-result.json');h=j('fixed/handback.json');log=(E/'raw/output.log').read_text();assert g['passAll'] and g['offlineGuestExecuted']==False
assert g['fixture']['boundPassed'] and not g['fixture']['remaining'] and g['fixture']['reapedDescendants']
assert j('fixed/fixture-enospc.json')['errno']==28 and 'missing copy budget' in g['missingCopyBudgetRejected']
assert j('fixed/forwarding-fixture.json')['assertions']==10
assert x['boundPassed'] and x['elapsedSeconds']<=90 and not x['remaining'] and x['pinsPreserved']==243
assert x['peakSampledMutable']<939524096 and g['allocation']['projectedMutable']<=939524096
assert 100663296+939524096+33554432==1073741824
assert 'ordinal import: DSETUP.DLL#11 via IAT 0x409024' in log and '*** CRASH at batch 6: unreachable' in log
assert '[Exit] code=0' in log and 'ENOSPC' not in log
parent=[json.loads(s) for s in (E/'raw/parent-37693.jsonl').read_text().splitlines()];child=[json.loads(s) for s in (E/'raw/child-37702.jsonl').read_text().splitlines()]
assert sum(r['kind']=='module-instance' for r in parent+child)==2
assert all(r['realTicks'] for r in parent+child if r['kind']=='module-instance')
assert any(r['kind']=='child-os-exit' and r['childPid']==37702 and r['code']==1 for r in parent)
assert not j('raw/child-37702-summary.json')['windows']
assert not any('input' in r['kind'] for r in child)
assert '[control] listening on http://127.0.0.1:45011/ctl' in log
p=E/'raw/child-37702.png';b=p.read_bytes();assert b[:8]==b'\x89PNG\r\n\x1a\n' and struct.unpack('>II',b[16:24])==(640,480) and len(b)==2061
assert h['originalSessionFilesPreserved']==2083 and h['recoveryUsed']<2147483648 and h['hostFree']>2982150144 and h['remaining']==[]
assert h['deletedPaths']==[] and h['originalBackupsUntouched']
for r in j('retrieval.json')['files']:
 p=E/r['path'];assert p.stat().st_size==r['size'] and hashlib.sha256(p.read_bytes()).hexdigest()==r['sha256']
protected=j('protected-before.json');after={p:hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest() for p in protected};assert protected==after
(E/'protected-after.json').write_text(json.dumps(after,indent=2))
W=E.parents[2];used=sum(p.stat().st_blocks*512 for p in [W,*W.rglob('*')]);assert used+8388608+8388608<=67108864
(E/'allocation-local.json').write_text(json.dumps(dict(wholeAllocated=used,reserve=8388608,publicationGrowthAllowance=8388608,totalProjected=used+16777216,cap=67108864,hostFree=os.statvfs(W).f_bavail*os.statvfs(W).f_frsize),indent=2))
print('PASS offline ENOSPC/reaping/admission/codec/10forwarding; one genuine config trap DSETUP11; no UI/input/gameplay;90s bound/cleanup/pins/allocation/retrieval/protected metadata verified')
