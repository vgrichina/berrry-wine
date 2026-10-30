from control import *
import tarfile,re
admission('initial-complete-forecast')
assert git(['rev-parse','HEAD'],'parent').decode().strip()==BASE
assert git(['symbolic-ref','HEAD'],'task-branch').decode().strip()=='refs/heads/task/'+R.name
assert git(['remote','get-url','origin'],'origin').decode().strip()=='git@github.com:vgrichina/wine-assembly.git'
assert git(['ls-remote','origin','refs/heads/main'],'remote-main').decode().strip()==BASE+'\trefs/heads/main'
p=json.loads((R/'pinned-input-closure.json').read_text());assert p['candidate']==BASE and p['PASS']
assert pin((R/'pinned-source-closure.tar.xz').read_bytes())=={k:p['sourceArchive'][k] for k in ['bytes','sha256']}
with tarfile.open(R/'pinned-source-closure.tar.xz') as t:
 members=t.getmembers();assert all(m.isfile() for m in members);assert set(m.name for m in members)==set(p['files'])
 sources={m.name:t.extractfile(m).read() for m in members}
 for n,b in sources.items():assert pin(b)==p['files'][n],n
 seen=set()
 def walk(n):
  if n in seen:return
  seen.add(n)
  for rel in re.findall(r'\(include\s+"([^"]+)"\)',sources[n].decode()):walk(str(pathlib.PurePosixPath(n).parent/rel))
 walk('src/main.watx');assert len(seen)==p['canonicalWATFiles']
 for n in ['test/run.js','lib/apps.js','tools/stage-gltron-original.js','tools/build-compile-wat.js']:assert (REPO/n).read_bytes()==sources[n]
 del sources
run(['/usr/bin/node','--max-old-space-size=512','-e','console.log(JSON.stringify({node:process.version,execPath:process.execPath,execArgv:process.execArgv,limits:require("fs").readFileSync("/proc/self/limits","utf8")}))'],'local-node-startup',cpu=120)
try:run(['/usr/bin/python3','-B','-c','import pathlib; p=pathlib.Path("../disposable-file");p.write_bytes(b"a"*600000);assert p.stat().st_size==600000;p.unlink();print("ok")'],'generated-vs-capture',limit=524288)
except:raise
try:run(['/usr/bin/python3','-B','-c','import os;os.write(1,b"x"*2048)'],'overflow-control',limit=1024)
except RuntimeError:assert json.loads((E/'overflow-control.json').read_text())['violation']=='capture overflow'
else:raise AssertionError('overflow accepted')
code='''const fs=require('fs'),vm=require('vm'),assert=require('assert');const s=fs.readFileSync('test/run.js','utf8');const args=['--app=gltron','--no-build','--gl-renderer=software','--wasm=build/wine-assembly.wasm','--max-seconds=45','--max-batches=100000','--batch-size=10000','--png=capture/original.png'];const parser=s.slice(s.indexOf('const getArg ='),s.indexOf('// WINE_ASSEMBLY_WASM='));const ctx={args};vm.createContext(ctx);vm.runInContext(parser+';globalThis.parsed={app:getArg("app"),mounts:getArgs("vfs-mount"),trees:getArgs("vfs-tree"),wasm:getArg("wasm")}',ctx);assert.equal(ctx.parsed.app,'gltron');assert.equal(ctx.parsed.mounts.length,0);assert.equal(ctx.parsed.trees.length,0);const app=require('./lib/apps').APPS.gltron;assert.equal(app.files.length,92);assert.equal(app.exe,'binaries/gltron-0.70/gltron.exe');console.log(JSON.stringify({args,parsed:ctx.parsed,exe:app.exe,exeGuestPath:app.exeGuestPath,cwd:app.cwd,files:app.files.map(x=>({url:x.url,path:x.path,size:x.size,sha256:x.sha256}))}));'''
out=run(['/usr/bin/node','--max-old-space-size=512','-e',code],'canonical-argv-registry',cpu=120);parsed=json.loads(out);save('launch-configuration.json',dict(PASS=True,trustedSSH=SSH,canonicalParser='exact test/run.js getArg/getArgs/hasFlag; registry mount with no comma-delimited flags',configuration=parsed,source=p['files']['test/run.js']))
run(['/usr/bin/node','--max-old-space-size=512','tools/stage-gltron-original.js','/home/user/wine-assembly/scratch/usage-watch/gltron-original-win32-recovery-oct28/payload/extracted/app',str(REPO/'binaries/gltron-0.70')],'stage-original',cpu=120)
with tarfile.open(R/'original-media.tar.xz','w:xz') as t:
 for f in parsed['files']:t.add(REPO/f['url'],arcname=f['url'],recursive=False)
save('local-preflight.json',dict(PASS=True,manifest=pin((R/'pinned-input-closure.json').read_bytes()),sourceArchive=pin((R/'pinned-source-closure.tar.xz').read_bytes()),mediaArchive=pin((R/'original-media.tar.xz').read_bytes()),canonicalWATFiles=len(seen),archiveMembers=len(members),generatedFSIZE=12*M,captureCeiling=524288,overflowRejected=True,mountValidation=True))
print(json.dumps(admission('pre-provision-complete-forecast')))
