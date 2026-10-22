"""LOCAL FILE GENERATION ONLY. Never deploys, connects, runs or builds a guest."""
import argparse,pathlib,hashlib,json,subprocess,difflib
E=pathlib.Path(__file__).resolve().parent
INPUT=pathlib.Path('/home/user/wine-assembly-aoe3-localization-runtime-boundary-oct22/scratch/runs/20261022-aoe3-localization-runtime-boundary/diagnostic-run.js')
OBSERVER=pathlib.Path('/home/user/wine-assembly-aoe3-observer-boundary-quota-oct22/scratch/runs/20261022-aoe3-observer-boundary-quota/observer.js')
def sha(b):return hashlib.sha256(b).hexdigest()
def prepare(output,deployment):
 original=INPUT.read_bytes();assert sha(original)=='8b0295232f0ecccbcf65d22628469dd4165f35a2856fc9464b589123158d6753'
 observer=OBSERVER.read_bytes();assert sha(observer)=='b89ab5bba916de36a324b6068d7df09f26ef227f8940ca58995677b946032032'
 text=original.decode()
 old='/home/user/aoe3-original-oct22/diagnostics-localization-boundary-20261022T0950Z'
 assert deployment.startswith('/home/user/aoe3-original-oct22/diagnostics-') and deployment!=old
 text=text.replace(old,deployment)
 def replace(a,b):
  nonlocal text
  assert text.count(a)==1,(a,text.count(a))
  text=text.replace(a,b)
 replace('  const boundaryObserver = require('+json.dumps(deployment+'/observer.js')+')(x => console.log("[BOUNDARY] " + JSON.stringify(x)), RegionMap);',
  '  const createBoundaryObserver = require('+json.dumps(deployment+'/observer.js')+');\n  const createBoundaryHook = require('+json.dumps(deployment+'/instance-hook.js')+');\n  const boundaryObserver = createBoundaryHook(createBoundaryObserver, x => console.log("[BOUNDARY] " + JSON.stringify(x)), RegionMap, "main");\n  if (WORKER_THREADS) throw new Error("bounded diagnostic harness does not cover OS worker_threads");')
 replace('boundaryObserver.api(t, instance.exports, memory, translateGuest, "entry");','boundaryObserver.api(t, "entry");')
 replace('boundaryObserver.api(lastApiName, instance.exports, memory, translateGuest, "exit");','boundaryObserver.api(lastApiName, "exit");')
 replace('h.log_eip = eip => boundaryObserver.block(eip, instance.exports, memory, translateGuest);','h.log_eip = boundaryObserver.log_eip;')
 replace('  ctx.exports = instance.exports;','  boundaryObserver.bind(instance.exports, memory, translateGuest);\n  ctx.exports = instance.exports;')
 replace('    let workerInstance = null;','    let workerInstance = null;\n    const workerBoundaryObserver = createBoundaryHook(createBoundaryObserver, x => console.log("[BOUNDARY] " + JSON.stringify(x)), RegionMap, "cooperative:" + tid);')
 replace('    wh.exit = () => {};','    if (traceEipOn) {\n      const previousEipLog = wh.log_eip;\n      wh.log_eip = ip => { workerBoundaryObserver.log_eip(ip); if (previousEipLog) previousEipLog(ip); };\n    }\n    wh.exit = () => {};')
 replace('workerImports.__setInstance = value => { workerInstance = value; };','workerImports.__setInstance = value => { workerInstance = value; workerBoundaryObserver.bind(value.exports, memory, translateGuest); };')
 # Deliberately retain main API logger semantics; worker block snapshots are
 # bound correctly, but cooperative API entry/exit supplementation is out of scope.
 output.mkdir(parents=True,exist_ok=False)
 (output/'diagnostic-run.js').write_text(text)
 (output/'observer.js').write_bytes(observer)
 (output/'instance-hook.js').write_bytes((E/'instance-hook.js').read_bytes())
 (output/'package.json').write_text('{"type":"commonjs"}\n')
 for f in ['diagnostic-run.js','observer.js','instance-hook.js']:subprocess.run(['node','--check',str(output/f)],check=True)
 patch=''.join(difflib.unified_diff(original.decode().splitlines(True),text.splitlines(True),fromfile='input-diagnostic-run.js',tofile='next-diagnostic-run.js',n=0))
 (E/'harness.patch').write_text(patch)
 receipt=dict(localOnly=True,guestRuns=0,mainApiObserver=True,cooperativeBlockObserver=True,osWorkerThreadsRejected=True,deploymentDirectory=deployment,files={p.name:sha(p.read_bytes()) for p in output.iterdir()})
 (E/'harness-preparation.json').write_text(json.dumps(receipt,indent=2)+'\n')
 return receipt
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--output-dir',required=True,type=pathlib.Path);p.add_argument('--deployment-dir',required=True)
 a=p.parse_args();print(json.dumps(prepare(a.output_dir,a.deployment_dir)))
