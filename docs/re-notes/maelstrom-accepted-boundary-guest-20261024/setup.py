import pathlib,subprocess,json,os,shutil,hashlib,time,re,resource
H=pathlib.Path(__file__).parent; OLD=pathlib.Path('/tmp/maelstrom-single-return-sync-capture-oct24'); N=pathlib.Path('/tmp/maelstrom-native-errno-capture-oct24'); D=pathlib.Path('/tmp/enigma-supervisor-independent-integrate-oct24/repo'); R=H/'repo'; C=pathlib.Path('/home/user/.codex')
sha=lambda b:hashlib.sha256(b).hexdigest()
def save(n,j): (H/n).write_text(json.dumps(j,indent=2)+'\n')
ssh='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
env=dict(os.environ,GIT_SSH_COMMAND=ssh);head='35a4a4e59fb2c76f9590b456ef7873e14271862a'
assert subprocess.check_output(['git','-C',str(D),'rev-parse','HEAD'],text=True).strip()==head
save('trusted-config.json',dict(ssh=ssh,head=head,coordinatorReceipt='/home/user/wine-assembly/scratch/usage-watch/runtime-accepted-inputs-20261024T1209Z.json'))
s=(pathlib.Path('/tmp/maelstrom-select-return-capture-oct24/work.py')).read_text().replace('bx_ktknkc9m','bx_qsz5ra8d');(H/'work.py').write_text(s)
from work import remote,payload
j=remote("python3 -c 'import os,json,pathlib,shutil;print(json.dumps(dict(uid=os.getuid(),free=shutil.disk_usage(\"/tmp\").free,memAvailable=int(pathlib.Path(\"/proc/meminfo\").read_text().split(\"MemAvailable:\")[1].split()[0])*1024)))'")
save('remote-admission.json',j);rr=json.loads(j['stdout'])
a=json.load(open(H/'measurement.json'));save('sqlite-baseline.json',a['sqliteBaseline'])
m=json.load(open(N/'manifest.json'));assert sha((N/'manifest.json').read_bytes())=='86111762b21d2c589925d13686bb2285bed23c89cce5243d1c27c407beb244fe';save('manifest.json',m)
charges=dict(remoteClosureAllocated=a['remoteClosureAllocated'],remoteHelpersEvidence=1800000,checkoutGit=2500000,localHelpersEvidence=2500000,transferOverlap=300000,sessionFull=a['sessionBytes'],launcherFull=a['launcherBytes'],sqlitePositiveAndFuture=3000000,externalFuture=16000000,reserve=8388608)
peak=sum(charges.values());free=shutil.disk_usage(H).free;mem=int(re.search(r'MemAvailable:\s+(\d+)',pathlib.Path('/proc/meminfo').read_text())[1])*1024
a.update(charges=charges,peak=peak,cap=67108864,free=free,after=free-peak,remoteFree=rr['free'],remoteAfter=rr['free']-peak,sourceMemAvailable=mem,perFileMax=max(x['bytes'] for x in m),standingManifest=str(N/'manifest.json'),standingTools=[],capturePriorCharged=744811,captureExtraCap=2097152,instructionReadCap=65536,codeSliceCap=8192)
for name in ['git','python3','node']:
 p=pathlib.Path(shutil.which(name)).resolve();a['standingTools'].append(dict(path=str(p),bytes=p.stat().st_size,sha256=sha(p.read_bytes())))
p=pathlib.Path('/home/user/.ascii/boat').resolve();a['standingTools'].append(dict(path=str(p),bytes=p.stat().st_size,sha256=sha(p.read_bytes())))
a['passAdmission']=peak<=67108864 and min(free,rr['free'])-peak>=2982150144 and mem>=805306368 and rr['memAvailable']>=2684354560 and rr['uid']==1000
save('admission.json',a);assert a['passAdmission'],a
args=[x.replace(str(N),str(H)) for x in json.load(open(N/'guest-args.json'))];args[2]='--require='+str(H/'capture.cjs');args[3]=str(H/'runner/test/run-boundary.js');save('guest-args.json',args)
src=pathlib.Path('/tmp/maelstrom-poststart-state-cause-oct24/canonical-run.js').read_text();assert sha(src.encode())=='4d7b9587676db38fcf3314807acb2b2a42b5f09d2c98fcf3dccb8a6cde9e1809'
parser=src[src.index('const getArg ='):src.index('// Was `--name=...`')]
code='const fs=require("fs"),assert=require("assert");const args=JSON.parse(fs.readFileSync(process.argv[1])).slice(4);'+parser+';assert.equal(getArgs("vfs-tree").length,1);assert.equal(getArgs("vfs-mount").length,0);assert.equal(getArg("vfs-tree"),process.argv[2]+"/vfs");assert.equal(getArg("trace-at"),"0x7a3366");assert.equal(+getArg("trace-at-limit"),1);assert.equal(+getArg("trace-at-start-batch"),36163);assert.equal(getArg("trace-at-mem"),"eax:4,esp+0x124:12");assert(!args.some(x=>x.startsWith("--watch")));console.log(JSON.stringify({pass:true,tree:getArgs("vfs-tree"),memory:getArg("trace-at-mem")}));'
def limits():resource.setrlimit(resource.RLIMIT_CPU,(60,60))
r=subprocess.run(['node','--max-old-space-size=256','-e',code,str(H/'guest-args.json'),str(H)],capture_output=True,text=True,timeout=60,preexec_fn=limits);save('precheckout-parser.json',dict(returncode=r.returncode,stdout=r.stdout,stderr=r.stderr));assert r.returncode==0,r.stderr
originals=[x for x in m if x['target'].startswith('vfs/')];assert len(originals)==48 and sum(x['bytes'] for x in originals)==2794170
assert any(',' in x['target'] for x in originals);save('intended-originals.json',originals)
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
(R/'.git/info/sparse-checkout').write_text('/CLAUDE.md\n/AGENTS.md\n/.gitignore\n/tools/maelstrom-breakpoint-boundary-audit.cjs\n/docs/re-notes/maelstrom-early-watch-independent-20261024.md\n')
subprocess.run(['git','-C',str(R),'checkout','-q','-b','task/maelstrom-accepted-boundary-guest-oct24',head],check=True)
subprocess.run(['git','-C',str(R),'remote','add','origin','git@github.com:vgrichina/wine-assembly.git'],check=True)
for n in ['stage.py','capture.cjs','preflight.py','validate-tree.cjs','supervise.py','collect.py']:
 s=(OLD/n).read_text().replace(str(OLD),str(H)).replace('bx_rfd49qx6','bx_qsz5ra8d')
 if n=='supervise.py':
  import datetime
  latest=int(datetime.datetime(2026,10,24,12,28,tzinfo=datetime.timezone.utc).timestamp())
  s=s.replace('1792835520',str(latest)).replace('latest start09:52UTC','latest start12:28UTC').replace('shutdown09:57UTC','shutdown12:33UTC').replace('2026-10-24T10:02:43.642Z','2026-10-24T12:38:44Z')
 (H/n).write_text(s)
save('setup-complete.json',dict(admission=True,precheckoutParser=True,originals48=True,head=head,guestExecuted=False));print(json.dumps(dict(peak=peak,passAdmission=True)))
