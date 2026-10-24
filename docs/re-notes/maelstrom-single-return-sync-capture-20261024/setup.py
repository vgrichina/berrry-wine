import pathlib,subprocess,json,os,shutil,hashlib,time,re,resource
H=pathlib.Path(__file__).parent; OLD=pathlib.Path('/tmp/maelstrom-select-return-capture-oct24'); D=pathlib.Path('/tmp/maelstrom-startup-divergence-cause-oct24/repo'); R=H/'repo'; C=pathlib.Path('/home/user/.codex')
sha=lambda b:hashlib.sha256(b).hexdigest()
def save(n,j): (H/n).write_text(json.dumps(j,indent=2)+'\n')
ssh='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
env=dict(os.environ,GIT_SSH_COMMAND=ssh)
head='9ffbb83a66eec3fe0548535889e1a4c0221ccb56'
assert subprocess.check_output(['git','-C',str(D),'rev-parse','HEAD'],text=True).strip()==head
r=subprocess.run(['git','ls-remote','git@github.com:vgrichina/wine-assembly.git','refs/heads/task/maelstrom-startup-divergence-cause-oct24'],env=env,capture_output=True,text=True,timeout=30)
save('donor-verification.json',dict(head=head,ssh=ssh,returncode=r.returncode,stdout=r.stdout,stderr=r.stderr));assert r.returncode==0 and r.stdout.split()[0]==head
# Reuse historical transfer and accounting primitives, changing only allocation identity.
s=(OLD/'work.py').read_text().replace('bx_ktknkc9m','bx_rfd49qx6');(H/'work.py').write_text(s)
from work import remote,payload
j=remote("python3 -c 'import os,json,pathlib,shutil;print(json.dumps(dict(uid=os.getuid(),free=shutil.disk_usage(\"/tmp\").free,memAvailable=int(pathlib.Path(\"/proc/meminfo\").read_text().split(\"MemAvailable:\")[1].split()[0])*1024)))'")
save('remote-admission.json',j);rr=json.loads(j['stdout'])
session=next((C/'sessions/2026/10/24').glob('*'+os.environ['CODEX_SESSION_ID']+'*'));launcher=pathlib.Path('/home/user/wine-assembly/scratch/usage-watch/maelstrom-single-return-sync-capture-oct24')
sql={str(p):max(p.stat().st_size,p.stat().st_blocks*512) for p in C.glob('*.sqlite*') if p.is_file()};save('sqlite-baseline.json',sql)
m=json.load(open(OLD/'manifest.json'));save('manifest.json',m)
def size(p):return sum(max(f.stat().st_size,f.stat().st_blocks*512) for f in p.rglob('*') if f.is_file()) if p.exists() else 0
charges=dict(remoteClosure=sum(x['bytes'] for x in m),remoteHelpersEvidence=1500000,checkoutGit=3500000,localHelpersEvidence=2500000,transferOverlap=1000000,sessionFull=session.stat().st_size,launcherFull=size(launcher),sqlitePositive=0,externalFuture=16000000,reserve=8388608)
peak=sum(charges.values());free=shutil.disk_usage(H).free;mem=int(re.search(r'MemAvailable:\s+(\d+)',pathlib.Path('/proc/meminfo').read_text())[1])*1024
a=dict(charges=charges,peak=peak,cap=67108864,free=free,after=free-peak,remoteFree=rr['free'],remoteAfter=rr['free']-peak,session=str(session),launcher=str(launcher),sourceMemAvailable=mem,perFileMax=max(x['bytes'] for x in m),standingManifest=str(OLD/'manifest.json'),standingTools=[],capturePriorCharged=100000,instructionBytes=0,codeSliceCap=8192)
for name in ['git','python3','node','boat']:
 p=pathlib.Path(shutil.which(name)).resolve();a['standingTools'].append(dict(path=str(p),bytes=p.stat().st_size,sha256=sha(p.read_bytes())))
