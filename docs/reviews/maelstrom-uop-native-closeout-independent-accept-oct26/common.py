import pathlib,json,hashlib,subprocess,os,resource,time,shutil
H=pathlib.Path(__file__).resolve().parent.parent; O=H/'ops'; R=H/'repo'
D=pathlib.Path('/tmp/maelstrom-uop-retained-native-closeout-oct26/repo')
E=D/'docs/reviews/maelstrom-uop-retained-native-closeout-oct26'
ROOT=pathlib.Path('/home/user/wine-assembly'); C=pathlib.Path('/home/user/.codex')
L=ROOT/'scratch/usage-watch'/H.name
SHA='2531492fd4c99033e50fb36a0fd0d2df1292ee77'; INTEGRATION='e745cc29a1a3b859625aa0cd335abee0b185da71'
SSH='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
def save(n,j):
 p=O/n; t=p.with_suffix(p.suffix+'.tmp');t.write_text(json.dumps(j,indent=2)+'\n');t.replace(p)
def sha(b):return hashlib.sha256(b).hexdigest()
def limits():
 resource.setrlimit(resource.RLIMIT_DATA,(536870912,536870912));resource.setrlimit(resource.RLIMIT_CPU,(60,60));resource.setrlimit(resource.RLIMIT_FSIZE,(25165824,25165824))
def run(argv,cwd=R):
 p=subprocess.run(argv,cwd=cwd,env=dict(os.environ,GIT_SSH_COMMAND=SSH),capture_output=True,timeout=65,preexec_fn=limits)
 assert len(p.stdout)+len(p.stderr)<=2097152,'capture gate'
 if p.returncode:
  save('last-command-failure.json',dict(argv=argv,returncode=p.returncode,stderr=p.stderr[:8192].decode(errors='replace')))
 assert p.returncode==0,(argv,p.returncode,p.stderr[:8192].decode(errors='replace'))
 return p.stdout
def git(*a,cwd=R):return run(['git',*a],cwd).decode().strip()
def alloc(p):return max(p.stat().st_size,p.stat().st_blocks*512)
def size(p):return sum(alloc(f) for f in p.rglob('*') if f.is_file() and not f.is_symlink())
def admit(name,publication=False):
 baseline=json.loads((O/'db-baseline.json').read_text());sessions=list((C/'sessions/2026/10/26').glob('*01a17747-e0f9-7532-9d40-e3c6ac520893.jsonl'));assert len(sessions)==1
 charges=dict(owned=size(H),launcher=size(L),session=sum(alloc(p) for p in sessions),positiveDB=sum(max(0,pathlib.Path(p).stat().st_size-v) for p,v in baseline.items()),WALSHM=sum(alloc(p) for p in C.glob('*.sqlite-*')),futureCheckoutGitEvidencePublication=8*1048576,futureSessionLauncherDB=8*1048576,reserve=8*1048576)
 mem=int(next(l.split()[1] for l in open('/proc/meminfo') if l.startswith('MemAvailable')))*1024;free=shutil.disk_usage(H).free
 needed=536870912+16777216+(536870912 if publication else 0)
 j=dict(at=time.time(),charges=charges,peak=sum(charges.values()),cap=67108864,memAvailable=mem,allocatedRAM=needed,remainingFloor=805306368,diskFree=free,growth=58720256,diskFloor=2982150144,passChecks=sum(charges.values())<=67108864 and mem-needed>=805306368 and free-58720256>=2982150144,standingReadonlyDonorObjects='excluded, links resolve to donor object bytes; never written',tools={x:shutil.which(x) for x in ['git','python3','node','ssh']})
 save(name,j);assert j['passChecks'],'fresh admission failed';return j
