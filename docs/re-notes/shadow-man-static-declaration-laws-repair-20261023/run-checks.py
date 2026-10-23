#!/usr/bin/env python3
"""Explicit bounded Python-only checks. No build/native/default recipe entry."""
import ctypes,hashlib,json,os,pathlib,resource,selectors,signal,subprocess,sys,time
sys.dont_write_bytecode=True
H=pathlib.Path(__file__).resolve().parent;R=H.parents[2]
DONOR=pathlib.Path('/home/user/wine-assembly-shadow-man-span-static-canonical-oct23')
COMBINED=pathlib.Path('/home/user/wine-assembly-shadow-man-complete-gate-data-readiness-oct23/build/combined.wat')
ENV=dict(os.environ,PYTHONDONTWRITEBYTECODE='1',GIT_NO_LAZY_FETCH='1',TMPDIR=str(H))
FILE=25165824;LOG=524288
def dump(name,value):(H/name).write_text(json.dumps(value,indent=2)+'\n')
def bounded(argv,label):
 assert ctypes.CDLL(None).prctl(36,1,0,0,0)==0
 def limits():
  resource.setrlimit(resource.RLIMIT_CPU,(60,60));resource.setrlimit(resource.RLIMIT_FSIZE,(FILE,FILE))
 p=subprocess.Popen(argv,cwd=R,env=ENV,stdout=subprocess.PIPE,stderr=subprocess.PIPE,start_new_session=True,preexec_fn=limits)
 sel=selectors.DefaultSelector();logs={};counts={'stdout':0,'stderr':0};retained=0;start=time.monotonic();reason=None;term=None
 for name,pipe in [('stdout',p.stdout),('stderr',p.stderr)]:
  os.set_blocking(pipe.fileno(),False);sel.register(pipe,selectors.EVENT_READ,name);logs[name]=(H/(label+'.'+name)).open('wb')
 while sel.get_map() or p.poll() is None:
  now=time.monotonic()
  if reason is None and now-start>60:reason='wall timeout'
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
  if any(f.stat().st_size>FILE for f in H.rglob('*') if f.is_file()):reason='regular file overflow'
 code=p.wait()
 try:os.killpg(p.pid,signal.SIGTERM)
 except ProcessLookupError:pass
 deadline=time.monotonic()+5
 while time.monotonic()<deadline:
  try:
   while os.waitpid(-1,os.WNOHANG)[0]:pass
  except ChildProcessError:break
  try:os.killpg(p.pid,0)
  except ProcessLookupError:break
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
 if remaining:reason='remaining process group'
 result=dict(argv=argv,cwd=str(R),pid=p.pid,exit=code if reason is None else 125,childExit=code,reason=reason,elapsed=time.monotonic()-start,streamBytes=counts,aggregateLogMax=LOG,retained=retained,fileMax=FILE,cpuSeconds=60,wallSeconds=60,termThenKillSeconds=5,subreaper=True,reaped=not remaining,remainingGroup=remaining)
 dump(label+'.json',result)
 return result['exit']
def verify():
 sha=lambda b:hashlib.sha256(b).hexdigest()
 expected=[('wine-assembly.wasm',1879746,'8fac39936b6df2418ad86cab118cef19a65a727f649fbc14c412b37818904686'),('wine-assembly.compat.wasm',1882319,'8590966d0fb0e015ee78d2f9897c5e87aff65861a58de0f7b392e549e099293d')]
 static=json.loads((H/'static-abi.json').read_text())
 assert static['state']=='STATIC_ABI_PASS' and static['fullSourceImportsCompared']==291 and static['fullSourceFunctionExportsCompared']==2227
 assert len(static['layout']['regions'])==269 and static['layout']['spans']==1 and static['layout']['payload']=='9a3bc9149d58209c'
 old=json.loads((DONOR/'docs/re-notes/shadow-man-span-static-canonical-20261023/static-abi.json').read_text())
 assert static==old,'binary/source/layout detailed serialization must be unchanged'
 for output,(name,size,digest) in zip(static['outputs'],expected):
  b=(DONOR/'build'/name).read_bytes()
  assert len(b)==output['bytes']==size and sha(b)==output['sha256']==digest
  assert len(output['types'])==172 and output['noStart'] and not output['native']
 assert COMBINED.stat().st_size==20696217 and sha(COMBINED.read_bytes())=='68cdd92ea9f1702b1bf6c6f216fe2b725d4de11fe57a154bc035e5a81e07467b'
 reject=pathlib.Path('/home/user/wine-assembly-shadow-man-span-static-independent-accept-oct23/docs/re-notes/shadow-man-span-static-independent-accept-20261023/reject-invalid-stride.py')
 assert (H/'reject-invalid-stride.py').read_bytes()==reject.read_bytes()
 assert (H/'test-static-abi.py').read_bytes()==(DONOR/'docs/re-notes/shadow-man-span-static-canonical-20261023/test-static-abi.py').read_bytes()
 assert 'stride/count size law' in (H/'independent-rejecting-test.stdout').read_text()
 compiler=DONOR/'tools/watx-src/compiler-codegen.js'
 buildblob=subprocess.check_output(['git','-C',str(DONOR),'rev-parse','b41a7c5f4b752d1f0bdab1141a11d4fed4dc6f9a:tools/build.sh'],env=ENV).decode().strip()
 assert buildblob=='5407cb296ee6cdab2e30a226d1188206beb852af'
 dump('verification.json',dict(state='REPAIR_CHECKS_PASS_PENDING_INDEPENDENT_ACCEPTANCE',unchangedOriginal16Tests=True,unchangedIndependentProbe=True,probeIntendedLaw=True,unchangedDetailedStaticABI=True,helperSHA256=sha((H/'static-abi.py').read_bytes()),compilerSHA256=sha(compiler.read_bytes()),compilerBytes=compiler.stat().st_size,buildBlob=buildblob,artifacts=[dict(name=n,bytes=s,sha256=h) for n,s,h in expected],fingerprint='9a3bc9149d58209c',imports=291,exports=2227,types=172,inventory=269,storage=268,spans=1,compiled=False,native=False,box=None))
 print('Original16 + declaration laws + unchanged rejecting probe + retained static comparison PASS; independent acceptance pending.')
def main():
 resource.setrlimit(resource.RLIMIT_CPU,(60,60));resource.setrlimit(resource.RLIMIT_FSIZE,(FILE,FILE))
 assert sys.argv[1:]==['--checks'],'explicit --checks required'
 commands=[('focused-tests',[sys.executable,str(H/'test-static-abi.py')]),('declaration-law-tests',[sys.executable,str(H/'test-declaration-laws.py')]),('independent-rejecting-test',[sys.executable,str(H/'reject-invalid-stride.py')]),('static-inspection-driver',[sys.executable,str(H/'static-abi.py'),'--input-root',str(DONOR),'--combined',str(COMBINED),'--output-dir',str(H)])]
 for label,argv in commands:
  code=bounded(argv,label)
  print(label,code,flush=True)
  if code:raise SystemExit(code)
 verify()
 assert sum((H/(label+'.'+stream)).stat().st_size for label,_ in commands for stream in ('stdout','stderr'))<=LOG
if __name__=='__main__':main()
