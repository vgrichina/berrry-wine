"""Read-only recovery integrity and box handback; no preparation/runtime retry."""
import pathlib,json,hashlib
from transport import *
rows=[json.loads(l) for l in (E/'transfer-files.jsonl').read_text().splitlines()]
assert len(rows)==2083 and sum(x['bytes'] for x in rows)==186399681
code='''import pathlib,json,hashlib,os,subprocess,shutil
R=pathlib.Path(ROOT_PATH);I=R/'immutable';M=R/'mutable';F=R/'fixed'
rows=[]
for p in sorted((I/'restored').rglob('*')):
 if not p.is_file():continue
 with p.open('rb') as f:h=hashlib.file_digest(f,'sha256').hexdigest()
 rows.append([str(p.relative_to(I/'restored')),p.stat().st_size,h])
assert len(rows)==2083 and sum(x[1] for x in rows)==186399681
def alloc(p):return sum(x.lstat().st_blocks*512 for x in [p,*p.rglob('*')])
nodes=subprocess.run(['pgrep','-a','node'],capture_output=True,text=True);assert nodes.returncode==1,nodes.stdout
assert not os.path.ismount(M) and not any(M.iterdir()) and not any(F.iterdir())
assert not (I/'runtime').exists() and not (I/'receipts').exists()
reg=I/'restored/parent-registry.json';assert reg.stat().st_size==17088 and hashlib.sha256(reg.read_bytes()).hexdigest()=='d7143f29d29576cd015ec875264028fa70795d0f18de457e31927048081d9de3'
seals={};game=I/'restored/parent-vfs/program files/acclaim entertainment/shadowman'
for n in ['d3dconfigutility.exe','mss32.dll','dsetup.dll','shadowman.exe']:
 p=game/n;seals[n]=dict(bytes=p.stat().st_size,sha256=hashlib.sha256(p.read_bytes()).hexdigest())
out=dict(box='bx_fn7pn7yg',destinationOriginalFiles=len(rows),destinationOriginalBytes=sum(x[1] for x in rows),originalRows=rows,registrySHA256=hashlib.sha256(reg.read_bytes()).hexdigest(),registryBytes=reg.stat().st_size,nativeSeals=seals,runtimeStaged=False,cloneCount=0,guestAttempts=0,ownedNodeProcesses=[],ownedGroups=[],tmpfsMounted=False,mutableEmpty=True,fixedEmpty=True,immutableReadOnly=all(not p.stat().st_mode&0o222 for p in [I,*I.rglob('*')]),allocation=dict(immutable=alloc(I),fixed=alloc(F),mutable=alloc(M),freeBytes=shutil.disk_usage(R).free),uid=os.getuid())
assert out['allocation']['immutable']<2147483648 and out['allocation']['fixed']<100663296 and out['allocation']['freeBytes']>=2147483648
print(json.dumps(out))
'''
r=run('ROOT_PATH='+repr(ROOT)+'\n'+code,'handback-integrity-api.json',30)
h=json.loads(r['stdout']);actual=h.pop('originalRows');expected={x['path'].split('/immutable/restored/',1)[1]:[x['bytes'],x['sha256']] for x in rows};assert {x[0]:x[1:] for x in actual}==expected
save('destination-original-hashes.json',actual);h['allOriginalHashesVerified']=True
box=api('sandboxes/'+BOX);save('box-final.json',box)
b=box['sandbox'];assert b['state']=='idle' and b['health']=='ok' and b['stop'] is None
h.update(boxState='RUNNING (API idle)',apiState=b['state'],health=b['health'],stop=b['stop'],expiry=b['archiveAfter'],coordinatorLifecycleOwner=True,handbackBefore='2026-10-23T02:45:00Z')
save('handback.json',h);print(json.dumps(h))
