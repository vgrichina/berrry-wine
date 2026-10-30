from control import *
import tarfile,ast
from objects import path
assert git(['rev-parse','HEAD'],'prepare-parent').decode().strip()==BASE
manifest=json.loads((R/'runtime-data-manifest.json').read_text());assert manifest['source']==BASE
assert pin((R/'eager-runtime-data.tar.xz').read_bytes())=={k:manifest['archive'][k] for k in ['bytes','sha256']}
with tarfile.open(R/'eager-runtime-data.tar.xz') as t:
 ms=t.getmembers();assert len(ms)==len(manifest['files']) and set(m.name for m in ms)==set(manifest['files'])
 for m in ms:
  assert m.isfile() and '..' not in pathlib.PurePosixPath(m.name).parts
  b=t.extractfile(m).read();assert pin(b)==manifest['files'][m.name]
  if not m.name.endswith('.tlb'):assert b==path(BASE,m.name)[1]
startup='console.log(JSON.stringify({node:process.version,execPath:process.execPath,execArgv:process.execArgv,limits:require("fs").readFileSync("/proc/self/limits","utf8")}))'
for heap in [256,512]:run(['/usr/bin/node','--max-old-space-size='+str(heap),'-e',startup],'local-node-startup-'+str(heap),cpu=60)
run(['/usr/bin/python3','-B','-c','import pathlib;p=pathlib.Path("../disposable");p.write_bytes(b"x"*600000);p.unlink();print("ok")'],'generated-control',limit=524288)
try:run(['/usr/bin/python3','-B','-c','import os;os.write(1,b"x"*2048)'],'overflow-control',limit=1024)
except RuntimeError:assert json.loads((E/'overflow-control.json').read_text())['violation']=='capture overflow'
else:raise AssertionError('overflow accepted')
code='const fs=require(\'fs\'),vm=require(\'vm\'),assert=require(\'assert\');const s=fs.readFileSync(\'test/run.js\',\'utf8\');const args=[\'--app=gltron\',\'--no-build\',\'--gl-renderer=software\',\'--wasm=build/wine-assembly.wasm\',\'--max-seconds=45\',\'--max-batches=100000\',\'--batch-size=10000\',\'--png=capture/original.png\'];const parser=s.slice(s.indexOf(\'const getArg =\'),s.indexOf(\'// WINE_ASSEMBLY_WASM=\'));const ctx={args};vm.createContext(ctx);vm.runInContext(parser+\';globalThis.parsed={app:getArg("app"),mounts:getArgs("vfs-mount"),trees:getArgs("vfs-tree"),wasm:getArg("wasm")}\',ctx);assert.equal(ctx.parsed.app,\'gltron\');assert.equal(ctx.parsed.mounts.length,0);assert.equal(ctx.parsed.trees.length,0);const app=require(\'./lib/apps\').APPS.gltron;assert.equal(app.files.length,92);assert.equal(app.exe,\'binaries/gltron-0.70/gltron.exe\');console.log(JSON.stringify({args,parsed:ctx.parsed,exe:app.exe,exeGuestPath:app.exeGuestPath,cwd:app.cwd,files:app.files.map(x=>({url:x.url,path:x.path,size:x.size,sha256:x.sha256}))}));'
out=run(['/usr/bin/node','--max-old-space-size=256','-e',code],'canonical-argv-registry',cpu=60);parsed=json.loads(out)
pins=json.loads(pathlib.Path('/tmp/gltron-original-main-render-runtime-oct30/pinned-input-closure.json').read_text());assert pin((REPO/'test/run.js').read_bytes())==pins['files']['test/run.js']
save('launch-configuration.json',dict(PASS=True,trustedSSH=SSH,canonicalParser='Exact pinned test/run.js parser; registry expands full original file paths without comma splitting',configuration=parsed,source=pins['files']['test/run.js']))
save('local-preflight.json',dict(PASS=True,parent=BASE,production='311c42abb41adc1fc16e06b4276005d15db553b2',dataManifest=pin((R/'runtime-data-manifest.json').read_bytes()),archive=manifest['archive'],members=len(ms),fontBytesMatchParent=True,tlbIdentityOnly=True,mountValidation=True,FSIZE=12*M,capture=524288,overflowRejected=True,expectedGitIndexBytes=(REPO/'.git/index').stat().st_size if (REPO/'.git/index').exists() else 0,indexFreePlumbing=True))
print(json.dumps(admission('pre-provision-complete-forecast')))
