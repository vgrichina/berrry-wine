import pathlib,os,json,hashlib,subprocess,resource,shutil,time
H=pathlib.Path('/tmp/enigma-presented-controller-independent-accept-oct26'); O=H/'ops'; R=H/'repo'
ROOT=pathlib.Path('/home/user/wine-assembly'); D=pathlib.Path('/tmp/enigma-presented-frame-controller-repair-oct26/repo')
REV='90a65119543037f17f5db17a2ef00880fc659c30'; BR='task/enigma-presented-controller-independent-accept-oct26'
SSH='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
NODE='/home/user/.nvm/versions/node/v24.18.1/bin/node'
def sha(b):return hashlib.sha256(b).hexdigest()
def save(n,j):
 p=O/n;t=p.with_suffix(p.suffix+'.new');t.write_text(json.dumps(j,indent=2)+'\n');os.replace(t,p)
def limits(git=False):
 resource.setrlimit(resource.RLIMIT_CPU,(90,90));resource.setrlimit(resource.RLIMIT_FSIZE,(25165824,25165824))
 if git:resource.setrlimit(resource.RLIMIT_DATA,(536870912,536870912))
def run(a,cwd=H,git=False,input=None,cap=2097152):
 p=subprocess.run(a,cwd=cwd,input=input,capture_output=True,timeout=120,preexec_fn=lambda:limits(git),env=dict(os.environ,GIT_SSH_COMMAND=SSH,TMPDIR=str(O)))
 assert len(p.stdout)+len(p.stderr)<=cap
 if git:
  with (O/'git-log.jsonl').open('a') as f:f.write(json.dumps(dict(argv=a,cwd=str(cwd),exit=p.returncode,stderr=p.stderr.decode()))+'\n')
 assert p.returncode==0,p.stderr[:8192]
 return p.stdout
def g(*a,cwd=R,input=None):return run(['git','-c','gc.auto=0','-c','pack.threads=1','-c','pack.window=0','-c','pack.windowMemory=16m',*a],cwd,True,input)
def alloc(p):
 seen=set();n=0
 for q in ([p,*p.rglob('*')] if p.is_dir() else [p]):
  if not q.exists():continue
  s=q.lstat();k=(s.st_dev,s.st_ino)
  if k not in seen:n+=s.st_blocks*512;seen.add(k)
 return n
def gate(stage):
 launch=ROOT/'scratch/usage-watch'/H.name
 clients=[]
 for p in pathlib.Path('/proc').glob('[0-9]*'):
  try:
   c=p.joinpath('cmdline').read_bytes()
   if b'/bin/codex' in c and (b'exec\0' in c or b'resume\0' in c):clients.append(dict(pid=int(p.name),rss=int(p.joinpath('status').read_text().split('VmRSS:')[1].split()[0])*1024))
  except (OSError,IndexError):pass
 baseline=json.loads((O/'db-baseline.json').read_text())
 wal=sum(max(0,alloc(pathlib.Path(p))-v) for p,v in baseline.items())
 sessions=sum(alloc(p) for p in pathlib.Path('/home/user/.codex/sessions/2026/10/26').glob('*'+os.environ.get('CODEX_THREAD_ID','NOSESSION')+'*'))
 charges=dict(owned=alloc(H),launcher=alloc(launch),sessions=sessions,positiveWAL=wal,future=4194304,reserve=8388608)
 projection=max(33554432,sum(charges.values()));free=shutil.disk_usage(H).free;mem=int(pathlib.Path('/proc/meminfo').read_text().split('MemAvailable:')[1].split()[0])*1024
 j=dict(stage=stage,charges=charges,projectedBytes=projection,cap=67108864,hostFree=free,hostProjectedRemaining=free-projection,memAvailable=mem,clients=clients,aggregateClientRSS=sum(x['rss'] for x in clients),newClientsReserve=1073741824,prospectiveNodeAndHeadroom=335544320,memoryFloor=805306368)
 j['pass']=projection<=67108864 and free-projection>=2982150144 and mem-1073741824-3*335544320>=805306368
 save('admission-'+stage+'.json',j);assert j['pass'],j
