"""Read-only exact-tree closure; --stage is a single admitted materialization.

No inherited receipt defines a scanner universe. Private Git uses standing object
stores, never a donor index/ref. Every materialized source byte is counted.
"""
import pathlib, subprocess, os, json, hashlib, re, shutil, sys
BASE=pathlib.Path('/home/user/wine-assembly')
OLD=pathlib.Path(str(BASE)+'-render-positiont-canonical-prereqs-complete-oct23')
DONOR=pathlib.Path(str(BASE)+'-render-positiont-com-qualification-fixture-oct23')
OUT=pathlib.Path(__file__).resolve().parent.parent
EXT=BASE/'scratch/usage-watch/render-positiont-complete-closure-gates-oct23'
E=OUT/'docs/re-notes/render-positiont-complete-closure-gates-20261023'
CANDIDATE='7aef3ff22f0dbe4fbfe739196bf92ad7a9435fb6'
env=dict(os.environ,GIT_NO_LAZY_FETCH='1')
def git(d,*args):return subprocess.check_output(['git','-C',str(d),*args],env=env,stderr=subprocess.DEVNULL)
def blob(b):return hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()
def footprint(p):return p.lstat().st_size+sum(x.lstat().st_size for x in p.rglob('*'))
tree={}
for row in git(DONOR,'ls-tree','-rz','-l',CANDIDATE).split(b'\0'):
 if not row:continue
 meta,f=row.split(b'\t');mode,typ,h,n=meta.split()
 if typ==b'blob':tree[f.decode()]={'blob':h.decode(),'bytes':int(n) if n!=b'BAD' else None,'mode':mode.decode()}
prior_tree=json.loads((pathlib.Path(str(BASE)+'-render-positiont-build-readiness-oct23')/'docs/re-notes/render-positiont-build-readiness-20261023/candidate-tree.json').read_text())
assert all(tree[f]['blob']==h for f,h in prior_tree.items())
cache={};locations={}
def read(f):
 if f in cache:return cache[f]
 h=tree[f]['blob']
 for d in [OLD,DONOR,BASE]:
  p=d/f
  if p.is_file():
   b=p.read_bytes()
   if blob(b)==h:cache[f]=b;locations[f]=str(d);return b
 for d in [DONOR,BASE]:
  try:b=git(d,'cat-file','blob',h)
  except subprocess.CalledProcessError:continue
  assert blob(b)==h;cache[f]=b;locations[f]=str(d)+':object:'+h;return b
 raise RuntimeError('missing exact local input '+f+' '+h)
universes={
 'rootJS':{f for f in tree if '/' not in f and f.endswith('.js')},
 'recursiveJS':{f for f in tree if f.split('/')[0] in ['lib','tools','test'] and f.endswith('.js') and not any(x.startswith('.') or x=='node_modules' for x in f.split('/'))},
 'WAT-WATX':{f for f in tree if re.fullmatch(r'src/[^/]+\.watx?',f)},
 'testDiscovery':{f for f in tree if re.fullmatch(r'test/(?:test-[A-Za-z0-9._-]+|[A-Za-z0-9._-]+\.test)\.js',f)},
}
files=set().union(*universes.values())
# Supporting inputs from failed plan are hints ONLY, checked against exact tree.
inherited=json.loads((OLD/'docs/re-notes/render-positiont-canonical-prereqs-complete-20261023/manifest.json').read_text())
for f,h,*_ in inherited:
 if f in tree:assert tree[f]['blob']==h
 files.add(f)
