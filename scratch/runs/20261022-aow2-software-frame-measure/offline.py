import pathlib, subprocess, json, hashlib, tarfile, re, os
E=pathlib.Path(__file__).resolve().parent
W=E.parents[2]; ROOT=pathlib.Path('/home/user/wine-assembly')
Q=pathlib.Path('/home/user/wine-assembly-mm-timer-qualified-integrate-oct22/scratch/runs/20261022-mm-timer-canonical-qualification')
A=pathlib.Path('/home/user/wine-assembly-arcanum-software-frame-measure-oct22')
REV='c26252c4a95babe583ade1d1c6e2da0c050be45c'
QUAL='ce4ce4f95eacaedff1b3e386f3ce3ae5d85bd16c'
def sha(b): return hashlib.sha256(b).hexdigest()
def save(n,v):
 assert os.statvfs(W).f_bavail*os.statvfs(W).f_frsize>=2982150144
 (E/n).write_text(json.dumps(v,indent=2)+'\n')
def git(*a):return subprocess.check_output(['git','-C',str(W),*a])
trees={r:{p:git('rev-parse',r+':'+p).decode().strip() for p in ['src','lib','tools','host.js','index.html','package-lock.json']} for r in [REV,QUAL]}
assert trees[REV]==trees[QUAL]
archive=Q/'qualification-artifacts.tar.gz'
assert sha(archive.read_bytes())=='3e308c0012e996070a01c1f77d6f399e9aaf7adb2d2620b27af018a80d29e248'
with tarfile.open(archive) as t: module=t.extractfile('build/wine-assembly.wasm').read()
assert sha(module)=='f644bbb26edc077239dac17b8b2cfda482aafd9eb44af4c4776d4fe153d5a1a7'
# Verify every recorded canonical source blob, not just config/tree names.
closure=json.loads((Q/'source-manifest.json').read_text())['files']+json.loads((Q/'supplemental-manifest.json').read_text())
for x in closure:
 b=git('cat-file','blob',x['blob']);assert len(b)==x['size'] and sha(b)==x['sha256'],x['path']
save('module-inventory.json',dict(source=REV,qualified=QUAL,trees=trees,archive=str(archive),archiveSha256=sha(archive.read_bytes()),moduleSha256=sha(module),moduleBytes=len(module),verifiedCanonicalSourceBlobs=len(closure),decision='Matching historical source/module available; no rebuild; not current-main qualification.'))
source=json.loads((A/'scratch/runs/20261022-arcanum-software-frame-measure/source-manifest.json').read_text())
for x in source:
 b=(A/'runtime'/x['path']).read_bytes();assert sha(b)==x['sha256'],x['path']
 if not x['path'].startswith('build/'):assert b==git('show',REV+':'+x['path']),x['path']
save('source-manifest.json',source)
fonts=json.loads((A/'scratch/runs/20261022-arcanum-software-frame-measure/font-supplement.json').read_text())
for x in fonts:
 b=(ROOT/x['path']).read_bytes();assert sha(b)==x['sha256'],x['path']
save('font-manifest.json',fonts)
base=pathlib.Path('test/binaries/win98-games-a-d/Age of Wonders2 demo-SW/extracted');r=ROOT/base
m=json.loads((r/'.wine-assembly-browser.json').read_text())
actual={p.relative_to(r).as_posix() for p in r.rglob('*') if p.is_file()}
assert actual=={x['url'] for x in m['files']}|{'AoW2.exe','vcl50.bpl','vclx50.bpl','Ml42ND50.bpl','.wine-assembly-browser.json'}
assert len(m['files'])==1059
for x in m['files']:
 assert (r/x['url']).stat().st_size==x['size']
 assert x['vfsPath']=='c:\\aow2demo\\'+x['url'].replace('/','\\')
 assert x['loadMode']=='lazy'
