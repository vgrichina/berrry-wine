import pathlib,json,os,shutil,sys
base=pathlib.Path('/tmp/gfx-equal-pixel-independent-accept-oct25');ops=base/'ops'
def allocated(root):
 total=0
 for d,dirs,files in os.walk(root,followlinks=False):
  total+=os.lstat(d).st_blocks*512
  for n in files:total+=os.lstat(os.path.join(d,n)).st_blocks*512
 return total
pre=json.load(open(ops/'preflight.json'))
launch=pathlib.Path('/home/user/wine-assembly/scratch/usage-watch/gfx-equal-pixel-independent-accept-oct25')
session=pathlib.Path('/home/user/.codex/sessions/2026/10/25/rollout-2026-10-25T22-08-01-01a1751b-3ca1-7703-95ad-214a3f7e369f.jsonl')
growth={str(p):max(0,p.stat().st_size-pre['sharedDBWALBaseline'].get(str(p),0)) for p in pathlib.Path('/home/user/.codex').glob('*.sqlite*')}
parts={'ownTaskTreeAllocated':allocated(base),'launcherAllocated':allocated(launch),'sessionAllocated':session.stat().st_blocks*512,'positiveSharedDBWALGrowth':sum(growth.values()),'sharedReadonlyViewMetadataCharge':1789952,'futurePublicationAndLogGrowthAllowance':8388608,'futureReserve':8388608}
total=sum(parts.values());free=shutil.disk_usage(base).free;mem=int(next(x.split()[1] for x in open('/proc/meminfo') if x.startswith('MemAvailable:')))*1024
standing={n:{'path':str(pathlib.Path(p).resolve()),'bytes':pathlib.Path(p).stat().st_size} for n,p in pre['tools'].items()}
r={'parts':parts,'projectedTotalBytes':total,'allocationBytes':67108864,'positiveSharedDBWALGrowth':growth,'diskFreeBytes':free,'floorBytes':2982150144,'volatilityBytes':627523584,'availableMemoryBytes':mem,'standingTools':standing,'standingReadonlySourceBytes':sum(v['bytes'] for v in pre['pins'].values()),'standingObjectBytesCopied':0,'captureTaskLogsBytes':sum(p.stat().st_size for p in ops.glob('*.log')),'pass':total<=67108864 and free-16777216>=2982150144+627523584 and mem>=1073741824}
(ops/(sys.argv[1] if len(sys.argv)>1 else 'publication-resource.json')).write_text(json.dumps(r,indent=2)+'\n');assert r['pass'],r
print(json.dumps({'resourceGate':'PASS','projectedBytes':total,'allocationBytes':67108864,'diskFreeBytes':free}))
