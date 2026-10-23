#!/usr/bin/env python3
"""One-shot exact backend admission and bounded execution; no guest execution."""
import ctypes,gzip,hashlib,json,os,pathlib,re,resource,selectors,shutil,signal,subprocess,sys,time
sys.dont_write_bytecode=True
H=pathlib.Path(__file__).resolve().parent; R=H.parents[2]
D=pathlib.Path('/home/user/wine-assembly-shadow-man-complete-gate-data-readiness-oct23')
E=D/'docs/re-notes/shadow-man-complete-gate-data-readiness-20261023'
OLD=pathlib.Path('/home/user/wine-assembly-shadow-man-capture-build-readiness-oct23/docs/re-notes/shadow-man-capture-build-readiness-20261023')
EXT=pathlib.Path('/home/user/wine-assembly/scratch/usage-watch/shadow-man-ready-canonical-module-oct23')
SESSION=pathlib.Path('/home/user/.codex/sessions/2026/10/23/rollout-2026-10-23T05-21-46-01a16735-443f-7c91-8b79-bb5bc35976e0.jsonl')
CAND='b41a7c5f4b752d1f0bdab1141a11d4fed4dc6f9a'
CAP=67108864;RESERVE=8388608;FLOOR=2982150144;MODULE=8388608;FILE=24*1048576;LOG=524288;GROW=2097152
ENV=dict(os.environ,GIT_NO_LAZY_FETCH='1',PYTHONDONTWRITEBYTECODE='1')
ENV.pop('NODE_OPTIONS',None);ENV.pop('WINE_REGION_SHAKE',None)
ENV.update(NODE_OPTIONS='--max-old-space-size=2048',WINE_WAT_COMPILER='watx',WINE_WAT_NAMES='0')
NODE=shutil.which('node')
def sha(b):return hashlib.sha256(b).hexdigest()
def dump(n,x):(H/n).write_text(json.dumps(x,indent=2)+'\n')
def size(p):return sum(q.stat().st_size for q in ([p]+list(p.rglob('*')) if p.is_dir() else [p]) if q.exists() and not q.is_symlink())
def git(*a):return subprocess.check_output(['git','-C',str(D),*a],env=ENV)
def exact(row):
 b=git('cat-file','blob',row['blob']);assert len(b)==row['bytes'] and sha(b)==row['sha256'],row['path'];return b
def account(label,extra=0):
 own=size(R);external=size(EXT)+size(SESSION);free=shutil.disk_usage(R).free
 x=dict(label=label,owned=own,external=external,growth=GROW,reserve=RESERVE,extra=extra,total=own+external+GROW+RESERVE+extra,cap=CAP,hostFree=free,hostFloor=FLOOR)
 x['admitted']=x['total']<=CAP and free-extra-GROW>=FLOOR
 with (H/'resources.jsonl').open('a') as f:f.write(json.dumps(x)+'\n')
 assert x['admitted'],x
 return x
