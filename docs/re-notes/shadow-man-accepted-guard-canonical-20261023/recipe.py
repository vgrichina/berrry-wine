#!/usr/bin/env python3
"""One consolidated admission and ONE explicitly requested guarded backend.

No default execution, guard controls, gates, decoder, Memory or Instance.
Read-only donor recipe supplies exact blob recovery/accounting primitives.
"""
import ctypes,hashlib,importlib.util,json,os,pathlib,re,resource,selectors,shutil,signal,subprocess,sys,time
sys.dont_write_bytecode=True
H=pathlib.Path(__file__).resolve().parent; R=H.parents[2]
DONOR=pathlib.Path('/home/user/wine-assembly-shadow-man-native-bound-canonical-oct23')
DH=DONOR/'docs/re-notes/shadow-man-native-bound-canonical-20261023'
BOUND=pathlib.Path('/home/user/wine-assembly-shared-native-bound-boundary-controls-oct23')
BH=BOUND/'docs/re-notes/shared-native-bound-boundary-controls-20261023'
REVIEW=pathlib.Path('/home/user/wine-assembly-render-positiont-guarded-com-qualification-oct23')
RH=REVIEW/'docs/re-notes/render-positiont-guarded-com-qualification-20261023'
GUARD=DH/'native-module-bound.cjs'; STATIC=DH/'static-abi.py'
GUARD_SHA='47ce2e2b835be33eab6b2b24f027ecaab8ceb61c559890e51548c78199beb197'
EXT=pathlib.Path('/home/user/wine-assembly/scratch/usage-watch/shadow-man-accepted-guard-canonical-oct23')
SESSION=pathlib.Path('/home/user/.codex/sessions/2026/10/23/rollout-2026-10-23T05-53-19-01a16752-2872-7283-91d6-f41ebee91d76.jsonl')
spec=importlib.util.spec_from_file_location('donor',DH/'recipe.py');d=importlib.util.module_from_spec(spec);spec.loader.exec_module(d)
d.H=H;d.R=R;d.EXT=EXT;d.SESSION=SESSION;d.GROW=4194304
ENV=d.ENV;NODE=d.NODE;MODULE=d.MODULE;LOG=d.LOG;FILE=d.FILE
sha=d.sha;dump=d.dump
def readgit(root,*args):
 return subprocess.check_output(['git','-C',str(root),*args],env=ENV)
def verify_seals(root,folder,commit):
 seals=json.loads((folder/'seals.json').read_text())
 for row in seals:
  b=(root/row['path']).read_bytes()
  assert len(b)==row['bytes'] and sha(b)==row['sha256'],row['path']
  assert readgit(root,'show',commit+':'+row['path'])==b,row['path']
 return dict(root=str(root),commit=commit,seals=len(seals))
