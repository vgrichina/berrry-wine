import sys,subprocess,json,hashlib,time,os,shutil
from pathlib import Path
b=Path('/tmp/app-files-empty-alias-fallback-repair-oct26');r=b/'repo';o=b/'ops'
name=sys.argv[1];cmd=sys.argv[2:]
assert cmd
mem=int(next(l.split()[1] for l in Path('/proc/meminfo').read_text().splitlines() if l.startswith('MemAvailable:')))*1024
free=shutil.disk_usage(b).free
assert mem-16777216>=805306368 and free-56*1024**2>=2982150144
p=subprocess.run(cmd,cwd=r,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,timeout=35)
assert len(p.stdout)<=131072
(o/(name+'.txt')).write_bytes(p.stdout)
h=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
cp=o/'checkpoint-tests.json';data=json.loads(cp.read_text()) if cp.exists() else {'base':'52b7bb0e9e73fc839344c33f00cffa2c638fc193','groups':[]}
data['groups'].append({'name':name,'at':time.time(),'candidate':subprocess.check_output(['git','rev-parse','HEAD'],cwd=r,text=True).strip(),'sourceSha256':h(r/'lib/app-files.js'),'fixtureSha256':{str(p.relative_to(r)):h(p) for p in [r/'test/app-files-empty-alias-fallback-oct26.test.cjs',*[r/a for a in cmd if (r/a).is_file()]]},'command':cmd,'exitCode':p.returncode,'evidence':name+'.txt','evidenceSha256':h(o/(name+'.txt')),'memAvailable':mem,'freeDisk':free})
data['remaining']=['complete scoped repair/tests','independent acceptance later','current-main integration separately','runtime/browser/gameplay untested']
tmp=cp.with_suffix('.tmp');tmp.write_text(json.dumps(data,indent=2)+'\n');tmp.replace(cp)
print(name,p.returncode);print(p.stdout.decode()[-1800:])
