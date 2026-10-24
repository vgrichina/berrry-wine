from setup import *
import shutil,time
BOX='bx_fkg5uw8h';R=str(H);B='/home/user/.ascii/boat'
def sha(b):return hashlib.sha256(b).hexdigest()
def save(n,j):(H/n).write_text(json.dumps(j,indent=2)+'\n')
def remote(cmd,timeout=30):
 assert len(cmd.encode())<=36000
 p=subprocess.run([B,'--no-update','--json','exec','--timeout',str(timeout),BOX,cmd],capture_output=True,text=True,timeout=timeout+15)
 try:j=json.loads(p.stdout)
 except Exception:save('first-rejection.json',dict(returncode=p.returncode,stdout=p.stdout,stderr=p.stderr));raise
 if p.returncode or j.get('exitCode')!=0:
  save('first-rejection.json',j);raise RuntimeError(str(j)[:1800])
 return j
def payload(x):return read(x['path']) if x['kind']=='git' else pathlib.Path(x['path']).read_bytes()
if __name__=='__main__':
 m=json.load(open(H/'manifest.json'));original=json.load(open(OLD/'manifest.json'))
 for x in original:
  b=subprocess.check_output(['git','-C','/home/user/wine-assembly-shadow-man-span-static-canonical-oct23','show','b41a7c5f4b752d1f0bdab1141a11d4fed4dc6f9a:'+x['path']],stderr=subprocess.DEVNULL) if x['kind']=='git' else pathlib.Path(x['path']).read_bytes()
  assert len(b)==x['bytes'] and sha(b)==x['sha256'],x
 for x in m:
  b=payload(x);assert len(b)==x['bytes'] and sha(b)==x['sha256'],x
 r=json.loads(json.load(open(H/'access-probe.json'))['stdout'])
 allocations=dict(remotePayload=15760340,privateCheckoutGitTransport=12000000,remoteHelpersRuns=3000000,localEvidence=3000000,externalSessionLauncherSQLiteExistingFuture=20000000,reserve=8388608)
 peak=sum(allocations.values());free=shutil.disk_usage('/tmp').free
 tools=[]
 for p in [shutil.which('node'),shutil.which('python3'),shutil.which('git'),B]:
  q=pathlib.Path(p).resolve();tools.append(dict(path=str(q),bytes=q.stat().st_size,sha256=sha(q.read_bytes())))
 j=dict(at=time.time(),allocations=allocations,peak=peak,cap=67108864,localFree=free,localAfter=free-peak,remote=r,remoteAfter=r['free']-peak,originalHashGate=dict(files=len(original),bytes=sum(x['bytes'] for x in original),passAll=True),manifestFiles=len(m),manifestBytes=sum(x['bytes'] for x in m),maxFile=max(x['bytes'] for x in m),standingTools=tools,standingInputs='original 287-file manifest verified in place; new exact-main runner closure; no local media copies',captureConservative=800000,captureCap=1048576,limits=dict(fixedSharedArenaMiB=512,oldspaceMiB=512,guestRunsMaximum=2,wall=90,cpu=90,output=524288),passAdmission=peak<=67108864 and min(free-peak,r['free']-peak)>=2982150144 and r['uid']==1000 and r['memAvailable']>=2684354560)
 save('admission.json',j);assert j['passAdmission'];print(json.dumps({k:j[k] for k in ['peak','localAfter','manifestFiles','manifestBytes','passAdmission']}))