assert sha((r/'AoW2.exe').read_bytes())=='a10590e5dbd013d154b00ea53e66670f4e74d38ab33adb2523f0a662af8f89f7'
assets=[dict(path=str(base/p),size=(r/p).stat().st_size,sha256=sha((r/p).read_bytes())) for p in sorted(actual)]
save('assets.json',dict(files=assets,manifestEntries=len(m['files']),originalFiles=len(actual)-1,totalBytes=sum(x['size'] for x in assets)))
native={};imports={};dumpdir=E/'imports';dumpdir.mkdir(exist_ok=True)
# Audit registered startup seeds and original dynamic game DLLs/ASIs/BPLs.
for p in sorted(r.iterdir()):
 if p.name!='AoW2.exe' and p.suffix.lower() not in ['.bpl','.dll','.asi']:continue
 s=subprocess.check_output(['objdump','-p',str(p)]).decode()
 (dumpdir/(p.name+'.txt')).write_text(s)
 native[p.name.lower()]=set(re.findall(r'^\s*\[\s*\d+\]\s+(\S+)',s,re.M))
 rows=[];dll=None
 for line in s.split('The Export Tables')[0].split('PE File Base Relocations')[0].splitlines():
  if 'DLL Name:' in line:dll=line.split('DLL Name:')[1].strip().lower()
  elif dll:
   q=re.match(r'^\s+[0-9a-f]+\s+(\d+)\s+(\S+)\s*$',line)
   if q:rows.append(dict(dll=dll,name=q[2]))
 imports[p.name.lower()]=rows
api={x['name'] for x in json.loads(git('show',REV+':src/api_table.json'))}
unresolved=[]
for owner,rows in imports.items():
 for row in rows:
  if row['dll'] in native:row['resolution']='original native export';ok=row['name'] in native[row['dll']]
  else:row['resolution']='accepted API table entry (handler semantics separately required)';ok=row['name'] in api
  if not ok:unresolved.append(dict(owner=owner,**row))
startup={'aow2.exe','vcl50.bpl','vclx50.bpl','ml42nd50.bpl'}
while True:
 expanded=startup|{x['dll'] for o in startup for x in imports.get(o,[]) if x['dll'] in imports}
 if expanded==startup:break
 startup=expanded
for x in unresolved:
 x['resolution']='not in API table or original package native exports; native system fallback not yet established'
 x['startupOwner']=x['owner'] in startup
save('dependency-audit.json',dict(imports=imports,unresolved=unresolved,startupOwners=sorted(startup),note='Full inventory includes unused designer/database packages: their missing exports are NOT asserted to block startup. API table membership alone is not proof of handler semantics. System native fallback is checked separately for the concrete blocker.'))
registry=git('show',REV+':lib/dll-registry.js').decode()
blocked=[x for x in unresolved if x['startupOwner'] and x['name'] in ['GetOverlappedResult','ActivateKeyboardLayout']]
assert len(blocked)==4
for x in blocked:
 assert x['dll'] not in registry
 assert not (ROOT/'test/binaries/dlls'/x['dll']).exists()
 assert x['dll'] not in {p.name.lower() for p in r.iterdir()}
source_search=subprocess.run(['git','-C',str(W),'grep','-n','-E','GetOverlappedResult|ActivateKeyboardLayout',REV,'--','src','lib','host.js'],capture_output=True,text=True)
assert source_search.returncode==1 and not source_search.stdout
save('source-gate.json',dict(passed=False,gate='complete startup import support',blocked=blocked,registryNativeFallback=False,standardNativePayloadPresent=False,sourceSearchExit=source_search.returncode,sourceSearchOutput=source_search.stdout,conclusion='Offline dependency gate fails; no browser launch. Calls are not proven reachable in the ordinary scene. This is not a reproduced runtime crash.',unreached=['remote staging and runner closure','emitting owner/canvas/layer attribution','short positive samples','full scene interval']))
print('PASS module/source/fonts/manifest; BLOCKED complete startup import support:',len(blocked),'imports across two startup packages; browser not launched')
raise SystemExit(2)
