"""Verify all mandatory CLI data against intended main; add only absent data."""
import pathlib,json,subprocess,hashlib,os,sys,base64
E=pathlib.Path(__file__).resolve().parent;W=E.parents[2];sys.path.insert(0,str(E));import transport as t
BASE='58e90870a40a541a4083cae5e987ca8de31889e6';SRC=pathlib.Path('/home/user/wine-assembly')
env=dict(os.environ,GIT_NO_LAZY_FETCH='1')
def git(*a):return subprocess.check_output(['git',*a],cwd=W,env=env)
def blob(b):return hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()
def verify(p):
 b=(SRC/p).read_bytes();expected=git('ls-tree',BASE,'--',p).decode().split()[2];assert blob(b)==expected,p
 return dict(path=p,bytes=len(b),sha256=hashlib.sha256(b).hexdigest(),gitBlob=expected,source=str(SRC/p),main=BASE)
# Enumerate with the exact pinned pure data helper, no guest or Wasm compilation.
helper=verify('lib/font-substitutions.js');manifest=verify('fonts/substitutions.json')
js="const f=require(process.argv[1]+'/lib/font-substitutions');console.log(JSON.stringify({bitmap:f.BUNDLED_BITMAP_FONTS,mounts:f.fontMounts(require(process.argv[1]+'/fonts/substitutions.json'),{subset:true})}))"
f=json.loads(subprocess.check_output(['node','-e',js,str(SRC)]));paths=['test/binaries/tlbs/stdole2.tlb','fonts/substitutions.json']+['fonts/'+n for n in f['bitmap']]+['fonts/'+m['file'] for m in f['mounts']];pins=[verify(p) for p in sorted(set(paths))]
t.save('required-data-manifest.json',dict(helper=helper,fontMounts=f,files=pins,totalBytes=sum(p['bytes'] for p in pins)))
a=json.loads((E/'admission.json').read_text());extra=sum((SRC/p['path']).stat().st_blocks*512 for p in pins)+(SRC/'lib/font-substitutions.js').stat().st_blocks*512;a['addedRootDataAllocated']=extra;a['total']+=extra;assert a['total']<67108864;t.save('data-admission.json',a)
# Embed original bytes directly in one bounded APIexec; no file-transfer authority or archive.
payload=[dict(**p,data=base64.b64encode((SRC/p['path']).read_bytes()).decode()) for p in pins]
code="""import pathlib,json,hashlib,base64,os,stat
R=pathlib.Path('/home/user/shadow-man-streamed-installed-runtime-oct22');I=R/'immutable';RT=I/'runtime'
PINS=PAYLOAD
assert os.getuid()==1000
assert all(not p.is_symlink() and not p.stat().st_mode&0o222 for p in [I,*I.rglob('*')])
before={str(p.relative_to(I)):hashlib.sha256(p.read_bytes()).hexdigest() for p in I.rglob('*') if p.is_file()}
assert all(not (RT/p['path']).exists() for p in PINS)
assert sum(p['bytes']+8192 for p in PINS)+sum(p.stat().st_blocks*512 for p in [I,*I.rglob('*')])<2147483648
old={};created=[];added=[]
def writable(p):
 if p not in old:old[p]=stat.S_IMODE(p.stat().st_mode);assert p.stat().st_uid==os.getuid();p.chmod(old[p]|stat.S_IWUSR)
try:
 for pin in PINS:
  dst=RT/pin['path'];chain=[];par=dst.parent
  while not par.exists():chain.append(par);par=par.parent
  writable(par)
  for d in reversed(chain):d.mkdir(mode=0o755);created.append(d)
  if dst.parent.exists() and dst.parent not in created:writable(dst.parent)
  data=base64.b64decode(pin['data']);assert len(data)==pin['bytes'] and hashlib.sha256(data).hexdigest()==pin['sha256']
  with dst.open('xb') as f:f.write(data)
  dst.chmod(0o444);assert hashlib.sha256(dst.read_bytes()).hexdigest()==pin['sha256'];added.append({k:v for k,v in pin.items() if k!='data'})
finally:
 for p,m in old.items():p.chmod(m)
 for p in reversed(created):p.chmod(0o555)
assert all(hashlib.sha256((I/p).read_bytes()).hexdigest()==h for p,h in before.items())
assert all(not p.stat().st_mode&0o222 for p in [I,*I.rglob('*')])
print(json.dumps(dict(passAll=True,added=added,preexistingFilesPreserved=len(before),parentModesRestored={str(p):oct(m) for p,m in old.items()},createdDirectories=[str(p) for p in created],immutableReadOnly=True)))
""".replace('PAYLOAD',repr(payload))
r=t.run(code,'data-stage-api.json',timeout=30);t.save('data-stage.json',json.loads(r['stdout']));print(json.dumps(dict(added=len(pins),bytes=sum(p['bytes'] for p in pins),wholeAdmission=a['total'],stage='PASS')))
