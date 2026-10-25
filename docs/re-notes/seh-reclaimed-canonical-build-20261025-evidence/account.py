import pathlib,json,os,time,hashlib,shutil,sys
T=pathlib.Path(__file__).resolve().parent.parent; O=T/'ops'; H=pathlib.Path('/home/user/.codex')
EXT=pathlib.Path('/home/user/wine-assembly/scratch/usage-watch/seh-reclaimed-canonical-build-oct25')
def rows(paths):
 out=[];seen=set()
 for p in paths:
  if not p.is_file() or p.is_symlink():continue
  s=p.stat();key=(s.st_dev,s.st_ino)
  if key in seen:continue
  seen.add(key);out.append(dict(path=str(p),bytes=s.st_size,allocated=s.st_blocks*512))
 return out
def size(a):return sum(max(x['bytes'],x['allocated']) for x in a)
baseline=O/'sqlite-baseline.json'
if not baseline.exists():baseline.write_text(json.dumps({str(p):p.stat().st_size for p in H.glob('*.sqlite')}))
initial=json.loads(baseline.read_text())
owned=rows(T.rglob('*'));launch=rows(EXT.rglob('*'));session=rows((H/'sessions/2026/10/25').glob('*'+os.environ['CODEX_SESSION_ID']+'.jsonl'));shared=rows([p for pattern in ['*.sqlite-wal','*.sqlite-shm'] for p in H.glob(pattern)])
repo=size(rows((T/'repo').rglob('*')));mods=size(rows(O.glob('*.wasm')))
charges=dict(owned=size(owned),externalLauncher=size(launch),currentSession=size(session),fullSharedWALSHM=size(shared),positiveDBGrowth=sum(max(0,pathlib.Path(p).stat().st_size-n) for p,n in initial.items()),board=8192,futureSparseGit=max(0,2097152-repo),futureBothModules=max(0,6291456-mods),futureOps=max(0,1048576-(size(owned)-repo-mods)),futurePublication=6291456,futureSessionLauncher=8388608,futureDB=4194304,reserve=8388608)
if (O/'outputs.json').exists():charges['futureBothModules']=0
if (O/'publication-complete.json').exists():charges['futurePublication']=0
free=shutil.disk_usage(T).free; mem=int(next(x.split()[1] for x in open('/proc/meminfo') if x.startswith('MemAvailable')))*1024
peak=sum(charges.values()); future=sum(v for k,v in charges.items() if k.startswith('future') or k=='reserve')
tools=[]
for name in ['node','git','python3','ssh']:
 p=pathlib.Path(shutil.which(name)).resolve();tools.append(dict(name=name,path=str(p),bytes=p.stat().st_size,sha256=hashlib.sha256(p.read_bytes()).hexdigest(),newBytes=0))
d=dict(at=time.time(),charges=charges,peak=peak,cap=67108864,free=free,conservativeFreeAfterWholeAllocation=free-67108864,afterFuture=free-future,floor=2982150144,memAvailable=mem,minimumMemory=2684354560,passAdmission=peak<=67108864 and free-67108864>=2982150144 and (len(sys.argv)<2 or sys.argv[1]!='admission-precheckout.json' or free>=3676782592) and mem>=2684354560,manifest=dict(owned=owned,launcher=launch,session=session,fullSharedWALSHM=shared),standingTools=tools,standingInputs='Immutable donor and standing canonical closure/compiler used read-only in place; streamed Git overlays in memory. No full tree or object copies.',limits=dict(compilerCPUWall=900,oldSpaceMiB=2048,cheapCPUWall=60,cheapHeapMiB=256,compilerOutput=524288,cheapOutput=131072,fileMax=25165824,reapSeconds=5,reserve=8388608),commands=dict(checkout='python3 ops/setup.py: explicit sparse checkout, flattened readonly alternates',compiler='node --max-old-space-size=2048 ops/build.cjs (compileClosure true and compat false)',module='node --max-old-space-size=2048 --require PINNED_GUARD PINNED_QUALIFIER OUTPUT SHA, one per output',static='python3 ops/inspect.py, imports/exports/types/noStart/layout/data bounds, no instances',publication='strict dedicated SSH git push task branch only'),previousDiskDenial='2678181888-byte failed coordinator sample retained in scratch; capacity not assumed stable',noGuest=True,noMounts=True)
(O/(sys.argv[1] if len(sys.argv)>1 else 'admission.json')).write_text(json.dumps(d,indent=2)+'\n')
print(json.dumps({k:d[k] for k in ['charges','peak','free','conservativeFreeAfterWholeAllocation','memAvailable','passAdmission']}));sys.exit(0 if d['passAdmission'] else 3)
