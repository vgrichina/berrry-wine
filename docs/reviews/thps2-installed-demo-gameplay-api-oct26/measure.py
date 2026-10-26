from common import *
import shutil,re,sys
def size(p):
 if not p.exists():return 0
 if p.is_file():return p.stat().st_blocks*512
 return sum(f.stat().st_blocks*512 for f in p.rglob('*') if f.is_file())
a=json.load(open(O/'resource-prestage.json'));db=json.load(open(O/'db-baseline.json'))
remote=py('''import pathlib,json,shutil,re
H=pathlib.Path(ROOT);procs=[]
for p in pathlib.Path('/proc').iterdir():
 if not p.name.isdigit():continue
 try:
  cmd=(p/'cmdline').read_bytes().split(b'\\0');exe=cmd[0].decode(errors='replace')
  if pathlib.Path(exe).name not in ('node','nodejs'):continue
  flags=[x.decode(errors='replace') for x in cmd if x.startswith((b'--max-old-space-size=',b'--memory-mb='))]
  rss=int(re.search(r'VmRSS:\\s+(\\d+)',(p/'status').read_text())[1])*1024
  procs.append(dict(pid=int(p.name),exe=exe,flags=flags,rss=rss))
 except (OSError,IndexError,TypeError):pass
print(json.dumps(dict(ownedBytes=sum(f.stat().st_blocks*512 for f in H.rglob('*') if f.is_file()) if H.exists() else 0,memAvailable=int(re.search(r'MemAvailable:\\s+(\\d+)',pathlib.Path('/proc/meminfo').read_text())[1])*1024,diskFree=shutil.disk_usage('/tmp').free,nodeProcesses=procs)))
'''.replace('ROOT',repr(str(H))))
delta=sum(max(0,pathlib.Path(p).stat().st_blocks*512-n) for p,n in db.items() if pathlib.Path(p).exists())
afterCapture=len(sys.argv)>1 and sys.argv[1] in ('prepublication','final')
charges=dict(hostOwned=size(H),remoteOwned=remote['ownedBytes'],hostSession=size(pathlib.Path(a['session'])),hostLauncher=size(pathlib.Path(a['launcher'])),attributablePositiveDBGrowth=delta,futureEvidenceAndPublication=900000 if afterCapture else 700000,futureCapturesBoth=0 if afterCapture else 1600000,futureSessionLauncherDB=500000 if afterCapture else 1000000,reserve=8388608)
total=sum(charges.values());free=shutil.disk_usage(H).free;mem=int(re.search(r'MemAvailable:\s+(\d+)',pathlib.Path('/proc/meminfo').read_text())[1])*1024
remaining=max(0,charges['futureEvidenceAndPublication']+charges['futureCapturesBoth']+charges['futureSessionLauncherDB']+charges['reserve'])
r=dict(at=time.time(),charges=charges,total=total,cap=67108864,hostFree=free,hostMemAvailable=mem,remote=remote,remoteRequired=3758096384,physicalFloor=2684354560,headroom=805306368,prospectiveHelpersTransient=268435456,prospectiveFixedArena=536870912,prospectiveOldSpace=536870912,noDoubleSubtractRSS=True,passGate=total<=67108864 and mem>=805306368 and free-remaining>=2982150144 and remote['memAvailable']>=3758096384 and remote['diskFree']-remaining>=2982150144)
save('resource-'+(sys.argv[1] if len(sys.argv)>1 else 'measured')+'.json',r);print(json.dumps(r));assert r['passGate']
