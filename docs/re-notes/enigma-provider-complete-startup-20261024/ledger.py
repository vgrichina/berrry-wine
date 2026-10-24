from work import *
def allocated(p):
 if not p.exists():return 0
 if p.is_file():return max(p.stat().st_size,p.stat().st_blocks*512)
 return p.stat().st_blocks*512+sum(allocated(x) for x in p.iterdir() if not x.is_symlink())
def measure(stage):
 a=json.load(open(H/'admission.json'));C=pathlib.Path('/home/user/.codex');base=json.load(open(H/'sqlite-baseline.json'));remote=json.loads(json.load(open(H/'remote-admission.json'))['stdout']);external=pathlib.Path(a['launcher'])
 charges=dict(localOwned=allocated(H),sessionFull=allocated(pathlib.Path(a['session'])),launcherFull=allocated(external)+sum(allocated(pathlib.Path(str(external)+s)) for s in ['-dispatch.json','.task.txt']),sqlitePositive=sum(max(0,allocated(p)-base.get(str(p),0)) for p in C.glob('*.sqlite*') if p.is_file()),remoteMaterialized=43741184,remoteHelpersEvidence=2097152,transferOverlap=262144,localGitFuture=524288,externalFuture=2097152,reserve=8388608)
 peak=sum(charges.values());free=shutil.disk_usage(H).free;j=dict(stage=stage,charges=charges,peak=peak,cap=67108864,sourceFree=free,sourceAfter=free-peak,remoteFree=remote['free'],remoteAfter=remote['free']-peak,passAdmission=peak<=67108864 and min(free,remote['free'])-peak>=2982150144);save('resource-'+stage+'.json',j);assert j['passAdmission'],j;return j
if __name__=='__main__':print(json.dumps(measure('current')))
