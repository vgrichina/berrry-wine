import os,sys,json,pathlib,subprocess,hashlib,time,shutil,resource,shlex,base64,zlib,gzip
H=pathlib.Path('/tmp/alien-shooter-required-exe-gameplay-api-oct26');O=H/'ops';ROOT=pathlib.Path('/home/user/wine-assembly');R=str(H);BOX='bx_a9dwsx2x'
NODE='/home/user/.nvm/versions/node/v24.22.1/bin/node'
SSH='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
def sha(b):return hashlib.sha256(b).hexdigest()
def save(n,j):
 p=O/n;p.write_text(json.dumps(j,indent=2)+'\n')
def allocated(p):
 if not p.exists():return 0
 return sum(x.lstat().st_blocks*512 for x in ([p,*p.rglob('*')] if p.is_dir() else [p]))
def remote(cmd,timeout=30,detach=False):
 cmd='timeout 120 prlimit --cpu=90 --fsize=25165824 -- sh -c '+shlex.quote(cmd)
 assert len(cmd.encode())<=60000
 a=['boat','--no-update','--json','exec']+(['--detach'] if detach else ['--timeout',str(timeout)])+[BOX,cmd]
 p=subprocess.run(a,capture_output=True,text=True,timeout=timeout+15)
 assert len(p.stdout.encode())+len(p.stderr.encode())<=8192
 j=json.loads(p.stdout)
 with (O/'api-history.jsonl').open('a') as f:f.write(json.dumps(dict(at=time.time(),command=cmd if len(cmd)<1500 else None,sha256=sha(cmd.encode()),requestBytes=len(cmd.encode()),responseBytes=len(p.stdout.encode())))+'\n')
 if p.returncode or (not detach and j.get('exitCode')!=0) or j.get('stdoutTruncated') or j.get('stderrTruncated'):
  save('first-api-failure.json',j);raise RuntimeError('first API failure; no unchanged retry')
 return j
def py(code,**kw):return remote('python3 -c '+shlex.quote(code),**kw)
def transfer(items):
 batch=[];size=0
 def flush():
  nonlocal batch,size
  if not batch:return
  code='import pathlib,base64,zlib,hashlib,os\nh=pathlib.Path('+repr(R)+')\n'
  for path,off,mode,data in batch:
   enc=base64.b64encode(zlib.compress(data)).decode()
   code+='p=h/'+repr(path)+';p.parent.mkdir(parents=True,exist_ok=True);b=zlib.decompress(base64.b64decode('+repr(enc)+'));assert hashlib.sha256(b).hexdigest()=='+repr(sha(data))+';p.open('+repr('wb' if off==0 else 'ab')+').write(b);os.chmod(p,'+str(mode)+')\n'
  py(code);batch=[];size=0
 for target,p in items:
  mode=p.stat().st_mode&0o777
  with p.open('rb') as f:
   off=0
   while b:=f.read(30000):
    n=len(base64.b64encode(zlib.compress(b)))+600
    if size+n>48000:flush()
    batch.append((target,off,mode,b));size+=n;off+=len(b)
 flush()
def glimits():
 resource.setrlimit(resource.RLIMIT_DATA,(536870912,536870912));resource.setrlimit(resource.RLIMIT_CPU,(90,90));resource.setrlimit(resource.RLIMIT_FSIZE,(25165824,25165824))
def git(*args,repo=H/'repo'):
 a=['git','-c','gc.auto=0','-c','pack.threads=1','-c','pack.window=0','-C',str(repo),*args]
 p=subprocess.run(a,capture_output=True,text=True,timeout=120,preexec_fn=glimits,env=dict(os.environ,GIT_SSH_COMMAND=SSH))
 with (O/'git.jsonl').open('a') as f:f.write(json.dumps(dict(argv=a,exit=p.returncode,stdout=p.stdout,stderr=p.stderr))+'\n')
 assert p.returncode==0,p.stderr
 return p.stdout.strip()