a['passAdmission']=peak<=67108864 and min(free,rr['free'])-peak>=2982150144 and mem>=805306368 and rr['memAvailable']>=2684354560 and rr['uid']==1000
save('admission.json',a);assert a['passAdmission'],a
recipe=json.load(open(D/'docs/re-notes/maelstrom-startup-divergence-cause-20261024/single-return-argv.json'));recipe['harnessSHA256']='4d7b9587676db38fcf3314807acb2b2a42b5f09d2c98fcf3dccb8a6cde9e1809'
args=[x.replace('/tmp/maelstrom-sync-packet-return-capture-oct24',str(H)) for x in recipe['argv']];save('guest-args.json',args)
# Validate actual relocated argv and all original identities before checkout.
src=pathlib.Path('/tmp/maelstrom-poststart-state-cause-oct24/canonical-run.js').read_text();assert sha(src.encode())==recipe['harnessSHA256']
parser=src[src.index('const getArg ='):src.index('// Was `--name=...`')]
code='const fs=require("fs"),assert=require("assert");const args=JSON.parse(fs.readFileSync(process.argv[1])).slice(4);'+parser+';assert.equal(getArgs("vfs-tree").length,1);assert.equal(getArgs("vfs-mount").length,0);assert.equal(getArg("vfs-tree"),process.argv[2]+"/vfs");assert.equal(+getArg("trace-at-limit"),16);assert.equal(+getArg("trace-at-start-batch"),36163);console.log(JSON.stringify({pass:true,tree:getArgs("vfs-tree"),memory:getArg("trace-at-mem")}));'
def limits():resource.setrlimit(resource.RLIMIT_CPU,(60,60))
r=subprocess.run(['node','--max-old-space-size=256','-e',code,str(H/'guest-args.json'),str(H)],capture_output=True,text=True,timeout=60,preexec_fn=limits);save('precheckout-parser.json',dict(returncode=r.returncode,stdout=r.stdout,stderr=r.stderr));assert r.returncode==0,r.stderr
originals=[x for x in m if x['target'].startswith('vfs/')];assert len(originals)==48 and sum(x['bytes'] for x in originals)==2794170
for x in originals:
 b=payload(x);assert len(b)==x['bytes'] and sha(b)==x['sha256']
assert any(',' in x['target'] for x in originals);save('intended-originals.json',originals)
# Exact donor, explicit NONCONE sparse paths, flattened read-only alternates.
R.mkdir();subprocess.run(['git','init','-q',str(R)],check=True)
seen=set();ordered=[]
def visit(p):
 p=pathlib.Path(p).resolve()
 if str(p) in seen:return
 seen.add(str(p));ordered.append(str(p));ap=p/'info/alternates'
 if ap.exists():
  for line in ap.read_text().splitlines():visit(p/line if not line.startswith('/') else line)
visit(D/'.git/objects');(R/'.git/objects/info/alternates').write_text('\n'.join(ordered)+'\n')
subprocess.run(['git','-C',str(R),'config','core.sparseCheckout','true'],check=True);subprocess.run(['git','-C',str(R),'config','core.sparseCheckoutCone','false'],check=True)
(R/'.git/info/sparse-checkout').write_text('/CLAUDE.md\n/AGENTS.md\n/.gitignore\n/docs/re-notes/maelstrom-startup-divergence-cause-20261024*\n/tools/maelstrom-startup-divergence.py\n')
subprocess.run(['git','-C',str(R),'checkout','-q','-b','task/maelstrom-single-return-sync-capture-oct24',head],check=True)
subprocess.run(['git','-C',str(R),'remote','add','origin','git@github.com:vgrichina/wine-assembly.git'],check=True)
for n in ['stage.py','capture.cjs','preflight.py','validate-tree.cjs','supervise.py','collect.py','preload.cjs','observer.cjs','observer-test.cjs']:
 p=OLD/n
 if not p.exists() and n=='observer.cjs':p=OLD/'repo/tools/maelstrom-select-observer.cjs'
 s=p.read_text().replace(str(OLD),str(H)).replace('bx_ktknkc9m','bx_rfd49qx6')
 if n=='supervise.py':
  s=s.replace('1792831320',str(1792835520)).replace('latest start08:42UTC','latest start09:52UTC').replace('shutdown08:47UTC','shutdown09:57UTC').replace('2026-10-24T08:53:24.080Z','2026-10-24T10:02:43.642Z')
 (H/n).write_text(s)
save('setup-complete.json',dict(admission=True,precheckoutParser=True,originals48=True,head=head,guestExecuted=False))
print(json.dumps(dict(peak=peak,remoteMem=rr['memAvailable'],passAdmission=True,setup=True)))
