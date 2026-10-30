from supervisor import *
from objects import *
import ast,types,io,contextlib,hashlib
BASE='b6cdf927cda965d1f2ee7cde447e38c9f79a9342'
dp=pathlib.Path('/home/user/wine-assembly/scratch/usage-watch')/(ROOT.name+'.dispatch.json');d=json.loads(dp.read_text());assert d['candidate']==BASE and d['ownedRepo']==str(REPO)
for p,w in d['sourcePins'].items():assert pin((REPO/p).read_bytes())==pin(path(BASE,p)[1])==w,p
assert len(d['sourcePins'])==24
assert pin(pathlib.Path(d['canonicalReceipt']).read_bytes())==d['canonicalReceiptPin']
f=json.loads((ROOT/'coordinator-allocation-forecast.json').read_text());a=admission();f['roots']=list(dict.fromkeys(f['roots']+a['roots']));f.update(actualSessionID=a['sessionID'],actualRollout=a['rollout'],actualAllocated=a['physicalAllocated'],remainingWorkReserve=a['remainingWorkReserve'],reserveAccounting='Initial used baseline retained; actual startup/work growth consumes existing8MiB work reserve, not an additional reserve. Publication8MiB remains.',RAMAdmission=False);(ROOT/'coordinator-allocation-forecast.json').write_text(json.dumps(f,indent=2))
identity(REPO,'startup');assert git('rev-parse','HEAD',cwd=REPO,label='head').decode().strip()==BASE
assert git('symbolic-ref','HEAD',cwd=REPO,label='branch').decode().strip()=='refs/heads/task/'+ROOT.name
assert git('remote','get-url','origin',cwd=REPO,label='origin').decode().strip()=='git@github.com:vgrichina/wine-assembly.git'
run(['/usr/bin/python3','-B','-c',"import pathlib,resource,json;pathlib.Path('legitimate-file').write_bytes(b'x'*600000);print(json.dumps(dict(DATA=resource.getrlimit(resource.RLIMIT_DATA),FSIZE=resource.getrlimit(resource.RLIMIT_FSIZE))))"],cwd=ROOT,label='generated-file-control');assert (ROOT/'legitimate-file').stat().st_size==600000;(ROOT/'legitimate-file').unlink()
try:run(['/usr/bin/python3','-B','-c',"print('x'*70000)"],cwd=ROOT,label='output-overflow-control',capture_limit=65536)
except RuntimeError:assert json.loads((E/'output-overflow-control.json').read_text())['violation']=='output control'
else:raise AssertionError('overflow not rejected')
run(['/usr/bin/python3','-B','-c',"import subprocess,sys;v=subprocess.run([sys.executable,'-B','-c','print(123)'],capture_output=True,timeout=2);assert v.returncode==0 and v.stdout==b'123\\n';print('PASS')"],cwd=ROOT,label='wrapper-child-compatibility')
S=E/'stage';S.mkdir(exist_ok=True)
closure=['test/toyvm-bounded24-caller-wiring-oct28/qualify_accounted.py','test/toyvm-kernel-profile-accounting-backend-oct28/supervise_accounted.py','test/toyvm-kernel-profile-accounting-backend-oct28/confine.py','test/toyvm-kernel-profile-accounting-backend-oct28/fuse_backend.py','test/toyvm-transient-profile-accounting-repair-oct28/pinned-supervisor.py']
for p in closure:
 b=(REPO/p).read_bytes();ast.parse(b);q=S/'repo'/p;q.parent.mkdir(parents=True,exist_ok=True);q.write_bytes(b)
