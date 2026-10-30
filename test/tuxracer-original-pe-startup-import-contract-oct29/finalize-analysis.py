from supervisor import *
import re
MAIN='3239df2388ec1599deb229b22ea1fb1e2b8f03fa';pins=json.loads((OUT/'extra-source-pins.json').read_text())
name='src/01b-api-hashes.generated.wat';data=run(['git','-C',str(OWN),'cat-file','blob',MAIN+':'+name],cwd=OWN,git=True,label='source-'+name)
assert len(data)+sum(x['bytes'] for x in pins.values())<=4*1024**2
(OWN/name).write_bytes(data);pins[name]={'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()};save('extra-source-pins.json',pins)
# Source transfer captures duplicate pinned materialized files; retain identities, not extra copies.
transfers=[]
for p in OUT.glob('source-*.stdout'):
 transfers.append({'name':p.name,'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()});p.unlink()
save('source-transfer-cleanup.json',transfers)
