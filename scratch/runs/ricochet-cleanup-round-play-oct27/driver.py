import pathlib,sys,os,json,time,hashlib,shutil,subprocess,shlex,base64,zlib,resource
H=pathlib.Path('/tmp/ricochet-cleanup-round-play-oct27');O=H/'ops';ROOT=pathlib.Path('/home/user/wine-assembly');R=str(H);BOX='bx_e9mecsag';label=sys.argv[1]
sys.stdout=open(O/(label+'-'+str(time.time_ns())+'.stdout'),'w',buffering=1);sys.stderr=open(O/(label+'-'+str(time.time_ns())+'.stderr'),'w',buffering=1)
def save(n,j):(O/n).write_text(json.dumps(j,indent=2)+'\n')
def sha(b):return hashlib.sha256(b).hexdigest()
def alloc(p):
 if not p.exists():return 0
 n=0
 for x in ([p,*p.rglob('*')] if p.is_dir() else [p]):
  try:n+=x.lstat().st_blocks*512
  except FileNotFoundError:pass
 return n
def gate():
 mem=int(pathlib.Path('/proc/meminfo').read_text().split('MemAvailable:')[1].split()[0])*1024;free=shutil.disk_usage(H).free
 clients=[];discovered=set()
 for proc in pathlib.Path('/proc').glob('[0-9]*'):
  try:
   args=(proc/'cmdline').read_bytes().split(b'\0')
   if not args[0].endswith(b'/codex') or b'exec' not in args:continue
   args=[a.decode() for a in args if a];log=pathlib.Path(args[args.index('--output-last-message')+1]).parent
   s=(proc/'stat').read_text().split(') ')[1].split();clients.append(dict(pid=int(proc.name),task=log.name,rss=int(s[21])*4096));discovered.add(log.name)
  except (OSError,ValueError,IndexError):continue
 peers=[];futures=0
 for name in sorted(discovered|{'enigma-cleanup-startgame-oct27','alien-cleanup-menu-mission-oct27','ricochet-cleanup-round-play-oct27','airstrike-cleanup-ordinary-quit-oct27','madbomber-retained-launch-recovery-oct27'}):
  used=alloc(pathlib.Path('/tmp')/name)+alloc(ROOT/'scratch/usage-watch'/name)
  events=ROOT/'scratch/usage-watch'/name/'events.jsonl';sid=None
  if events.exists():
   with events.open() as f:
    for line in f:
     try:j=json.loads(line)
     except ValueError:continue
     if j.get('type')=='thread.started':sid=j['thread_id'];break
  if sid:used+=sum(alloc(p) for p in pathlib.Path('/home/user/.codex/sessions').rglob('*'+sid+'.jsonl'))
  remaining=max(0,100663296-used);futures+=remaining;peers.append(dict(task=name,used=used,remaining=remaining))
 wal={str(p):alloc(p) for p in pathlib.Path('/home/user/.codex').glob('*-wal')};bp=O/'wal-baseline.json'
 if not bp.exists():save(bp.name,wal)
 positive=sum(max(0,n-json.loads(bp.read_text()).get(p,n)) for p,n in wal.items())
 projected=free-futures-16777216-positive
 j=dict(at=time.time(),free=free,memAvailable=mem,requiredRAM=2751463424,clients=clients,actualClientRSS=sum(c['rss'] for c in clients),actualRSSAlreadyInMemAvailable=True,peers=peers,positiveWAL=positive,projected=projected,floor=2982150144,ownAllocated=alloc(H),localCap=100663296)
 save('admission-'+label+'-'+str(time.time_ns())+'.json',j)
 assert mem>=2751463424 and projected>=2982150144 and alloc(H)<100663296,j
 return j
