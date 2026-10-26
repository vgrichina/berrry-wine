import pathlib,sys,json,datetime,shutil
from account import accounting
B=pathlib.Path('/tmp/civ2-win16-ordinary-gameplay-oct26');R=pathlib.Path('/home/user/wine-assembly/scratch/runs/civ2-win16-ordinary-gameplay-oct26')
def alloc(root):return sum(p.lstat().st_blocks*512 for p in [root,*root.rglob('*')])
account=accounting();used=account['total'];mem=int(next(l.split()[1] for l in open('/proc/meminfo') if l.startswith('MemAvailable:')))*1024;free=shutil.disk_usage(B).free;remaining=67108864-used
out=dict(at=datetime.datetime.now(datetime.timezone.utc).isoformat(),operation=sys.argv[1],memAvailable=mem,requiredMemAvailable=3355443200,memoryAdmitted=mem>=3355443200,taskAllocated=used,allocationCap=67108864,remainingIncludingFuturePublicationAnd8MiBReserve=remaining,diskFree=free,projectedHostFreeAfterAllRemainingGrowth=free-remaining,requiredProjectedFree=2982150144,diskAdmitted=free-remaining>=2982150144,standingSourceIncluded=27570176,standingCdFixtureExcluded=372871168,standingCdLogical=372035495)
out['accounting']=account
(R/(sys.argv[1]+'-admission.json')).write_text(json.dumps(out,indent=2)+'\n');print(json.dumps(out));sys.exit(0 if out['memoryAdmitted'] and out['diskAdmitted'] and remaining>=8388608 else 1)
