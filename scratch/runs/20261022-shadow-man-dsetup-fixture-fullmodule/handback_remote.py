import pathlib,subprocess,json,os,hashlib,datetime
R=pathlib.Path('/home/user/shadow-man-dsetup-canonical-qualification-oct22');E=R/'evidence-fixture-fullmodule';os.chdir(R)
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
env=dict(os.environ,GIT_NO_LAZY_FETCH='1')
def git(*a):return subprocess.check_output(['git',*a],env=env).decode().strip()
H='c9681105dd96ab31a8a709eeb61242ad5ad60cae'
assert git('rev-parse','HEAD')==H and not git('status','--porcelain','--untracked-files=no')
manifest=json.loads((E/'build-inputs.json').read_text())
for row in manifest['inputs']:
 p=R/row['path'];assert sha(p)==row['sha256'] and p.stat().st_size==row['bytes'],row['path']
# Binary-only provenance check: the default source compiler does not append
# the canonical builder's layout custom section. Never compile/instantiate here.
b=(R/'build/wine-assembly.wasm').read_bytes()
def leb(data,at):
 v=0;s=0
 while True:
  x=data[at];at+=1;v|=(x&127)<<s
  if x<128:return v,at
  s+=7
at=8;out=b[:8];removed=[]
while at<len(b):
 start=at;kind=b[at];size,payload=leb(b,at+1);end=payload+size;name=None
 if kind==0:
  n,p=leb(b,payload);name=b[p:p+n].decode()
 if name=='wine-region-layout':removed.append(name)
 else:out+=b[start:end]
 at=end
static=json.loads((E/'module-identities/47304.json').read_text())['events'][0]['sha256']
proof=dict(removed=removed,canonicalSHA256=hashlib.sha256(b).hexdigest(),withoutLayoutStampSHA256=hashlib.sha256(out).hexdigest(),staticCompiledModuleSHA256=static,exactCoreEqual=hashlib.sha256(out).hexdigest()==static)
assert proof['exactCoreEqual'];(E/'canonical-core-proof.json').write_text(json.dumps(proof,indent=2)+'\n')
processes=subprocess.check_output(['ps','-eo','pid,ppid,comm,args']).decode().splitlines()
matching=[l for l in processes if len(l.split(None,3))>3 and l.split(None,3)[2]=='node' and any(x in l for x in ['build-compile-wat','test/test-','test/run.js'])];assert not matching,matching
allocated=int(subprocess.check_output(['du','-s','-B1',str(R)]).split()[0]);free=os.statvfs(R).f_bavail*os.statvfs(R).f_frsize
assert allocated+67108864+2097152<1073741824 and free>2147483648
tests=json.loads((E/'qualification.json').read_text());assert tests['total']==3 and len(tests['failures'])==1
facts=dict(verdict='BLOCKED_OUT_OF_SCOPE_STATIC_DX_HARNESS',box='bx_f3gs8qm2',state='RUNNING; API exec responding',expiry='2026-10-22T23:20:32.491Z',lifecycleOwner='coordinator',retainedRoot=str(R),retainedEvidence=str(E),head=H,parent=git('rev-parse','HEAD^'),history=git('log','--format=raw','-5'),gitClean=True,completeClosureVerified=len(manifest['inputs']),canonicalAttempts=1,canonicalExit=0,qualificationCommands=3,qualificationPassed=2,qualificationFailed=1,remainingNotRun=9,canonicalFileInstantiations=0,modules=[dict(path=str(p.relative_to(R)),bytes=p.stat().st_size,sha256=sha(p)) for p in (R/'build').glob('*.wasm')],ownedBuildTestProcesses=matching,allocated=allocated,free=free,reserve=67108864,cap=1073741824,freeFloor=2147483648,handbackAt=datetime.datetime.now(datetime.timezone.utc).isoformat(),nativeAuthenticDSETUP11='UNKNOWN',installedRegistry='UNKNOWN')
(E/'handback.json').write_text(json.dumps(facts,indent=2)+'\n');print(json.dumps(facts,indent=2))
