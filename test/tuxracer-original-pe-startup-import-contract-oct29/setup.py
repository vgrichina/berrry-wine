from supervisor import *
MAIN='3239df2388ec1599deb229b22ea1fb1e2b8f03fa'
# No checkout: seed only the isolated index with the pinned tree.
for args in [['symbolic-ref','HEAD','refs/heads/task/'+TASK],['read-tree',MAIN],['config','core.sparseCheckout','true'],['config','user.name','Wine Ops'],['config','user.email','wine-ops@localhost'],['config','remote.origin.url','git@github.com:vgrichina/wine-assembly.git']]:
 run(['git','-C',str(OWN)]+args,cwd=OWN,git=True,mutate=True,label='setup-'+args[0])
# HEAD base retains full pinned tree; only task files will be staged.
run(['git','-C',str(OWN),'update-ref','refs/heads/task/'+TASK,MAIN],cwd=OWN,git=True,mutate=True,label='setup-base')
(OWN/'.git/info').mkdir(exist_ok=True);(OWN/'.git/info/sparse-checkout').write_text('/test/'+TASK+'/\n')
pins={}
for name in ['src/main.watx','src/08-pe-loader.wat','src/08b-dll-loader.wat','src/09b-dispatch.wat','src/09b2-dispatch-table.generated.wat']:
 data=run(['git','-C',str(OWN),'cat-file','blob',MAIN+':'+name],cwd=OWN,git=True,label='source-'+name)
 p=OWN/name;p.parent.mkdir(exist_ok=True,parents=True);p.write_bytes(data);pins[name]={'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()}
save('extra-source-pins.json',pins)
