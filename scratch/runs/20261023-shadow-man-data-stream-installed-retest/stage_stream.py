"""Exact audited DATA only; supported known-length raw uploads, no retries."""
import pathlib,json,hashlib,os,sys,datetime
E=pathlib.Path(__file__).resolve().parent
sys.path.insert(0,str(E));import transport as t
pins=json.loads((E/'required-data-manifest.json').read_text())['files']
for x in pins:
 b=pathlib.Path(x['source']).read_bytes()
 assert len(b)==x['bytes'] and hashlib.sha256(b).hexdigest()==x['sha256']
 assert hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()==x['gitBlob']
t.save('box-before.json',t.api('sandboxes/'+t.BOX))
box=json.loads((E/'box-before.json').read_text())['sandbox'];assert box['state']=='idle' and box['health']=='ok' and box['stop'] is None
common="""import pathlib,json,hashlib,os,stat
R=pathlib.Path('/home/user/shadow-man-streamed-installed-runtime-oct22');I=R/'immutable';RT=I/'runtime';F=R/'fixed';M=R/'mutable'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def alloc(p):return sum(x.lstat().st_blocks*512 for x in [p,*p.rglob('*')])
"""
prepare=common+"PINS="+repr(pins)+"\n"+"""
assert os.getuid()==1000
assert all(not p.is_symlink() and not p.stat().st_mode&0o222 for p in [I,*I.rglob('*')])
assert all(not (RT/x['path']).exists() for x in PINS)
st=os.statvfs(M);assert st.f_blocks*st.f_frsize==939524096 and (st.f_blocks-st.f_bfree)*st.f_frsize+4*177682979+16777216<939524096
assert alloc(F)+2097152<100663296 and alloc(I)+1048576<2147483648 and os.statvfs(R).f_bavail*os.statvfs(R).f_frsize>2147483648
assert M.stat().st_uid==M.stat().st_gid==1000
assert sha(M/'registry.json')==sha(I/'restored/parent-registry.json')=='d7143f29d29576cd015ec875264028fa70795d0f18de457e31927048081d9de3'
before={str(p.relative_to(I)):sha(p) for p in I.rglob('*') if p.is_file()}
receipt=dict(before=before,old={},created=[])
def save(): (F/'data-stream-preparation.json').write_text(json.dumps(receipt))
save()
def writable(p):
 k=str(p)
 if k not in receipt['old']:
  assert p.stat().st_uid==os.getuid();receipt['old'][k]=stat.S_IMODE(p.stat().st_mode);save();p.chmod(receipt['old'][k]|stat.S_IWUSR)
for x in PINS:
 dst=RT/x['path'];chain=[];p=dst.parent
 while not p.exists():chain.append(p);p=p.parent
 writable(p)
 for d in reversed(chain):
  receipt['created'].append(str(d));save();d.mkdir(mode=0o755)
 writable(dst.parent)
print(json.dumps(dict(passAll=True,preexistingFiles=len(before),temporaryParents=receipt['old'],created=receipt['created'],immutableAllocated=alloc(I),fixedAllocated=alloc(F),tmpfsUsed=(st.f_blocks-st.f_bfree)*st.f_frsize,tmpfsCap=st.f_blocks*st.f_frsize,uid=os.getuid())))
"""
restore=common+"""
r=json.loads((F/'data-stream-preparation.json').read_text())
for p in r['created']:
 d=pathlib.Path(p)
 if d.exists():
  for x in d.iterdir():
   if x.is_file():x.chmod(0o444)
for p,m in r['old'].items():pathlib.Path(p).chmod(m)
for p in reversed(r['created']):
 if pathlib.Path(p).exists():pathlib.Path(p).chmod(0o555)
for p,h in r['before'].items():assert sha(I/p)==h,p
assert all(not p.stat().st_mode&0o222 for p in [I,*I.rglob('*')])
print(json.dumps(dict(passAll=True,preexistingFilesPreserved=len(r['before']),immutableReadOnly=True,immutableAllocated=alloc(I),fixedAllocated=alloc(F))))
"""
uploaded=[]
try:
 t.run(prepare,'prepare-api.json');print('PREPARED',flush=True)
 for x in pins:
  assert datetime.datetime.now(datetime.timezone.utc)<datetime.datetime(2026,10,23,0,17,30,tzinfo=datetime.timezone.utc),'handoff budget'
  with pathlib.Path(x['source']).open('rb') as f:r=t.upload_stream(f,x['bytes'],t.ROOT+'/immutable/runtime/'+x['path'])
  assert r['sha256']==x['sha256'];uploaded.append(r);t.save('uploaded.json',uploaded)
  print('UPLOADED '+x['path'],flush=True)
finally:
 t.run(restore,'restore-api.json')
verify=common+'PINS='+repr(pins)+'\n'+"""
for x in PINS:
 p=RT/x['path'];assert p.stat().st_size==x['bytes'] and sha(p)==x['sha256'],x['path']
print(json.dumps(dict(passAll=True,files=len(PINS),bytes=sum(x['bytes'] for x in PINS),immutableReadOnly=True)))
"""
t.run(verify,'data-gate-api.json');print('DATA GATE PASS',flush=True)
