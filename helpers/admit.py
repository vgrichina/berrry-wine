import json,sys,pathlib,datetime,shutil
from account import accounting
R=pathlib.Path('/home/user/wine-assembly/scratch/runs/civ2-win16-footprint-recovered-gameplay-oct26')
a=accounting();mem=int(next(l.split()[1] for l in open('/proc/meminfo') if l.startswith('MemAvailable:')))*1024;free=shutil.disk_usage(R).free
future=26001408 if sys.argv[1]=='compile' else 24117248
out=dict(at=datetime.datetime.now(datetime.timezone.utc).isoformat(),operation=sys.argv[1],memAvailable=mem,requiredMemAvailable=3355443200,accounting=a,futureIncluding8MiBReserve=future,totalProjection=a['total']+future,diskFree=free,projectedHostFree=free-future,admitted=mem>=3355443200 and a['total']+future<=67108864 and free-future>=2982150144)
(R/(sys.argv[1]+'-admission.json')).write_text(json.dumps(out,indent=2)+'\n');print(json.dumps(out));sys.exit(0 if out['admitted'] else 1)
