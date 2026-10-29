from supervisor import *
import shutil
controls()
save('launch-config.json',dict(ssh=ENV['GIT_SSH_COMMAND'],mountArgv=[],intendedMountedFiles=[],runtime=False,rootRefs=str(BASE/D['task']/'root-ref-digest.json')))
# Empty mount vector: evaluate the exact canonical parser body, without loading
# or executing the runner. No guest, browser, build, or mounts are involved.
node=shutil.which('node');flags=['--max-old-space-size=64']
out=run([node,*flags,'-e',"const r=require('node:process');console.log(JSON.stringify({version:r.version,execPath:r.execPath,flags:r.execArgv,limits:require('node:fs').readFileSync('/proc/self/limits','utf8')}));"],cwd=ROOT)
save('node-startup.json',dict(executable=node,flags=flags,result=json.loads(out),environment='supervisor.ENV; same for parser, no DATA cap applied to Node'))
parser="const fs=require('fs'),vm=require('vm'),crypto=require('crypto');const s=fs.readFileSync('/home/user/wine-assembly/test/run.js','utf8');const a=s.indexOf('const getArgs = name => {'),b=s.indexOf('const hasFlag',a);if(a<0||b<0)throw Error('parser missing');const body=s.slice(a,b);const x=vm.runInNewContext(body+'; [getArgs(\"vfs-mount\"),getArgs(\"vfs-tree\"),getArgs(\"vfs-include\")]',{args:[]});if(JSON.stringify(x)!=='[[],[],[]]')throw Error('mounts');console.log(JSON.stringify({mountArgv:[],intendedFiles:[],parsed:x,parserSHA256:crypto.createHash('sha256').update(body).digest('hex')}));"
save('mount-parser.json',json.loads(run([node,*flags,'-e',parser],cwd=ROOT)))
git(['init'],initial=True)
git(['config','user.name','Wine Ops Worker'],mutate=True)
git(['config','user.email','wine-ops@localhost'],mutate=True)
git(['config','core.sparseCheckout','true'],mutate=True)
git(['config','core.sparseCheckoutCone','false'],mutate=True)
admission('write own sparse patterns')
(REPO/'.git/info/sparse-checkout').write_text('/'+D['sourceRepoPath']+'\n')
git(['checkout','-b','task/'+D['task'],D['main']],mutate=True)
git(['remote','add','origin','git@github.com:vgrichina/wine-assembly.git'],mutate=True)
src=REPO/D['sourceRepoPath'];assert src.stat().st_size==D['source']['bytes'];assert hashlib.sha256(src.read_bytes()).hexdigest()==D['source']['sha256']
pins={}
admission('verify pinned media, copy owned payload; peak media under12MiB')
payload=ROOT/'payload';payload.mkdir()
for n,v in D['media'].items():
 p=pathlib.Path(v['path']);data=p.read_bytes();assert len(data)==v['bytes'] and hashlib.sha256(data).hexdigest()==v['sha256'];shutil.copyfile(p,payload/n);pins[n]=v
inventory=json.loads((payload/'inventory.json').read_text())
for row in inventory['files']:
 p=pathlib.Path(D['payload'])/'extracted'/row['path'];assert p.is_file() and not p.is_symlink()
 q=payload/'extracted'/row['path'];q.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(p,q)
 assert q.stat().st_size==row['bytes'] and hashlib.sha256(q.read_bytes()).hexdigest()==row['sha256']
for n in ['inventory.json','closure.json']:shutil.copyfile(payload/n,E/('expected-'+n))
save('input-pins.json',dict(main=D['main'],source=D['source'],media=pins,inventoryReusedFrom=D['media']['inventory.json'],copiedFiles=inventory['count'],copiedExtractedBytes=inventory['bytes'],copiedPayloadPhysical=physical(payload),objdump={'path':'/usr/bin/objdump','resolved':str(pathlib.Path('/usr/bin/objdump').resolve()),'sha256':hashlib.sha256(pathlib.Path('/usr/bin/objdump').read_bytes()).hexdigest()}))
print('PASS setup: pinned production and 92 original payload files copied; no extraction or execution')
