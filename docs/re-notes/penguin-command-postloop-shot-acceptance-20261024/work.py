import pathlib,subprocess,json,os,hashlib,shutil,time,shlex,base64,zlib
H=pathlib.Path(__file__).parent
OLD=pathlib.Path('/tmp/penguin-immediate-shot-state-oct24')
PRE=pathlib.Path('/tmp/penguin-cannon-block-decision-oct24')
D=pathlib.Path('/tmp/input-consumption-clock-independent-closeout-oct24/repo')
REV='5691793a58b4670fd2a621114d7926100a1e47de'
BRANCH='task/penguin-postloop-shot-acceptance-oct24'
BOX='bx_fq6tc9p2'; B='/home/user/.ascii/boat'
E=H/'repo/docs/re-notes/penguin-command-postloop-shot-acceptance-20261024'
def save(n,j):
 p=H/n;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(j,indent=2)+'\n')
def sha(b):return hashlib.sha256(b).hexdigest()
def remote(cmd,timeout=30):
 assert len(cmd.encode())<=36000
 p=subprocess.run([B,'--no-update','--json','exec','--timeout',str(timeout),BOX,cmd],capture_output=True,text=True,timeout=timeout+15)
 j=json.loads(p.stdout)
 with (H/'api-history.jsonl').open('a') as f:f.write(json.dumps(dict(at=time.time(),requestBytes=len(cmd.encode()),responseBytes=len(p.stdout.encode())+len(p.stderr.encode()),commandSHA256=sha(cmd.encode()),commandId=j.get('commandId')))+'\n')
 if p.returncode or j.get('exitCode')!=0 or j.get('stdoutTruncated') or j.get('stderrTruncated'):
  save('first-rejection.json',j);raise RuntimeError(str(j)[:1500])
 return j
def py(code,timeout=30):return remote('python3 -c '+shlex.quote(code),timeout)
def git(*a):return subprocess.check_output(['git','-C',str(H/'repo'),*a],stderr=subprocess.DEVNULL).decode().strip()
def payload(x):
 return subprocess.check_output(['git','-C',str(D),'show',REV+':'+x['path']],stderr=subprocess.DEVNULL) if x['kind']=='git' else pathlib.Path(x['path']).read_bytes()
def size(p):return sum(x.stat().st_size for x in p.rglob('*') if x.is_file())
def account(stage):
 C=pathlib.Path('/home/user/.codex');base=json.load(open(H/'sqlite-baseline.json'))
 sessions=list(C.glob('sessions/2026/10/24/*'+os.environ['CODEX_THREAD_ID']+'*'));assert len(sessions)==1
 charges=dict(localOwned=size(H),sessionFull=sessions[0].stat().st_size,launcher=size(pathlib.Path('/home/user/wine-assembly/scratch/usage-watch/penguin-postloop-shot-acceptance-oct24')),sqlitePositive=sum(max(0,p.stat().st_size-base.get(str(p),0)) for p in C.glob('*.sqlite*') if p.is_file()),remoteClosure=15760340,remoteHelpersEvidence=2500000,transportAndGitFuture=4000000,externalFuture=16000000,reserve=8388608)
 peak=sum(charges.values());free=shutil.disk_usage('/tmp').free
 j=dict(charges=charges,peak=peak,cap=67108864,free=free,after=free-peak,passAdmission=peak<=67108864 and free-peak>=2982150144)
 save('resource-'+stage+'.json',j);assert j['passAdmission'];return j
if __name__=='__main__':
 save('sqlite-baseline.json',{str(p):p.stat().st_size for p in pathlib.Path('/home/user/.codex').glob('*.sqlite*') if p.is_file()})
 m=json.load(open(OLD/'manifest.json'));assert len(m)==291 and sum(x['bytes'] for x in m)==15760340
 tools=[]
 for t in [B,shutil.which('git'),shutil.which('python3'),shutil.which('node')]:
  p=pathlib.Path(t).resolve();tools.append(dict(path=str(p),bytes=p.stat().st_size,sha256=sha(p.read_bytes())))
 a=account('initial');r=json.loads(py('import pathlib,json,os;print(json.dumps(dict(free=os.statvfs("/tmp").f_bavail*os.statvfs("/tmp").f_frsize,memAvailable=int(next(x.split()[1] for x in pathlib.Path("/proc/meminfo").read_text().splitlines() if x.startswith("MemAvailable:")))*1024)))')['stdout'])
 assert r['free']-a['peak']>=2982150144 and r['memAvailable']>=2684354560
 save('admission.json',dict(**a,remote=r,toolsStanding=tools,donorManifest=str(OLD/'manifest.json'),standingInputBytes=15760340,files=291,maxFile=max(x['bytes'] for x in m),internalPriorConservative=100000,internalCap=1048576,retainedHistory=True,sourceCPU=60,sourceOldspace=256,sourceMemory=805306368,guestRemoteOnly=True))
 repo=H/'repo';subprocess.run(['git','init','-q',str(repo)],check=True)
 objects=[];queue=[D/'.git/objects']
 while queue:
  o=queue.pop().resolve()
  if str(o) in objects:continue
  objects.append(str(o));a=o/'info/alternates'
  if a.exists():queue.extend((o/x).resolve() if not x.startswith('/') else pathlib.Path(x) for x in a.read_text().splitlines())
 (repo/'.git/objects/info/alternates').write_text('\n'.join(objects)+'\n')
 git('config','core.sparseCheckout','true');(repo/'.git/info/sparse-checkout').write_text('/docs/re-notes/penguin-command-postloop-shot-acceptance-20261024.md\n/docs/re-notes/penguin-command-postloop-shot-acceptance-20261024/\n')
 git('update-ref','refs/heads/'+BRANCH,REV);git('symbolic-ref','HEAD','refs/heads/'+BRANCH);git('read-tree','-mu','HEAD');git('remote','add','origin','git@github.com:vgrichina/wine-assembly.git');E.mkdir(parents=True)
 save('manifest.json',m)
 print('ADMITTED',json.dumps(r),flush=True)
