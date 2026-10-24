from work import *
def allocated(p):
 if not p.exists():return 0
 if p.is_file():return max(p.stat().st_size,p.stat().st_blocks*512)
 return p.stat().st_blocks*512+sum(allocated(x) for x in p.iterdir() if not x.is_symlink())
def measure(stage):
 a=json.load(open(H/'admission.json'));C=pathlib.Path('/home/user/.codex');baseline=json.load(open(H/'sqlite-baseline.json'))
 external=pathlib.Path(a['launcher']);remote=json.load(open(H/'remote-admission.json'));remoteFree=json.loads(remote['stdout'])['free']
 charges=dict(localOwned=allocated(H),sessionFull=allocated(pathlib.Path(a['session'])),launcherFull=allocated(external)+sum(allocated(pathlib.Path(str(external)+s)) for s in ['-dispatch.json','.task.txt']),sqlitePositive=sum(max(0,allocated(p)-baseline.get(str(p),0)) for p in C.glob('*.sqlite*') if p.is_file()),remoteMaterialized=a['charges']['remoteMaterialized'],remoteHelpersEvidence=2097152,transferOverlap=262144,localGitFuture=262144,externalFuture=4194304,reserve=8388608)
 peak=sum(charges.values());free=shutil.disk_usage(H).free
 j=dict(stage=stage,charges=charges,peak=peak,cap=67108864,sourceFree=free,sourceAfter=free-peak,remoteFree=remoteFree,remoteAfter=remoteFree-peak,passAdmission=peak<=67108864 and min(free,remoteFree)-peak>=2982150144)
 save('resource-'+stage+'.json',j);assert j['passAdmission'],j;return j
if __name__=='__main__':print(json.dumps(measure('current')))
