import pathlib,json,subprocess,os,hashlib,zlib,shutil
BASE=pathlib.Path('/home/user/wine-assembly')
OLD=pathlib.Path(str(BASE)+'-render-positiont-build-readiness-oct23')
DONOR=pathlib.Path(str(BASE)+'-render-positiont-com-qualification-fixture-oct23')
OUT=pathlib.Path(str(BASE)+'-render-positiont-canonical-prereqs-complete-oct23')
EXT=BASE/'scratch/usage-watch/render-positiont-canonical-prereqs-complete-oct23'
E=OLD/'docs/re-notes/render-positiont-build-readiness-20261023'
env=dict(os.environ,GIT_NO_LAZY_FETCH='1')
def git(d,*args):return subprocess.check_output(['git','-C',str(d),*args],env=env,stderr=subprocess.DEVNULL)
def blob(b):return hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()
def footprint(p):return p.lstat().st_size+sum(x.lstat().st_size for x in p.rglob('*'))
tree=json.loads((E/'candidate-tree.json').read_text())
rows={r['path']:r for name in ['admission.json','complete-js-input-admission.json'] for r in json.loads((E/name).read_text())['files']}
# Provenance metadata and all documented later assets are planned now.
assetids={'fonts/Terminal.fon':'fb0ed91d991e23a7e59eea339bd5763c5557ed87','docs/dos-corpus/live/toyvm-bundle.js':'4ba63492b67c92a996f817ad241fae94f9e09c59','docs/dos-corpus/live/toyvm-jit-bundle.js':'2f3df6e171cc0a573953cec4de1addad26759ca9'}
for f in ['tools/watx-src/PROVENANCE.md','tools/watx-src/CHANGELOG.md',*assetids]:
 rows[f]={'path':f,'blob':assetids[f] if f in assetids else tree[f]}
def read(f,h):
 for d in [OLD,DONOR,BASE]:
  p=d/f
  if p.is_file():
   b=p.read_bytes()
   if blob(b)==h:return b,str(p)
 for d in [DONOR,BASE]:
  try:b=git(d,'cat-file','blob',h)
  except subprocess.CalledProcessError:continue
  assert blob(b)==h
  return b,str(d)+':object:'+h
 raise RuntimeError('missing '+f+' '+h)
cache={};manifest=[]
assets={'fonts/Terminal.fon','docs/dos-corpus/live/toyvm-bundle.js','docs/dos-corpus/live/toyvm-jit-bundle.js'}
for f,r in sorted(rows.items()):
 b,d=read(f,r['blob']);cache[f]=b;manifest.append([f,r['blob'],len(b),d,'bundle' if f in assets else 'initial'])
# Copy only existing commits/trees, never blobs or donor index; materialized
# source is counted once. No alternates, links, donor writes or new acquisition.
objects=[]
for p in (DONOR/'.git/objects').glob('*/*'):
 if p.parent.name in ['pack','info']:raise RuntimeError('unexpected packed donor store')
 b=zlib.decompress(p.read_bytes())
 if not b.startswith(b'blob '):objects.append(p)
dirs=set()
for f,_,_,_,phase in manifest:
 if phase!='initial':continue
 for p in pathlib.PurePosixPath(f).parents:
  if str(p)!='.':dirs.add(str(p))
source=sum(r[2] for r in manifest if r[4]=='initial')
gitupper=sum(p.stat().st_size for p in objects)+len({p.parent.name for p in objects})*4096+65536
manifestbytes=len(json.dumps(manifest,separators=(',',':')).encode())
external=footprint(EXT)
growth=1048576 # bounded future launcher events/stdout, logs and runner receipts
initial=source+len(dirs)*4096+gitupper+manifestbytes+external+growth+8388608
pins=json.loads(cache['test/support/positiont-com-source-pins.json'])
added=set(r['path'] for r in json.loads((E/'complete-js-input-admission.json').read_text())['files'])
released=[r for r in manifest if r[0] in added and not r[0].startswith('test/watx-compiler-')]
laterassets=sum(r[2] for r in manifest if r[4]=='bundle')
combined=10+sum(len(cache['src/'+f]) for f in __import__('re').findall(r'\(include "([^"]+)"\)',cache['src/main.watx'].decode()))
bundle=initial-sum(r[2] for r in released)+laterassets+6*4096
concat=bundle-laterassets-sum(r[2] for r in manifest if r[0] in added and r[0].startswith('test/watx-compiler-'))+combined
rec=dict(candidate='7aef3ff22f0dbe4fbfe739196bf92ad7a9435fb6',phase='MEASURED BEFORE CHECKOUT',sourceBytes=source,directoryUpper=len(dirs)*4096,gitUpper=gitupper,manifestBytes=manifestbytes,externalBytes=external,futureGrowth=growth,reserve=8388608,cap=67108864,hostFloor=2982150144,hostFree=shutil.disk_usage(BASE).free,phases={'initial-scanner':initial,'bundle-decoder-provenance':bundle,'concat-parens':concat},combinedBytes=combined,assetsBytes=laterassets)
rec['admitted']=max(rec['phases'].values())<=rec['cap'] and rec['hostFree']-max(rec['phases'].values())>=rec['hostFloor']
(EXT/'plan.json').write_text(json.dumps(rec,indent=2)+'\n')
print(json.dumps(rec),flush=True)
if not rec['admitted']:raise SystemExit(2)
if '--stage' not in __import__('sys').argv:raise SystemExit(0)
assert not OUT.exists()
OUT.mkdir();git(OUT,'init','-q','-b','task/render-positiont-canonical-prereqs-complete-oct23')
for p in objects:
 q=OUT/'.git/objects'/p.parent.name/p.name;q.parent.mkdir(exist_ok=True);shutil.copyfile(p,q)
git(OUT,'update-ref','refs/heads/task/render-positiont-canonical-prereqs-complete-oct23',rec['candidate'])
git(OUT,'config','user.name','Wine Assembly Worker');git(OUT,'config','user.email','codex@wine-assembly.local')
git(OUT,'remote','add','origin','git@github.com:vgrichina/wine-assembly.git')
ev=OUT/'docs/re-notes/render-positiont-canonical-prereqs-complete-20261023';ev.mkdir(parents=True)
(ev/'manifest.json').write_text(json.dumps(manifest,separators=(',',':'))+'\n')
(ev/'admission.json').write_text(json.dumps(rec,indent=2)+'\n')
for f,h,n,d,phase in manifest:
 if phase!='initial':continue
 p=OUT/f;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(cache[f])
 if f.endswith('.sh'):p.chmod(0o755)
print('STAGED bytes',footprint(OUT),flush=True)
