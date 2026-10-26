import os,json,pathlib,subprocess,resource,hashlib,time,shlex
H=pathlib.Path('/tmp/thps2-installed-demo-gameplay-api-oct26'); O=H/'ops'; ROOT=pathlib.Path('/home/user/wine-assembly'); BOX='bx_xfbwmcty'
SSH='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
ENV=dict(os.environ,GIT_SSH_COMMAND=SSH,BOAT_NO_UPDATE='1')
def sha(p):
 h=hashlib.sha256()
 with open(p,'rb') as f:
  for b in iter(lambda:f.read(8192),b''):h.update(b)
 return h.hexdigest()
def save(n,v): (O/n).write_text(json.dumps(v,indent=2)+'\n')
def glimits():
 resource.setrlimit(resource.RLIMIT_DATA,(536870912,536870912));resource.setrlimit(resource.RLIMIT_CPU,(90,90));resource.setrlimit(resource.RLIMIT_FSIZE,(25165824,25165824))
def git(*a,cwd=ROOT):
 p=subprocess.run(['git','-C',str(cwd),*a],env=ENV,capture_output=True,timeout=120,preexec_fn=glimits)
 assert p.returncode==0,p.stderr[:8192]
 return p.stdout
def api(code,timeout=30):
 p=subprocess.run(['boat','exec','--json','--timeout',str(timeout),BOX,'--','python3','-c',code],env=ENV,capture_output=True,timeout=timeout+20)
 assert len(p.stdout)<=8192,(len(p.stdout),p.stderr[:1000])
 r=json.loads(p.stdout);assert r.get('exitCode')==0,r
 return r
def py(code,timeout=30):return json.loads(api(code,timeout)['stdout'])
def send(data,target,offset=0):
 import base64
 enc=base64.b64encode(data).decode(); dest=str(H/target)
 code=f'import os,base64,json; p={dest!r};os.makedirs(os.path.dirname(p),exist_ok=True);f=open(p,"r+b" if os.path.exists(p) else "wb");f.seek({offset});f.write(base64.b64decode({enc!r}));f.close();print("{{}}")'
 return api(code)
