from ops import *
box=json.loads((E/'box.json').read_text())['id']
envelope=json.loads((E/'runtime.stdout').read_text());r=json.loads(envelope['stdout'])
assert not envelope['stdoutTruncated'] and not envelope['stderrTruncated']
br=r['report']['backendReceipt']
record('canonical-receipt',dict(task=r['task'],candidate=r['candidate'],gatePASS=r['gatePASS'],runtimeResult='runtime-result.json',runtimeSHA256=hashlib.sha256((E/'runtime-result.json').read_bytes()).hexdigest(),apiEnvelopeSHA256=hashlib.sha256((E/'runtime.stdout').read_bytes()).hexdigest(),box=box,sourcePins=r['pins'],scope='ordinary inherited descendant output only; arbitrary escaped descendants/fullresource/browser/gameplay UNKNOWN',browserAllowance=r['report']['browserAllowanceRemaining'],cliExit=r['cliExit'],filesystem=br['filesystem'],stopReason=br['stopReason'],cpuSeconds=br['cpuSeconds'],wallSeconds=br['wallSeconds'],safetyCleanup=r['safetyCleanup'],cleanupComplete=r['report']['cleanupComplete'],remainingMounts=r['remainingMounts'],observedIdentities=r['observedIdentities'],descendantObservation=r['descendantObservation'],productionInvocations=1,retainedStdoutSHA256=hashlib.sha256(r['fixtureOutput'].encode()).hexdigest(),limitations=['Original historical post-runtime WAL baseline and retention RAM rejection remain historical limitations; current task baseline is pre-operation, not launcher-startup proof.','Startup selftest first launched in incompatible hard128 child context rejected before any runtime; corrected to existing authorized parent context with inherited hard unchanged; no production retry.','Production exposes retained output and authoritative limit reason, not an independent attempted-byte counter; 2048 attempted bytes are fixture source evidence.','No guest mount argv or Node process; canonical guest mount parser and Node startup not invoked. Boat staging enumerates each exact --file argv separately, no comma-bearing files.']))
rc,out,err=run(['/home/user/.ascii/boat','--json','stop',box],cwd=OWN,name='snapshot-stop',timeout=120)
assert rc==0
rc,out,err=run(['/home/user/.ascii/boat','--json','info',box],cwd=OWN,name='stopped-info',timeout=30)
assert rc==0
info=json.loads(out)
def states(o):
 if isinstance(o,dict):
  for k,v in o.items():
   if k=='state':yield v
   else:yield from states(v)
 elif isinstance(o,list):
  for v in o:yield from states(v)
found=list(states(info));record('actual-stopped',dict(box=box,states=found,verified=any(x in ('stopped','STOPPED') for x in found),infoSHA256=hashlib.sha256(out.encode()).hexdigest()))
print(json.dumps(dict(box=box,states=found)))
assert any(x in ('stopped','STOPPED') for x in found)
