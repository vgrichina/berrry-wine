from transport import *
code='''import pathlib,json,hashlib,os,runpy,datetime
H=pathlib.Path('/tmp/enigma-reconciled-canonical-boat-build-oct26');O=H/'ops'
d=runpy.run_path(str(O/'remote-run.py'));d['gate']('closeout');inputs=d['verify']()
passes={n:json.load(open(O/(n+'-execution.json'))) for n in ['startup','generator','build','static-complete']}
assert all(x['exit']==0 and x['reason']=='natural' for x in passes.values())
summary=json.load(open(O/'static-summary.json'));assert summary['pass']
remaining=[]
for x in list(passes.values())+[json.load(open(O/'static-execution.json')),json.load(open(O/'static-corrected-execution.json'))]:
 pid=x['ownedProcessGroup']
 if pathlib.Path('/proc/'+str(pid)).exists():remaining.append(pid)
assert not remaining,remaining
ck=dict(candidate='425755ee5ee9be0734c7aca187521100f5487674',acceptedSource='facebcb2e6d04b84e80211a7814654e528566b0f',completed=['exact147source extraction','Node startup','normal generator --check','single canonical two-backend build','static-complete'],remaining=[],compiled=True,canonicalRuntimeQualified=False,instantiated=False,guest=False,gameplay='unknown',inputManifest=inputs,originalStaticFailures=[json.load(open(O/'static-execution.json')),json.load(open(O/'static-corrected-execution.json'))],remainingRuntimeGates=['exact changed-module initializer/thunk/decoded CALL-JMP/park-retry/async qualification','step ACK for all requested batches plus following frozen zero-credit snapshot before input'],box='bx_xw8d895f',state='RUNNING handback; lifecycle coordinator owned',expiry='2026-10-27T00:37:17.515Z',ownedGroupsAbsent=True)
d['save']('checkpoint.json',ck)
d['save']('closeout.json',dict(at=datetime.datetime.now(datetime.timezone.utc).isoformat(),allocatedBytes=d['allocated'](),allocation=1073741824,passes=passes,inputs=inputs,ownedRemaining=remaining,pythonVersion=__import__('sys').version,kernel=__import__('platform').uname()._asdict(),nodeVersion='24.22.1',snapshotRecoveryPath=str(H),coordinatorOwnsShutdown=True))
print(json.dumps(dict(completed=ck['completed'],ownedRemaining=remaining,allocatedBytes=d['allocated'](),box=ck['box'],expiry=ck['expiry'])))
'''
print(api(code,'remote-closeout')['stdout'])
