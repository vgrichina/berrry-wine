from pathlib import Path
import sys,os,time,json,gzip,hashlib,fcntl
base=Path(__file__).resolve().parent;root=base.parents[3];R=base/'prepared'
sys.path.insert(0,str(root/'tools'))
from native_kernel_custody import supervise,identity
life=json.loads(gzip.decompress((base.parent/'prepared/lifecycle.json.gz').read_bytes()))
pins=json.loads(gzip.decompress((base.parent/'runtime-pins.json.gz').read_bytes()))
for p in pins['files']:
 b=(root/p['path']).read_bytes();assert len(b)==p['size'] and hashlib.sha256(b).hexdigest()==p['sha256'],p['path']
P=root/'scratch/runs/20261108-q3-gl-readiness-gameplay'
(P/'runtime-pins.json').write_text(json.dumps(pins))
with open('/tmp/wine-runtime.lock','a') as lock:
 fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
 deadline=min(time.time()+480,life['overallDeadline']-180)
 os.environ.update(LOCAL_PRODUCTION_FIXTURE='1',Q3_NATIVE_CANCEL_PROBE='1',BROWSER_DEADLINE=str(int(deadline*1000)),RENDER_BACKEND='webgl',CASE_TAG='changed-control-1475-cancellation',Q3_NATIVE_COMPOSITION='1',Q3_NATIVE_INPUT_CAUSE='1',Q3_INPUT_WIRE='1',Q3_EXECUTION_BOUNDARY_OUT=str(R/'execution-boundary.jsonl.gz'))
 with gzip.open(R/'runtime-identity.json.gz','xb') as f:f.write(json.dumps(dict(**identity(os.getpid()),deadline=deadline)).encode())
 supervise(R,['node','--require',str(root/'tools/q3-native-driver-composition.cjs'),'--require',str(root/'tools/q3-native-input-cause-diagnostic.cjs'),'--require',str(root/'tools/q3-input-wire-observation.cjs'),'--require',str(root/'tools/q3-execution-boundary.cjs'),str(P/'browser-run.cjs')],deadline=deadline,cleanup_deadline=deadline+30,journal_compression='gzip',command_compression='gzip')
 with gzip.open(R/'runtime-complete.json.gz','xb') as f:f.write(json.dumps(dict(at=time.time(),actualWait=True)).encode())