def bounded(argv,label,cwd=R):
 # Aggregate capture bound, finite regular-file limit, process-group cleanup.
 assert ctypes.CDLL(None).prctl(36,1,0,0,0)==0
 def limits():
  resource.setrlimit(resource.RLIMIT_CPU,(900,900));resource.setrlimit(resource.RLIMIT_FSIZE,(FILE,FILE))
 p=subprocess.Popen(argv,cwd=cwd,env=ENV,stdout=subprocess.PIPE,stderr=subprocess.PIPE,start_new_session=True,preexec_fn=limits)
 sel=selectors.DefaultSelector();logs={};counts={'stdout':0,'stderr':0};retained=0;start=time.monotonic();reason=None;term=None;leader_done=False
 for name,pipe in [('stdout',p.stdout),('stderr',p.stderr)]:
  os.set_blocking(pipe.fileno(),False);sel.register(pipe,selectors.EVENT_READ,name);logs[name]=(H/(label+'.'+name)).open('wb')
 while sel.get_map() or p.poll() is None:
  now=time.monotonic()
  if reason is None and now-start>900:reason='wall timeout'
  if reason is not None and term is None:
   try:os.killpg(p.pid,signal.SIGTERM)
   except ProcessLookupError:pass
   term=now
  if term is not None and now-term>=5:
   try:os.killpg(p.pid,signal.SIGKILL)
   except ProcessLookupError:pass
  for key,_ in sel.select(.05):
   b=os.read(key.fileobj.fileno(),65536)
   if not b:sel.unregister(key.fileobj);key.fileobj.close();continue
   name=key.data;keep=b[:max(0,LOG-retained)];logs[name].write(keep);retained+=len(keep);counts[name]+=len(b)
   if sum(counts.values())>LOG:reason='aggregate stdout+stderr overflow'
  for f in R.rglob('*'):
   if f.is_file() and f.stat().st_size>FILE:reason='regular file overflow '+str(f)
 code=p.wait()
 # Even a successful leader must not leave surviving children. These commands
 # are synchronous and do not intentionally daemonize.
 try:os.killpg(p.pid,signal.SIGTERM)
 except ProcessLookupError:pass
 deadline=time.monotonic()+5
 while time.monotonic()<deadline:
  try:os.killpg(p.pid,0)
  except ProcessLookupError:break
  try:
   while os.waitpid(-1,os.WNOHANG)[0]:pass
  except ChildProcessError:break
  time.sleep(.05)
 try:os.killpg(p.pid,signal.SIGKILL)
 except ProcessLookupError:pass
 try:
  while True:os.waitpid(-1,0)
 except ChildProcessError:pass
 for f in logs.values():f.close()
 remaining=[]
 for q in pathlib.Path('/proc').iterdir():
  if not q.name.isdigit():continue
  try:
   fields=(q/'stat').read_text().split(') ',1)[1].split()
   if int(fields[2])==p.pid:remaining.append(int(q.name))
  except (OSError,IndexError):pass
 assert not remaining,remaining
 result=dict(argv=argv,cwd=str(cwd),pid=p.pid,exit=code,reason=reason,elapsed=time.monotonic()-start,streamBytes=counts,aggregateLogMax=LOG,retained=retained,fileMax=FILE,cpuSeconds=900,wallSeconds=900,termThenKillSeconds=5,subreaper=True,reaped=True,remainingGroup=remaining,maxChildRSSBytes=resource.getrusage(resource.RUSAGE_CHILDREN).ru_maxrss*1024)
 dump(label+'.json',result)
 return code if reason is None else 125
def memory():
 return int(re.search(r'^MemAvailable:\s+(\d+)',pathlib.Path('/proc/meminfo').read_text(),re.M).group(1))*1024
