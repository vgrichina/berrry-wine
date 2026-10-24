import pathlib,subprocess,json,os,hashlib,shutil,time,shlex,base64,zlib,resource
H=pathlib.Path(__file__).parent
P=pathlib.Path('/tmp/enigma-provider-complete-startup-oct24')
Q=pathlib.Path('/tmp/enigma-quiet-filesystem-startup-oct24')
D=pathlib.Path('/tmp/enigma-supervisor-independent-integrate-oct24/repo')
R=str(P); BOX='bx_jhed6zf3';B='/home/user/.ascii/boat'
REV='35a4a4e59fb2c76f9590b456ef7873e14271862a'
SSH='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
def sha(b):return hashlib.sha256(b).hexdigest()
def save(n,j):
 p=H/n;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(j,indent=2)+'\n')
def allocated(p):
 if not p.exists():return 0
 if p.is_symlink():return p.lstat().st_blocks*512
 if p.is_file():return max(p.stat().st_size,p.stat().st_blocks*512)
 return p.stat().st_blocks*512+sum(allocated(x) for x in p.iterdir())
def remote(cmd,timeout=30,allow_exit=False):
 assert len(cmd.encode())<=36000
 p=subprocess.run([B,'--no-update','--json','exec','--timeout',str(timeout),BOX,cmd],capture_output=True,text=True,timeout=timeout+15)
 with (H/'api-history.jsonl').open('a') as f:f.write(json.dumps(dict(at=time.time(),command=cmd if len(cmd)<2000 else None,commandSHA256=sha(cmd.encode()),requestBytes=len(cmd.encode()),responseBytes=len(p.stdout.encode())+len(p.stderr.encode())))+'\n')
 try:j=json.loads(p.stdout)
 except Exception:save('first-rejection.json',dict(status=p.returncode,stdout=p.stdout,stderr=p.stderr));raise
 if p.returncode or (j.get('exitCode')!=0 and not allow_exit) or j.get('stdoutTruncated') or j.get('stderrTruncated'):
  save('first-rejection.json',j);raise RuntimeError('remote rejection retained')
 return j
def py(code,timeout=30):return remote('python3 -c '+shlex.quote(code),timeout)
def payload(x):
 return subprocess.check_output(['git','-C',x['donor'],'show',x['revision']+':'+x['path']],stderr=subprocess.DEVNULL) if x['kind']=='git' else pathlib.Path(x['path']).read_bytes()
def toolbytes(p):
 total=0
 for line in p.read_text().splitlines():
  try:j=json.loads(line).get('payload',{})
  except ValueError:continue
  out=j.get('output','')
  if j.get('type') in ['custom_tool_call_output','function_call_output']:
   total+=len(out.encode()) if isinstance(out,str) else sum(len(x.get('text','').encode()) for x in out if isinstance(x,dict))
 return total

def measure(stage):
 a=json.load(open(H/'admission.json'));C=pathlib.Path('/home/user/.codex');base=json.load(open(H/'sqlite-baseline.json'))
 sqlite=sum(max(0,allocated(p)-base.get(str(p),0)) for p in C.glob('*.sqlite*') if p.is_file())
 previous=json.load(open(H/'sqlite-highwater.json'))['bytes'] if (H/'sqlite-highwater.json').exists() else 0
 sqlite=max(sqlite,previous);save('sqlite-highwater.json',dict(bytes=sqlite))
 charges=dict(localOwned=allocated(H),sessionFull=allocated(pathlib.Path(a['session'])),launcherFull=sum(allocated(pathlib.Path(a['launcher']+s)) for s in ['', '-dispatch.json','.task.txt']),sqlitePrebaseline=1048576,sqlitePositiveHighwater=sqlite,sqliteFuture=524288,remoteMaterialized=43741184,remoteHelpersEvidence=2097152,transferOverlap=262144,gitPublicationFuture=1048576,externalFuture=1048576,reserve=8388608)
 peak=sum(charges.values());free=shutil.disk_usage(H).free;rf=json.loads(json.load(open(H/'remote-admission.json'))['stdout'])['free']
 largest=max((p.stat().st_size for p in H.rglob('*') if p.is_file()),default=0)
 j=dict(stage=stage,charges=charges,peak=peak,cap=67108864,sourceFree=free,sourceAfter=free-peak,remoteFree=rf,remoteAfter=rf-peak,largestLocal=largest,passAdmission=peak<=67108864 and min(free,rf)-peak>=2982150144 and largest<=25165824)
 save('resource-'+stage+'.json',j)
 sp=pathlib.Path(a['session']);new=toolbytes(sp)+sum(x['responseBytes'] for x in map(json.loads,(H/'api-history.jsonl').read_text().splitlines()))
 save('capture-current.json',dict(newCharged=new,newAllowance=2097152,prior=json.load(open(H/'capture-history.json')),passNew=new<=2097152,method='full tool text plus full remote JSON; conservative overlap; historical charges retained'))
 assert new<=2097152,'new capture denial';assert j['passAdmission'],j
 return j
