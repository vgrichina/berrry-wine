import control as c,pathlib,json,hashlib,tarfile,re,posixpath,resource,inspect
O=c.O;P=O.parent; BASE='a370b362ad41c39109b96510c49246e77e54e0b0'
def sha(b):return hashlib.sha256(b).hexdigest()
c.admission()
assert json.loads((O/'containment-controls.json').read_text())['PASS']
assert (O/'capture-overflow-control.json').exists()
if not c.G.exists():
 c.run('init-owned-bare',['git','-C',str(O),'init','--bare',str(c.G)],cwd=O,git=True)
 (c.G/'objects/info/alternates').write_text('/home/user/wine-assembly/.git/objects\n')
c.git('config','remote.origin.url','git@github.com:vgrichina/wine-assembly.git',mutation=True)
assert c.git('ls-remote','--exit-code','origin','refs/heads/main').decode().split()==[BASE,'refs/heads/main']
assert c.git('cat-file','-t',BASE).strip()==b'commit'
old=json.loads((P/'post-title-poll-recovered-runtime/completion-receipt.json').read_text())
ap=P/'post-title-poll-recovered-runtime/admission.json'
c.save('prior-admission-mismatch.json',dict(path=str(ap),sealedSHA=old['artifactHashes']['admission.json']['sha256'],currentSHA=sha(ap.read_bytes()),currentBytes=json.loads(ap.read_text()),priorReceiptSHA=sha((P/'post-title-poll-recovered-runtime/completion-receipt.json').read_bytes()),note='Current bytes preserved; prior receipt untouched. No blanket historical verification.'))
manifest=json.loads((P/'source-manifest.json').read_text());pins=manifest['inputs'];data={};archives=[];allrows={}
paths=[pathlib.Path('/tmp/tuxracer-software-render-msvcrt-retest-oct30/packet.tar.gz'),pathlib.Path('/tmp/tuxracer-glcolor4dv-canonical-enter-runtime-oct30-report-corrected/candidate.tar.gz'),pathlib.Path('/tmp/tuxracer-vertex-color-gameplay-owner-policy-oct30/candidate-delta.tar.gz')]
expected=['0c1b282fcb6f720c78090dce8156b2d321f9ee5839f414b09a068d033961629b','7cf0738a328c086ba454feb6e88dbcb7d2881ccc761106f2747f7c7f73b52403','96158178be44976471c7fc8a986eb7d5c71beada50808f1b66178557af2ef1bf']
for path,h in zip(paths,expected):
 assert sha(path.read_bytes())==h
 archives.append(dict(path=str(path),bytes=path.stat().st_size,sha256=h))
 with tarfile.open(path) as t:
  for row in t.getmembers():
   assert row.isfile() and not row.name.startswith('/') and '..' not in pathlib.PurePosixPath(row.name).parts
   b=t.extractfile(row).read();data[row.name]=b
   allrows[row.name]=dict(bytes=len(b),sha256=sha(b))
for n,x in pins.items():
 assert n in data and len(data[n])==x['bytes'] and sha(data[n])==x['sha256'],n
 assert hashlib.sha1(b'blob '+str(len(data[n])).encode()+b'\0'+data[n]).hexdigest()==x['oid'],n
seen=set()
def wat(n):
 assert n in data,n
 if n in seen:return
 seen.add(n)
 for k in re.findall(r'\(include\s+"([^"]+)"\)',data[n].decode()):wat(posixpath.normpath(posixpath.join(posixpath.dirname(n),k)))
wat('src/main.watx');assert len(seen)==128
js=set();missing=[]
def imports(n):
 if n in js:return
 js.add(n)
 assert n in data,n
 if not n.endswith(('.js','.mjs','.cjs')):return
 s='\n'.join(line for line in data[n].decode().splitlines() if not line.lstrip().startswith('//'))
 for k in re.findall(r'''require\(\s*['"]([^'"]+)['"]\s*\)''',s):
  if k.startswith('.'):
   q=posixpath.normpath(posixpath.join(posixpath.dirname(n),k));q=next((z for z in [q,q+'.js',q+'/index.js',q+'.json'] if z in data),None)
   if q:imports(q)
   else:missing.append([n,k])
for n in ['tools/build-compile-wat.js','test/run.js']:imports(n)
c.save('compiler-entry.txt',dict(text=data['tools/build-compile-wat.js'].decode()))
# Pin the full existing overlay, not just statically visible imports. Dynamic/runtime
# paths are present in this complete retained packet and reused host-ABI receipt.
observer=P/'input-consumption/main-scheduler-observer.js';assert sha(observer.read_bytes())=='01f4de4099a0e60c56cf6ea109f82ae12e1c42b6ba15309d0411b10fe8029040'
data['test/main-scheduler-observer.js']=observer.read_bytes();allrows['test/main-scheduler-observer.js']=dict(bytes=observer.stat().st_size,sha256=sha(observer.read_bytes()))
assert sha(data['test/run.js'])=='f96e9bb924700ee571e2904e097f80742ff55638399898ae1dc32454af05b02d'
mp=pathlib.Path('/tmp/tuxracer-glcolor4dv-canonical-enter-runtime-oct30/raw/mount-configuration-filename-only.stdout');assert sha(mp.read_bytes())=='14c73c68d0afa4886d9530ee121c0c94b3af50c48a7cc33f8dc9fee90e2ca6f9'
mount=json.loads(mp.read_text());assert mount['argv']==['--app=tuxracer_original_061a'] and len(mount['files'])==157
c.save('mount-reuse.json',dict(PASS=True,parser='validateLocalManifestSync',unchanged=True,receipt=str(mp),sha256=sha(mp.read_bytes()),argv=mount['argv'],files=mount['files'],commaFiles=mount['commaFiles']))
watbytes=sum(len(data[n]) for n in seen)
c.save('staging-manifest.json',dict(files=allrows,archives=archives,observer=dict(path=str(observer),sha256=sha(observer.read_bytes())),canonicalManifestSHA=sha((P/'source-manifest.json').read_bytes())))
c.save('closure.json',dict(PASS=not missing,baseline=BASE,candidate=manifest['candidate'],canonical=128,pins=len(pins),staticImports=len(js),missing=missing,manifestSHA=sha((P/'source-manifest.json').read_bytes()),overlayCount=len(data),overlayBytes=sum(map(len,data.values())),archiveBytes=sum(x['bytes'] for x in archives),watInputBytes=watbytes,combinedWATGenerated=False,combinedWATNote='Canonical build-compile-wat.js compiles VFS in memory; it does not write combined.wat',buildFileLimit=4*c.M,transportFileLimit=12*c.M,expectedWASMFiles=[1881806,1900000],moduleExpectedBytes=1881806,hostABI=json.loads((P/'host-abi-reuse.json').read_text()),runnerSHA=sha(data['test/run.js']),remoteBudget=256*c.M,remoteReserve=8*c.M,remoteProjection=sum(map(len,data.values()))+sum(x['bytes'] for x in archives)+40*c.M,localProjection=c.admission()))
assert not missing,missing
assert sum(map(len,data.values()))+sum(x['bytes'] for x in archives)+40*c.M<248*c.M
print(json.dumps(dict(PASS=True,missing=missing,watbytes=watbytes,combinedWATGenerated=False,overlayBytes=sum(map(len,data.values())))))
