import pathlib, subprocess, os, time, json, resource, signal, hashlib, datetime, sys
C=pathlib.Path(__file__).resolve().parent
R=C.parent
REPO=C/'repo'
M=1048576
B='/home/user/.ascii/boat'
SSH='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
ENV=dict(os.environ, BOAT_NO_UPDATE='1', PYTHONDONTWRITEBYTECODE='1', GIT_SSH_COMMAND=SSH)
ENV['GIT_ALTERNATE_OBJECT_DIRECTORIES']=':'.join(json.loads((C/'stores.json').read_text())['stores'])
SEQ=0
PREFIX=('watchdog' if '--watchdog' in sys.argv else 'op')+'-'+str(os.getpid())
ORIG_DATA=resource.getrlimit(resource.RLIMIT_DATA)
resource.setrlimit(resource.RLIMIT_DATA,(128*M,ORIG_DATA[1]))
resource.setrlimit(resource.RLIMIT_CPU,(60,60))
resource.setrlimit(resource.RLIMIT_FSIZE,(12*M,12*M))
def save(n,v):
 p=C/n; t=p.with_suffix(p.suffix+'.tmp');t.write_text(json.dumps(v,indent=2)+'\n');t.replace(p)
def digest(p):return hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()
def cwd_check(cwd):
 p=pathlib.Path(os.path.abspath(os.fspath(cwd)))
 if not p.is_relative_to(C):raise ValueError('outside owned root before spawn')
 p=p.resolve(strict=True)
 if not p.is_relative_to(C):raise ValueError('symlink escape before spawn')
 return p
def limits(kind):
 resource.setrlimit(resource.RLIMIT_CPU,(60,60));resource.setrlimit(resource.RLIMIT_FSIZE,(12*M,12*M))
 if kind in ('python','git'):
  amount=(256 if kind=='git' else 128)*M
  resource.setrlimit(resource.RLIMIT_DATA,(amount,amount))
 else:resource.setrlimit(resource.RLIMIT_DATA,ORIG_DATA)
def run(argv,*,cwd,wall=60,kind='native',check=True,input=None):
 global SEQ
 cwd=cwd_check(cwd)
 if argv[0]=='git':assert argv[1:3]==['-C',str(REPO)]
 SEQ+=1; name='%s-%03d'%(PREFIX,SEQ)
 a=C/(name+'.stdout');b=C/(name+'.stderr')
 with a.open('xb') as out,b.open('xb') as err:
  p=subprocess.Popen(argv,cwd=cwd,env=ENV,stdout=out,stderr=err,stdin=subprocess.PIPE if input is not None else subprocess.DEVNULL,preexec_fn=lambda:limits(kind),start_new_session=True)
  start=time.monotonic()
  try:
   if input is not None:p.stdin.write(input);p.stdin.close()
   while p.poll() is None:
    if time.monotonic()-start>wall:raise RuntimeError('wall timeout '+name)
    if a.stat().st_size+b.stat().st_size>524288:raise RuntimeError('capture overflow '+name)
    if sum(x.stat().st_size for x in C.glob('*.std*'))>4*M:raise RuntimeError('aggregate capture overflow')
    time.sleep(.1)
  finally:
   try:os.killpg(p.pid,signal.SIGKILL)
   except ProcessLookupError:pass
   p.wait()
 rec=dict(argv=argv,at=time.time(),exit=p.returncode,stdoutFile=a.name,stderrFile=b.name,wall=time.monotonic()-start)
 save(name+'.json',rec)
 out=a.read_text();err=b.read_text();assert len(out.encode())+len(err.encode())<=524288
 if check:assert p.returncode==0,(rec,err[:2000],out[:2000])
 return dict(rec,stdout=out,stderr=err)
def git(*args,mutate=False,**kwargs):
 if mutate:
  for flag,want in [('--show-toplevel',str(REPO)),('--absolute-git-dir',str(REPO/'.git'))]:
   assert run(['git','-C',str(REPO),'rev-parse',flag],cwd=REPO,kind='git')['stdout'].strip()==want
 return run(['git','-C',str(REPO),*args],cwd=REPO,kind='git',**kwargs)
def api(args,wall=60):
 q=run([B,'--no-update','--json',*args],cwd=C,wall=wall)
 v=json.loads(q['stdout']);assert not v.get('error') and v.get('success',True),v
 return v
def box():return json.loads((C/'new-boat.json').read_text())['id']
def remote(code,*args,wall=50):
 v=api(['exec',box(),'--cwd','/home/user/enigma-original','--timeout',str(wall),'--','/usr/bin/python3','-B','-c',code,*args],wall+15)
 assert v.get('exitCode')==0 and not v.get('stdoutTruncated') and not v.get('stderrTruncated'),v
 return v['stdout']
def physical(root):
 if not root.exists():return 0
 return root.lstat().st_blocks*512+sum(p.lstat().st_blocks*512 for p in root.rglob('*'))
