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
 base=json.loads((C/'coordinator-allocation-forecast.json').read_text())
 roots={p:physical(pathlib.Path(p)) for p in base['roots']}
 events=pathlib.Path('/home/user/wine-assembly/scratch/usage-watch')/C.name/'events.jsonl'
 ids=[json.loads(l)['thread_id'] for l in events.open() if json.loads(l).get('type')=='thread.started']
 assert len(set(ids))==1
 matches=list(pathlib.Path('/home/user/.codex/sessions/2026/10/30').glob('rollout-*'+ids[0]+'.jsonl'));assert len(matches)==1
 roots[str(matches[0])]=physical(matches[0])
 used=sum(roots.values());v=os.statvfs(C);free=v.f_bavail*v.f_frsize
 rec=dict(at=time.time(),roots=roots,session=ids[0],used=used,startupAndWorkGrowth=8*M,publicationReserve=8*M,forecast=used+16*M,cap=64*M,hostFree=free,aggregateFutureGrowth=267292672,hostFloor=1610612736,RAMAdmission=False,MemAvailable=next(l for l in pathlib.Path('/proc/meminfo').read_text().splitlines() if l.startswith('MemAvailable:')))
 rec['PASS']=rec['forecast']<=64*M and free-267292672>=1610612736
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
if __name__=='__main__' and '--watchdog' in sys.argv:watchdog()
