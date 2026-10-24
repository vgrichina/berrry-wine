import pathlib,subprocess,json,os,hashlib,shutil,time,shlex,base64,zlib
H=pathlib.Path(__file__).parent
OLD=pathlib.Path('/tmp/penguin-integrated-clock-firing-oct24')
D=pathlib.Path('/tmp/input-consumption-clock-independent-closeout-oct24/repo')
R=str(H);BOX='bx_rcsfy9bm';B='/home/user/.ascii/boat'
REV='5691793a58b4670fd2a621114d7926100a1e47de'
BRANCH='task/penguin-immediate-shot-state-oct24'
E=H/'repo/docs/re-notes/penguin-command-immediate-shot-state-20261024'
def save(n,j):
 p=H/n;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(j,indent=2)+'\n')
def sha(b):return hashlib.sha256(b).hexdigest()
def remote(cmd,timeout=30):
 assert len(cmd.encode())<=36000
 p=subprocess.run([B,'--no-update','--json','exec','--timeout',str(timeout),BOX,cmd],capture_output=True,text=True,timeout=timeout+15)
 j=json.loads(p.stdout)
 with (H/'api-history.jsonl').open('a') as f:f.write(json.dumps(dict(at=time.time(),requestBytes=len(cmd.encode()),responseBytes=len(p.stdout.encode())+len(p.stderr.encode()),commandSHA256=sha(cmd.encode()),commandId=j.get('commandId')))+'\n')
 if p.returncode or j.get('exitCode')!=0 or j.get('stdoutTruncated') or j.get('stderrTruncated'):
  save('first-rejection.json',j);raise RuntimeError(str(j)[:1800])
 return j
def py(code,timeout=30):return remote('python3 -c '+shlex.quote(code),timeout)
def send(b,target):
 for off in range(0,len(b),18000):
  enc=base64.b64encode(zlib.compress(b[off:off+18000])).decode()
  code='import pathlib,zlib,base64;p=pathlib.Path('+repr(R+'/'+target)+');p.parent.mkdir(parents=True,exist_ok=True);p.open('+repr('wb' if off==0 else 'ab')+').write(zlib.decompress(base64.b64decode('+repr(enc)+')))'
  remote('python3 -c '+shlex.quote(code))
def payload(x):
 return subprocess.check_output(['git','-C',str(D),'show',REV+':'+x['path']],stderr=subprocess.DEVNULL) if x['kind']=='git' else pathlib.Path(x['path']).read_bytes()
def git(*args):return subprocess.check_output(['git','-C',str(H/'repo'),*args],stderr=subprocess.DEVNULL).decode().strip()
def get(src,dst):
 meta=json.loads(py('import pathlib,hashlib,json,zlib;b=pathlib.Path('+repr(src)+').read_bytes();print(json.dumps(dict(bytes=len(b),sha256=hashlib.sha256(b).hexdigest(),zbytes=len(zlib.compress(b)))))')['stdout'])
 out=bytearray()
 for off in range(0,meta['zbytes'],4096):
  out.extend(base64.b64decode(py('import pathlib,zlib,base64;b=zlib.compress(pathlib.Path('+repr(src)+').read_bytes());print(base64.b64encode(b['+str(off)+':'+str(off+4096)+']).decode())')['stdout']))
 b=zlib.decompress(out);assert len(b)==meta['bytes'] and sha(b)==meta['sha256'];dst.parent.mkdir(parents=True,exist_ok=True);dst.write_bytes(b)
 return dict(path=str(dst.relative_to(E)),**meta)
if __name__=='__main__':
 m=json.load(open(OLD/'manifest.json'))
 sqlite={str(p):p.stat().st_size for p in pathlib.Path('/home/user/.codex').glob('*.sqlite*') if p.is_file()};save('sqlite-baseline.json',sqlite)
 r=json.loads(py('import os,pathlib,json;print(json.dumps(dict(uid=os.getuid(),free=os.statvfs("/tmp").f_bavail*os.statvfs("/tmp").f_frsize,memAvailable=int(next(x.split()[1] for x in pathlib.Path("/proc/meminfo").read_text().splitlines() if x.startswith("MemAvailable:")))*1024)))')['stdout'])
 allocations=dict(remoteManifest=15760340,remoteHelpersEvidence=4000000,localGitCheckoutTransportEvidence=7000000,externalSessionLauncherSQLiteFuture=24000000,reserve=8388608)
 peak=sum(allocations.values());free=shutil.disk_usage('/tmp').free
 tools=[]
 for p in [B,shutil.which('python3'),shutil.which('git'),shutil.which('node')]:
  q=pathlib.Path(p).resolve();tools.append(dict(path=str(q),bytes=q.stat().st_size,sha256=sha(q.read_bytes())))
 a=dict(allocations=allocations,peak=peak,cap=67108864,localFree=free,localAfter=free-peak,remote=r,remoteAfter=r['free']-peak,toolsStanding=tools,immutableDonorBytes=sum(x['bytes'] for x in m),manifestFiles=len(m),maxFile=max(x['bytes'] for x in m),internalCaptureConservative=900000,captureCap=1048576,sourceSlicesCap=8192,instructionCap=65536,historyRetained=True,passAdmission=peak<=67108864 and min(free-peak,r['free']-peak)>=2982150144 and r['memAvailable']>=2684354560)
 save('admission.json',a);assert a['passAdmission']
 for x in m:
  b=payload(x);assert len(b)==x['bytes'] and sha(b)==x['sha256'],x['target']
 save('manifest.json',m);save('local-closure-verification.json',dict(files=len(m),bytes=sum(x['bytes'] for x in m),passAll=True))
 repo=H/'repo';subprocess.run(['git','init','-q',str(repo)],check=True)
 objects=[];queue=[D/'.git/objects']
 while queue:
  o=queue.pop().resolve()
  if str(o) in objects:continue
  objects.append(str(o));a=o/'info/alternates'
  if a.exists():queue.extend((o/x).resolve() if not x.startswith('/') else pathlib.Path(x) for x in a.read_text().splitlines())
 (repo/'.git/objects/info/alternates').write_text('\n'.join(objects)+'\n')
 git('config','core.sparseCheckout','true');(repo/'.git/info/sparse-checkout').write_text('/docs/re-notes/penguin-command-immediate-shot-state-20261024.md\n/docs/re-notes/penguin-command-immediate-shot-state-20261024/\n')
 git('update-ref','refs/heads/'+BRANCH,REV);git('symbolic-ref','HEAD','refs/heads/'+BRANCH);git('read-tree','-mu','HEAD');git('remote','add','origin','git@github.com:vgrichina/wine-assembly.git');E.mkdir(parents=True)
 print(json.dumps(dict(admitted=True,peak=peak,files=len(m),bytes=sum(x['bytes'] for x in m))))
