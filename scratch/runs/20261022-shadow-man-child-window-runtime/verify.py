"""Evidence-only verifier. Does not launch a guest, contact Boat, or fetch Git."""
import pathlib,json,hashlib,copy,sys
E=pathlib.Path(__file__).resolve().parent
def j(n):return json.loads((E/n).read_text())
def rows(n):return [json.loads(s) for s in (E/'raw'/n).read_text().splitlines()]
def verify(exit=None,installer=None,quota=None):
 exit=exit or j('exit.json');installer=installer or rows('child-54028.jsonl');pre=j('preflight.json');parent=rows('parent-54020.jsonl');helper=rows('child-54035.jsonl')
 assert exit['aggregateBoundPassed'] and exit['elapsedSeconds']<60 and exit['remainingLiveProcesses']==[]
 assert exit['reason']=='first-child-show-window' and exit['firstExactFailure'] is None
 assert pre['quotaBytes']==(quota or 419430400)==exit['quotaBytes']
 assert pre['fixedAllocatedBytes']<=100663296 and pre['fixedAllocatedBytes']+pre['quotaBytes']+16777216<=536870912
 assert len(pre['seals'])==243 and exit['postSealCount']==243 and exit['pinsPreserved']
 assert sum(r['kind']=='fork' for r in parent)==2
 assert [r['eax'] for r in parent if r['kind']=='return' and r.get('name')=='WinExec']==[33,33]
 assert all(sum(r['kind']=='module-instance' for r in rr)==1 for rr in [parent,installer,helper])
 assert installer[0]['pid']==54028 and installer[0]['exe']['sha256']=='a8657371f03e2e66db951c3dcd3aeb42c576894908ca2eb1b3806aa0404cb083'
 assert all(r['moduleHash']=='f644bbb26edc077239dac17b8b2cfda482aafd9eb44af4c4776d4fe153d5a1a7' for r in parent if r['kind']=='fork')
 assert any(r['kind']=='return' and r.get('name')=='CreateWindowExA' and r['eax']==65537 and r['entry']['title']=='Setup' for r in installer)
 assert any(r['kind']=='return' and r.get('name')=='ShowWindow' and r['entry']['args'][:2]==[65544,5] for r in installer)
 assert installer[-1]==dict(tag='child',pid=54028,kind='node-exit',code=1)
 assert helper[-1]==dict(tag='child',pid=54035,kind='node-exit',code=0)
 assert any(r['kind']=='entry' and r.get('name')=='ExitProcess' and r['args'][0]==0 for r in helper)
 assert not any(r.get('name')=='ExitProcess' for r in installer)
 for r in j('runtime-inventory.json')['files']:
  p=E/'raw'/r['path']
  if '/' in r['path']:continue
  assert p.stat().st_size==r['size'] and hashlib.sha256(p.read_bytes()).hexdigest()==r['sha256'],r['path']
 assert hashlib.sha256((E/'observer.cjs').read_bytes()).hexdigest()==j('observer-hashes.json')['current']
 log=(E/'raw/output.log').read_text();assert 'ENOSPC' not in log and 'Authority deadline' not in log
 assert 'authorized first-boundary stop: first-child-show-window' in log
 hand=j('handback.json');assert hand['allFileHashesEqual'] and not hand['remainingLiveProcesses'] and hand['pinCount']==243
 assert hand['recoveryAfterAllocated']<2147483648 and hand['hostFreeBytes']>2982150144
 assert j('preservation.json')['allFileHashesEqual'] and j('protected-before.json')==j('protected-after.json')
 print('PASS: one attempt; 2 genuine forks/preloads/modules; installer window API boundary; sealed child PNG is visually blank; quota/process/preservation checks')
verify()
if '--self-test' in sys.argv:
 bad=copy.deepcopy(j('exit.json'));bad['elapsedSeconds']=61
 missing=[r for r in rows('child-54028.jsonl') if r['kind']!='module-instance']
 for kw in [dict(exit=bad),dict(installer=missing),dict(quota=150994944)]:
  try:verify(**kw)
  except AssertionError:pass
  else:raise AssertionError('negative control accepted')
 print('PASS: 3 reject controls (watchdog violation, missing child module, stale quota)')
