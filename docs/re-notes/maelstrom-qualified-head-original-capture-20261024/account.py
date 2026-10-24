from transport import *
import re
O=H/'ops';C=pathlib.Path('/home/user/.codex')
def account(stage,remoteBytes=19000000):
 a=json.load(open(O/'admission.json'));base=json.load(open(O/'sqlite-baseline.json'))
 charges=dict(localOwned=size(H),sessionFull=pathlib.Path(a['session']).stat().st_size,launcherFull=size(pathlib.Path(a['launcher'])),sqlitePositive=sum(max(0,max(p.stat().st_size,p.stat().st_blocks*512)-base.get(str(p),0)) for p in C.glob('*.sqlite*') if p.is_file()),remoteOwnedProjected=remoteBytes,transferOverlap=1000000,futureSQLite=4194304,externalFuture=12000000,publicationFuture=2000000,reserve=8388608)
 peak=sum(charges.values());free=shutil.disk_usage(H).free
 j=dict(at=time.time(),charges=charges,peak=peak,cap=67108864,free=free,after=free-peak,passAdmission=peak<=67108864 and free-peak>=2982150144)
 (O/('resource-'+stage+'.json')).write_text(json.dumps(j,indent=2));assert j['passAdmission'],j
 print(json.dumps(j));return j
if __name__=='__main__':account(__import__('sys').argv[1])