def admission():
 # Reuse exact measured closure, not a fresh scanner/materialization pass.
 m=json.loads((DH/'manifest.json').read_text());rows=m['files']
 assert m['candidate']==d.CAND and len(rows)==140 and sum(r['bytes'] for r in rows)==21207647
 pins=[]
 for row in rows:
  assert readgit(DONOR,'rev-parse',d.CAND+':'+row['path']).decode().strip()==row['blob']
  d.exact(row);pins.append(row)
 assert len([r for r in pins if re.fullmatch(r'src/[^/]+\.(wat|watx)',r['path'])])==128
 selected={r['path']:d.exact(r) for r in rows if r['path'].endswith('.js') or r['path']=='tools/build.sh'}
 assert selected['tools/build.sh'].count(b'\nnode tools/build-compile-wat.js\n')==1
 # Audited native call sites: fixed Buffers, direct global synchronous Module,
 # no captured constructor, VM escape, async compile or instantiation route.
 build=selected['tools/build-compile-wat.js'].decode()
 assert "new WebAssembly.Module(buf)" in build and "out[key] = appendSection(Buffer.from(r.wasmBinary), stamp)" in build
 closure=selected['tools/watx-closure.js'].decode()
 for token in ["mode: 'production'","standardWat: true","runtimeBuiltins: false","strictDeclarations: true"]:assert token in closure
 for path,b in selected.items():
  assert not re.search(rb'WebAssembly\.(?:Memory|Instance|instantiate|compile|validate)\s*\(',b),path
 qualifier=pathlib.Path(m['qualifier']['path']);qb=qualifier.read_bytes()
 assert sha(qb)==m['qualifier']['sha256']=='4f8b0bbddac21abc821f7da77dc4d7a8573a81b15358a3ff75f173b40a862bdc'
 assert b'const mod=new WebAssembly.Module(b)' in qb and b"fs.readFileSync(file)" in qb
 assert sha(GUARD.read_bytes())==GUARD_SHA
 accepted=json.loads((RH/'independent-review.json').read_text());boundary=json.loads((RH/'boundary-acceptance.json').read_text())
 assert accepted['guardAcceptance']=='ACCEPTED' and boundary['accepted'] and boundary['guardSha256']==GUARD_SHA
 seals=[verify_seals(DONOR,DH,'9f442e41bb81853659d8664e1aa903e560d4061e'),verify_seals(BOUND,BH,'004eb539fd58168ce935f829e3fb5cd26f350df6'),verify_seals(REVIEW,RH,'80b28a502f18f933c2bf5b45be04a26e79acbf9a')]
 for t in m['tools']:
  p=pathlib.Path(t['path']);assert p.stat().st_size==t['bytes'] and sha(p.read_bytes())==t['sha256']
 assert pathlib.Path('/usr/lib/python3.12').is_dir()
 combined=pathlib.Path(m['standingCombined']['path']);assert combined.stat().st_size==20696217 and sha(combined.read_bytes())=='68cdd92ea9f1702b1bf6c6f216fe2b725d4de11fe57a154bc035e5a81e07467b'
 assert json.loads((d.E/'result.json').read_text())['exit']==0
 assert readgit(DONOR,'show','9f442e41bb81853659d8664e1aa903e560d4061e:'+str(STATIC.relative_to(DONOR)))==STATIC.read_bytes()
 ssh='ssh -o BatchMode=yes -o StrictHostKeyChecking=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -i /home/user/.ssh/wine_github_ed25519'
 refs={'refs/heads/task/shadow-man-native-bound-canonical-oct23':'9f442e41bb81853659d8664e1aa903e560d4061e','refs/heads/task/shared-native-bound-boundary-controls-oct23':'004eb539fd58168ce935f829e3fb5cd26f350df6','refs/heads/task/render-positiont-guarded-com-qualification-oct23':'80b28a502f18f933c2bf5b45be04a26e79acbf9a','refs/heads/main':'bb9c496ed13095cc832fdf607f0937fb9c14b7de'}
 remote=subprocess.check_output(['git','ls-remote','git@github.com:vgrichina/wine-assembly.git',*refs],env=dict(ENV,GIT_SSH_COMMAND=ssh),text=True)
 actual={line.split()[1]:line.split()[0] for line in remote.splitlines()};dump('remote-before.json',dict(expected=refs,actual=actual,ssh=ssh));assert actual==refs
 # Complete 64MiB projection includes all source, both bounded modules, six
 # aggregate captures, report/Git/index/dirs growth, external growth and reserve.
 extra=21207647+2*MODULE+6*LOG+2097152+262144
 a=d.account('ONE consolidated pre-build admission before source staging',extra)
 available=memory()
 pre=dict(candidate=d.CAND,closure=m,verifiedSeals=seals,acceptedGuard=dict(path=str(GUARD),sha256=GUARD_SHA,scope='audited synchronous fixed Buffer Module callsites only; not hostile sandbox',compiler='new WebAssembly.Module(buf) with Buffer from appendSection',qualifier='new WebAssembly.Module(b) with fs.readFileSync Buffer',controls='reused, no replay'),staticHelper=dict(path=str(STATIC),sha256=sha(STATIC.read_bytes())),standingDependencies=json.loads((DH/'standing-dependencies.json').read_text()),accounting=a,MemAvailable=available,memoryMinimum=2684354560,argv=[NODE,'--require',str(GUARD),'tools/build-compile-wat.js'],environment={k:ENV[k] for k in ['NODE_OPTIONS','WINE_WAT_COMPILER','WINE_WAT_NAMES']},unset=['inherited NODE_OPTIONS','WINE_REGION_SHAKE'],bounds=dict(file=FILE,aggregateCapture=LOG,module=MODULE,oldSpaceMiB=2048,cpuSeconds=900,wallSeconds=900,termThenKillSeconds=5,subreaper=True,reserve=d.RESERVE,totalRSS='not bounded by old space'),prefix='52 successful gates and decoder REUSED',noDefaultCompile=True,noWorkers=True,noMemory=True,noInstance=True)
 # Read-only compatibility check of the unchanged helper's exact algorithm.
 # Do not repair it, alter its mirror input or execute a known-doomed build.
 mirror=selected['lib/region-map.generated.js'].decode()
 matches=re.findall(r"^\s+\w+: \{ name: '([^']+)', base: (0x[\da-fA-F_]+), size: (0x[\da-fA-F_]+), end: (0x[\da-fA-F_]+), within:",mirror,re.M)
 text='\n'.join(sorted(f"{n}:{int(b.replace('_',''),16):08X}:{int(s.replace('_',''),16):08X}" for n,b,s,e in matches))+'\n'
 computed=sha(text.encode())[:16];declared=re.search(r"const LAYOUT_HASH = ['\"]([a-f0-9]{16})['\"]",mirror).group(1)
 compatibility=dict(helper=str(STATIC),helperSHA256=sha(STATIC.read_bytes()),mirrorSHA256=sha(selected['lib/region-map.generated.js']),matchedRows=len(matches),helperComputedLayout=computed,candidateDeclaredLayout=declared,compatible=computed==declared,assertion='static-abi.py main: assert layout==declared,(layout,declared)',nativeExecuted=False)
 dump('helper-compatibility.json',compatibility);pre['helperCompatibility']=compatibility
 dump('preflight.json',pre)
 dump('manifest.json',m)
 assert computed==declared,('STATIC_HELPER_LAYOUT_INCOMPATIBLE',computed,declared,len(matches))
 assert available>=2684354560,('fresh prebuild memory',available,2684354560)
 return m