def remote(cmd,timeout=30,detach=False):
 cmd='timeout 120 prlimit --cpu=90 --fsize=25165824 -- sh -c '+shlex.quote(cmd)
 assert len(cmd.encode())<=60000
 a=['boat','--no-update','--json','exec']+(['--detach'] if detach else ['--timeout',str(timeout)])+[BOX,cmd];ident=str(time.time_ns());save('api-'+ident+'-command.json',dict(argv=a if len(cmd)<1500 else a[:-1]+['COMMAND_RETAINED_AS_SHA256_AND_PINNED_INPUT_ROWS'],commandSHA256=sha(cmd.encode()),limits={str(k):resource.getrlimit(k) for k in [resource.RLIMIT_AS,resource.RLIMIT_DATA,resource.RLIMIT_CPU,resource.RLIMIT_FSIZE]}))
 p=subprocess.run(a,stdout=open(O/('api-'+ident+'.stdout'),'wb'),stderr=open(O/('api-'+ident+'.stderr'),'wb'),timeout=timeout+15)
 out=(O/('api-'+ident+'.stdout')).read_bytes();err=(O/('api-'+ident+'.stderr')).read_bytes()
 assert len(out)+len(err)<=8192
 ledger=O/'text-ledger.json';total=(json.loads(ledger.read_text())['bytes'] if ledger.exists() else 0)+len(out)+len(err);save(ledger.name,dict(bytes=total,cap=1048576));assert total<=1048576
 j=json.loads(out);assert p.returncode==0 and (detach or j.get('exitCode')==0) and not j.get('stdoutTruncated') and not j.get('stderrTruncated'),j
 return j
def py(code,**kw):return remote('python3 -c '+shlex.quote(code),**kw)
gate()
if label=='prepare':
 mp=ROOT/'scratch/usage-watch/ricochet-cleanup-verified-runtime-map-oct27.json';assert sha(mp.read_bytes())=='db9db02900adb80270a86e206a49920d6ac81bd1108daa25d2dd32c3b7c4d54a';j=json.loads(mp.read_text());assert len(j['files'])==537
 for x in j['files']:
  p=pathlib.Path(x['source']);assert p.stat().st_size==x['bytes'] and hashlib.file_digest(p.open('rb'),'sha256').hexdigest()==x['sha256'],x
 save('inputs.json',j)
 fixture=pathlib.Path('/tmp/ricochet-accepted-cleanup-merged-integration-oct26/repo/test/fixtures/ricochet-serial-controller');helper=fixture.parents[2]/'tools/boat-capture-readback.py';assert sha(helper.read_bytes())=='b4fe820ca51edab45ace65371a4561442f5ee6ecf165920b426ce5206d155336'
 work=(fixture/'work.py').read_text().replace('/tmp/ricochet-serial-progress-gameplay-api-oct26',R).replace('bx_ex22dvm8',BOX).replace("pathlib.Path(__file__).resolve().parents[3] / 'tools/boat-capture-readback.py'",repr(str(helper)))
 (O/'work.py').write_text(work);(O/'read.py').write_bytes((fixture/'read.py').read_bytes())
 save('pinned-checkpoint.json',dict(files=537,bytes=sum(x['bytes'] for x in j['files']),mapSHA256=sha(mp.read_bytes()),helperSHA256=sha(helper.read_bytes()),remaining=['stage','node startup/parser','one guest','round response','publication']))
 print('pins/readback prepared')
elif label=='stage':
 j=json.loads((O/'inputs.json').read_text());state=O/'stage-progress.json';done=json.loads(state.read_text()) if state.exists() else dict(index=0,offset=0,requests=0);start=time.monotonic()
 adm=json.loads(py('import pathlib,shutil,json;print(json.dumps(dict(mem=int(pathlib.Path("/proc/meminfo").read_text().split("MemAvailable:")[1].split()[0])*1024,free=shutil.disk_usage("/tmp").free)))')['stdout']);save('remote-admission-'+str(time.time_ns())+'.json',adm);assert adm['mem']>=4563402752 and adm['free']-268435456>=2982150144
 while done['index']<len(j['files']) and time.monotonic()-start<90:
  batch=[];size=0
  while done['index']<len(j['files']):
   x=j['files'][done['index']];p=pathlib.Path(x['source']);offset=done['offset']
   with p.open('rb') as f:f.seek(offset);b=f.read(30000)
   enc=base64.b64encode(zlib.compress(b)).decode();cost=len(enc)+650
   if batch and size+cost>48000:break
   batch.append((x['target'],offset,x['mode'],enc,sha(b)));size+=cost;done['offset']+=len(b)
   if done['offset']>=x['bytes']:done['index']+=1;done['offset']=0
  code='import pathlib,base64,zlib,hashlib,os;h=pathlib.Path('+repr(R)+')\n'
  for target,off,mode,enc,digest in batch:code+='p=h/'+repr(target)+';p.parent.mkdir(parents=True,exist_ok=True);b=zlib.decompress(base64.b64decode('+repr(enc)+'));assert hashlib.sha256(b).hexdigest()=='+repr(digest)+';p.open('+repr('wb' if off==0 else 'ab')+').write(b);os.chmod(p,'+str(mode)+')\n'
  py(code);done['requests']+=1;save(state.name,done)
 print(done)