# Exact asset absent from sparse fixture commit, deliberately pinned separately.
tree['fonts/Terminal.fon']={'blob':'fb0ed91d991e23a7e59eea339bd5763c5557ed87','bytes':5168,'mode':'100644'}
files.update(['index.html','test/run-all.sh'])
build=read('tools/build.sh').decode();prefix=build.split('node tools/build-compile-wat.js\n')[0]
assert len(build.split('node tools/build-compile-wat.js\n'))==2
roots=set(re.findall(r'^\s*node (\S+\.js)',prefix,re.M))
roots.update(['tools/test-tiers.js','tools/check-test-timeouts.js'])
# Follow all literal require edges, and all exact quoted tree paths in the
# executable consumer closure. This is conservative (includes inactive branches).
# Dynamic paths are audited explicitly below, rather than guessed by this walk.
def closure(roots):
 seen=set();queue=list(roots);refs=set()
 while queue:
  f=queue.pop()
  if f in seen:continue
  seen.add(f);text=read(f).decode()
  for name in re.findall(r'require\([\'\"]([^\'\"]+)[\'\"]\)',text):
   if not name.startswith('.'):continue
   p=os.path.normpath(str(pathlib.PurePosixPath(f).parent/name))
   q=next((q for q in [p,p+'.js',p+'.json',p+'/index.js'] if q in tree),None)
   if q:
    refs.add(q)
    if q.endswith('.js'):queue.append(q)
  for name in re.findall(r'[\'\"]([^\'\"\n]+)[\'\"]',text):
   for p in [name,os.path.normpath(str(pathlib.PurePosixPath(f).parent/name))]:
    if p in tree:refs.add(p)
 return seen|refs
consumer=closure(roots)
files.update(consumer)
# Explicit dynamic consumers: bundle roots (compile-wat uses path.join), source
# include/region/layout walkers, API specs, compiler seal entries and font bytes.
bundle=closure({'tools/toyvm/live.js','tools/toyvm/region-prepare.js','lib/compile-wat.js'})
files.update(bundle)
late_roots=set(re.findall(r'^\s*node (\S+\.js)',prefix[prefix.index('node tools/toyvm/bundle-browser.js'):],re.M))
late_consumers=closure(late_roots)|bundle
files.update(late_consumers)
prov=read('tools/watx-src/PROVENANCE.md').decode()
provenance={f for f in tree if re.search(r'(?m)^[0-9a-f]{64}\s+'+re.escape(f)+r'\s*$',prov)}
assert provenance
files.update(provenance)
pins=json.loads(read('test/support/positiont-com-source-pins.json'))
files.update(pins)
assert all(tree[f]['blob']==h for f,h in pins.items())
assets={'fonts/Terminal.fon','docs/dos-corpus/live/toyvm-bundle.js','docs/dos-corpus/live/toyvm-jit-bundle.js'}
files.update(assets)
deferred=assets|{'tools/watx-src/PROVENANCE.md','tools/watx-src/CHANGELOG.md','tools/layout-offsets.json'}|{f for f in pins if f.startswith('lib/') and not f.endswith('.js') and f!='lib/host-import-sigs.generated.json'}
# Keep ALL lib/tools/root JS through all later scanners/layout consumers. Only
# test JS is released before bundles, except sealed provenance + exact fixture
# pins. At concat release all unpinned inputs except the actual final consumers.
concat=closure({'tools/concat-wat.js','tools/check-parens.js'})|set(pins)|{'src/main.watx','test/support/positiont-com-module.js','test/support/positiont-com-source-pins.json'}
manifest=[]
for f in sorted(files):
 b=read(f)
 life='concat' if f in concat else 'late'
 if f.startswith('test/') and f.endswith('.js') and f not in provenance and f not in concat and f not in late_consumers:life='scanner'
 manifest.append([f,tree[f]['blob'],len(b),locations[f],life,'late' if f in deferred else 'initial'])
inherited_set={r[0] for r in inherited}
assert not ({r[0] for r in manifest if r[4]=='scanner'}&late_consumers)
review={'candidate':CANDIDATE,'treeEntries':len(tree)-1,'inheritedFocusedTreeEntries':len(prior_tree),'treeSha256':hashlib.sha256(json.dumps(tree,sort_keys=True).encode()).hexdigest(),'universes':{k:sorted(v) for k,v in universes.items()},'consumerRoots':sorted(roots),'consumerClosure':sorted(consumer),'lateConsumerClosure':sorted(late_consumers),'bundleClosure':sorted(bundle),'provenanceInputs':sorted(provenance),'concatClosure':sorted(concat),'omittedByInheritedReceipts':sorted(files-inherited_set),'inheritedCompletenessAccepted':False,'setEquality':all(v<=files for v in universes.values())}
# Each input class is masked in the same pre-execution identity verifier. No
# canonical child process is launched by the verifier or its rejection controls.
def verify(rows,mask=None):
 actual={r[0] for r in rows}
 assert actual==files,'missing input '+str(mask)
 for f in sorted(actual):
  assert f!=mask,'masked input unavailable '+str(mask)
  assert blob(read(f))==tree[f]['blob']
