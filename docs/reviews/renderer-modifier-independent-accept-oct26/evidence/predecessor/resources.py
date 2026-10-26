import os,json,shutil,subprocess
from pathlib import Path
base=Path('/tmp/renderer-physical-modifier-state-repair-oct26')
launcher=Path('/home/user/wine-assembly/scratch/usage-watch/renderer-physical-modifier-state-repair-oct26')
session=Path('/home/user/.codex/sessions/2026/10/26/rollout-2026-10-26T05-50-25-01a176c2-9175-72e3-8e88-b0228e719446.jsonl')
roots=[base,launcher,session]
manifest=[]
for root in roots:
 files=[root] if root.is_file() else [p for p in root.rglob('*') if p.is_file() and not p.is_symlink()]
 for p in files: manifest.append({'path':str(p),'bytes':p.stat().st_size})
# Conservative upper bound: charge the current shared WAL set once, rather
# than attributing the same WAL bytes to launcher, session and repo separately.
wals=[{'path':str(p),'bytes':p.stat().st_size} for p in Path('/home/user/.codex').glob('*-wal')]
measured=sum(x['bytes'] for x in manifest);wal=sum(x['bytes'] for x in wals)
future=12*1024**2;reserve=8*1024**2;peak=measured+wal+future+reserve
mem=int(next(l.split()[1] for l in Path('/proc/meminfo').read_text().splitlines() if l.startswith('MemAvailable:')))*1024
processes=subprocess.check_output(['ps','-eo','comm,rss'],text=True).splitlines()[1:]
fleet=sum(int(l.split()[-1])*1024 for l in processes if l.split()[0] in ('codex','MainThread'))
free=shutil.disk_usage(base).free
receipt={'phase':os.environ.get('PHASE','publication'),'focusedManifest':manifest,'focusedBytes':measured,'sharedWALSingleConservativeUpperBound':wals,'sharedWALBytes':wal,'futureBytes':future,'reserveBytes':reserve,'projectedPeak':peak,'limit':67108864,'freeBytes':free,'freeAfterFuture':free-future,'memAvailable':mem,'fleetCodexAndMainThreadRSS':fleet,'memoryAfterClientAllowance':mem-536870912,'pass':peak<=67108864 and free-future>=2982150144 and mem-536870912>=805306368}
(base/'ops'/('resources-'+receipt['phase']+'.json')).write_text(json.dumps(receipt,indent=2)+'\n')
print(json.dumps({k:v for k,v in receipt.items() if k not in ('focusedManifest','sharedWALSingleConservativeUpperBound')}))
assert receipt['pass']
