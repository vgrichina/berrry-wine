import os,pathlib,json,hashlib,subprocess,resource,time,signal,shutil
H=pathlib.Path('/tmp/gl-palette-current-webgl-qualification-oct26'); O=H/'ops'; S=H/'source'; ROOT=pathlib.Path('/home/user/wine-assembly')
L=ROOT/'scratch/usage-watch'/H.name
REV='754c97d3ff22ce0a0cd06d08ac06dc0446fbcbb2'
SSH='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
NODE='/usr/local/bin/node'
ENV=dict(os.environ,NODE_PATH='/tmp/wa-local-runtime-deps/node_modules',CHROME='/usr/bin/google-chrome',TMPDIR=str(H/'tmp'),PALETTE_GPU_EVIDENCE=str(O/'test-result.json'),GIT_SSH_COMMAND=SSH,GIT_CONFIG_COUNT='1',GIT_CONFIG_KEY_0='gc.auto',GIT_CONFIG_VALUE_0='0')
def sha(b):return hashlib.sha256(b).hexdigest()
def save(n,x): (O/n).write_text(json.dumps(x,indent=2)+'\n')
def alloc(p):
 try: return sum(q.lstat().st_blocks*512 for q in [p,*p.rglob('*')] if not q.is_symlink()) if p.is_dir() else p.lstat().st_blocks*512
 except FileNotFoundError:return 0
def limits(git=False):
 resource.setrlimit(resource.RLIMIT_CPU,(90,90));resource.setrlimit(resource.RLIMIT_FSIZE,(25165824,25165824))
 if git:resource.setrlimit(resource.RLIMIT_DATA,(536870912,536870912))
def run(a,cwd=H,git=False):
 p=subprocess.run(a,cwd=cwd,env=ENV,capture_output=True,timeout=120,preexec_fn=lambda:limits(git))
 assert len(p.stdout)+len(p.stderr)<=2097152
 assert p.returncode==0,(a,p.returncode,p.stderr[:8192].decode(errors='replace'))
 return p.stdout
def g(*a,cwd=S):return run(['git','-c','gc.auto=0','-c','maintenance.auto=false','-c','pack.threads=1',*a],cwd,True)
def verify():
 p=json.load(open(ROOT/'scratch/usage-watch/gl-palette-current-webgl-closure-plan-oct26.json')); rows=[]
 assert p['revision']==REV and len(p['files'])==149 and not p['missing']
 for r in p['files']:
  b=(S/r['path']).read_bytes(); blob=hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()
  assert len(b)==r['bytes'] and sha(b)==r['sha256'] and blob==r['blob'],r
  rows.append(r)
 return dict(originalMainRevision=REV,files=rows,verified=149)
def accounting():
 base=json.load(open(O/'db-baseline.json'))
 wal=sum(max(0,alloc(pathlib.Path(p))-n) for p,n in base.items())
 sessions=sum(alloc(p) for p in pathlib.Path('/home/user/.codex/sessions/2026/10/26').glob('*'+os.environ.get('CODEX_THREAD_ID','NONE')+'*'))
 c=dict(taskRoot=alloc(H),launcher=alloc(L),session=sessions,positiveWALOnce=wal,future=4194304,reserve=8388608)
 return c
def gate(name,initial=False):
 c=accounting();used=sum(c.values());free=shutil.disk_usage(H).free
 mem=int(pathlib.Path('/proc/meminfo').read_text().split('MemAvailable:')[1].split()[0])*1024
 incremental=max(0,used-c['taskRoot']-c['launcher']-c['session']-c['positiveWALOnce'])
 j=dict(charges=c,total=used,cap=67108864,free=free,projectedFree=free-incremental,floor=2982150144,MemAvailable=mem,requiredMemory=2952790016,alreadyLiveClientChargedThroughMemAvailable=True)
 j['pass']=used<=67108864 and free-incremental>=2982150144 and (mem>=2952790016 if initial else True)
 save('admission-'+name+'.json',j);assert j['pass'],j
 return j