verify(manifest)
classes={'rootJS':'host.js','recursiveLib':'lib/compile-wat.js','recursiveTools':'tools/toyvm/vm.js','recursiveTest':'test/run.js','WAT':'src/00-regions.wat','WATX':'src/main.watx','nonJS':'index.html','provenance':'tools/watx-src/PROVENANCE.md','font':'fonts/Terminal.fon','bundle':'docs/dos-corpus/live/toyvm-jit-bundle.js','dynamicData':'src/api_table.json','runner':'test/run-all.sh'}
controls=[]
for kind,f in classes.items():
 assert f in files
 try:verify(manifest,f)
 except AssertionError as error:controls.append({'class':kind,'masked':f,'exit':1,'beforeExecution':True,'error':str(error)})
 else:raise AssertionError('mask accepted')
dirs={str(p) for f in files for p in pathlib.PurePosixPath(f).parents if str(p)!='.'}
combined=10+sum(len(read('src/'+f)) for f in re.findall(r'\(include "([^"]+)"\)',read('src/main.watx').decode()))
# Metadata/index/object upper bound includes publication of compact review
# artifacts; unchanged blobs resolved from standing stores (no archive copy).
overhead=len(dirs)*4096+1048576
growth=1572864
ext=footprint(EXT)
base=ext+overhead+growth+8388608
phases={'initial-scanner':base+sum(r[2] for r in manifest if r[5]=='initial'),
 'bundle-decoder-provenance-layout':base+sum(r[2] for r in manifest if r[4]!='scanner'),
 'concat-parens':base+sum(r[2] for r in manifest if r[4]=='concat')+combined}
admission={'candidate':CANDIDATE,'cap':67108864,'reserve':8388608,'externalMeasured':ext,'taskCodeMeasured':footprint(OUT),'directoryUpper':len(dirs)*4096,'privateGitEvidenceUpper':1048576,'futureGrowth':growth,'hostFloor':2982150144,'hostFree':shutil.disk_usage(BASE).free,'combinedBytes':combined,'phases':phases,'admitted':max(phases.values())<=67108864 and shutil.disk_usage(BASE).free-max(phases.values())>=2982150144,'design':'private Git, standing read-only object alternates; no donor index, refs or metadata writes; source bytes fully staged, no source links'}
for name,value in [('manifest',manifest),('closure',review),('missing-controls',controls),('admission',admission)]:
 (E/(name+'.json')).write_text(json.dumps(value,separators=(',',':'))+'\n')
print(json.dumps(admission),flush=True)
if not admission['admitted']:sys.exit(2)
if '--stage' not in sys.argv:sys.exit(0)
assert not (OUT/'.git').exists(),'materialize once'
git(OUT,'init','-q','-b','task/render-positiont-complete-closure-gates-oct23')
(OUT/'.git/objects/info/alternates').write_text(str(DONOR/'.git/objects')+'\n'+str(BASE/'.git/objects')+'\n')
git(OUT,'update-ref','refs/heads/task/render-positiont-complete-closure-gates-oct23',CANDIDATE)
git(OUT,'config','user.name','Wine Assembly Worker');git(OUT,'config','user.email','codex@wine-assembly.local')
git(OUT,'remote','add','origin','git@github.com:vgrichina/wine-assembly.git')
for f,h,n,d,life,start in manifest:
 if start!='initial':continue
 p=OUT/f;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(read(f))
 if f.endswith('.sh'):p.chmod(0o755)
print('STAGED',footprint(OUT),flush=True)
