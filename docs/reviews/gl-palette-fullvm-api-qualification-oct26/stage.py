from common import *
import re,tarfile,io
gate('before-stage')
# Use immutable object bytes; a donor working file is eligible only if its Git blob identity matches.
g('init','-q',str(R),cwd=H)
stores=[]
for p in [D/'.git/objects',ROOT/'.git/objects',*pathlib.Path('/tmp').glob('*/repo/.git/objects')]:
 if p.is_dir() and str(p) not in stores:stores.append(str(p))
(R/'.git/objects/info/alternates').write_text('\n'.join(stores)+'\n')
rows=g('ls-tree','-r','-t','-l',REV).decode().splitlines(); entries={};trees=[]
for l in rows:
 head,p=l.split('\t');mode,kind,oid,size=head.split()
 if kind=='tree':trees.append((oid,kind))
 else:entries[p]=(mode,oid,int(size) if size!='BAD' else None)
selected=set(p for p in entries if p.startswith(('src/','lib/','tools/watx-src/')) or p in ['tools/watx.js','tools/watx-closure.js','test/render-helper.js','test/compile-src.js'])
cache={};sources={};missing=[]
def blob(p):
 if p in cache:return cache[p]
 mode,oid,size=entries[p]
 try:b=g('cat-file','blob',oid);source='immutable object'
 except AssertionError:
  b=None
  for q in [ROOT/p,*[x/p for x in pathlib.Path('/tmp').glob('*/repo')]]:
   if q.is_file():
    c=q.read_bytes()
    if hashlib.sha1(b'blob '+str(len(c)).encode()+b'\0'+c).hexdigest()==oid:b=c;source=str(q);break
  if b is None:missing.append((p,oid));return None
 assert hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()==oid
 cache[p]=b;sources[p]=source;return b
todo=list(selected)
while todo:
 p=todo.pop();b=blob(p)
 if b is None:continue
 if p.endswith(('.js','.cjs')):
  for m in re.finditer(rb'require\(\s*[\'"]([^\'"]+)[\'"]\s*\)',b):
   req=m[1].decode()
   if req.startswith('.'):
    base=os.path.normpath(str(pathlib.PurePosixPath(p).parent/req));matches=[s for s in [base,base+'.js',base+'.json',base+'/index.js'] if s in entries]
    if matches and matches[0] not in selected:selected.add(matches[0]);todo.append(matches[0])
save('input-recovery.json',dict(candidate=REV,selected=len(selected),missing=missing,stores=stores))
print('SELECTED',len(selected),'BYTES',sum(len(b) for b in cache.values()),'MISSING',missing,flush=True)
assert not missing,'bounded exact object recovery still needed'
# Retain only metadata needed for sparse evidence publication, not another source checkout.
for oid,kind in [(REV,'commit'),(g('rev-parse',REV+'^{tree}').decode().strip(),'tree'),*trees]:
 b=g('cat-file',kind,oid);raw=(kind+' '+str(len(b))+'\0').encode()+b
 assert hashlib.sha1(raw).hexdigest()==oid
 p=R/'.git/objects'/oid[:2]/oid[2:];p.parent.mkdir(exist_ok=True);p.write_bytes(zlib.compress(raw))
(R/'.git/objects/info/alternates').unlink();(R/'.git/shallow').write_text(REV+'\n')
for k,v in [('core.sparseCheckout','true'),('core.sparseCheckoutCone','false'),('core.sshCommand',SSH),('user.name','Wine Ops'),('user.email','wine-ops@local')]:g('config',k,v)
(R/'.git/info/sparse-checkout').write_text('/docs/reviews/'+H.name+'/\n')
g('update-ref','refs/heads/'+BR,REV);g('symbolic-ref','HEAD','refs/heads/'+BR);g('read-tree','-mu','HEAD');g('remote','add','origin','git@github.com:vgrichina/wine-assembly.git')
test=(ROOT/'scratch/runs/20261014-palette-fullvm-regressions/test-d3dim-palette-alpha-page-watch.js').read_bytes()
assert sha(test)=='c06d10e8d419302a82eab03bd68e0c788df84323a0c1ed484b28bfd19246aebe'
manifest=[]
with tarfile.open(H/'source.tar.gz','w:gz',compresslevel=6) as t:
 for p in sorted(selected):
  b=cache[p];manifest.append(dict(path=p,blob=entries[p][1],sha256=sha(b),bytes=len(b)))
  info=tarfile.TarInfo(p);info.size=len(b);info.mode=0o644;info.mtime=0;t.addfile(info,io.BytesIO(b))
 p='test/test-d3dim-palette-alpha-page-watch.js';info=tarfile.TarInfo(p);info.size=len(test);info.mtime=0;t.addfile(info,io.BytesIO(test))
 manifest.append(dict(path=p,retained=True,sha256=sha(test),bytes=len(test)))
save('source-manifest.json',dict(candidate=REV,files=manifest,total=sum(x['bytes'] for x in manifest),archiveBytes=(H/'source.tar.gz').stat().st_size,archiveSHA256=sha((H/'source.tar.gz').read_bytes())))
save('sources.json',sources)
gate('archive',remote=sum(x['bytes'] for x in manifest)+5*1048576)
print('ARCHIVE READY',json.load(open(O/'source-manifest.json'))['archiveBytes'])
