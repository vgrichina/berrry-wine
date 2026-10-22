import pathlib,os,json,subprocess,hashlib,shutil,socket
from watchdog import *
R=pathlib.Path('/home/user/shadow-man-install-continue-oct22');Q=pathlib.Path('/home/user/shadow-man-install-quota-oct22');F=R/'bounded-diagnostic';O=Q/'bounded-game'
def sha(p):
 with p.open('rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()
def alloc(p):return sum(x.stat().st_blocks*512 for x in [p,*p.rglob('*')])
F.mkdir(exist_ok=True);assert not O.exists();O.mkdir();(O/'tmp').mkdir()
# Existing installed tree and all original backups stay in place, no deletion/copy.
assert subprocess.run(['sudo','mount','-o','remount,size=939524096',str(Q)],capture_output=True).returncode==0
assert os.statvfs(Q).f_blocks*os.statvfs(Q).f_frsize==939524096
rows=[]
for base,manifest in [(R,'staged-runtime-manifest.json'),(R/'recovery/source/Demos/Shadowman','original-seals.json'),(R/'support','support-manifest.json')]:
 for r in json.loads((R/manifest).read_text()):
  p=base/r['path'];assert p.stat().st_size==r['size'] and sha(p)==r['sha256'],p
  rows.append(dict(path=str(p),size=r['size'],sha256=r['sha256']))
assert len(rows)==243
fixed=sum(alloc(p) for p in [R/'runtime',R/'runner',R/'support',R/'recovery/source/Demos/Shadowman',F])
assert fixed+1048576<=100663296,(fixed,'fixed exceeds96MiB incl1MiB diagnostic allowance')
assert alloc(R)+1048576<=2147483648
assert shutil.disk_usage(R).free>=2982150144+939524096
# Actual known export source sizes, rounded page allocation + per-file inode/path overhead.
V=Q/'session/parent-vfs';files=[p for p in V.rglob('*') if p.is_file()]
copy=sum(((p.stat().st_size+4095)//4096)*4096 for p in files)
# Extra actual PE aliases and generated DLLs observed in predecessor child input.
child=R/'retained-game/tmp';oldinputs=[p for p in child.rglob('in') if p.is_dir()]
if not oldinputs:oldinputs=[p for p in (R/'retained-game').rglob('in') if p.is_dir()]
assert oldinputs,'retained original child input unavailable for allocation measurement'
oldfiles=[p for p in oldinputs[0].rglob('*') if p.is_file()];copy=max(copy,sum(((p.stat().st_size+4095)//4096)*4096 for p in oldfiles))
st=os.statvfs(Q);current=(st.f_blocks-st.f_bfree)*st.f_frsize
budget={'CreateProcess-input':1,'parent-export':1,'child-export':1};overhead=3*len(oldfiles)*4096+16777216
projection=admit(current,copy,budget,overhead)
try:admit(current,copy,{'parent-export':1});raise Exception('missing budget accepted')
except AssertionError as e:missingRejected=str(e)
# Real /dev/full ENOSPC, child and grandchild outlive failed output until external cleanup.
fixture="import os,subprocess,time,json; c=subprocess.Popen(['python3','-c','import time;time.sleep(30)']);\ntry:os.write(1,b'x'*65536)\nexcept OSError as e:\n open('fixture-enospc.json','w').write(json.dumps({'errno':e.errno,'grandchild':c.pid}));time.sleep(30)"
res=supervise(['python3','-c',fixture],F,dict(os.environ),'/dev/full',F/'fixture-receipt.json',1.5)
assert res['boundPassed'] and not res['remaining'] and len(res['seen'])>=2 and json.loads((F/'fixture-enospc.json').read_text())['errno']==28,res
# Codec stays the exact pinned version, actual encode/decode, no guest execution.
env=dict(os.environ,NODE_PATH=str(R/'runner/node_modules'))
codec=subprocess.run(['node',str(R/'codec-fixture.cjs')],env=env,capture_output=True,text=True);assert codec.returncode==0,(codec.stdout,codec.stderr)
obs=F/'game-observer.cjs';assert subprocess.run(['node','--check',str(obs)],capture_output=True).returncode==0
s=obs.read_text();src=(R/'runtime/test/run.js').read_text()
assert "require('worker_threads').isMainThread" in s and "ve.saveVfsToHost=function" in s
assert "const written = saveVfsToHost(vfs, inDir);" in src and "saveVfsToHost(ctx.vfs, SAVE_VFS" in src
assert '...PIPE_CHILD_ARGS' in src and '--pipe-child-args=' in src
I=V/'program files/acclaim entertainment/shadowman';payload={}
for n,h in [('shadowman.exe','4b32868bb30a8ca089483203f8c2b637507f12de4f11f39bf45b1fa41d5f5772'),('d3dconfigutility.exe','850c69cfa4a0d610072a67763d54179bc4cdc58875560ce5ede33bfa44d19fe0')]:
 p=I/n;assert sha(p)==h;payload[n]=dict(path=str(p),size=p.stat().st_size,sha256=h)
result=dict(passAll=True,offlineGuestExecuted=False,fixture=res,missingCopyBudgetRejected=missingRejected,codec=codec.stdout,seals=rows,payload=payload,allocation=dict(currentMutable=current,copyBytes=copy,copyCount=3,copyRoutes=budget,metadataOverhead=overhead,growth=67108864,projectedMutable=projection,mutableHardCap=939524096,fixedMeasured=fixed,fixedCeiling=100663296,reserve=33554432,totalCap=1073741824,recoveryUsed=alloc(R),recoveryCap=2147483648,hostFree=shutil.disk_usage(R).free),exportGuardCoversCreateProcessAndParentChildOutputs=True,realTicksViaSupportedPipeChildArgs=True,childPortsDynamicallyAllocatedNotInherited=True)
(F/'gate.json').write_text(json.dumps(result,indent=2));print(json.dumps(result))
