#!/usr/bin/env python3
"""One exact guarded diagnostic build and four sequential fresh qualifiers.

Run only after independently accepted published boundary-control handoff. Every
unexpected result latches the task and stops; no retry, repair, source fix or pin
refresh. Candidate source copies remain until all qualifications finish.
"""
import importlib.util,json,os,pathlib,resource,sys,time,hashlib,re
R=pathlib.Path(__file__).resolve().parents[1]
E=R/'docs/re-notes/render-positiont-guarded-com-qualification-20261023'
def module(n,file):
 s=importlib.util.spec_from_file_location(n,R/'tools'/file);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
p=module('plan','positiont-guarded-plan.py');capture=module('capture','positiont-guarded-capture.py')
NODE='/home/user/.nvm/versions/node/v24.18.1/bin/node'
GUARD='/home/user/wine-assembly-shadow-man-native-bound-canonical-oct23/docs/re-notes/shadow-man-native-bound-canonical-20261023/native-module-bound.cjs'
def save(n,v):p.save(n,v)
def memory():return int(next(l.split()[1] for l in pathlib.Path('/proc/meminfo').read_text().splitlines() if l.startswith('MemAvailable:')))*1024
def accounting(phase):
 current=p.footprint(R)+p.footprint(p.EXT)+p.footprint(p.SESSION)
 reserve=8388608;growth=4194304;free=os.statvfs(R).f_bavail*os.statvfs(R).f_frsize
 a=dict(phase=phase,owned=current,reserve=reserve,futureExternalAndSessionGrowth=growth,total=current+reserve+growth,cap=67108864,hostFree=free,hostFreeAfterGrowth=free-growth)
 with (E/'execution-resources.jsonl').open('a') as f:f.write(json.dumps(a)+'\n')
 assert a['total']<=67108864 and a['hostFreeAfterGrowth']>=2982150144,('RESOURCE_ADMISSION_DENIED',a)
 return a
def command(name,argv,seconds,expected=0,armed=None):
 before=memory()
 minimum=2684354560 if name=='build' else 1610612736 if name in ['baseline','disable-shared-route','alias-queued-bytes','corrupt-queued-ir'] else 0
 assert before>=minimum,('FRESH_COMMAND_MEMORY_ADMISSION_DENIED',name,before,minimum)
 result=capture.run(argv,E/(name+'.log'),seconds)
 result.update(memAvailableBefore=before,maxChildRssBytes=resource.getrusage(resource.RUSAGE_CHILDREN).ru_maxrss*1024)
 save(name+'.json',result)
 accounting('after-'+name)
 if result['exit']!=expected:raise RuntimeError(name+' unexpected exit '+str(result['exit']))
 if armed:
  text=(E/(name+'.log')).read_text();assert armed in text,(name,'matching ARMED absent')
 return result