elif label=='remote':print(py(pathlib.Path(sys.argv[2]).read_text(),timeout=int(sys.argv[3]) if len(sys.argv)>3 else 30))
elif label=='read':
 sys.path.insert(0,str(O));from read import readfile
 exec(compile((O/'read-audit.py').read_text(),str(O/'read-audit.py'),'exec'));audit=Audit(O);receipt=readfile(sys.argv[2],O/sys.argv[3],deadline=time.monotonic()+40,concurrency=4,executor=audit);receipt['fullResponseBytes']=audit.bytes;save('readback-'+sys.argv[3]+'.json',receipt);print(receipt)
elif label=='git':
 import fcntl
 lock=open('/tmp/wine-ops-production-git.lock','a');fcntl.flock(lock,fcntl.LOCK_EX)
 def git(args):
  ident=str(time.time_ns());a=['git',*args];env=dict(os.environ,GIT_SSH_COMMAND='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes',GIT_TERMINAL_PROMPT='0',GIT_OPTIONAL_LOCKS='0',GIT_NO_LAZY_FETCH='1')
  def limits():resource.setrlimit(resource.RLIMIT_DATA,(536870912,536870912))
  save('git-'+ident+'-command.json',dict(argv=a,trustedSSH=env['GIT_SSH_COMMAND'],gitChildDATA=536870912))
  p=subprocess.run(a,env=env,preexec_fn=limits,stdout=open(O/('git-'+ident+'.stdout'),'wb'),stderr=open(O/('git-'+ident+'.stderr'),'wb'),timeout=90)
  assert p.returncode==0,(args,p.returncode,ident)
  return (O/('git-'+ident+'.stdout')).read_text()
 repo=H/'repo';base='f461584655aa36f1ca30686cbd1428757b232b3c';branch='task/'+H.name
 if sys.argv[2]=='init':
  git(['init','-b',branch,str(repo)]);(repo/'.git/objects/info/alternates').write_text('/tmp/ricochet-accepted-cleanup-merged-integration-oct26/repo/.git/objects\n')
  for k,v in [('user.name','Wine Ops'),('user.email','wine-ops@local'),('remote.origin.url','git@github.com:vgrichina/wine-assembly.git'),('core.sparseCheckout','true'),('gc.auto','0')]:git(['-C',str(repo),'config',k,v])
  (repo/'.git/info/sparse-checkout').write_text('/docs/reviews/'+H.name+'/\n/scratch/runs/'+H.name+'/\n')
  git(['-C',str(repo),'update-ref','refs/heads/'+branch,base]);git(['-C',str(repo),'read-tree','-m','-u','HEAD']);save('git-init-receipt.json',dict(base=base,branch=branch,alternates='read-only immutable donor',status=git(['-C',str(repo),'status','--porcelain'])))
 elif sys.argv[2]=='publish':
  git(['-C',str(repo),'add','-f','docs/reviews/'+H.name,'scratch/runs/'+H.name]);git(['-C',str(repo),'diff','--cached','--check']);scope=git(['-C',str(repo),'diff','--cached','--name-only']);assert all(p.startswith(('docs/reviews/'+H.name+'/','scratch/runs/'+H.name+'/')) for p in scope.splitlines())
  tree=git(['-C',str(repo),'write-tree','--missing-ok']).strip();commit=git(['-C',str(repo),'commit-tree',tree,'-p',base,'-m','Document bounded Ricochet round-play acceptance and retained diagnostics']).strip();git(['-C',str(repo),'update-ref','refs/heads/'+branch,commit,base]);git(['-C',str(repo),'push','origin','HEAD:refs/heads/'+branch]);ref=git(['-C',str(repo),'ls-remote','--exit-code','origin','refs/heads/'+branch]).strip();assert ref==commit+'\trefs/heads/'+branch
  save('publication.json',dict(commit=commit,branch=branch,remote='origin',exactRef=ref,verified=True,scope=scope.splitlines(),status=git(['-C',str(repo),'status','--porcelain'])))
