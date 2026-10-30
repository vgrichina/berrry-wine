from control import *
import tarfile,re,ast
D=pathlib.Path('/tmp/gltron-runtime-data-complete-original-render-oct30')
assert git(['rev-parse','HEAD'],'prepare-parent').decode().strip()==BASE
for n in ['objects.py','packed_reader.py']:(R/n).write_bytes((D/n).read_bytes())
from objects import read,entries,path
def oid_at(rel):
 oid=read(BASE,'commit').splitlines()[0].split()[1].decode()
 for n in rel.split('/'):mode,oid=entries(oid)[n.encode()]
 return oid
m=json.loads((R/'runner-closure-manifest.json').read_text());assert m['commit']==BASE
archive=(R/'runner-closure.tar.xz').read_bytes();assert pin(archive)['sha256']==m['archiveSHA256']
sources={}
with tarfile.open(R/'runner-closure.tar.xz') as t:
 ms=t.getmembers();assert len(ms)==len(m['files']) and set(x.name for x in ms)==set(m['files'])
 for x in ms:
  assert x.isfile() and not pathlib.PurePosixPath(x.name).is_absolute() and '..' not in pathlib.PurePosixPath(x.name).parts
  b=t.extractfile(x).read();assert pin(b)==m['files'][x.name]
  assert hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()==oid_at(x.name),x.name
  sources[x.name]=b
assert 'tools/disasm.js' in sources and 'tools/simd-ops.js' in sources
dm=json.loads((D/'runtime-data-manifest.json').read_text());assert pin((D/'eager-runtime-data.tar.xz').read_bytes())=={k:dm['archive'][k] for k in ['bytes','sha256']}
with tarfile.open(D/'eager-runtime-data.tar.xz') as t:
 ms=t.getmembers();assert len(ms)==len(dm['files']) and set(x.name for x in ms)==set(dm['files'])
 for x in ms:
  b=t.extractfile(x).read();assert pin(b)==dm['files'][x.name]
  if not x.name.endswith('.tlb'):assert b==path(BASE,x.name)[1]
conf=json.loads((D/'evidence/launch-configuration.json').read_text());assert conf['source']==m['files']['test/run.js'] and conf['trustedSSH']==SSH
s=sources['test/run.js'].decode();parser=s[s.index('const getArg ='):s.index('// WINE_ASSEMBLY_WASM=')]
code='const vm=require("vm"),assert=require("assert");const args='+json.dumps(conf['configuration']['args'])+';const ctx={args};vm.createContext(ctx);vm.runInContext('+json.dumps(parser+';globalThis.parsed={app:getArg("app"),mounts:getArgs("vfs-mount"),trees:getArgs("vfs-tree"),wasm:getArg("wasm")}')+',ctx);assert.equal(ctx.parsed.app,"gltron");assert.equal(ctx.parsed.mounts.length,0);assert.equal(ctx.parsed.trees.length,0);assert.equal(ctx.parsed.wasm,"build/wine-assembly.wasm");console.log(JSON.stringify(ctx.parsed));'
startup='console.log(JSON.stringify({node:process.version,execPath:process.execPath,execArgv:process.execArgv,limits:require("fs").readFileSync("/proc/self/limits","utf8")}))'
run(['/usr/bin/node','--max-old-space-size=256','-e',startup],'local-node-startup-256',cpu=60)
run(['/usr/bin/node','--max-old-space-size=256','-e',code],'canonical-parser',cpu=60)
assert len(conf['configuration']['files'])==92
save('launch-configuration.json',conf)
run(['/usr/bin/python3','-B','-c','import pathlib;p=pathlib.Path("../disposable");p.write_bytes(b"x"*600000);p.unlink();print("ok")'],'generated-control',limit=524288)
try:run(['/usr/bin/python3','-B','-c','import os;os.write(1,b"x"*2048)'],'overflow-control',limit=1024)
except RuntimeError:assert json.loads((E/'overflow-control.json').read_text())['violation']=='capture overflow'
else:raise AssertionError('overflow accepted')
save('local-preflight.json',dict(PASS=True,parent=BASE,production='311c42abb41adc1fc16e06b4276005d15db553b2',runnerMembers=len(sources),runnerManifest=pin((R/'runner-closure-manifest.json').read_bytes()),allRunnerGitBlobIdentities=True,allDataVerified=True,dataManifest=pin((D/'runtime-data-manifest.json').read_bytes()),originalFiles=92,mountValidation='Canonical exact pinned parser and unchanged complete registry config; filename paths including commas retained as objects',FSIZE=12*M,capture=524288,overflowRejected=True,indexFreePlumbing=True,dynamicRequires='Path-limited query evidence; ordinal lookup optional Win16 diagnostic irrelevant to Win32; media imports and watx retained; WINE_REGION_MAP absent required'))
print(json.dumps(admission('pre-provision-complete-forecast')))