fixture=(ROOT/'fixture.py').read_text();ast.parse(fixture);(S/'fixture.py').write_text(fixture)
obs=(REPO/'test/toyvm-kernel-profile-accounting-backend-oct28/mounted-open-destination-retained-oct30/observer.py').read_text();ast.parse(obs);(S/'observer.py').write_text(obs)
receipt=ROOT.parent/'cancellation-receipt.json';(S/'cancellation-receipt.json').write_bytes(receipt.read_bytes())
m=types.ModuleType('caller');m.__file__=str(REPO/closure[0]);exec(compile((REPO/closure[0]).read_bytes(),m.__file__,'exec'),m.__dict__);assert callable(m.load_backend());m.validate_receipt(receipt)
argv=['/usr/bin/python3','-B','/tmp/tvsa-stage/repo/'+closure[0],'--domain','tiny-fixture','--receipt','/tmp/tvsa-stage/cancellation-receipt.json','--work','/tmp/tvsa','--live-limit','20480','--write-limit','65536','--file-limit','16384','--rss-limit','67108864','--cpu-limit','10','--wall-limit','20','--output-limit','8192','--rename-evidence','64','--','/usr/bin/python3','-B','-c',fixture]
parsed={};m.qualify=lambda **kw:parsed.update(kw) or dict(accepted=False)
with contextlib.redirect_stdout(io.StringIO()):assert m.main(argv[3:])==1
assert parsed['command']==argv[argv.index('--')+1:] and parsed['work']=='/tmp/tvsa'
assert (parsed['live_limit'],parsed['write_limit'],parsed['file_limit'])==(20480,65536,16384)
backend=(REPO/closure[3]).read_text();adapter=(REPO/closure[1]).read_text();sup=(REPO/closure[4]).read_text()
for v in ["self.failure=self.failure or reason","if self.failure:raise OSError(errno.ENOSPC,self.failure)","self.nodes[ino]['opens']-=1;self.handles-=1;self.collect(ino)","self.live-=4096+((len(n['data'])+4095)//4096)*4096"]:assert v in backend
assert "if state['failure']:return state['failure']" in adapter and 'reason = check()' in sup and 'signal.SIGTERM' in sup
assert 4096+2*(4096+4096)==20480 and 20480-8192==12288
oracle=dict(kind='SOURCE_PREDICTIONS_ONLY',source=BASE,quotas=dict(live=20480,write=65536,perfile=16384),arithmetic=dict(before=20480,retained=20480,growthAttempt=4096,afterRejection=20480,afterFinalOldClose=12288,retryAdditionalAllocation=0,writtenThroughout=8192),firstFailure='filesystem allocation limit',WRITE='rejects subsequent writes while failure set',READ='remains possible',RELEASE='still decrements opens and collects unlinked inode',productionBoundary='Adapter owned_check returns sticky failure; supervisor sends SIGTERM on next check (~10ms loop). Stable post-rejection/release/retry windows may be unreachable in exact production CLI. Do not suppress termination or substitute runner.',CLIContract=dict(acceptedFalseExit=1,reason='qualify main returns 0 if accepted else1; accounting rejects filesystem.failure'),callbackLimitations='WRITE/RELEASE callbacks not instrumented; do not claim direct callback observations')
(E/'oracle.json').write_text(json.dumps(oracle,indent=2))
manifest=dict(candidate=BASE,all24SourcePins=d['sourcePins'],sourcePins={p:d['sourcePins'][p] for p in closure},fixturePin=pin((S/'fixture.py').read_bytes()),observerPin=pin((S/'observer.py').read_bytes()),receiptPin=pin((S/'cancellation-receipt.json').read_bytes()),cliArgv=argv);(E/'runtime-manifest-base.json').write_text(json.dumps(manifest))
checks=dict(PASS=True,all24PinsAndGitObjectsVerified=True,candidate=BASE,dispatchPin=pin(dp.read_bytes()),canonicalParser=True,intendedFiles=['/tmp/tvsa/domain/source,sticky','/tmp/tvsa/domain/destination,sticky'],mount='supported synchronous FUSE tree; inline comma filenames; exact filename-bearing argv parsed',socket='/tmp/tvsa/status.sock',socketBytes=21,wrapperChildCompatibility=True,generatedFile=dict(bytes=600000,FSIZE=12*M,captureCeiling=524288),overflowControlRejected=True,node='not used; native Boat CLI and Python workload',allocation=admission(),SSH=SSH,oracle=oracle,selectedEvidenceTarget=196608,selectedEvidenceCap=524288)
(E/'preflight.json').write_text(json.dumps(checks,indent=2));(E/'fixture-preflight.json').write_text(json.dumps(dict(PASS=True,syntax=True,arithmetic=True,canonicalParser=True)))
print(json.dumps(dict(PASS=True,allocation=checks['allocation']['physicalAllocated'],remainingWorkReserve=checks['allocation']['remainingWorkReserve'],session=a['sessionID'])))