elif label=='config':exec(compile((O/'build-config.py').read_text(),str(O/'build-config.py'),'exec'))
elif label=='tools':
 names=['inputs.json','guest-args.json','startup-args.json','serial.py','remote-supervisor.py','remote-child.py','verify-remote.py'];items=[(n,O/n) for n in names]+[('trusted-supervisor.py',pathlib.Path('/tmp/gl-required-version-independent-integrate-oct26/repo/test/helpers/palette-browser-supervisor.py'))]
 for name,p in items:
  with p.open('rb') as f:
   offset=0
   while b:=f.read(30000):
    code='import pathlib,base64,zlib,hashlib;p=pathlib.Path('+repr(R+'/'+name)+');p.parent.mkdir(parents=True,exist_ok=True);b=zlib.decompress(base64.b64decode('+repr(base64.b64encode(zlib.compress(b)).decode())+'));assert hashlib.sha256(b).hexdigest()=='+repr(sha(b))+';p.open('+repr('wb' if offset==0 else 'ab')+').write(b)';py(code);offset+=len(b)
 print('tools staged')
elif label=='startup':
 code=(O/'startup-run.py').read_text();v=py(code,timeout=25);save('node-startup.json',v);print('exact Node startup/parser PASS')
elif label=='launch':
 v=py((O/'launch-guest.py').read_text(),timeout=5);save('production-launch.json',v);save('checkpoint.json',dict(phase='ONE INVOCATION STARTING; no replay',at=time.time(),remaining=['inspect menu','round response','quit','cleanup','publication']))
 print(v)
elif label=='decision':
 j=json.loads(sys.argv[2]);ident=time.time_ns();j['id']=ident
 code='import pathlib,json,time;h=pathlib.Path('+repr(R)+');o=h/"serial";p=o/"continue.json";assert not p.exists() and not (o/"done.json").exists();j='+repr(j)+';p.write_text(json.dumps(j));end=time.monotonic()+30\nwhile time.monotonic()<end:\n d=o/"decision-done.json"\n if d.exists() and json.loads(d.read_text())["id"]==j["id"]:print(d.read_text());break\n if (h/"guest/terminal.json").exists():raise RuntimeError("guest terminated; do not replay")\n time.sleep(.02)\nelse:raise RuntimeError("inflight uncertain; no replay")'
 v=py(code,timeout=35);save('decision-'+str(ident)+'.json',dict(request=j,response=v));print(v)
elif label=='menu':
 v=py('import pathlib,time;h=pathlib.Path('+repr(R)+');end=time.monotonic()+85\nwhile time.monotonic()<end:\n if (h/"serial/paused.json").exists():print((h/"serial/paused.json").read_text());break\n if (h/"guest/supervision.json").exists():raise RuntimeError("guest ended before menu")\n time.sleep(.05)\nelse:raise RuntimeError("menu readiness timeout; no replay")',timeout=90);save('menu-paused.json',v)
 sys.path.insert(0,str(O));from read import readfile
 exec(compile((O/'read-audit.py').read_text(),str(O/'read-audit.py'),'exec'));audit=Audit(O);receipt=readfile('serial/menu.png',O/'menu.png',deadline=time.monotonic()+25,concurrency=4,executor=audit);receipt['fullResponseBytes']=audit.bytes;save('readback-menu.png.json',receipt);print('MENU READY')
elif label=='collect':
 v=py((O/'collect-remote.py').read_text());j=json.loads(v['stdout']);save('remote-handback.json',j)
 sys.path.insert(0,str(O));from read import readfile
 exec(compile((O/'read-audit.py').read_text(),str(O/'read-audit.py'),'exec'));audit=Audit(O);receipts={}
 for name,pin in j['manifest'].items():
  dest=O/'remote-evidence'/name;dest.parent.mkdir(parents=True,exist_ok=True);r=readfile(name,dest,deadline=time.monotonic()+15,concurrency=4,executor=audit);assert r['sha256']==pin['sha256'];receipts[name]=r
 save('collection-receipts.json',receipts);print('collected',len(receipts),'fullResponseBytes',audit.bytes)
