import pathlib,json,subprocess,os
from remote import *
p=subprocess.run(['boat','--json','info',BOX],capture_output=True,text=True);assert p.returncode==0;save('box-before.json',json.loads(p.stdout))
run('import pathlib,os,json;R=pathlib.Path(%r);s=os.statvfs(R);n=sum(p.stat().st_blocks*512 for p in R.rglob("*"));assert n+900000000<2147483648;assert s.f_bavail*s.f_frsize-900000000>=2982150144;print(json.dumps(dict(currentAllocated=n,additionalProjected=900000000,cap=2147483648,free=s.f_bavail*s.f_frsize)))'%REMOTE,'remote-prewrite.json')
for n in ['support.py','observer.cjs','launch.py','input-fixture.cjs']:
 transfer((E/n).read_bytes(),n)
print(run('import pathlib,subprocess,json;Q=pathlib.Path("/home/user/shadow-man-install-quota-oct22");assert not Q.exists();Q.mkdir();p=subprocess.run(["sudo","mount","-t","tmpfs","-o","size=419430400,mode=0777","tmpfs",str(Q)],capture_output=True,text=True);print(json.dumps(dict(command=p.args,exitCode=p.returncode,stdout=p.stdout,stderr=p.stderr)));assert p.returncode==0;O=Q/"session";O.mkdir();(O/"tmp").mkdir()','mount-api.json')['stdout'])
print('REMOTE SCRIPTS + HARD QUOTA PREPARED')
