import pathlib,subprocess,json,os,hashlib,shutil,time,shlex,base64,zlib
H=pathlib.Path(__file__).parent
P=pathlib.Path('/tmp/enigma-provider-complete-startup-oct24')
R=str(P)
BOX='bx_784z5j62'; B='/home/user/.ascii/boat'
SSH='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
def save(n,j):
 p=H/n;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(j,indent=2)+'\n')
def sha(b):return hashlib.sha256(b).hexdigest()
def remote(cmd,timeout=30):
 assert len(cmd.encode())<=36000
 p=subprocess.run([B,'--no-update','--json','exec','--timeout',str(timeout),BOX,cmd],capture_output=True,text=True,timeout=timeout+15)
 with (H/'api-history.jsonl').open('a') as f:f.write(json.dumps(dict(at=time.time(),requestBytes=len(cmd.encode()),responseBytes=len(p.stdout.encode())+len(p.stderr.encode()),commandSHA256=sha(cmd.encode())))+'\n')
 try:j=json.loads(p.stdout)
 except Exception:save('first-rejection.json',dict(status=p.returncode,stdout=p.stdout,stderr=p.stderr));raise
 if p.returncode or j.get('exitCode')!=0 or j.get('stdoutTruncated') or j.get('stderrTruncated'):
  save('first-rejection.json',j);raise RuntimeError(str(j)[:1200])
 return j
def py(code,timeout=30):return remote('python3 -c '+shlex.quote(code),timeout)
def payload(x):
 return subprocess.check_output(['git','-C',x['donor'],'show',x['revision']+':'+x['path']],stderr=subprocess.DEVNULL) if x['kind']=='git' else pathlib.Path(x['path']).read_bytes()
def allocated(p):
 if not p.exists():return 0
 if p.is_file():return max(p.stat().st_size,p.stat().st_blocks*512)
 return p.stat().st_blocks*512+sum(allocated(x) for x in p.iterdir() if not x.is_symlink())
def measure(stage):
 a=json.load(open(H/'admission.json'));C=pathlib.Path('/home/user/.codex');base=json.load(open(H/'sqlite-baseline.json'))
 charges=dict(localOwned=allocated(H),sessionFull=allocated(pathlib.Path(a['session'])),launcherFull=sum(allocated(pathlib.Path(a['launcher']+s)) for s in ['', '-dispatch.json','.task.txt']),sqliteBeforeBaseline=1048576,sqlitePositive=sum(max(0,allocated(p)-base.get(str(p),0)) for p in C.glob('*.sqlite*') if p.is_file()),remoteMaterialized=43741184,remoteHelpersEvidence=2097152,transferOverlap=262144,gitFuture=524288,externalFuture=1048576,reserve=8388608)
 peak=sum(charges.values());free=shutil.disk_usage(H).free;r=json.load(open(H/'remote-admission.json'));rf=json.loads(r['stdout'])['free']
 j=dict(stage=stage,charges=charges,peak=peak,cap=67108864,sourceFree=free,sourceAfter=free-peak,remoteFree=rf,remoteAfter=rf-peak,passAdmission=peak<=67108864 and min(free,rf)-peak>=2982150144);save('resource-'+stage+'.json',j);assert j['passAdmission'],j;return j
