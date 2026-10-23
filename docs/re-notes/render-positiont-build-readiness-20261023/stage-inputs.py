import os, subprocess, json, hashlib, pathlib, re, shutil, zlib
ROOT=pathlib.Path('/home/user/wine-assembly')
DONOR=pathlib.Path(str(ROOT)+'-render-positiont-com-qualification-fixture-oct23')
OUT=pathlib.Path(str(ROOT)+'-render-positiont-build-readiness-oct23')
CAND='7aef3ff22f0dbe4fbfe739196bf92ad7a9435fb6'
ENV=dict(os.environ,GIT_NO_LAZY_FETCH='1')
def git(root,*args):
 p=subprocess.run(['git','-C',str(root),*args],env=ENV,capture_output=True)
 if p.returncode: raise RuntimeError((args,p.stderr.decode()))
 return p.stdout
tree={l.split('\t')[1]:l.split()[2] for l in git(DONOR,'ls-tree','-r',CAND).decode().splitlines()}
cache={}
def read(f):
 if f in cache:return cache[f]
 h=tree[f]
 for repo in [DONOR,ROOT]:
  p=subprocess.run(['git','-C',str(repo),'cat-file','blob',h],env=ENV,capture_output=True)
  if p.returncode==0: cache[f]=(p.stdout,str(repo)+':object:'+h);return cache[f]
 for repo in [DONOR,ROOT]:
  p=repo/f
  if p.is_file():
   b=p.read_bytes()
   if hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()==h:
    cache[f]=(b,str(p));return cache[f]
 raise RuntimeError('missing exact input '+f+' '+h)
build=read('tools/build.sh')[0].decode()
pins=json.loads(read('test/support/positiont-com-source-pins.json')[0])
selected=set(pins)|{'CLAUDE.md','AGENTS.md','.gitignore','package.json','package-lock.json','tools/build.sh','test/support/positiont-com-module.js','test/support/positiont-com-source-pins.json','test/test-d3d9-positiont-com-qualification.js','test/render-helper.js'}
selected.update(re.findall(r'(?:node|bash) ([\w/.-]+)',build))
selected.discard('tools/wasm-data.js');selected.discard('tools/build-compile-wat.js')
# Exact gate data and compiler metadata; no binaries/media or unrelated tools.
selected.update(f for f in tree if f.startswith('tools/') and '/' not in f[6:] and f.endswith('.json'))
selected.update(f for f in tree if f.startswith('tools/toyvm/') and f.endswith('.js'))
regions=read('src/00-regions.wat')[0].decode()
selected.update(x for x in re.findall(r'file:([^\s"$:]+)',regions) if x in tree)
while True:
 old=set(selected)
 for f in list(selected):
  b,_=read(f)
  if not f.endswith(('.js','.sh')):continue
  for req in re.findall(r'require\([\'\"]([^\'\"]+)[\'\"]\)',b.decode(errors='replace')):
   if not req.startswith('.'):continue
   p=os.path.normpath(str(pathlib.PurePosixPath(f).parent/req))
   for q in [p,p+'.js',p+'.json',p+'/index.js']:
    if q in tree: selected.add(q);break
 if selected==old:break
rows=[dict(path=f,blob=tree[f],bytes=len(read(f)[0]),donor=read(f)[1]) for f in sorted(selected)]
gitbytes=int(subprocess.check_output(['du','-sb',str(DONOR/'.git')]).split()[0])
source=sum(x['bytes'] for x in rows)
# Conservative independently compressed loose objects, plus donor metadata copy.
objects=sum(len(zlib.compress(b'blob '+str(len(read(f)[0])).encode()+b'\0'+read(f)[0]))+128 for f in selected)
projection=source+gitbytes+objects+8*1024**2+5*1024**2
free=shutil.disk_usage(ROOT).free
receipt=dict(candidate=CAND,phase='MEASURED BEFORE CHECKOUT',files=rows,sourceBytes=source,gitDonorBytes=gitbytes,newLooseObjectUpperBytes=objects,growthBytes=5*1024**2,reserveBytes=8*1024**2,projectedPeak=projection,cap=64*1024**2,free=free,freeFloor=2982150144,admitted=projection<=64*1024**2 and free-projection>=2982150144)
print(json.dumps({k:v for k,v in receipt.items() if k!='files'},indent=2),flush=True)
if not receipt['admitted']:raise SystemExit(2)
if OUT.exists():raise RuntimeError('refuse existing checkout')
OUT.mkdir()
ev=OUT/'docs/re-notes/render-positiont-build-readiness-20261023';ev.mkdir(parents=True)
(ev/'admission.json').write_text(json.dumps(receipt,indent=2)+'\n')
shutil.copytree(DONOR/'.git',OUT/'.git')
git(OUT,'checkout','-b','task/render-positiont-build-readiness-oct23')
for row in rows:
 f=row['path'];b=read(f)[0];p=OUT/f;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(b)
 if f.endswith('.sh'):p.chmod(0o755)
(ev/'candidate-tree.json').write_text(json.dumps(tree,sort_keys=True,indent=2)+'\n')
print('STAGED',OUT)
