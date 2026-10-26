import pathlib,json,os,sys,time,shutil
H=pathlib.Path(__file__).resolve().parent.parent;O=H/'ops';C=pathlib.Path('/home/user/.codex')
def files(root):
 seen=set();rows=[]
 for p in root.rglob('*'):
  if not p.is_file() or p.is_symlink():continue
  s=p.stat();key=(s.st_dev,s.st_ino)
  if key in seen:continue
  seen.add(key);rows.append(dict(path=str(p),bytes=s.st_size,allocated=max(s.st_size,s.st_blocks*512)))
 return rows
def total(rows):return sum(r['allocated'] for r in rows)
owned=files(H);launcher=files(pathlib.Path('/home/user/wine-assembly/scratch/usage-watch/maelstrom-errno-api-canonical-native-oct25'))
session=[p for p in (C/'sessions/2026/10/25').glob('*01a17571-c3ee-7aa3-b392-95a660b7f8a7.jsonl')]
wal=[p for p in C.glob('*.sqlite-wal')];shm=[p for p in C.glob('*.sqlite-shm')];base=json.load(open(O/'sqlite-baseline.json'))
alloc=lambda p:max(p.stat().st_size,p.stat().st_blocks*512)
initial=json.load(open(O/'admission-precheckout.json'));ic=initial['charges']
remoteProjection=sum(ic[k] for k in ['remoteCompiler','remoteSourceBundle','remoteAuthenticAnchors','remoteBothModules','remoteScriptsEvidence'])+262144
if (O/'remote-size.json').exists():
 remote=json.load(open(O/'remote-size.json'));remoteProjection=max(remoteProjection,remote['allocated'])
done=(O/'execution-complete.json').exists()
if done and (O/'remote-size.json').exists():remoteProjection=json.load(open(O/'remote-size.json'))['allocated']+65536
charges=dict(owned=total(owned),launcher=total(launcher),session=sum(alloc(p) for p in session),sharedWAL=sum(alloc(p) for p in wal),sharedSHM=sum(alloc(p) for p in shm),positiveSQLite=sum(max(0,pathlib.Path(p).stat().st_size-n) for p,n in base.items()),remoteTotalIncludingFutures=remoteProjection,futureLocalEvidence=196608 if (O/'publication-plan.json').exists() else 524288 if done else 1048576,futurePublication=524288 if (O/'commit.json').exists() else 2097152 if done else 1048576,futureSessionLauncherDB=1048576 if done else 4194304,board=4096,reserve=8388608)
free=shutil.disk_usage(H).free;mem=int(next(l.split()[1] for l in open('/proc/meminfo') if l.startswith('MemAvailable')))*1024
peak=sum(charges.values());d=dict(at=time.time(),charges=charges,peak=peak,cap=67108864,memAvailable=mem,minimumMemory=1073741824,free=free,afterProjection=free-sum(charges[k] for k in charges if k.startswith('future'))-8388608,passChecks=peak<=67108864 and mem>=1073741824 and free-peak>=2982150144,manifest=owned,standing='readonly donor/installed tools reused; no object store copying; compressed remote source bytes charged once on each host')
(O/(sys.argv[1] if len(sys.argv)>1 else 'resource-current.json')).write_text(json.dumps(d,indent=2));print(json.dumps({k:d[k] for k in ['charges','peak','memAvailable','free','passChecks']}));assert d['passChecks']
