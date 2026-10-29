"""Recover exact named source blobs from the already supplied read-only object closure."""
from supervisor import *
MAIN='3239df2388ec1599deb229b22ea1fb1e2b8f03fa'
pins=json.loads((OUT/'extra-source-pins.json').read_text())
assert sum(p['bytes'] for p in pins.values())<=4*1024**2
for name,pin in pins.items():
 p=OWN/name
 if p.exists() and hashlib.sha256(p.read_bytes()).hexdigest()==pin['sha256']:continue
 data=run(['git','-C',str(OWN),'cat-file','blob',MAIN+':'+name],cwd=OWN,git=True,label='recover-'+name)
 assert len(data)==pin['bytes'] and hashlib.sha256(data).hexdigest()==pin['sha256']
 p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(data)
 (OUT/('recover-'+name.replace('/','_')+'.stdout')).unlink()
