from work import *
assert json.load(open(H/'ops/initial-admission.json'))['passAdmission']
dispatch=json.load(open('/home/user/wine-assembly/scratch/usage-watch/enigma-separated-output-runtime-dispatch-oct24.json'))
for pin in dispatch['pins']:assert sha(pathlib.Path(pin['path']).read_bytes())==pin['sha256'],pin
old=pathlib.Path('/tmp/enigma-accepted-lossless-startup-oct24')
args=[x.replace(str(P),R) for x in json.load(open(old/'guest-args.json'))]
assert sum(':png:' in x for x in args)==1
args.append('--quiet-fs');save('guest-args.json',args)
m=json.load(open(P/'manifest.json'));runner=payload(m[0]).decode()
parser=runner[runner.index('const getArg ='):runner.index('// Was `--name=...`')]
code='const assert=require("assert"),args='+json.dumps(args[7:])+';'+parser+';assert.deepEqual(getArgs("vfs-tree"),['+json.dumps(R+'/vfs')+']);assert.equal(getArgs("vfs-mount").length,0);assert.equal(getArgs("dlls").length,8);assert(hasFlag("no-build"));assert(hasFlag("quiet-fs"));console.log("PASS actual canonical parser")'
r=subprocess.run(['node','--max-old-space-size=256','-e',code],capture_output=True,text=True,timeout=60)
save('precheckout-parser.json',dict(status=r.returncode,stdout=r.stdout,stderr=r.stderr,argv=args,parserSHA256=sha(parser.encode()),enumeratedFiles=sum(x['target'].startswith('vfs/') for x in m),commaNames=[x['target'] for x in m if ',' in x['target']],fullEnumeration=str(P/'manifest.json')));assert r.returncode==0
r=subprocess.run(['git','ls-remote','git@github.com:vgrichina/wine-assembly.git','refs/heads/main'],env=dict(os.environ,GIT_SSH_COMMAND=SSH),capture_output=True,text=True,timeout=30)
save('trusted-donor.json',dict(ssh=SSH,status=r.returncode,stdout=r.stdout,stderr=r.stderr));assert r.returncode==0 and r.stdout.split()[0]==REV
save('remote-admission.json',py('import os,json,pathlib,shutil;print(json.dumps(dict(uid=os.getuid(),free=shutil.disk_usage("/tmp").free,memAvailable=int(pathlib.Path("/proc/meminfo").read_text().split("MemAvailable:")[1].split()[0])*1024)))'))
measure('precheckout')
repo=H/'repo';repo.mkdir()
def git(*args):
 r=subprocess.run(['git','-C',str(repo),*args],capture_output=True,text=True);assert r.returncode==0,r.stderr;return r.stdout
git('init');objects=[];seen=set()
def visit(p):
 p=p.resolve()
 if str(p) in seen:return
 seen.add(str(p));objects.append(str(p))
 a=p/'info/alternates'
 if a.exists():
  for line in a.read_text().splitlines():visit(pathlib.Path(line) if line.startswith('/') else p/line)
visit(D/'.git/objects')
(repo/'.git/objects/info/alternates').write_text('\n'.join(objects)+'\n')
git('config','core.sparseCheckout','true');git('config','core.sparseCheckoutCone','false')
paths=['tools/enigma-findfirst-compat.cjs','tools/enigma-terminal-capture-guard.cjs','tools/enigma-quiet-filesystem.cjs','tools/lossless-capture-png.cjs','tools/enigma-supervisor-output.py','lib/filesystem.js']
note='docs/re-notes/enigma-separated-output-authentic-startup-20261024'
(repo/'.git/info/sparse-checkout').write_text('\n'.join('/'+p for p in paths)+'\n/'+note+'.md\n/'+note+'/\n')
git('checkout','-b','task/enigma-separated-output-authentic-startup-oct24',REV)
git('config','user.name','Wine Ops');git('config','user.email','wine-ops@local');git('remote','add','origin','git@github.com:vgrichina/wine-assembly.git')
save('checkout.json',dict(revision=REV,paths=paths,flattenedAlternateCount=len(objects),pins={p:sha((repo/p).read_bytes()) for p in paths}))
for n in ['capture.cjs','supervise-original.py','validate-tree.cjs']:(H/n).write_bytes((old/n).read_bytes())
for n in ['preflight.py']:(H/n).write_bytes((pathlib.Path('/tmp/enigma-recovered-lossless-startup-oct24')/n).read_bytes())
for n in ['preflight.py','validate-tree.cjs']:(H/n).write_text((H/n).read_text().replace(str(P),R))
code='const fs=require("fs"),t=require('+json.dumps(str(repo/'tools/enigma-terminal-capture-guard.cjs'))+');fs.writeFileSync('+json.dumps(str(H/'supervise-transformed.py'))+',t.transformSupervisor(fs.readFileSync('+json.dumps(str(H/'supervise-original.py'))+',"utf8")));'
subprocess.run(['node','--max-old-space-size=256','-e',code],check=True,timeout=60)
s=(H/'supervise-transformed.py').read_text()
assert "1792835520,'latest start09:52UTC'" in s
s=s.replace("1792835520,'latest start09:52UTC'","1792854960,'latest start15:16UTC'").replace('bx_fvkjwxap',BOX).replace('shutdown09:57UTC','shutdown15:23UTC').replace('2026-10-24T10:02:44.741Z','2026-10-24T15:27:08.953Z')
(H/'supervise.py').write_text(s)
save('supervisor-identity.json',dict(original=sha((H/'supervise-original.py').read_bytes()),acceptedTransformed=sha((H/'supervise-transformed.py').read_bytes()),deployed=sha(s.encode()),configurationOnly=['deadline','box','lifecycle','expiry'],artifactLimit=2097152,retainedOutputLimit=131072,profile='single-frame'))
env={k:v.replace(str(P),R) for k,v in json.load(open(old/'next-env.json')).items()};env['ENIGMA_CAPTURE_PROFILE']='single-frame';save('next-env.json',env)
(H/'manifest.json').write_bytes((P/'manifest.json').read_bytes())
save('standing-inputs.json',dict(immutableDonor=str(D),revision=REV,manifest=str(P/'manifest.json'),standingBytes=sum(x['bytes'] for x in m),files=len(m),copiedLocalAssetBytes=0,executables=['/usr/bin/node','/usr/bin/python3',B],allManifestSourcesReadOnly=True,acceptedSuitesReused=6))
measure('prepared');print('PREPARED sparse checkout canonical parser exactpins PASS')