def controls():
 # Driver/file controls only; no guard implementation/control replay.
 assert bounded([sys.executable,'-c','print("small")'],'driver-small')==0
 assert bounded([sys.executable,'-c','import os;os.write(1,b"x"*262144);os.write(2,b"y"*262145)'],'driver-overflow')==125
 assert bounded([sys.executable,'-c','f=open("file-control.tmp","wb");f.truncate(25165825)'],'driver-file')!=0
 (R/'file-control.tmp').unlink(missing_ok=True)
 dump('driver-controls.json',dict(passed=True,aggregateOverflow=True,fileEFBIG=True,guardControlsReplayed=False))
def run():
 assert not (H/'attempt.json').exists(),'one-shot already consumed'
 dump('attempt.json',dict(candidate=d.CAND,started=time.time()))
 m=admission();controls()
 for row in m['files']:
  p=R/row['path'];p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(d.exact(row))
 # Revalidate actual staged pins, file/log coverage and capacity immediately
 # before the sole compiler Popen. No control or source work after this gate.
 for row in m['files']:
  b=(R/row['path']).read_bytes();assert len(b)==row['bytes'] and sha(b)==row['sha256']
 a=d.account('fresh immediately-before-compiler disk',2*MODULE+6*LOG+2097152+262144)
 av=memory();dump('compiler-admission.json',dict(MemAvailable=av,minimum=2684354560,accounting=a))
 assert av>=2684354560,('fresh compiler memory',av,2684354560)
 code=bounded([NODE,'--require',str(GUARD),'tools/build-compile-wat.js'],'backend')
 assert code==0,('backend',code)
 outputs=[]
 for name in ['wine-assembly.wasm','wine-assembly.compat.wasm']:
  p=R/'build'/name;b=p.read_bytes();assert len(b)<=MODULE;outputs.append(dict(path=str(p),bytes=len(b),sha256=sha(b)))
 dump('outputs.json',outputs)
 assert bounded([NODE,'tools/wasm-data.js','build/wine-assembly.wasm','--overlaps'],'postcompile')==0
 for i,o in enumerate(outputs):
  q=pathlib.Path(m['qualifier']['path']);assert sha(q.read_bytes())==m['qualifier']['sha256']
  assert bounded([NODE,'--require',str(GUARD),str(q),o['path'],o['sha256']],'qualifier-'+str(i))==0
 script='import importlib.util,pathlib,sys;sys.dont_write_bytecode=True;s=importlib.util.spec_from_file_location("abi",sys.argv[1]);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);m.H=pathlib.Path(sys.argv[2]);m.R=pathlib.Path(sys.argv[3]);m.main()'
 assert bounded([sys.executable,'-c',script,str(STATIC),str(H),str(R)],'static-abi')==0
 dump('result.json',dict(state='GUARDED_MODULE_STATIC',exit=0,outputs=outputs,Memory=False,Instance=False,guest=False))
 d.account('successful static qualification retained outputs')
 print('GUARDED_MODULE_STATIC')
if __name__=='__main__':
 if sys.argv[1:]!=['--run']:
  print('No default compile. Explicit --run is one-shot admission/build/static.');sys.exit(0)
 try:run()
 except Exception as e:
  dump('blocker.json',dict(type=type(e).__name__,error=str(e)));dump('result.json',dict(state='BLOCKED',exit=3,error=str(e)))
  print('BLOCKED',str(e),file=sys.stderr);sys.exit(3)
