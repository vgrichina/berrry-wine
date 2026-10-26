import pathlib,subprocess,json,os,hashlib,shutil,time,shlex,re
H=pathlib.Path(__file__).resolve().parent.parent;O=H/'ops';BOX='bx_7qwjxps7';B='/home/user/.ascii/boat'
def save(n,j):(O/n).write_text(json.dumps(j,indent=2)+'\n')
def sha(b):return hashlib.sha256(b).hexdigest()
def remote(cmd,timeout=30):
 assert len(cmd.encode())<=36000
 p=subprocess.run([B,'--no-update','--json','exec','--timeout',str(timeout),BOX,cmd],capture_output=True,text=True,timeout=timeout+15)
 assert len(p.stdout.encode())+len(p.stderr.encode())<=131072
 try:j=json.loads(p.stdout)
 except Exception:save('first-api-rejection.json',dict(returncode=p.returncode,stdout=p.stdout,stderr=p.stderr));raise
 with (O/'api-history.jsonl').open('a') as f:f.write(json.dumps(dict(at=time.time(),requestBytes=len(cmd.encode()),responseBytes=len(p.stdout.encode())+len(p.stderr.encode()),commandSHA256=sha(cmd.encode()),commandId=j.get('commandId')))+'\n')
 if p.returncode or j.get('exitCode')!=0 or j.get('stdoutTruncated') or j.get('stderrTruncated') or j.get('oomKilled') or j.get('timedOut'):
  save('first-api-rejection.json',j);raise RuntimeError(str(j)[:1200])
 return j
def py(code,timeout=30):return remote('python3 -c '+shlex.quote(code),timeout)
def size(p):
 if not p.exists():return 0
 if p.is_file():return max(p.stat().st_size,p.stat().st_blocks*512)
 return sum(max(f.stat().st_size,f.stat().st_blocks*512) for f in p.rglob('*') if f.is_file())
def account(stage,remoteActual=0):
 a=json.load(open(O/'resource-initial.json'));C=pathlib.Path('/home/user/.codex');base=json.load(open(O/'sqlite-baseline.json'))
 m=json.load(open(H/'manifest.json'));remoteBytes=sum((x['bytes']+4095)//4096*4096 for x in m)
 traffic=[json.loads(s) for s in (O/'api-history.jsonl').read_text().splitlines()] if (O/'api-history.jsonl').exists() else []
 charges=dict(localOwned=size(H),remoteOwned=max(remoteBytes,remoteActual),remoteHelpersAndEvidenceFuture=1048576,transferOverlap=1048576,publicationFuture=3145728,session=size(pathlib.Path(a['session'])),launcher=size(pathlib.Path(a['launcher'])),positiveDBWAL=sum(max(0,size(p)-base.get(str(p),0)) for p in C.glob('*.sqlite*') if p.is_file()),sessionEventsDBFuture=8388608,reserve=8388608)
 charges['conservativeAPIRequestResponseEvents']=sum(x['requestBytes']+x['responseBytes'] for x in traffic)
 charges['APIEventsFuture']=1048576
 peak=sum(charges.values());free=shutil.disk_usage(H).free;mem=int(re.search(r'MemAvailable:\s+(\d+)',pathlib.Path('/proc/meminfo').read_text())[1])*1024
 j=dict(at=time.time(),charges=charges,peak=peak,cap=67108864,free=free,projectedFree=free-peak,memAvailable=mem,projectedMem=mem-536870912,passed=peak<=67108864 and free-peak>=2982150144 and mem-536870912>=805306368)
 save('resource-'+stage+'.json',j);assert j['passed'],j;return j