def admission(label):
 watch=pathlib.Path('/home/user/wine-assembly/scratch/usage-watch')
 names=['enigma-guest-poll-causal-runtime-oct30','enigma-compact-causal-runtime-owner133-oct30','enigma-start-game-causal-repair-owner133-oct30','enigma-retained-prefix-guest-poll-runtime-oct30','enigma-fresh-boat-efficient-transfer-runtime-oct30','enigma-corrected-manifest-retained-runtime-oct30',C.name]
 roots={str(p):physical(p) for p in [R,*[watch/n for n in names]]}
 session=pathlib.Path('/home/user/.codex/sessions/2026/10/30/rollout-2026-10-30T09-14-18-01a18c16-ad94-7742-a5e0-3306e31b8b8b.jsonl')
 roots[str(session)]=session.stat().st_blocks*512
 s=os.statvfs(C);used=sum(roots.values());free=s.f_bavail*s.f_frsize
 rec=dict(at=time.time(),roots=roots,used=used,growth=3*M,reserve=8*M,totalForecast=used+11*M,cap=64*M,free=free,futureHostGrowth=267292672,hostFloor=2147483648,RAMAdmission=False,MemAvailable=next(x for x in pathlib.Path('/proc/meminfo').read_text().splitlines() if x.startswith('MemAvailable:')))
 rec['PASS']=rec['totalForecast']<=64*M and free-267292672>=2147483648
 save('allocation-'+label+'.json',rec);assert rec['PASS'],rec
 return rec
def close():
 if (C/'closeout.json').exists():return
 lock=C/'stop-lock'
 try:lock.mkdir()
 except FileExistsError:
  for _ in range(90):
   if (C/'closeout.json').exists():return
   time.sleep(2)
  raise RuntimeError('other closer did not finish')
 save('stop-request.json',dict(at=time.time(),id=box()))
 api(['stop',box()],wall=120)
 for _ in range(60):
  v=api(['info',box()])['sandbox']
  if v['state']=='stopped' and v.get('lastSnapshotStatus')=='completed' and v.get('snapshotVerifiedAt') and v['snapshotVerifiedAt']>json.loads((C/'schedule.json').read_text())['createdAt']:
   save('closeout.json',dict(at=time.time(),verifiedStopped=True,postRunSnapshotCompleted=True,sandbox=v));return
  time.sleep(2)
 raise RuntimeError('post-run completed snapshot not verified')
def watchdog():
 sch=json.loads((C/'schedule.json').read_text());parent=json.loads((C/'watchdog.json').read_text())['parent']
 while pathlib.Path('/proc/%d'%parent).exists() and time.time()<sch['shutdownEpoch']:
  if (C/'closeout.json').exists():return
  time.sleep(2)
 try:close()
 except BaseException as e:save('watchdog-failure.json',dict(error=repr(e),at=time.time()))
def preflight():
 tests={}
 for key,kw in [('omitted',{}),('shared',dict(cwd='/home/user/wine-assembly')),('donor',dict(cwd=R/'repo'))]:
  try:run(['/bin/true'],**kw)
  except (ValueError,TypeError):tests[key]='REJECTED BEFORE SPAWN'
  else:raise AssertionError(key)
 tests['sentinel']=run(['/bin/pwd'],cwd=C)['stdout'].strip();assert tests['sentinel']==str(C)
 assert git('rev-parse','HEAD')['stdout'].strip()=='8cf96b58a9fe68b46fbc1b861f940b7d2fb97a47'
 assert git('branch','--show-current')['stdout'].strip()=='task/'+C.name
 p=R/'enigma-fresh-boat-efficient-transfer-runtime-oct30/preflight.json';v=json.loads(p.read_text())
 assert v['legitimate2MiBFilePassed'] and v['captureOverflowRejected'] and v['generatedFileCeiling']==12*M
 q=run(['/usr/bin/node','--max-old-space-size=512',str(R/'guest-poll-parser.cjs')],cwd=C)
 parsed=json.loads(q['stdout']);mount=json.loads((R/'mount-enumeration.json').read_text())
 assert len(mount['files'])==2460
 assert digest(R/'guest-poll-args.json')=='80194f366b579a2604eec56df0d1dd7ff4a633d731b6d4792688f1da8b85a9a0'
 save('prelaunch.json',dict(PASS=True,controls=tests,parser=parsed,mountEnumeration=dict(path=str(R/'mount-enumeration.json'),sha256=digest(R/'mount-enumeration.json'),files=len(mount['files']),commaFiles=[p for p in mount['files'] if ',' in p]),reusedFileCaptureReceipt=dict(path=str(p),sha256=digest(p)),generatedFSIZE=12*M,captureCeiling=524288,aggregateCapture=4*M,gitDATA=256*M,pythonDATA=128*M,NodeDATA='inherited unrestricted; no Git cap',trustedGitSSH=SSH,rootRefReceipt='/home/user/wine-assembly/scratch/usage-watch/'+C.name+'/root-ref-digest.json',inputs={str(p):dict(bytes=p.stat().st_size,sha256=digest(p)) for p in [C/'guest.py',R/'guest-poll-args.json',R/'guest-poll-instrument.py']}))
 admission('prelaunch')
if __name__=='__main__':
 if '--watchdog' in sys.argv:watchdog()
 else:preflight()
