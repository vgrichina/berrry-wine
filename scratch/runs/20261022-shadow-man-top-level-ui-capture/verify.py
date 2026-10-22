"""Offline evidence verification only. No guest, network or rebuild."""
import pathlib,json,hashlib,subprocess
E=pathlib.Path(__file__).resolve().parent
def j(n):return json.loads((E/n).read_text())
def rows(n):return [json.loads(l) for l in (E/'raw'/n).read_text().splitlines()]
pre=j('preflight.json');exit=j('exit.json');hand=j('handback.json');stop=j('raw/stop-request.json')
assert len(pre['seals'])==243 and exit['postSealCount']==243 and hand['pinCount']==243
assert exit['aggregateBoundPassed'] and exit['elapsedSeconds']<60 and not exit['remainingLiveProcesses'] and not hand['remainingLiveProcesses']
assert pre['quotaBytes']==exit['quotaBytes']==419430400
assert pre['fixedAllocatedBytes']<=100663296 and pre['fixedAllocatedBytes']+419430400+16777216<=536870912
assert hand['recoveryAfterAllocated']<2147483648 and hand['hostFreeBytes']>2982150144
assert hand['allFileHashesEqual'] and j('preservation.json')['allHashesEqual'] and j('preservation.json')['noRecopy']
assert j('protected-before.json')==j('protected-after.json')
parent=rows('parent-61331.jsonl');installer=rows('child-61339.jsonl');helper=rows('child-61346.jsonl')
assert sum(r['kind']=='fork' for r in parent)==2
assert [r['eax'] for r in parent if r['kind']=='return' and r.get('name')=='WinExec']==[33,33]
assert all(sum(r['kind']=='module-instance' for r in rr)==1 for rr in [parent,installer,helper])
assert installer[0]['role']=='installer' and installer[0]['exe']['sha256']=='a8657371f03e2e66db951c3dcd3aeb42c576894908ca2eb1b3806aa0404cb083'
assert helper[0]['role']=='cleanup-helper'
assert stop['pid']==61339 and stop['reason']=='installer-top-level-painted-settled'
w=stop['record']['window'];assert w['hwnd']==65537 and w['ownerPid']==61339 and not w['style']&0x40000000 and w['style']&0x10000000 and w['actualParent']==0
assert w['paintedAt']>=w['shownAt'] and stop['record']['elapsedMs']>=400
assert any(r['kind']=='real-end-paint-return' and r['window']['hwnd']==65537 for r in installer)
assert any(r['kind']=='return' and r.get('name')=='ShowWindow' and r['entry']['args'][:2]==[65544,5] and r['eax']==0 for r in installer)
assert any(r['kind']=='window-visibility-return' and r['window']['hwnd']==65544 and r['window']['style']&0x40000000 for r in installer)
assert not any(r.get('name')=='ExitProcess' for r in installer)
assert any(r['kind']=='entry' and r.get('name')=='ExitProcess' and r['args'][0]==0 for r in helper)
assert installer[-1]['kind']=='node-exit' and installer[-1]['code']==1 and helper[-1]['code']==0
for r in j('runtime-inventory.json')['files']:
 p=E/'raw'/r['path'];assert p.stat().st_size==r['size'] and hashlib.sha256(p.read_bytes()).hexdigest()==r['sha256']
assert (E/'observer.cjs').read_bytes()==(E/'raw/observer.cjs').read_bytes()
assert hashlib.sha256((E/'observer.cjs').read_bytes()).hexdigest()==j('observer-hashes.json')['after']
png=j('raw/child-61339-summary.json')['screenshot'];assert hashlib.sha256((E/'raw'/png['name']).read_bytes()).hexdigest()==png['sha256']
log=(E/'raw/output.log').read_text();assert all(s not in log for s in ['ENOSPC','Authority deadline','RuntimeError','unreachable','failed:'])
assert 'authorized first-boundary stop: installer-top-level-painted-settled' in log
assert '[max-seconds] stopping after 55s' in log and stop['record']['elapsedMs']>50000
assert j('review.json')['visibleInstallerUI'] and not j('review.json')['promptSettlingStopProved']
box=j('box-final.json')['sandbox'];assert box['id']=='bx_495585da' and box['state']=='idle' and box['stop'] is None and box['health']=='ok'
cmd=j('raw/command.json');assert cmd['guestAttempts']==1 and cmd['aggregateBoundSeconds']==60
assert not any(a.startswith('--input=') for a in cmd['command'])
subprocess.run(['node',str(E/'fixture.cjs')],check=True)
print('PASS: genuine installer-owned top-level painted PNG, one bounded attempt, exact243 pins, preservation, ownership, and delayed-timer limitation verified')
