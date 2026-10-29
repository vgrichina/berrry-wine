from ops import *
r=json.loads((E/'runtime-result.json').read_text())
br=r['report']['backendReceipt']
owned={tuple(x) for x in br['owned']}
causal=[]
for sample in r['samples']:
 rows=[x for x in sample['rows'] if (x['pid'],x['start']) in owned]
 for parent in rows:
  if not parent['cmd'].startswith('/usr/bin/python3 -B -c import subprocess, sys\n'):continue
  for child in rows:
   if child['ppid']!=parent['pid'] or not child['cmd'].startswith('/usr/bin/python3 -B -c import time; allocation = bytearray'):continue
   if parent['state']=='S' and parent['rss']<24*1048576 and child['rss']>48*1048576 and parent['rss']+child['rss']>67108864:
    causal.append(dict(time=sample['t'],parent=parent,child=child,pairRSS=parent['rss']+child['rss']))
checks=dict(cliExit=r['cliExit']==1,rejected=r['report']['accepted'] is False,reason=br['stopReason']=='aggregate RSS limit',observedChildContribution=bool(causal),peak=br['peakRSS']>67108864,cpu=br['cpuSeconds']<4,wall=br['wallSeconds']<8,noExternalCleanup=r['safetyCleanup'] is None,treeCleanup=br['cleanupComplete'] is True and r['report']['cleanupComplete'] is True,observedIdentitiesReaped=all(x['absentOrReused'] for x in r['observedIdentities']),disconnected=not r['remainingMounts'] and not br['filesystemCleanup']['remainingMounts'] and br['filesystemCleanup']['unmountExit']==0 and br['filesystem']['openHandles']==0,allowance=r['report']['browserAllowanceRemaining']==dict(captures=1,cpuSeconds=35.353183,wallSeconds=101.495550694))
life=json.loads((E/'lifecycle-final.json').read_text());assert life['actualStopped']
record('canonical-receipt',dict(task=r['task'],candidate=r['candidate'],sourcePins=r['pins'],PASS=all(checks.values()),checks=checks,cliExit=r['cliExit'],stopReason=br['stopReason'],peakRSS=br['peakRSS'],cpuSeconds=br['cpuSeconds'],wallSeconds=br['wallSeconds'],causalSamples=causal,observedIdentities=r['observedIdentities'],browserAllowanceRemaining=r['report']['browserAllowanceRemaining'],runtimeSHA256=hashlib.sha256((E/'runtime-result.json').read_bytes()).hexdigest(),originalObserverVerdict=r['gatePASS'],observerLimitation='Substring classifier included CLI/confine embedded argv; offline assessment joins authoritative owned PID/start identities and exact executable command prefixes. Original evidence retained; one invocation only.',scope='Bounded ordinary waiting-parent/single-child RSS aggregation only; arbitrary escaped-descendant completeness, full-resource/browser/gameplay remain UNKNOWN.',lifecycle=life,expiry='2026-10-29T04:50:42.899Z',cutoffUTC='2026-10-29T04:50:00Z'))
print(json.dumps(dict(PASS=all(checks.values()),checks=checks,causalSamples=len(causal))))
