from work import *
PREV=pathlib.Path('/tmp/enigma-presented-menu-progress-gameplay-oct26')
HS=[pathlib.Path('/tmp/enigma-small-step-production-gameplay-oct26'),pathlib.Path('/tmp/enigma-retained-bounded-progress-gameplay-oct26'),PREV,H]
def gate(stage,remoteBytes=46116864,future=33554432):
 old=json.loads((PREV/'ops/admission-prepublication.json').read_text())
 base=json.loads((HS[0]/'ops/sqlite-baseline.json').read_text())
 wal=max(old['charges']['positiveWALOnce'],sum(max(0,allocated(pathlib.Path(p))-v) for p,v in base.items()))
 launchers=[];sessions=[]
 for h in HS:
  l=ROOT/'scratch/usage-watch'/h.name;launchers.append(l)
  sid=json.loads((h/'ops/launch.json').read_text())['session'] if (h/'ops/launch.json').exists() else json.loads((l/'events.jsonl').open().readline())['thread_id']
  sessions+=list(pathlib.Path('/home/user/.codex/sessions/2026/10/26').glob('*'+sid+'.jsonl'))
 charges=dict(localOwned=sum(allocated(h) for h in HS),remoteOwnedAndProjected=remoteBytes,launchers=sum(allocated(l)+sum(allocated(pathlib.Path(str(l)+s)) for s in ['.task.txt','.task.runtime.json','-dispatch.json']) for l in launchers),sessions=sum(allocated(p) for p in sessions),positiveWALOnce=wal,prospectiveGrowth=future,reserve=8388608)
 mem=int(pathlib.Path('/proc/meminfo').read_text().split('MemAvailable:')[1].split()[0])*1024;free=shutil.disk_usage(H).free
 clients=[];owners=[]
 for p in pathlib.Path('/proc').glob('[0-9]*'):
  try:
   c=p.joinpath('cmdline').read_bytes().replace(b'\0',b' ');rss=int(p.joinpath('status').read_text().split('VmRSS:')[1].split()[0])*1024
   if b'/bin/codex' in c:clients.append(dict(pid=int(p.name),rss=rss))
   if rss>67108864:owners.append(dict(pid=int(p.name),rss=rss,command=c.decode(errors='replace')[:160]))
  except (OSError,ValueError,IndexError):pass
 reserves=dict(CivII=805306368,GL=268435456,remoteHelpers=268435456,GitAndLocalHelper=67108864,clientGrowth=335544320,host=805306368)
 j=dict(at=time.time(),stage=stage,charges=charges,total=sum(charges.values()),cap=134217728,memAvailable=mem,clients=clients,largeResidentOwners=owners,reserves=reserves,minimumMemory=sum(reserves.values()),diskFree=free,projectedFree=free-sum(charges.values()),diskFloor=2982150144,positiveWALPolicy='Positive per-file growth from earliest retained baseline counted once, floored at historical accounted peak; shared full database never duplicated')
 j['pass']=j['total']<=j['cap'] and mem>=j['minimumMemory'] and j['projectedFree']>=j['diskFloor']
 save('admission-'+stage+'.json',j);print(json.dumps({k:v for k,v in j.items() if k not in ['clients','largeResidentOwners']}));assert j['pass'],j
 return j
if __name__=='__main__':gate('preparation')
