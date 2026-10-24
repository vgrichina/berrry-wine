import pathlib, subprocess, json, hashlib, os, shutil, time
H=pathlib.Path(__file__).parent
P=pathlib.Path('/tmp/penguin-quiet-gameplay-oct24/repo/docs/re-notes/penguin-command-quiet-original-gameplay-20261024')
D='/home/user/wine-assembly-shadow-man-span-static-canonical-oct23'
REV='b41a7c5f4b752d1f0bdab1141a11d4fed4dcf9a' # corrected exact revision below
REV='b41a7c5f4b752d1f0bdab1141a11d4fed4dc6f9a'
BOX='bx_ts27jq5e'; R=str(H); B='/home/user/.ascii/boat'
def sha(b):return hashlib.sha256(b).hexdigest()
def save(n,j):(H/n).write_text(json.dumps(j,indent=2)+'\n')
def remote(cmd,timeout=30):
 p=subprocess.run([B,'--no-update','--json','exec','--timeout',str(timeout),BOX,cmd],capture_output=True,text=True,timeout=timeout+15)
 try:j=json.loads(p.stdout)
 except Exception:save('first-rejection.json',dict(returncode=p.returncode,stdout=p.stdout,stderr=p.stderr));raise
 if p.returncode or j.get('exitCode')!=0:
  save('first-rejection.json',j);raise RuntimeError(str(j)[:2000])
 return j
def read(x):
 return subprocess.check_output(['git','-C',D,'show',REV+':'+x['path']],env=dict(os.environ,GIT_NO_LAZY_FETCH='1')) if x['kind']=='git' else pathlib.Path(x['path']).read_bytes()
if __name__=='__main__':
 m=json.loads((P/'retained-payload-manifest.json').read_text())
 for x in m:
  b=read(x);assert len(b)==x['bytes'] and sha(b)==x['sha256'],x
 assert len(m)==287 and sum(x['bytes'] for x in m)==15719953
 save('manifest.json',m)
 sql={str(p):p.stat().st_size for p in pathlib.Path('/home/user/.codex').glob('*.sqlite*') if p.is_file()};save('sqlite-baseline.json',sql)
 rr=remote("python3 -c 'import os,json,shutil;print(json.dumps(dict(uid=os.getuid(),free=shutil.disk_usage(\"/tmp\").free,memAvailable=int(next(x.split()[1] for x in open(\"/proc/meminfo\") if x.startswith(\"MemAvailable:\")))*1024)))'")
 save('remote-admission.json',rr);r=json.loads(rr['stdout'])
 allocations=dict(remoteExactPayload=15719953,privateCheckoutGitAndTransport=4*1048576,remoteHelpersLogsEvidence=3*1048576,localEvidenceHelpers=4*1048576,externalLauncherSessionExistingAndFuture=12*1048576,positiveSQLiteAndFuture=10*1048576,transportBuffers=1048576,reserve=8*1048576)
 peak=sum(allocations.values());free=shutil.disk_usage('/tmp').free
 tools=[]
 for name in ['node','python3','git','boat']:
  p=pathlib.Path(shutil.which(name)).resolve();tools.append(dict(path=str(p),bytes=p.stat().st_size,sha256=sha(p.read_bytes())))
 j=dict(at=time.time(),allocations=allocations,peak=peak,cap=67108864,localFree=free,localAfter=free-peak,remote=r,remoteAfter=r['free']-peak,manifestFiles=len(m),manifestBytes=15719953,maxFile=max(x['bytes'] for x in m),standingTools=tools,standingInputs='exact manifest + immutable git donor; no local payload copies',captureConservative=220000,captureCap=1048576,limits=dict(fixedSharedArenaMiB=512,oldspaceMiB=512,nativePreflightSequential=True,guestSeconds=60,batches=200000,wall=90,cpu=90,output=524288),passAdmission=peak<=67108864 and min(free-peak,r['free']-peak)>=2982150144 and r['uid']==1000 and r['memAvailable']>=2684354560)
 save('admission.json',j);assert j['passAdmission'],j
 print(json.dumps({k:j[k] for k in ['peak','localAfter','manifestFiles','passAdmission']}))
