import pathlib,sys,os,json,time,hashlib,shutil,subprocess,shlex,base64,zlib,resource
H=pathlib.Path('/tmp/ricochet-measured-cpu-round-gameplay-oct27');O=H/'ops';ROOT=pathlib.Path('/home/user/wine-assembly');OLD=pathlib.Path('/tmp/ricochet-cleanup-round-play-oct27');BOX='bx_e9mecsag';R=str(H);label=sys.argv[1]
sys.stdout=open(O/(label+'-'+str(time.time_ns())+'.stdout'),'w',buffering=1);sys.stderr=open(O/(label+'-'+str(time.time_ns())+'.stderr'),'w',buffering=1)
def save(n,j):(O/n).write_text(json.dumps(j,indent=2,default=str)+'\n')
def sha(b):return hashlib.sha256(b).hexdigest()
def alloc(p):
 if not p.exists():return 0
 total=0
 for x in [p,*p.rglob('*')] if p.is_dir() else [p]:
  try:total+=x.lstat().st_blocks*512
  except FileNotFoundError:pass
 return total
def gate():
 receipt=json.loads((ROOT/'scratch/usage-watch/cleanup-fleet-continuation-admission-oct27.json').read_text());assert receipt['pass']
 clients=[]
 for p in pathlib.Path('/proc').glob('[0-9]*'):
  try:
   a=(p/'cmdline').read_bytes().split(b'\0')
   if a[0].endswith(b'/codex') and b'exec' in a:
    a=[x.decode() for x in a if x];name=pathlib.Path(a[a.index('--output-last-message')+1]).parent.name;s=(p/'stat').read_text().split(') ')[1].split();clients.append(dict(pid=int(p.name),task=name,rss=int(s[21])*4096))
  except (OSError,ValueError,IndexError):pass
 peers=[];future=0
 for c in clients:
  name=c['task'];used=alloc(pathlib.Path('/tmp')/name)+alloc(ROOT/'scratch/usage-watch'/name);event=ROOT/'scratch/usage-watch'/name/'events.jsonl';sid=None
  if event.exists():
   with event.open() as f:
    for line in f:
     try:j=json.loads(line)
     except ValueError:continue
     if j.get('type')=='thread.started':sid=j['thread_id'];break
  if sid:used+=sum(alloc(p) for p in pathlib.Path('/home/user/.codex/sessions').rglob('*'+sid+'.jsonl'))
  remain=max(0,134217728-used);future+=remain;peers.append(dict(task=name,used=used,remaining=remain))
 wal={str(p):alloc(p) for p in pathlib.Path('/home/user/.codex').glob('*-wal')};bp=O/'wal-baseline.json'
 if not bp.exists():save(bp.name,wal)
 positive=sum(max(0,v-json.loads(bp.read_text()).get(k,v)) for k,v in wal.items())
 mem=int(pathlib.Path('/proc/meminfo').read_text().split('MemAvailable:')[1].split()[0])*1024;free=shutil.disk_usage(H).free;ram=max(0,5-len(clients))*335544320+268435456+805306368
 j=dict(at=time.time(),clients=clients,peers=peers,remainingFutures=future,positiveWAL=positive,positiveWALAlreadyMaterializedInFree=True,memAvailable=mem,requiredRAM=ram,actualRSSAlreadyIncluded=True,free=free,projected=free-future-16777216,floor=2982150144,own=alloc(H),cap=134217728)
 save('admission-'+label+'-'+str(time.time_ns())+'.json',j);assert mem>=ram and j['projected']>=2982150144 and j['own']<134217728,j
 return j
