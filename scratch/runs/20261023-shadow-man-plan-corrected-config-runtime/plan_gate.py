"""Offline actual-plan gate; independent classified manifest and dependency closure."""
import pathlib,json,hashlib,collections,re,posixpath,subprocess,copy,shutil
from transport import E,ROOT,save
C=pathlib.Path('/home/user/wine-assembly-shadow-man-launcher-configuration-capture-oct23/scratch/runs/20261023-shadow-man-launcher-configuration-capture')
def digest(p):
 with p.open('rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()
def admission():
 a=json.loads((E/'admission.json').read_text());own=int(subprocess.check_output(['du','-s','-B1',str(E.parents[2])]).split()[0]);total=a['selectedAllocated']+own+a['toolsAndGitAllowance']+a['reserve'];free=shutil.disk_usage(E).free
 assert total<=a['cap'] and free>=a['hostFloor'],(total,free)
 return dict(total=total,own=own,selected=a['selectedAllocated'],toolsAllowance=a['toolsAndGitAllowance'],reserve=a['reserve'],cap=a['cap'],hostFree=free,hostFloor=a['hostFloor'])
def expected():
 d={};groups=collections.Counter()
 def add(target,size,sha,group):
  assert target not in d,target
  d[target]=dict(bytes=size,sha256=sha,group=group);groups[group]+=1
 for x in json.loads((C/'runtime-manifest.json').read_text()):add(ROOT+'/immutable/runtime/'+x['path'],x['size'],x['sha256'],'main')
 for x in json.loads((C/'codec-pins.json').read_text())['files']:add(ROOT+'/immutable/runtime/'+x['path'].removeprefix('runner/'),x['size'],x['sha256'],'png')
 for x in json.loads((C/'accepted/required-data-manifest.json').read_text())['files']:add(ROOT+'/immutable/runtime/'+x['path'],x['bytes'],x['sha256'],'data')
 x=json.loads((C/'ctl-pin.json').read_text());add(ROOT+'/immutable/runtime/'+x['path'],x['bytes'],x['sha256'],'ctl')
 add(ROOT+'/immutable/runtime/build/wine-assembly.wasm',1879387,'ccd5b0a8e4fcb84d06bf539c8a4af28b377472072f3422750122048e9339f553','canonical')
 for n in ['runtime-manifest.json','codec-pins.json','accepted-installed-payload.json','accepted-parent-registry.json','accepted/required-data-manifest.json']:
  p=C/n;add(ROOT+'/immutable/receipts/'+p.name,p.stat().st_size,digest(p),'receipts')
 p=C/'accepted-parent-registry.json';add(ROOT+'/immutable/registry-preflight.json',p.stat().st_size,digest(p),'registry-preflight')
 pins=json.loads((E/'accepted-fixed-pins.json').read_text())
 for n in ['compile-guard.cjs','game-observer.cjs','dependency-preflight.cjs','forwarding-fixture.cjs','guard-fixture.cjs','watchdog.py','hash_gate.py','prepare_mutable.py']:
  x=pins[n];add(ROOT+'/fixed/'+n,x['bytes'],x['sha256'],'fixed')
 return d,groups
def validate(plan,dependencies=True,check_sources=True):
 want,groups=expected();assert len(plan)==len(want)
 actual={}
 index={l.split('\t')[1]:l.split()[1] for l in (E/'base-index.txt').read_text().splitlines()}
 for x in plan:
  target=x['target'];assert target not in actual,'duplicate destination';assert target in want,'unclassified destination'
  w=want[target];assert (x['bytes'],x['sha256'])==(w['bytes'],w['sha256']),'manifest identity mismatch'
  p=pathlib.Path(x['source'])
  if check_sources:assert p.is_file() and not p.is_symlink() and p.stat().st_size==x['bytes'] and digest(p)==x['sha256'],'donor identity: '+str(p)
  rel=target.removeprefix(ROOT+'/immutable/runtime/')
  if rel in index:
   b=p.read_bytes();assert hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()==index[rel],'main Git identity'
  actual[target]=x
 assert actual.keys()==want.keys(),'incomplete classified manifest'
 closure=dependency_gate(actual) if dependencies else None
 return dict(passAll=True,total=len(actual),immutable=sum('/immutable/' in t for t in actual),fixed=groups['fixed'],groups=dict(groups),separateCtlPinReceipt=1,immutableWithCtlPin=sum('/immutable/' in t for t in actual)+1,dependencies=closure)
def dependency_gate(actual):
 rt=ROOT+'/immutable/runtime/';files={t.removeprefix(rt):pathlib.Path(x['source']) for t,x in actual.items() if t.startswith(rt)}
 builtins=set(json.loads(subprocess.check_output(['node','-p','JSON.stringify(require("module").builtinModules)'],text=True)));seen=set();missing=[];workers=[];dynamic=[]
 def resolve(fr,spec):
  if spec.startswith('.'):
   base=posixpath.normpath(posixpath.join(posixpath.dirname(fr),spec))
  elif spec=='pngjs':base='node_modules/pngjs/'+json.loads(files['node_modules/pngjs/package.json'].read_text()).get('main','index.js')
  else:raise KeyError(spec)
  base=posixpath.normpath(base)
  for p in [base,base+'.js',base+'.json',base+'/index.js']:
   if p in files:return p
  raise KeyError(spec)
 def visit(p):
  assert p in files,'missing explicit command/Worker dependency: '+p
  if p in seen or not p.endswith(('.js','.cjs')):return
  seen.add(p);s=files[p].read_text()
  for spec in re.findall(r'\brequire\s*\(\s*[\'"]([^\'"\n]+)[\'"]\s*\)',s):
   if spec in builtins or spec.removeprefix('node:') in builtins:continue
   try:q=resolve(p,spec)
   except KeyError:missing.append(dict(fromPath=p,spec=spec));continue
   visit(q)
  workers.extend(dict(fromPath=p,expression=m) for m in re.findall(r'(?:new Worker|fork)\([^\n]{0,180}',s))
  dynamic.extend(dict(fromPath=p,expression=m) for m in re.findall(r'\brequire\s*\(\s*(?![\'"])[^\n]{0,100}',s))
 roots=['test/run.js','host.js','tools/ctl.js','lib/guest-worker.js','lib/worker-imports.js','lib/thread-manager.js','lib/guest-thread-host.js','lib/render-worker.js','lib/d3d-render-worker.js','lib/d3dim-render-worker.js','lib/d3d9-render-worker.js','lib/gl-render-worker.js','lib/glide-render-worker.js','lib/storage.js','lib/vfs-export.js','lib/host-imports.js']
 for p in roots:visit(p)
 excluded={'@node-3d/glfw','@node-3d/webgl','skia-canvas','../tools/watx-closure.js','./region-layout.js','../tools/diablo-gameplay-bench','../tools/build-page-translation-stats.js','./tools/disasm','../tools/dump_sprites'}
 assert {x['spec'] for x in missing}==excluded,missing
 # Full actual argv selects canonical/no-build/raster; no excluded dump/experiment paths.
 recipe=json.loads((C/'accepted/next-runtime-recipe.json').read_text())
 argv=recipe['argvTemplate'];assert '--no-build' in argv and any(x.startswith('--wasm=') for x in argv)
 assert not any(x.startswith(('--webgl','--glfw','--skia','--dump-sprites','--disasm','--page-translation-stats','--diablo-gameplay-bench')) for x in argv)
 for n in ['compile-guard.cjs','game-observer.cjs','settings-observer.cjs']:
  assert (E/n).is_file();r=subprocess.run(['node','--check',str(E/n)],capture_output=True,text=True);assert r.returncode==0,r.stderr
 return dict(passAll=True,roots=roots,visited=sorted(seen),missingConditionalExcluded=missing,workers=workers,dynamicReviewed=dynamic,argvTemplate=argv,settingsDependencies=['fs','path','crypto','worker_threads','lib/host-imports.js','lib/storage.js'])
def main():
 plan=json.loads((C/'staging-plan.json').read_text());r=validate(plan,check_sources=False);rejected=[]
 variants={}
 variants['omitted']=plan[:-1];variants['duplicate']=plan[:-1]+[copy.deepcopy(plan[0])]
 p=copy.deepcopy(plan);p[0]['target']=p[0]['target'].replace('/immutable/','/fixed/');variants['misclassified']=p
 p=copy.deepcopy(plan);p[0]['sha256']='0'*64;variants['wrong-hash']=p
 p=copy.deepcopy(plan);p[0]['target']+='.wrong';variants['wrong-destination']=p
 for name,p in variants.items():
  try:validate(p,False,False)
  except AssertionError:rejected.append(name)
  else:raise AssertionError('negative accepted: '+name)
 for suffix in ['lib/guest-worker.js','lib/storage.js','tools/ctl.js','node_modules/pngjs/lib/png.js']:
  p={x['target']:x for x in plan if x['target']!=ROOT+'/immutable/runtime/'+suffix}
  try:dependency_gate(p)
  except (AssertionError,KeyError):rejected.append('missing-dependency:'+suffix)
  else:raise AssertionError('dependency omission accepted: '+suffix)
 mismatches=[]
 for x in plan:
  p=pathlib.Path(x['source']);actual=dict(bytes=p.stat().st_size,sha256=digest(p))
  if actual!={k:x[k] for k in ['bytes','sha256']}:mismatches.append(dict(source=x['source'],target=x['target'],expected={k:x[k] for k in ['bytes','sha256']},actual=actual))
 r.update(passAll=not mismatches,fixtureAssertionsPass=True,rejected=rejected,planSHA256=digest(C/'staging-plan.json'),admission=admission(),originalRestoreForbidden=True,structuralPlanPass=True,donorIdentityPass=not mismatches,stagingAuthorized=False,firstBlocker='stale fixed-helper donor identities',mismatches=mismatches)
 save('offline-plan-fixture.json',r);save('staging-plan.json',plan);print(json.dumps({k:v for k,v in r.items() if k!='dependencies'}))
if __name__=='__main__':main()
