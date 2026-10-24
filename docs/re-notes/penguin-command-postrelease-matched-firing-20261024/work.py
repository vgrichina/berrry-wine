import pathlib,subprocess,json,os,hashlib,shutil,time,shlex,base64,zlib
H=pathlib.Path(__file__).parent
OLD=pathlib.Path('/tmp/penguin-integrated-clock-firing-oct24')
R=str(H); S=str(OLD); BOX='bx_fkg5uw8h'
B='/home/user/.ascii/boat'; REV='5691793a58b4670fd2a621114d7926100a1e47de'
BRANCH='task/penguin-postrelease-matched-firing-oct24'
E=H/'repo/docs/re-notes/penguin-command-postrelease-matched-firing-20261024'
def save(n,j):
 p=H/n;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(j,indent=2)+'\n')
def sha(b):return hashlib.sha256(b).hexdigest()
def remote(cmd,timeout=30):
 assert len(cmd.encode())<=36000
 p=subprocess.run([B,'--no-update','--json','exec','--timeout',str(timeout),BOX,cmd],capture_output=True,text=True,timeout=timeout+15)
 j=json.loads(p.stdout)
 if p.returncode or j.get('exitCode')!=0 or j.get('stdoutTruncated') or j.get('stderrTruncated'):
  save('first-rejection.json',j);raise RuntimeError(str(j)[:1500])
 return j
def py(code,timeout=30):return remote('python3 -c '+shlex.quote(code),timeout)
def send(b,target):
 assert len(b)<18000
 code='import pathlib,base64;p=pathlib.Path('+repr(target)+');p.parent.mkdir(parents=True,exist_ok=True);assert not p.exists();p.write_bytes(base64.b64decode('+repr(base64.b64encode(b).decode())+'))'
 return py(code)
def get(src,dst):
 meta=json.loads(py('import pathlib,hashlib,json,zlib;b=pathlib.Path('+repr(src)+').read_bytes();print(json.dumps(dict(bytes=len(b),sha256=hashlib.sha256(b).hexdigest(),zbytes=len(zlib.compress(b)))))')['stdout'])
 out=bytearray()
 for off in range(0,meta['zbytes'],4096):
  code='import pathlib,zlib,base64;b=zlib.compress(pathlib.Path('+repr(src)+').read_bytes());print(base64.b64encode(b['+str(off)+':'+str(off+4096)+']).decode())'
  out.extend(base64.b64decode(py(code)['stdout']))
 b=zlib.decompress(out);assert len(b)==meta['bytes'] and sha(b)==meta['sha256'];dst.parent.mkdir(parents=True,exist_ok=True);dst.write_bytes(b)
 return dict(path=str(dst.relative_to(E)),**meta)
