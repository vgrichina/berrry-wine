import pathlib,os,json,hashlib,subprocess,resource,shutil,time,zlib
H=pathlib.Path('/tmp/gl-palette-fullvm-api-qualification-oct26'); O=H/'ops'; R=H/'repo'
ROOT=pathlib.Path('/home/user/wine-assembly'); D=pathlib.Path('/tmp/dashboard-sidebar-independent-publication-oct26/repo')
REV='7681b752d7c3fe565a49e92832c3d9825bec7ed9'; BR='task/'+H.name
SSH='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
BOX='bx_7tjybtxp'; REM='/tmp/palette-fullvm-oct26'
def sha(b):return hashlib.sha256(b).hexdigest()
def save(n,j):
 p=O/n;t=p.with_suffix(p.suffix+'.new');t.write_text(json.dumps(j,indent=2)+'\n');os.replace(t,p)
def lim(git=False):
 resource.setrlimit(resource.RLIMIT_CPU,(90,90));resource.setrlimit(resource.RLIMIT_FSIZE,(25165824,25165824))
 if git:resource.setrlimit(resource.RLIMIT_DATA,(536870912,536870912))
def run(a,cwd=H,git=False,input=None,cap=2097152):
 p=subprocess.run(a,cwd=cwd,input=input,capture_output=True,timeout=120,preexec_fn=lambda:lim(git),env=dict(os.environ,GIT_SSH_COMMAND=SSH,TMPDIR=str(O),BOAT_NO_UPDATE='1'))
 assert len(p.stdout)+len(p.stderr)<=cap
 if p.returncode:
  with (O/'incidents.jsonl').open('a') as f:f.write(json.dumps(dict(argv=a,exit=p.returncode,stdout=p.stdout.decode(errors='replace')[:8192],stderr=p.stderr.decode(errors='replace')[:8192]))+'\n')
 assert p.returncode==0,(a,p.returncode,p.stderr[:8192],p.stdout[:8192])
 return p.stdout
def g(*a,cwd=R):return run(['git','-c','gc.auto=0','-c','pack.threads=1','-c','pack.window=0','-c','pack.windowMemory=16m',*a],cwd,True)
def api(cmd,timeout=30):
 b=run(['boat','exec','--json','--timeout',str(timeout),BOX,cmd]);j=json.loads(b)
 with (O/'api-receipts.jsonl').open('a') as f:f.write(json.dumps(j)+'\n')
 assert j.get('exitCode')==0 and not j.get('stdoutTruncated') and not j.get('stderrTruncated'),j
 return j['stdout']
def alloc(p):
 return sum(q.lstat().st_blocks*512 for q in ([p,*p.rglob('*')] if p.is_dir() else [p]) if q.exists())
def gate(stage,remote=0):
 baseline=json.load(open(O/'db-baseline.json')); wal=sum(max(0,alloc(pathlib.Path(p))-v) for p,v in baseline.items())
 sessions=sum(alloc(p) for p in pathlib.Path('/home/user/.codex/sessions/2026/10/26').glob('*'+os.environ.get('CODEX_THREAD_ID','NONE')+'*'))
 charges=dict(hostOwned=alloc(H),remoteOwned=remote,launcher=alloc(ROOT/'scratch/usage-watch'/H.name),sessions=sessions,positiveWAL=wal,future=4194304,reserve=8388608)
 projection=max(60*1048576,sum(charges.values())); free=shutil.disk_usage(H).free;mem=int(pathlib.Path('/proc/meminfo').read_text().split('MemAvailable:')[1].split()[0])*1024
 j=dict(stage=stage,charges=charges,projection=projection,cap=67108864,hostFree=free,hostProjectedRemaining=free-projection,memAvailable=mem,requiredMem=2415919104)
 j['pass']=projection<=67108864 and free-projection>=2982150144 and mem>=2415919104;save('admission-'+stage+'.json',j);assert j['pass'],j