def main():
 assert not (E/'execution-attempt.json').exists() and not (E/'execution-result.json').exists(),'one build attempt only'
 boundary=json.loads((E/'boundary-acceptance.json').read_text());assert boundary['accepted'] is True
 assert p.sha(pathlib.Path(GUARD).read_bytes())=='47ce2e2b835be33eab6b2b24f027ecaab8ceb61c559890e51548c78199beb197'
 records=json.loads((E/'source-manifest.json').read_text())
 current=accounting('before-staging')
 # Previous combined plan is unchanged except a seventh tiny provenance/pin
 # command and these final reviewed driver bytes. Reserve its full capture;
 # never charge only expected successful output. No staged source was released.
 increments=sum(x['bytes'] for x in records)+262144+8388608+65536+7*524288+65536+2097152
 peak=current['total']+increments
 assert peak<=67108864,('FINAL_PHASE_PROJECTION_DENIED',peak)
 assert current['hostFree']-increments-4194304>=2982150144
 mem=memory();assert mem>=2684354560,('COMPILER_MEMORY_ADMISSION_DENIED',mem)
 save('execution-attempt.json',dict(status='ADMITTED',time=time.time(),boundaryAcceptance=boundary,
  combinedPreflight='combined-preflight.json',projectedPeak=peak,cap=67108864,MemAvailable=mem,
  exactBuildAttempts=1,sourceCopies=sum(x['bytes'] for x in records),sourceLifetime='through final qualifier',
  finalClosureIncludes=['tools/positiont-guarded-verify.cjs uses only fs/assert/crypto and pinned builder'],
  note='Seventh provenance/pins-only command explicitly reserved before staging; no earlier full compile admission/rejection/retry'))
 for x in records:
  b=pathlib.Path(x['retained']).read_bytes();assert len(b)==x['bytes'] and p.sha(b)==x['sha256'] and p.blob(b)==x['blob']
  target=R/x['path'];target.parent.mkdir(parents=True,exist_ok=True)
  with target.open('xb') as f:f.write(b)
 (R/'build').mkdir(exist_ok=True)
 os.chdir(R)
 for n in ['NODE_OPTIONS','NODE_V8_COVERAGE','NODE_COMPILE_CACHE','NODE_DEBUG','NODE_DEBUG_NATIVE','WINE_REGION_MAP','WINE_REGION_SHAKE','WINE_WAT_COMPILER','WINE_WAT_NAMES']:os.environ.pop(n,None)
 os.environ['NODE_PATH']='/home/user/wine-dashboard-deps-20261014/node_modules'
 accounting('staged-before-build')
 mem=memory();assert mem>=2684354560,('FRESH_COMPILER_MEMORY_ADMISSION_DENIED',mem)
 build=[NODE,'--max-old-space-size=2048','--require',GUARD,'test/support/positiont-com-module.js','--build-diagnostic','build/positiont-com-diagnostic.wasm','build/positiont-com-diagnostic.provenance.json']
 command('build',build,900)
 binary=R/'build/positiont-com-diagnostic.wasm';prov=R/'build/positiont-com-diagnostic.provenance.json'
 assert binary.stat().st_size<=8388608 and prov.stat().st_size<=65536
 save('artifact-identities.json',dict(moduleBytes=binary.stat().st_size,moduleSha256=p.sha(binary.read_bytes()),provenanceBytes=prov.stat().st_size,provenanceSha256=p.sha(prov.read_bytes()),qualification='GUARDED_DIAGNOSTIC'))
 command('verify-provenance-pins',[NODE,'--max-old-space-size=128','tools/positiont-guarded-verify.cjs'],30)
 for name in ['baseline','disable-shared-route','alias-queued-bytes','corrupt-queued-ir']:
  mem=memory();assert mem>=1610612736,('QUALIFICATION_MEMORY_ADMISSION_DENIED',name,mem)
  args=[NODE,'--max-old-space-size=512','--require',GUARD,'test/test-d3d9-positiont-com-qualification.js','--qualify','--allow-512m','--module=build/positiont-com-diagnostic.wasm','--provenance=build/positiont-com-diagnostic.provenance.json']
  if name!='baseline':args.append('--negative-control='+name)
  command(name,args,150,0 if name=='baseline' else 1,None if name=='baseline' else 'ARMED negative control '+name+':')
  if name=='baseline':assert 'PASS full COM/native allocator fixture' in (E/(name+'.log')).read_text()
  else:
   text=(E/(name+'.log')).read_text()
   if name=='disable-shared-route':
    assert 'DP-start2-offset16-stride48: actual shared native IR selection' in text,('UNEXPECTED_NEGATIVE_ORACLE',name)
   else:
    # Both deliberate corruptions can be rejected by the authentic native IR
    # validator before rasterization, or by the fixture's final pixel oracle.
    # An unrelated exit-1, allocator/admission error or missing import cannot pass.
    assert re.search(r'native shader validation failed \([0-9]+\)',text) or 'queue bytes survive caller mutation and real heap reuse: complete BGRA/depth oracle' in text,('UNEXPECTED_NEGATIVE_ORACLE',name)
 save('execution-result.json',dict(status='PASS',qualification='GUARDED_DIAGNOSTIC',commands=['build','verify-provenance-pins','baseline','disable-shared-route','alias-queued-bytes','corrupt-queued-ir'],actualSoftwarePixels=True,WebGL=False,game=False))
if __name__=='__main__':
 try:main()
 except Exception as error:
  save('execution-result.json',dict(status='BLOCKED',firstBlocker=str(error),time=time.time(),noRetry=True));print(str(error),file=sys.stderr);sys.exit(2)
