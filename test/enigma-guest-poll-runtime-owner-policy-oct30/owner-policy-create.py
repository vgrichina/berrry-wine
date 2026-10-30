from pathlib import Path
import json,hashlib
r=Path(__file__).parent
# New self-contained wrapper, preserving predecessor bytes.
s=(r/'guest_poll_ops_v2.py').read_text().replace("E=ROOT/'guest-poll-evidence'","E=ROOT/'owner-policy/e'")
s=s.replace("memoryRequired=4436865024","memoryPolicy='observational only; owner 2026-10-30'")
s=s.replace("memory=mem>=2147483648,disk=sample['free']-200183808>=3*1024**3","disk=sample['free']-200183808>=1610612736")
s=s.replace("time.sleep(.03)","time.sleep(.03)")
# Catch fast output overflow as well as running-child overflow.
s=s.replace(" # Native API transfer", " assert out.stat().st_size+err.stat().st_size<=512*1024,'capture'\n # Native API transfer")
(r/'owner_policy_ops.py').write_text(s)
s=(r/'guest_poll_gate.py').read_text().replace('import guest_poll_ops_v2 as ops','import owner_policy_ops as ops').replace("OUT=ops.ROOT/'guest-poll'","OUT=ops.ROOT/'owner-policy'")
(r/'owner_policy_gate.py').write_text(s)
s=(r/'guest-poll-runtime.py').read_text().replace('import guest_poll_gate as gate','import owner_policy_gate as gate').replace("R/'guest-poll-guest.py'","R/'owner-policy-guest.py'").replace("'enigma-guest-poll-oct30'","'enigma-guest-poll-owner-policy-oct30'")
(r/'owner-policy-runtime.py').write_text(s)
# Repair prepared collector's missing initialization/control/startup/hardwall block.
poll=(r/'guest-poll-guest.py').read_text();base=(r/'causal-guest.py').read_text()
a=base.index('rec=dict(');b=base.index('\nevents=[',a)
prefix=base[:b]
prefix=prefix.replace("assert mem()>=int(2.5*1073741824)","rec['MemAvailableObservation']=mem()")
events=poll[poll.index('events=['):poll.index('\nt=time.monotonic()')]
tail=poll[poll.index('\nt=time.monotonic()'):]
tail=tail.replace("if rss>2*1073741824 or mem()<int(2.5*1073741824):reason='physical memory denial';break","rec['MemAvailableObservation']=mem()\n   if rss>2*1073741824:reason='process RSS denial';break")
(r/'owner-policy-guest.py').write_text(prefix+'\n'+events+tail)
for name in ['owner_policy_ops.py','owner_policy_gate.py','owner-policy-runtime.py','owner-policy-guest.py']:
 p=r/name;compile(p.read_text(),name,'exec');p.chmod(0o444)
print(json.dumps({'created':True,'guestFix':'restored missing save/ctl/capture/startup/hardwall definitions from retained causal-guest; schedule unchanged from prepared guest-poll'}))
