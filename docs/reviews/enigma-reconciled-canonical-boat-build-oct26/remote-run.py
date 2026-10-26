import pathlib,os,json,hashlib,resource,subprocess,time,signal,shutil,sys
H=pathlib.Path('/tmp/enigma-reconciled-canonical-boat-build-oct26');S=H/'source';O=H/'ops';O.mkdir(exist_ok=True)
CAP=3221225472;ALLOCATION=1073741824;FLOOR=2982150144
def sha(b):return hashlib.sha256(b).hexdigest()
def save(n,j):
 p=O/n;t=p.with_suffix('.new');t.write_text(json.dumps(j,indent=2)+'\n');os.replace(t,p)
def allocated():
 return sum(p.lstat().st_blocks*512 for p in [H,*H.rglob('*')])
def verify():
 m=json.load(open(H/'input-manifest.json'))
 for n,x in m.items():
  b=(S/n).read_bytes();assert len(b)==x['bytes'] and sha(b)==x['sha256'] and hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()==x['oid'],n
 return dict(files=len(m),manifestSHA256=sha((H/'input-manifest.json').read_bytes()),unchanged=True)
def gate(label):
 assert time.time()<1793059800,'execution cutoff 2026-10-27T00:10Z'
 used=allocated();free=shutil.disk_usage(H).free;mem=int(pathlib.Path('/proc/meminfo').read_text().split('MemAvailable:')[1].split()[0])*1024
 r=dict(at=time.time(),label=label,used=used,allocation=ALLOCATION,remaining=ALLOCATION-used,free=free,projectedFree=free-max(0,ALLOCATION-used),floor=FLOOR,memAvailable=mem,required=CAP+805306368+67108864,physicalCompilerSubtree=CAP,hostFloor=805306368,helpersReserve=67108864,remoteReserveIncluded=8388608)
 r['pass']=used<=ALLOCATION and r['projectedFree']>=FLOOR and mem>=r['required'];save('admission-'+label+'.json',r);assert r['pass'],r
def stats():
 d={}
 for p in pathlib.Path('/proc').glob('[0-9]*'):
  try:
   s=p.joinpath('stat').read_text().split(') ')[1].split();d[int(p.name)]=(int(s[1]),int(s[2]),int(s[11])+int(s[12]),int(s[21])*4096,s[19])
  except (OSError,IndexError,ValueError):pass
 return d
def main(label,cmd):
 gate(label);before=verify();save('inputs-before-'+label+'.json',before)
 assert resource.getrlimit(resource.RLIMIT_DATA)==(-1,-1) and resource.getrlimit(resource.RLIMIT_AS)==(-1,-1)
 resource.setrlimit(resource.RLIMIT_CPU,(90,90));resource.setrlimit(resource.RLIMIT_FSIZE,(25165824,25165824))
 node=shutil.which('node');env=dict(PATH=str(pathlib.Path(node).parent)+':/usr/bin:/bin',HOME='/home/user',TMPDIR=str(O),LC_ALL='C',TZ='UTC',NODE_OPTIONS='--max-old-space-size=1536')
 cmd=[node,*cmd];save('config-'+label+'.json',dict(argv=cmd,cwd=str(S),env=env,nodeSHA256=sha(pathlib.Path(node).read_bytes()),limits={str(k):resource.getrlimit(k) for k in [resource.RLIMIT_CPU,resource.RLIMIT_FSIZE,resource.RLIMIT_DATA,resource.RLIMIT_AS]},physicalCap=CAP,wall=120,aggregateOutput=2097152,individualExcerpt=8192))
 start=time.monotonic();p=subprocess.Popen(cmd,cwd=S,env=env,stdin=subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,start_new_session=True);os.set_blocking(p.stdout.fileno(),False)
 peak=0;cpu=0;tracked={};buf=bytearray();reason='natural';maxdisk=allocated();lastdisk=start
 while True:
  st=stats();owned={os.getpid()};changed=True
  while changed:
   n=len(owned);owned|={pid for pid,v in st.items() if v[0] in owned};changed=len(owned)!=n
  owned|={pid for pid,v in st.items() if v[1]==p.pid}
  rss=sum(st.get(pid,(0,0,0,0))[3] for pid in owned);peak=max(peak,rss)
  for pid in owned:
   if pid in st:tracked[(pid,st[pid][4])]=st[pid][2]
  cpu=sum(tracked.values())/os.sysconf('SC_CLK_TCK')
  try:buf.extend(os.read(p.stdout.fileno(),65536))
  except BlockingIOError:pass
  if rss>CAP:reason='physical-memory'
  elif cpu>90:reason='aggregate-cpu'
  elif time.monotonic()-start>120:reason='wall'
  elif len(buf)>2097152:reason='output'
  elif time.time()>=1793059800:reason='cutoff'
  if time.monotonic()-lastdisk>=1:
   used=allocated();maxdisk=max(maxdisk,used);lastdisk=time.monotonic()
   if used>ALLOCATION or shutil.disk_usage(H).free-max(0,ALLOCATION-used)<FLOOR:reason='disk'
  if reason!='natural':break
  if p.poll() is not None:
   buf.extend(p.stdout.read() or b'');break
  time.sleep(.025)
 if p.poll() is None:os.killpg(p.pid,signal.SIGKILL)
 p.wait()
 try:os.killpg(p.pid,signal.SIGKILL)
 except ProcessLookupError:pass
 (O/(label+'.log')).write_bytes(buf[:2097152]);after=verify();save('inputs-after-'+label+'.json',after)
 r=dict(label=label,argv=cmd,exit=p.returncode,reason=reason,peakRSS=peak,physicalCap=CAP,cpu=cpu,wall=time.monotonic()-start,outputBytes=len(buf),maxDisk=maxdisk,inputHashesUnchanged=before==after,supervisorIncluded=True,trackedProcesses=len(tracked),ownedProcessGroup=p.pid,ownedGroupCleanup=True)
 save(label+'-execution.json',r)
 ck=json.load(open(O/'checkpoint.json')) if (O/'checkpoint.json').exists() else dict(candidate='425755ee5ee9be0734c7aca187521100f5487674',completed=[],remaining=['startup','generator','build','static'],instantiated=False,guest=False)
 passed=reason=='natural' and p.returncode==0 and len(buf)<=2097152
 if passed:ck['completed'].append(label);ck['remaining']=[x for x in ck['remaining'] if x!=label]
 else:ck['firstFailure']=r
 save('checkpoint.json',ck);print(json.dumps(r));assert passed,r
if __name__=='__main__':
 label=sys.argv[1]
 commands=dict(startup=['-e','console.log(JSON.stringify({node:process.version,execPath:process.execPath,execArgv:process.execArgv,env:process.env,limits:require("fs").readFileSync("/proc/self/limits","utf8"),startup:true}))'],generator=['tools/gen-host-import-sigs.js','--check'],build=['tools/build-compile-wat.js'],static=[str(O/'static-check.js')])
 main(label,commands[label])