def plan():
 m=json.loads(gzip.decompress((E/'phase-manifest.json.gz').read_bytes()));rows={r['path']:r for r in m['rows']}
 tree={l.split('\t')[1]:l.split()[2] for l in git('ls-tree','-r',CAND).decode().splitlines()}
 # All top-level WAT/WATX is a dynamic directory read, including main.watx.
 selected={f for f in tree if re.fullmatch(r'src/[^/]+\.(wat|watx)',f)}
 selected.update(['tools/build-compile-wat.js','tools/watx-closure.js','tools/watx.js','tools/region-layout-hash.js','lib/dispatch-trampoline.js','tools/wasm-data.js','lib/region-map.generated.js','tools/build.sh'])
 selected.update('tools/watx-src/'+f for f in ['compiler-parser.js','compiler-stages.js','compiler-codegen.js','compiler.js'])
 # layoutHash's region-layout.js require is inside an uncalled helper/CLI,
 # not in the exported layoutHash/appendSection build path.
 out=[]
 for f in sorted(selected):
  r=rows[f];assert r['blob']==tree[f];b=exact(r);out.append(dict(r,consumer='compiler' if f!='tools/wasm-data.js' else 'postcompile'))
 build=exact(rows['tools/build.sh']);assert hashlib.sha1(b'blob '+str(len(build)).encode()+b'\0'+build).hexdigest()=='5407cb296ee6cdab2e30a226d1188206beb852af'
 assert build.count(b'\nnode tools/build-compile-wat.js\n')==1
 qualifier=(OLD/'qualify-after-admission.cjs').read_bytes();assert len(qualifier)==1817 and sha(qualifier)=='4f8b0bbddac21abc821f7da77dc4d7a8573a81b15358a3ff75f173b40a862bdc'
 # Independently check accepted prefix and diagnostic surface, not replay gates.
 assert json.loads((E/'result.json').read_text())['exit']==0
 combined=D/'build/combined.wat';cb=combined.read_bytes();assert len(cb)==20696217 and sha(cb)=='68cdd92ea9f1702b1bf6c6f216fe2b725d4de11fe57a154bc035e5a81e07467b'
 includes=re.findall(r'\(include "([^"]+)"\)',exact(rows['src/main.watx']).decode());assert cb==b'(module\n'+b''.join(exact(rows['src/'+f]) for f in includes)+b')\n'
 tools=[]
 for n in ['node','python3','git','ssh','bash']:
  p=pathlib.Path(shutil.which(n)).resolve();tools.append(dict(name=n,path=str(p),bytes=p.stat().st_size,sha256=sha(p.read_bytes()),standing=True))
 versions={n:subprocess.check_output(a,text=True).strip() for n,a in [('node',[NODE,'--version']),('python',[sys.executable,'--version']),('git',['git','--version'])]}
 sources=sum(r['bytes'] for r in out)
 # Reserve both <=8MiB modules, independent per-stream logs, evidence/Git/dirs,
 # plus external growth and reserve in every phase. No scanner or combined copy.
 extra=sources+2*MODULE+2*LOG+2*1048576+262144
 dump('manifest.json',dict(candidate=CAND,producerReview='4dab22cfefb7b7048fbb6189b81cdccdd4ab8753',prefixCommit='3c1bfd31b6054bdb3910b8049f20db626167ca36',files=out,qualifier=dict(path=str(OLD/'qualify-after-admission.cjs'),bytes=len(qualifier),sha256=sha(qualifier)),standingCombined=dict(path=str(combined),bytes=len(cb),sha256=sha(cb)),tools=tools,versions=versions))
 a=account('combined admission BEFORE staging',extra)
 dump('preflight.json',dict(accounting=a,sourceBytes=sources,outputs=dict(primaryMax=MODULE,compatMax=MODULE,estimate='bounded reservation, actual unknown until authentic compile',combined='standing read-only diagnostic; never compiler input'),argv=[NODE,'--wasm-max-module-size=8388608','tools/build-compile-wat.js'],env={k:ENV[k] for k in ['NODE_OPTIONS','WINE_WAT_COMPILER','WINE_WAT_NAMES']},unset=['WINE_REGION_SHAKE','inherited NODE_OPTIONS'],wallSeconds=900,cpuSeconds=900,termThenKillSeconds=5,fileMax=FILE,stdoutMax=LOG,stderrMax=LOG,nodeOldSpaceMiB=2048,totalRSS='not limited by old-space; unknown peak; host available memory recorded separately',native='two internal Module constructions; V8 module-size guard <=8MiB, no Memory/Instance',postchecks=['exact wasm-data primary --overlaps','pinned qualifier with actual SHA','binary full signature and layout comparison'],closure='all src top-level WAT/WATX; 4 dynamically vm-loaded compiler stages; explicit watx/closure/layout-hash/trampoline; built-in fs/path/vm/crypto; no external package, media or generated input; inactive CLI dependency not consumed',release='retain all compiler sources through backend, then release only if needed; no planned deletion needed',procMeminfo=pathlib.Path('/proc/meminfo').read_text(),limits=resource.getrlimit(resource.RLIMIT_FSIZE)))
 print(json.dumps(a));return 0
def childlimits():
 resource.setrlimit(resource.RLIMIT_CPU,(900,900));resource.setrlimit(resource.RLIMIT_FSIZE,(FILE,FILE))
