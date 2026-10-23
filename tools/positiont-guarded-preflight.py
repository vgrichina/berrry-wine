#!/usr/bin/env python3
"""One combined executable preflight. It does not stage or run the compiler.

All execution phases remain conditional on the sealed shared guard being ready,
independent review/control, released native ownership and fresh memory admission.
"""
import importlib.util,json,os,pathlib,subprocess,sys,time
spec=importlib.util.spec_from_file_location('plan',pathlib.Path(__file__).with_name('positiont-guarded-plan.py'))
p=importlib.util.module_from_spec(spec);spec.loader.exec_module(p)
SHARED=pathlib.Path('/home/user/wine-assembly-shadow-man-native-bound-canonical-oct23')
SE=SHARED/'docs/re-notes/shadow-man-native-bound-canonical-20261023'
SX=p.HOST/'scratch/usage-watch/shadow-man-native-bound-canonical-oct23'
GUARD=SE/'native-module-bound.cjs'
EXPECTED='47ce2e2b835be33eab6b2b24f027ecaab8ceb61c559890e51548c78199beb197'
def main():
 assert not (p.E/'combined-preflight.json').exists(),'one combined attempt only'
 assert (SX/'result.json').is_file() and (SX/'final.txt').is_file(),'SHARED_HANDOFF_UNAVAILABLE'
 p.main()
 assert p.sha(GUARD.read_bytes())==EXPECTED
 rev=p.git(SHARED,'rev-parse','HEAD').decode().strip()
 rel=str(GUARD.relative_to(SHARED));assert p.git(SHARED,'show',rev+':'+rel)==GUARD.read_bytes()
 seals=json.loads((SE/'seals.json').read_text())
 for s in seals:
  b=(SHARED/s['path']).read_bytes();assert len(b)==s['bytes'] and p.sha(b)==s['sha256']
  assert b==p.git(SHARED,'show',rev+':'+s['path'])
 records=json.loads((p.E/'source-manifest.json').read_text())
 # No source links/copies yet. All exact source pins remain until the last
 # qualifier's verifySources call, so no optimistic early release is assumed.
 source=sum(r['bytes'] for r in records)
 owned=p.footprint(p.ROOT)+p.footprint(p.EXT)+p.footprint(p.SESSION)
 budgets=dict(sourceCopies=source,sourceDirectoryOverhead=262144,module=8388608,
  provenance=65536,allCommandCaptures=6*524288,temps=65536,
  gitReportEvidenceGrowth=2097152,externalAndSessionFutureGrowth=4194304,reserve=8388608)
 peak=owned+sum(budgets.values())
 free=os.statvfs(p.ROOT).f_bavail*os.statvfs(p.ROOT).f_frsize
 growth=sum(v for k,v in budgets.items() if k!='reserve')
 assert peak<=67108864,('TASK_ALLOCATION_DENIED',peak)
 assert free-growth>=2982150144,('HOST_FLOOR_DENIED',free,growth)
 pins={r['path']:r['blob'] for r in records if r['pin']}
 assert len(pins)==286
 sourceWat={r['path'] for r in records if r['path'].startswith('src/') and r['path'].endswith(('.wat','.watx'))}
 entry=next(r for r in records if r['path']=='src/main.watx')
 import re
 includes=set('src/'+s for s in re.findall(r'\(include\s+"([^"]+)"\)',pathlib.Path(entry['retained']).read_text()))
 assert includes<=sourceWat
 result=dict(status='REVIEW_PHASE_ADMITTED_ONLY',guard=dict(commit=rev,path=str(GUARD),sha256=EXPECTED,sealsVerified=len(seals),
  producerBlocker=json.loads((SE/'blocker.json').read_text()),producerHeavyAdmission=json.loads((SE/'heavy-admission.json').read_text())),
 candidate='7aef3ff22f0dbe4fbfe739196bf92ad7a9435fb6',scopedAcceptance='aea185d3dfc1b772cea00ca1a4aed14b9553dfed',
 accounting=dict(cap=67108864,measuredOwned=owned,incrementalBudgets=budgets,projectedPeak=peak,
  hostFree=free,hostAfterGrowth=free-growth,hostFloor=2982150144,sourceStagedBytes=0,
  phases='review -> single guarded builder -> hashes/provenance/pins -> 4 fresh qualifiers -> publication; source copies retained throughout; 8MiB output is enforced synchronously before native construction and write'),
 closure=dict(files=len(records),bytes=source,pins=286,watFiles=len(sourceWat),includes=len(includes),complete=True,
  compiler='literal require closure plus vm-loaded 4 compiler stages, all entry includes; no compiler disk temps; source and byte generation in heap',
  qualification='prebuilt load/export/provenance/286 pins then fonts:none render helper; 47 conservative JS/JSON dependencies; software Bridge; no default compile',
  inactive='headless-gl load() never called by software backend; fonts mount skipped; named-event authority constructors/callerClockDomain never called; Worker routes require unprovided factories/options; resources-icon fetch/loadImage never called; no guest events/process routes',
  dynamic='WINE_REGION_MAP must be unset; requires(path.join(...watx.js)) and watx-src FILES explicitly included; no external data other than output module/provenance and pinned sources; pngjs7 standing; optional GPU addons are inactive, not installed/staged'),
 commands=dict(build=['node','test/support/positiont-com-module.js','--build-diagnostic','build/positiont-com-diagnostic.wasm','build/positiont-com-diagnostic.provenance.json'],
  qualify=['node','test/test-d3d9-positiont-com-qualification.js','--qualify','--allow-512m','--module=build/positiont-com-diagnostic.wasm','--provenance=build/positiont-com-diagnostic.provenance.json'],
  controls=['disable-shared-route','alias-queued-bytes','corrupt-queued-ir']),
 limits=dict(file=25165824,capturePerCommandAggregate=524288,overflowExit=125,termThenKillSeconds=5,subreaper=True,
  compile=dict(oldSpaceMiB=2048,wallSeconds=900,cpuSeconds=900,MemAvailableMinimum=2684354560,nativeModuleMax=8388608,nativeConcurrency=1),
  qualify=dict(oldSpaceMiB=512,wallSeconds=150,cpuSeconds=150,MemAvailableMinimum=1610612736,sharedArenaBytes=536870912,pages=8192,InstanceConcurrency=1),
  review=dict(oldSpaceMiB=128,wallSeconds=30,cpuSeconds=30,maxNativeInput=8,Memory=False,Instance=False),RSS='old-space is not an RSS bound; measure separately'),
 env=dict(NODE_PATH='/home/user/wine-dashboard-deps-20261014/node_modules',preload=str(GUARD),unset=['NODE_OPTIONS','WINE_REGION_MAP','WINE_REGION_SHAKE','WINE_WAT_COMPILER','WINE_WAT_NAMES']),
 runtime=dict(box=None,lifecycleOwner='coordinator'),reviewControlExecuted=False,compileExecuted=False,qualificationExecuted=False)
 p.save('combined-preflight.json',result)
 print(json.dumps(dict(status=result['status'],projectedPeak=peak,cap=67108864,guardCommit=rev,sourceFiles=len(records),pins=286)))
if __name__=='__main__':main()
