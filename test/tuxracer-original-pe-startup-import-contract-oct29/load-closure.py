from supervisor import *
MAIN='3239df2388ec1599deb229b22ea1fb1e2b8f03fa';pins=json.loads((OUT/'extra-source-pins.json').read_text())
for name in ['src/10-helpers.wat']:
 data=run(['git','-C',str(OWN),'cat-file','blob',MAIN+':'+name],cwd=OWN,git=True,label='source-'+name)
 assert sum(x['bytes'] for x in pins.values())+len(data)<=4*1024**2
 (OWN/name).write_bytes(data);pins[name]={'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()}
save('extra-source-pins.json',pins)