def bounded(argv,label,cwd=R):
 # Pipe limits are separate from regular-file RLIMIT; subreaper guarantees reap.
 ctypes.CDLL(None).prctl(36,1,0,0,0)
 p=subprocess.Popen(argv,cwd=cwd,env=ENV,stdout=subprocess.PIPE,stderr=subprocess.PIPE,start_new_session=True,preexec_fn=childlimits)
 sel=selectors.DefaultSelector();logs={};counts={'stdout':0,'stderr':0};start=time.monotonic();reason=None;term=None
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
   name=key.data;remaining=LOG-counts[name];logs[name].write(b[:max(0,remaining)]);counts[name]+=len(b)
   if counts[name]>LOG:reason=name+' overflow'
  for f in R.rglob('*'):
   if f.is_file() and f.stat().st_size>FILE:reason='regular file overflow '+str(f)
 code=p.wait()
 for f in logs.values():f.close()
 try:
  while True:os.waitpid(-1,0)
 except ChildProcessError:pass
 result=dict(argv=argv,cwd=str(cwd),exit=code,reason=reason,elapsed=time.monotonic()-start,streamBytes=counts,reaped=True)
 dump(label+'.json',result)
 return code if reason is None else 125
def controls():
 # Tiny negative controls use identical guards, no wasm/native or guest.
 results={}
 results['small']=bounded([sys.executable,'-c','print("small control")'],'control-small')==0
 results['nativeSizeBound']=bounded([NODE,'--wasm-max-module-size=8','-e','try { new WebAssembly.Module(Uint8Array.from([0,97,115,109,1,0,0,0,0,0])); process.exit(1); } catch(e) { if (!/size|maximum/i.test(e.message)) throw e; console.log(e.message); }'],'control-native-size')==0
 results['logOverflow']=bounded([sys.executable,'-c','import os;os.write(1,b"x"*524289)'],'control-log')==125
 results['fileOverflow']=bounded([sys.executable,'-c','import os;f=open("guard-control.tmp","wb");f.truncate(25165825)'],'control-file')!=0
 (R/'guard-control.tmp').unlink(missing_ok=True)
 dump('controls.json',results);assert all(results.values())
def stage():
 m=json.loads((H/'manifest.json').read_text());account('before source staging',sum(r['bytes'] for r in m['files'])+2*MODULE+2*LOG+2097152)
 for r in m['files']:
  p=R/r['path'];p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(exact(r))
 account('staged before backend',2*MODULE+2*LOG+2097152)
def run():
 assert not (H/'attempt.json').exists(),'one-shot already consumed'
 dump('attempt.json',dict(candidate=CAND,state='started'))
 controls();stage()
 code=bounded([NODE,'--wasm-max-module-size=8388608','tools/build-compile-wat.js'],'backend')
 dump('result.json',dict(state='BACKEND_PASS' if code==0 else 'BLOCKED',exit=code))
 if code:return code
 account('after backend')
 outputs=[]
 for f in ['wine-assembly.wasm','wine-assembly.compat.wasm']:
  p=R/'build'/f;b=p.read_bytes();assert len(b)<=MODULE;outputs.append(dict(path=str(p),bytes=len(b),sha256=sha(b)))
 dump('outputs.json',outputs)
 code=bounded([NODE,'tools/wasm-data.js','build/wine-assembly.wasm','--overlaps'],'postcompile')
 if code:return code
 for i,o in enumerate(outputs):
  assert sha((OLD/'qualify-after-admission.cjs').read_bytes())=='4f8b0bbddac21abc821f7da77dc4d7a8573a81b15358a3ff75f173b40a862bdc'
  code=bounded([NODE,'--wasm-max-module-size=8388608',str(OLD/'qualify-after-admission.cjs'),o['path'],o['sha256']],'qualifier-'+str(i))
  if code:return code
 dump('result.json',dict(state='PENDING_FULL_ABI_CHECK',exit=0));account('after qualification');return 0
if __name__=='__main__':
 try:sys.exit(run() if '--run' in sys.argv else plan())
 except Exception as e:
  dump('blocker.json',dict(error=str(e),type=type(e).__name__));print('BLOCKED',e,file=sys.stderr);sys.exit(3)