elif label=='package':exec(compile((O/'package.py').read_text(),str(O/'package.py'),'exec'))
elif label=='check':
 repo=H/'repo';run=repo/'scratch/runs'/H.name
 checker=ROOT/'ops/check-run-evidence.js';pin=dict(path=str(checker),sha256=sha(checker.read_bytes()),bytes=checker.stat().st_size);save('checker-source-pin.json',pin)
 items=[('report/ops/check-run-evidence.js',checker)]+[('report/'+str(p.relative_to(repo)),p) for p in run.rglob('*') if p.is_file()]
 args=['/home/user/.nvm/versions/node/v24.22.1/bin/node','--max-old-space-size=2048',R+'/report/ops/check-run-evidence.js',R+'/report'];save('checker-args.json',args);items.append(('checker-args.json',O/'checker-args.json'))
 for name,p in items:
  with p.open('rb') as f:
   offset=0
   while b:=f.read(30000):
    enc=base64.b64encode(zlib.compress(b)).decode();assert len(enc)<=50000
    code='import pathlib,base64,zlib,hashlib;p=pathlib.Path('+repr(R+'/'+name)+');p.parent.mkdir(parents=True,exist_ok=True);b=zlib.decompress(base64.b64decode('+repr(enc)+'));assert hashlib.sha256(b).hexdigest()=='+repr(sha(b))+';p.open('+repr('wb' if offset==0 else 'ab')+').write(b)';py(code);offset+=len(b)
  if p.stat().st_size==0:py('import pathlib;p=pathlib.Path('+repr(R+'/'+name)+');p.parent.mkdir(parents=True,exist_ok=True);p.touch(exist_ok=False)')
 code='import pathlib,subprocess,json;h=pathlib.Path('+repr(R)+');p=subprocess.run(["python3","-S",str(h/"remote-supervisor.py"),"checker"],stdout=open(h/"checker-supervisor.stdout","wb"),stderr=open(h/"checker-supervisor.stderr","wb"),timeout=20);j=json.loads((h/"checker/supervision.json").read_text());t=json.loads((h/"checker/terminal.json").read_text());out=(h/"checker/node.stdout").read_text();err=(h/"checker/node.stderr").read_text();assert p.returncode==0 and j["exit"]==0 and not j["stopReason"] and j["cleanupComplete"] and t["returncode"]==0,(j,t,out,err);print(json.dumps(dict(supervision=j,stdout=out,stderr=err)))'
 v=py(code,timeout=25);save('evidence-checker.json',v);shutil.copyfile(O/'evidence-checker.json',run/'evidence-checker.json');shutil.copyfile(O/'checker-source-pin.json',run/'checker-source-pin.json');print('production evidence containment checker PASS')
