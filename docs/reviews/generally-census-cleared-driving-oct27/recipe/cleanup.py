from common import *
code='''import pathlib,json,time,os
h=pathlib.Path(HERE);q=json.loads((h/'guest-supervision.json').read_text());live=[]
for pid,start in q['owned']:
 try:
  s=pathlib.Path('/proc/'+str(pid)+'/stat').read_text().rsplit(') ',1)[1].split()
  if s[19]==start and s[0]!='Z':live.append(dict(pid=pid,start=start,state=s[0]))
 except FileNotFoundError:pass
v=dict(at=time.time(),ownedSurvivors=live,supervisorCleanupComplete=q['cleanupComplete'],exit=q['exit'],stopReason=q['stopReason'],nodeTerminalStatus='closed stdout after bridge ACK timeout; EPIPE retained; supervisor owns full cleanup',uncertainStepNotReplayed=True,heldDrivingKeys=[],drivingInputDispatched=False,ordinaryQuit='not attempted after uncertain loading step',box=BOXID,expiry='2026-10-27T13:20:39.001Z',lifecycleMutation=False,shutdownOwner='coordinator',remoteAllocated=sum(p.stat().st_blocks*512 for p in h.parent.rglob('*') if p.is_file()))
(h/'owned-cleanup.json').write_text(json.dumps(v,indent=2));print(json.dumps(v))
'''.replace('HERE',repr(O)).replace('BOXID',repr(BOX))
x=json.loads(py('owned-cleanup',code)['stdout']);save('owned-process-cleanup.json',x);assert x['supervisorCleanupComplete'] and not x['ownedSurvivors'];print(json.dumps(x))
