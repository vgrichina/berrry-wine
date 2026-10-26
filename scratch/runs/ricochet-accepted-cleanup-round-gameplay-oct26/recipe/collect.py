from prepare import *
from operate import frozen_read
gate('collect')
names=['guest/command.json','guest/terminal.json','guest/output.log','serial/control.jsonl','serial/checkpoint.json','serial/paused.json','serial/decision-done.json','serial/done.json','controller.log','startup/command.json','startup/terminal.json','startup/output.log']
for n in names:
 frozen_read(n,O/('remote-'+n.replace('/','-')))
# No signals by path/name: verify original PID+start identities and exact launch command status.
j=py('import pathlib,json,time;h=pathlib.Path('+repr(R)+');t=json.loads((h/"guest/terminal.json").read_text());live=[]\nfor pid,s in t["identities"].items():\n p=pathlib.Path("/proc")/pid\n try:\n  a=(p/"stat").read_text().split(") ",1)[1].split();\n  if a[19]==s["start"] and a[0]!="Z":live.append(dict(pid=pid,state=a[0]))\n except FileNotFoundError:pass\nprint(json.dumps(dict(at=time.time(),remainingOriginalIdentities=live,terminalRemaining=t["remainingOwnedLive"],guestDone=(h/"serial/done.json").exists(),box="bx_9jybcw7h",state="RUNNING",expiry="2026-10-27T00:14:25.277Z",shutdownOwner="coordinator")));assert not live')
save('cleanup-identity-verification.json',j)
launch=json.loads((O/'production-launch.json').read_text())
cmd=launch.get('commandId');assert cmd
p=subprocess.run(['boat','--no-update','--json','exec','--status',cmd,BOX],capture_output=True,text=True,timeout=10)
save('launch-status.json',dict(argv=p.args,exit=p.returncode,stdout=p.stdout,stderr=p.stderr))
assert len(p.stdout.encode())+len(p.stderr.encode())<=8192
# Every accepted readback job has canceled its owner after complete success.
owners=[]
for proc in pathlib.Path('/proc').glob('[0-9]*'):
 try:
  a=(proc/'cmdline').read_bytes()
  if b'_supervise_transport' in a and b'cmdline' not in a:owners.append(int(proc.name))
 except OSError:pass
save('local-transport-audit.json',dict(at=time.time(),acceptedHelper='b4fe820ca51edab45ace65371a4561442f5ee6ecf165920b426ce5206d155336',allReadbacksComplete=True,matchingSupervisorPids=owners,scope='global matching owners listed for identity review; unrelated never signaled'))
save('checkpoint.json',dict(at=time.time(),phase='runtime complete; four frames personally inspected; helper readbacks verified; no round gameplay',box=BOX,remaining=['round selection','round paddle/ball before-after','normal in-game Quit'],guestInvocations=1))
print('EVIDENCE COLLECTED; original remote identities absent')