def git(*args):return subprocess.check_output(['git','-C',str(H/'repo'),*args],stderr=subprocess.DEVNULL).decode().strip()
if __name__=='__main__':
 if os.sys.argv[1]=='setup':
  sqlite={str(p):p.stat().st_size for p in pathlib.Path('/home/user/.codex').glob('*.sqlite*') if p.is_file()};save('sqlite-baseline.json',sqlite)
  j=py('import pathlib,os,json,hashlib;h=pathlib.Path('+repr(S)+');print(json.dumps(dict(uid=os.getuid(),memAvailable=int(next(x.split()[1] for x in pathlib.Path("/proc/meminfo").read_text().splitlines() if x.startswith("MemAvailable:")))*1024,free=os.statvfs("/tmp").f_bavail*os.statvfs("/tmp").f_frsize,standingBytes=sum(p.stat().st_size for p in h.rglob("*") if p.is_file()),identities={str(p):dict(bytes=p.stat().st_size,sha256=hashlib.sha256(p.read_bytes()).hexdigest()) for p in [h/"runner/test/run.js",h/"runtime/build/wine-assembly.wasm",h/"game/penguin-command.exe"]})))');save('source-health-api.json',j);r=json.loads(j['stdout'])
  alloc=dict(remoteNew=12582912,localCheckoutGitTransportEvidence=16777216,externalSessionLauncherSQLiteFuture=25165824,reserve=8388608);peak=sum(alloc.values());free=shutil.disk_usage('/tmp').free
  tools=[]
  for p in [B,shutil.which('python3'),shutil.which('git')]:
   q=pathlib.Path(p).resolve();tools.append(dict(path=str(q),bytes=q.stat().st_size,sha256=sha(q.read_bytes())))
  a=dict(allocations=alloc,peak=peak,cap=67108864,free=free,localAfter=free-peak,remoteAfter=r['free']-peak,standingPrior=json.load(open(OLD/'resource-final.json')),standingTools=tools,captureTextProjected=900000,captureCap=1048576,historyRetained=True,passAdmission=peak<=67108864 and min(free-peak,r['free']-peak)>=2982150144 and r['memAvailable']>=2684354560)
  save('admission.json',a);assert a['passAdmission'];assert r['standingBytes']==26478368
  assert [x['sha256'] for x in r['identities'].values()]==['3c59fd034391e069f24a6047cf96cd8dac84a791d7d7591d55e5f7cb6e161a5e','8fac39936b6df2418ad86cab118cef19a65a727f649fbc14c412b37818904686','14d6e430c26c44c94ef5c176eca2f66edd82dd66fd155d29a5596e3d6e170fc1']
  repo=H/'repo';subprocess.run(['git','init','-q',str(repo)],check=True)
  objects=[];queue=[pathlib.Path('/tmp/input-consumption-clock-independent-closeout-oct24/repo/.git/objects')]
  while queue:
   o=queue.pop().resolve()
   if str(o) in objects:continue
   objects.append(str(o));alt=o/'info/alternates'
   if alt.exists():queue.extend((o/x).resolve() if not x.startswith('/') else pathlib.Path(x) for x in alt.read_text().splitlines())
  (repo/'.git/objects/info/alternates').write_text('\n'.join(objects)+'\n')
  git('config','core.sparseCheckout','true');(repo/'.git/info/sparse-checkout').write_text('/docs/re-notes/penguin-command-postrelease-matched-firing-20261024.md\n/docs/re-notes/penguin-command-postrelease-matched-firing-20261024/\n')
  git('update-ref','refs/heads/'+BRANCH,REV);git('symbolic-ref','HEAD','refs/heads/'+BRANCH);git('read-tree','-mu','HEAD');git('remote','add','origin','git@github.com:vgrichina/wine-assembly.git');E.mkdir(parents=True)
  # Retain actual supervisor, changing only new output root, standing runner cwd,
  # fixed cap metadata and explicit lifecycle/deadline. Never copy runtime inputs.
  s=(OLD/'supervise.py').read_text().replace("cwd=H/'runner'","cwd=pathlib.Path("+repr(S+"/runner")+")").replace('maxBatches=200000','maxBatches=43000').replace('shutdown05:15UTC','shutdown05:20UTC').replace("name=sys.argv[1];assert", "assert time.time()<1792818990, 'deadline leaves 90s before05:18UTC'\nname=sys.argv[1];assert")
  (H/'supervise.py').write_text(s);save('supervisor-diff.json',dict(originalSHA=sha((OLD/'supervise.py').read_bytes()),newSHA=sha(s.encode()),changes=['new output root','standing runner cwd','43000 metadata','05:20 lifecycle','latest start05:16:30']))
  send(s.encode(),R+'/supervise.py')
  for name in ['control','treatment']:
   args=json.load(open(OLD/'control-args.json'));args=[x for x in args if not x.startswith(('--input=','--png='))]
   inputs=['33000:mousemove:420:360','34000:mousedown:420:360','34500:mouseup:420:360','34800:mousemove:260:220']
   if name=='treatment':inputs+=['40000:keydown:65','40200:keyup:65']
   inputs += [str(b)+':png:'+R+'/'+name+'/b'+str(b)+'.png' for b in [39999,40020,40100,40201,40500,41000]]
   inputs.sort(key=lambda x:int(x.split(':')[0]));args+=['--input='+','.join(inputs)]
   save(name+'-inputs.json',inputs);save(name+'-args.json',args);send((H/(name+'-args.json')).read_bytes(),R+'/'+name+'-args.json')
  print(json.dumps(dict(passAdmission=True,peak=peak,repo=str(repo))))
 elif os.sys.argv[1]=='run':
  name=os.sys.argv[2];assert name in ['control','treatment'];assert not (H/(name+'-launch-api.json')).exists()
  j=remote('python3 '+shlex.quote(R+'/supervise.py')+' '+name,100);save(name+'-launch-api.json',j)
  seals=[]
  for f in ['output.log','terminal.json','command.json']:seals.append(get(R+'/'+name+'/'+f,E/name/f))
  save(name+'-collection-seals.json',seals);print(j['stdout'])
