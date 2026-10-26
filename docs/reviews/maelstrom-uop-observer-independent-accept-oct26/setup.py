import os,json,pathlib,shutil,subprocess,hashlib,time
H=pathlib.Path(__file__).resolve().parent.parent; O=H/'ops'; R=H/'repo'
D=pathlib.Path('/tmp/maelstrom-uop-owned-native-observer-repair-oct26'); C='145e66c80606c1ab4f854cef0cfcff2f5d6364ac'
def save(n,v):(O/n).write_text(json.dumps(v,indent=2)+'\n')
sha=lambda b:hashlib.sha256(b).hexdigest()
dispatch=json.loads(pathlib.Path('/home/user/wine-assembly/scratch/usage-watch/maelstrom-uop-observer-independent-accept-oct26-dispatch.json').read_text())
for p,pin in dispatch['pins'].items():
 b=(D/'repo'/p).read_bytes();assert len(b)==pin['bytes'] and sha(b)==pin['sha256']
save('pins.json',dispatch)
conf=json.loads((D/'ops/configuration.json').read_text())
p=pathlib.Path(conf['sourceOnlyMountReceipt']);assert sha(p.read_bytes())==conf['sourceOnlyMountReceiptSHA256'];assert json.loads(p.read_text())['actualArgv']==[]
save('configuration.json',conf)
files=[p for p in H.rglob('*') if p.is_file()]; launch=pathlib.Path('/home/user/wine-assembly/scratch/usage-watch')/H.name
mem=int(next(l.split()[1] for l in pathlib.Path('/proc/meminfo').read_text().splitlines() if l.startswith('MemAvailable:')))*1024
ps=subprocess.check_output(['ps','-eo','pid,rss,args'],text=True)
fleet=[l for l in ps.splitlines() if '/bin/codex exec --profile wine-worker' in l]
save('resource-initial.json',dict(projected=56*1048576,cap=64*1048576,reserve=8*1048576,free=shutil.disk_usage(H).free,memAvailable=mem,workerAllowance=536870912,floor=805306368,fleet=fleet,taskBytes=sum(p.stat().st_size for p in files),launchBytes=sum(p.stat().st_size for p in launch.rglob('*') if p.is_file())))
assert shutil.disk_usage(H).free-56*1048576>=2982150144 and mem-536870912>=805306368
subprocess.run(['git','init','-q',str(R)],check=True)
# Copy only this donor's tiny loose-object layer; no linked materialized bytes.
for p in (D/'repo/.git/objects').glob('[0-9a-f][0-9a-f]/*'):
 q=R/'.git/objects'/p.parent.name/p.name;q.parent.mkdir(exist_ok=True);shutil.copyfile(p,q)
checkout=json.loads((D/'ops/checkout.json').read_text());(R/'.git/objects/info/alternates').write_text('\n'.join(checkout['flatAlternates'])+'\n')
def git(*args):return subprocess.check_output(['git','-C',str(R),*args],stderr=subprocess.PIPE).decode().strip()
git('config','user.name','Wine independent reviewer');git('config','user.email','wine-review@localhost');git('config','core.sparseCheckout','true')
selected=[p for p in checkout['selected'] if p.startswith(('tools/','test/'))]+list(dispatch['pins'])
selected=sorted(set(selected));(R/'.git/info/sparse-checkout').write_text('\n'.join('/'+p for p in selected)+'\n')
git('checkout','-q','-b','task/maelstrom-uop-observer-independent-accept-oct26',C)
git('remote','add','origin','git@github.com:vgrichina/wine-assembly.git')
save('checkout.json',dict(candidate=C,selected=selected,flatAlternates=checkout['flatAlternates'],looseCopied=True,head=git('rev-parse','HEAD')))
sourcepins=json.loads((D/'ops/fixture-inputs.json').read_text())
for row in sourcepins:
 b=pathlib.Path(row['standing']).read_bytes();assert len(b)==row['bytes'] and sha(b)==row['sha256']
save('standing-source.json',sourcepins)
save('standing-tools.json',json.loads((D/'ops/standing-inputs.json').read_text())[:6])
shutil.copyfile(D/'ops/baseline-latch.cjs',O/'baseline-latch.cjs');assert sha((O/'baseline-latch.cjs').read_bytes())=='24b0e65c902cad56974a12da48251b77b3eebb018c4bd5825d7e2f5050b06095'
save('sqlite-baseline.json',{str(p):p.stat().st_size for p in pathlib.Path('/home/user/.codex').glob('*.sqlite*') if p.is_file()})
save('setup.json',dict(pass_=True,compiler=dict(path=sourcepins[-1]['standing'],sha256=sourcepins[-1]['sha256'],gitBlob=git('rev-parse',C+':src/07e-uop-compiler.wat')),rootReceipt='/home/user/wine-assembly/scratch/usage-watch/'+H.name+'/root-ref-digest.json'))
print(json.dumps(dict(head=git('rev-parse','HEAD'),selected=len(selected),taskBytes=sum(p.stat().st_size for p in H.rglob('*') if p.is_file()))))
