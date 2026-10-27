"""Independent exact-production late-hardlink challenge; no root relocation."""
import importlib.util,json,os,pathlib,tempfile
from unittest import mock
import accept
P=pathlib.Path;O=accept.O;i=accept.load();real_write=os.write;real_spec=importlib.util.spec_from_file_location
with tempfile.TemporaryDirectory(prefix='independent-late-link-',dir=O) as tmp:
 outside=P(tmp)/'external-log';injected=[]
 def write(fd,data):
  try:name=P(os.readlink('/proc/self/fd/'+str(fd)))
  except OSError:name=P('/')
  if name.name=='node-startup.log.new' and not injected:
   assert name.parent.name=='output' and name.parent.parent.name=='ops'
   os.link(name,outside)
   injected.append({'at':'immediately before first os.write on exclusively-created startup-log descriptor','source':str(name),'outside':str(outside),'linkCountAtWrite':os.fstat(fd).st_nlink,'rootRelocated':False})
  return real_write(fd,data)
 with mock.patch.object(importlib.util,'spec_from_file_location',i['bridge_spec']),mock.patch.object(os,'write',write):
  r=i['t'].exercise(i['source'])
 assert len(injected)==1
 assert i['receipts'] and i['receipts'][0]['cleanupComplete'] and i['receipts'][0]['stopReason'] is None
 assert r['children']==['startup'] and r['error'] and r['collectorError']
 assert r['collected'] is None
 assert not r['artifacts'].get('remote-final-accounting.json',{}).get('accountingComplete')
 n=outside.stat().st_size;allocated=outside.stat().st_blocks*512
 report={'candidate':'2b825a30d178a34aca28b50307d87049693ba529','runnerSHA256':accept.sha(accept.RUNNER),'unchangedReproducerSHA256':accept.sha(accept.REPRO),'exactProductionEntry':True,'nodeExecutable':accept.NODE,'nodeFlags':accept.FLAGS,'injection':injected,'externalContentBytes':n,'externalAllocatedBytes':allocated,'externalSHA256':accept.sha(outside),'runnerError':r['error'],'collectorError':r['collectorError'],'children':r['children'],'collected':False,'accountingComplete':False,'rootRelocated':False,'OSsandboxClaim':False,'outerAllocationBypassClaim':False,'safeRefusalAfterWrite':True,'acceptance':'REJECT' if n else 'PASS','reason':'A single late hardlink aliases the already-open output inode outside the task root before its first write. The post-write link-count check refuses, but external content already exists.'}
 (O/'late-hardlink-counterexample.json').write_text(json.dumps(report,indent=2))
 # Preserve compact exact payload evidence without retaining environment values.
 (O/'late-hardlink-payload-identity.json').write_text(json.dumps({'bytes':n,'allocated':allocated,'sha256':accept.sha(outside),'payloadOmitted':'Node startup environment is not publication material'},indent=2))
 print(json.dumps({k:report[k] for k in ['acceptance','externalContentBytes','externalAllocatedBytes','runnerError','collectorError','children','rootRelocated']}))
 assert n==0,'REJECT: production descriptor write filled an outside hardlink before post-write refusal'
