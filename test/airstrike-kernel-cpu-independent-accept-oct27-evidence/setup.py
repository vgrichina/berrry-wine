import subprocess,resource,os,pathlib,json,hashlib,fcntl
r=pathlib.Path('/tmp/airstrike-kernel-cpu-independent-accept-oct27/repo');r.mkdir(exist_ok=True)
d=pathlib.Path('/tmp/airstrike-cgroup-cpu-receipt-oct27/repo')
def git(*a):
 def lim():resource.setrlimit(resource.RLIMIT_DATA,(536870912,536870912))
 with open('/tmp/wine-ops-production-git.lock','a') as lock:
  fcntl.flock(lock,fcntl.LOCK_EX)
  return subprocess.check_output(['git','-C',str(r),*a],preexec_fn=lim).decode()
git('init');(r/'.git/objects/info/alternates').write_text(str(d/'.git/objects')+'\n')
git('config','user.name','Wine Ops');git('config','user.email','wine-ops@localhost')
url=subprocess.check_output(['git','-C',str(d),'config','--get','remote.origin.url']).decode().strip()
git('remote','add','origin',url)
git('sparse-checkout','init','--no-cone');git('sparse-checkout','set','/test/cgroup-cpu-receipt-oct27.py','/test/cgroup-cpu-receipt-report-oct27.md','/test/helpers/cgroup-cpu-evidence-oct27.py','/test/unique-cpu-receipt-oct27.py','/test/helpers/palette-browser-supervisor-candidate-oct27.py')
git('checkout','-b','task/airstrike-kernel-cpu-independent-accept-oct27','ed8d8279793fbf076335e42120dd00c676f25d9e')
pins={p:hashlib.sha256((r/p).read_bytes()).hexdigest() for p in ['test/helpers/cgroup-cpu-evidence-oct27.py','test/cgroup-cpu-receipt-oct27.py']}
assert pins['test/helpers/cgroup-cpu-evidence-oct27.py']=='ddd770715ff69dea7e42c14f8760553da5403dc81105310622710b07c5229ac3'
assert pins['test/cgroup-cpu-receipt-oct27.py']=='1e179c6316850960a5fccfe9d653c7b0a6869165adb6a3831541085e70e8ef15'
print(json.dumps(dict(pins=pins,mountArgv=[],mountValidation='not applicable: no mount/SSH runtime; Git SSH exact configured via environment',identity=git('config','user.name').strip())))