elif label=='prepublish':
 run=H/'repo/scratch/runs'/H.name;doc=H/'repo/docs/reviews'/H.name
 a=gate();used=next(p['used'] for p in a['peers'] if p['task']==H.name);raw=sum(p.stat().st_size for pattern in ['api-*.stdout','api-*.stderr','read-*.stdout','read-*.stderr'] for p in O.glob(pattern));assert raw<1048576
 ops=alloc(O);j=dict(at=time.time(),ownTotalIncludingSession=used,opsAllocated=ops,opsPlanningBucket=20971520,opsPlanningBucketOverage=max(0,ops-20971520),allocation=100663296,publicationFuture=4194304,eventGrowthFuture=8388608,minimumRemainingReserve=8388608,completeProjectedTask=used+20971520,aggregateAdmission=a,cumulativeFullAPIRawResponseBytes=raw,responseCap=1048576,rawResponseCount=sum(1 for p in O.glob('api-*.stdout')),historicalIncident='Complete encoded staging command bodies were retained and exceeded the20MiB ops planning bucket. Existing bodies preserved; future bodies use exact command hashes plus immutable file rows. No claim of historical component-bucket compliance. Full96MiB total projection passes; no other cleanup performed.')
 assert j['completeProjectedTask']<=100663296,j
 save('accounting-before-publication.json',j);shutil.copyfile(O/'accounting-before-publication.json',run/'accounting-before-publication.json')
 with (doc/'README.md').open('a') as f:f.write('\nAccounting incident: retained encoded staging command bodies exceeded the20MiB ops planning bucket; no retrospective component-budget compliance is claimed. Existing bodies remain untouched in owned ops. The measured complete task projection, including publication/event futures and8MiB minimum reserve, remains below96MiB. Exact measured category values, fleet peers and full raw-response total are recorded in accounting-before-publication.json.\n')
 # Check the already passing exact execution receipts and immutable local evidence once.
 checker=json.loads(json.loads((O/'evidence-checker.json').read_text())['stdout']);assert not checker['supervision']['stopReason'] and checker['supervision']['exit']==0
 assert '"errors": []' in checker['stdout'] and '"missing": []' in checker['stdout'] and '"invalid": []' in checker['stdout'],checker['stdout']
 paths=[p for base in [run,doc] for p in base.rglob('*') if p.is_file() and p!=doc/'payload-manifest.json'];entries=[]
 for p in paths:
  assert not p.is_symlink();entries.append(dict(path=str(p.relative_to(H/'repo')),bytes=p.stat().st_size,sha256=hashlib.file_digest(p.open('rb'),'sha256').hexdigest()))
 save('publication-payload-manifest.json',entries);shutil.copyfile(O/'publication-payload-manifest.json',doc/'payload-manifest.json')
 for x in entries:
  p=H/'repo'/x['path'];assert hashlib.file_digest(p.open('rb'),'sha256').hexdigest()==x['sha256']
 save('checkpoint.json',dict(phase='BLOCKED_RUNTIME_CPU; evidence checker PASS; payload hashes verified; pending branch publication',payloads=len(entries),remaining=['task commit push exactref','owned watcher cleanup','coordinator handback'],box=BOX,state='RUNNING',expiry='2026-10-27T09:43:37Z',shutdownOwner='coordinator'))
 print('publication gate PASS',len(entries),'payloads',used,'used',j['completeProjectedTask'],'projected',raw,'raw API bytes')
elif label=='publication-incident':
 run=H/'repo/scratch/runs'/H.name
 for p in O.glob('git-*'):
  if p.is_file() and (p.name.endswith('.stderr') or p.name.endswith('-command.json')):shutil.copyfile(p,run/p.name)
 save('publication-incidents.json',dict(ignoredScratch=dict(returncode=1,commandReceipt='git-1793091803768847646-command.json',stderr='git-1793091803768847646.stderr',resolution='Explicit forced add of the authorized scoped report paths only; no files removed and no Git force push.')))
 shutil.copyfile(O/'publication-incidents.json',run/'publication-incidents.json')
 print('retained ignored report staging incident')
elif label=='packaging-correction':
 run=H/'repo/scratch/runs'/H.name;doc=H/'repo/docs/reviews'/H.name
 incidents=dict(ignoredScratch='Explicit scoped git add -f corrects ignored report paths; no force push.',selfManifest='Previous manifest accidentally included itself after repackaging; excluded self entry while preserving original failure stdout/stderr.',missingHistoricalBlob='Normal git commit rejected unavailable unchanged historical Army Authority tgz blob90413573b25a8bc99486bb8bdb4c64e60b45188d in immutable sparse donor. Preserve unchanged parent tree with git write-tree --missing-ok and commit-tree; no fetch/full checkout/repack. All NEW report payload blobs are present and hashed.',wrapperPropagation='Initial supervisor wrapper recorded child rejection but exited0. A packaging sequence therefore attempted next staging after a failed manifest check. No commit/push occurred. Wrapper now propagates child exit and later operations are sequenced only on inspected passing receipts. Original receipts retained; no behavioral acceptance or guest repeated.')
 save('publication-incidents-final.json',incidents);shutil.copyfile(O/'publication-incidents-final.json',run/'publication-incidents-final.json')
 for pattern in ['git-*.stderr','prepublish-*.stderr']:
  for p in O.glob(pattern):shutil.copyfile(p,run/p.name)
 for name in ['driver.py','supervised.py']:shutil.copyfile(O/name,run/name)
 with (doc/'README.md').open('a') as f:f.write('\nPackaging diagnostics are preserved in publication-incidents-final.json. Sparse donor lacks an unrelated historical blob, so publication preserves the unchanged parent tree with write-tree --missing-ok / commit-tree; only new report payloads are materialized. No full checkout, fetch, repack or acceptance rerun. The manifest self-reference and wrapper exit propagation mistakes are retained and corrected.\n')
 print('owned packaging corrections retained')