def remote(cmd,timeout=30,detach=False):
 ident=str(time.time_ns());a=['boat','--no-update','--json','exec']+(['--detach'] if detach else ['--timeout',str(timeout)])+[BOX,cmd]
 ledger=O/'api-ledger.json';j=json.loads(ledger.read_text()) if ledger.exists() else dict(bytes=0,cap=8388608,reservedFrames=3*2097152,terminalReserve=1048576,pending=0)
 assert j['bytes']+j['pending']+8192<=j['cap'];j['pending']+=8192;save(ledger.name,j)
 save('api-'+ident+'-command.json',dict(argv=a,commandSHA256=sha(cmd.encode()),limits={str(k):resource.getrlimit(k) for k in [resource.RLIMIT_AS,resource.RLIMIT_DATA,resource.RLIMIT_CPU,resource.RLIMIT_FSIZE]}))
 with open(O/('api-'+ident+'.stdout'),'wb') as out,open(O/('api-'+ident+'.stderr'),'wb') as err:p=subprocess.run(a,stdout=out,stderr=err,timeout=timeout+15)
 out=(O/('api-'+ident+'.stdout')).read_bytes();err=(O/('api-'+ident+'.stderr')).read_bytes();j['pending']-=8192;j['bytes']+=len(out)+len(err);save(ledger.name,j);assert len(out)+len(err)<=8192 and j['bytes']<=j['cap']
 v=json.loads(out);assert p.returncode==0 and (detach or v.get('exitCode')==0) and not v.get('stdoutTruncated') and not v.get('stderrTruncated'),v
 return v
def py(code,**kw):return remote('python3 -c '+shlex.quote(code),**kw)
gate()
if label=='git':
 source=(OLD/'ops/driver.py').read_text();part=source[source.index(' import fcntl',source.index("elif label=='git':")):source.index("elif label=='config':")];exec('if True:\n'+part)
elif label=='remote':save('remote-last.json',py(pathlib.Path(sys.argv[2]).read_text(),timeout=int(sys.argv[3]) if len(sys.argv)>3 else 30))
elif label=='stage-tools':
 for p in (O/'remote-tools').iterdir():
  b=p.read_bytes();code='import pathlib,base64,hashlib;p=pathlib.Path('+repr(R+'/'+p.name)+');p.parent.mkdir(parents=True,exist_ok=True);b=base64.b64decode('+repr(base64.b64encode(b).decode())+');assert hashlib.sha256(b).hexdigest()=='+repr(sha(b))+';p.write_bytes(b)';py(code)
 print('tools staged only; retained closure unchanged')
elif label=='prepare':exec(compile((O/'prepare.py').read_text(),str(O/'prepare.py'),'exec'))
elif label=='package':exec(compile((O/'package.py').read_text(),str(O/'package.py'),'exec'))
elif label=='analyze':exec(compile((O/'analyze.py').read_text(),str(O/'analyze.py'),'exec'))
elif label=='finalize':exec(compile((O/'finalize.py').read_text(),str(O/'finalize.py'),'exec'))
elif label=='check':
 checker=ROOT/'ops/check-run-evidence.js';argv=['/usr/local/bin/node','--max-old-space-size=128',str(checker),str(H/'repo')]
 for n in ['checker-command.json','checker.stdout','checker.stderr']:
  if (O/n).exists():shutil.copyfile(O/n,O/(n+'.prior-'+str(time.time_ns())))
 startup=argv[:2]+['-e',"console.log(JSON.stringify({exec:process.execPath,version:process.version,flags:process.execArgv.slice(0,1),limits:require('fs').readFileSync('/proc/self/limits','utf8')}))"]
 with open(O/'checker-startup.stdout','wb') as out,open(O/'checker-startup.stderr','wb') as err:probe=subprocess.run(startup,stdout=out,stderr=err,timeout=10)
 assert probe.returncode==0
 save('checker-command.json',dict(argv=argv,sha256=sha(checker.read_bytes()),limits={str(k):resource.getrlimit(k) for k in [resource.RLIMIT_AS,resource.RLIMIT_DATA,resource.RLIMIT_CPU,resource.RLIMIT_FSIZE]}))
 with open(O/'checker.stdout','wb') as out,open(O/'checker.stderr','wb') as err:p=subprocess.run(argv,stdout=out,stderr=err,timeout=30)
 j=json.loads((O/'checker.stdout').read_text());assert p.returncode==0 and not j['errors'] and not j['missing'] and not j['invalid'],j
 save('checker-result.json',dict(exit=p.returncode,result=j))
elif label in ['decision','menu','collect','read']:
 source=(OLD/'ops/driver.py').read_text()
 if label=='read':part=source[source.index("elif label=='read':"):source.index("elif label=='git':")]
 else:part=source[source.index("elif label=='decision':"):source.index("elif label=='package':")]
 exec('if False:pass\n'+part)
