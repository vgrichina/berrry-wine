from ops import *
life=json.loads((E/'lifecycle.json').read_text());box=life['box']
rc,out,err=run(['/home/user/.ascii/boat','stop',box,'--json'],cwd=OWN,name='stop',timeout=120)
record('stop-response',dict(box=box,exit=rc,stdout=out,stderr=err));assert rc==0
rc,out,err=run(['/home/user/.ascii/boat','info',box,'--json'],cwd=OWN,name='stopped-info',timeout=30)
assert rc==0
obj=json.loads(out)
record('lifecycle-receipt',dict(box=box,expiry=life['expiry'],cutoff=life['cutoff'],stopResponse=json.loads((E/'stop-response.json').read_text()),actualInfo=obj,delegation=life['shutdownOwner']))
print(out[:5000])
