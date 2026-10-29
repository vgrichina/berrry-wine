from ops import *
box=json.loads((E/'box.json').read_text())['id'];envelope=json.loads((E/'runtime.stdout').read_text());r=json.loads(envelope['stdout'])
assert not envelope['stdoutTruncated'] and not envelope['stderrTruncated']
record('canonical-receipt',dict(task=r['task'],candidate=r['candidate'],gatePASS=r['gatePASS'],runtimeResult='runtime-result.json',runtimeSHA256=hashlib.sha256((E/'runtime-result.json').read_bytes()).hexdigest(),apiEnvelopeSHA256=hashlib.sha256((E/'runtime.stdout').read_bytes()).hexdigest(),box=box,sourcePins=r['pins'],scope='one ordinary Python process aggregate RSS rejection only; arbitrary descendant RSS, fullresource/browser/gameplay UNKNOWN',browserAllowance=r['report']['browserAllowanceRemaining'],cliExit=r['cliExit'],stopReason=r['report']['backendReceipt']['stopReason'],peakRSS=r['report']['backendReceipt']['peakRSS'],cpuSeconds=r['report']['backendReceipt']['cpuSeconds'],wallSeconds=r['report']['backendReceipt']['wallSeconds'],safetyCleanup=r['safetyCleanup'],cleanupComplete=r['report']['cleanupComplete'],remainingMounts=r['remainingMounts'],observedIdentities=r['observedIdentities']))
rc,out,err=run(['/home/user/.ascii/boat','--json','stop',box],cwd=OWN,name='snapshot-stop',timeout=120)
print(json.dumps(dict(box=box,stopExit=rc,stdoutBytes=len(out),stderrBytes=len(err))))
assert rc==0
rc,out,err=run(['/home/user/.ascii/boat','--json','info',box],cwd=OWN,name='stopped-info',timeout=30)
info=json.loads(out)
def states(o):
 if isinstance(o,dict):
  for k,v in o.items():
   if k=='state':yield v
   else:yield from states(v)
 elif isinstance(o,list):
  for v in o:yield from states(v)
found=list(states(info));record('actual-stopped',dict(box=box,states=found,verified=any(x in ('stopped','STOPPED') for x in found),infoSHA256=hashlib.sha256(out.encode()).hexdigest()));print(json.dumps(dict(box=box,states=found)))
assert any(x in ('stopped','STOPPED') for x in found)
