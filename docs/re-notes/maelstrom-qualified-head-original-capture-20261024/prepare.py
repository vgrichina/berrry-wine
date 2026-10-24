import pathlib,subprocess,json,os,hashlib,shutil,re,time,resource,shlex
H=pathlib.Path('/tmp/maelstrom-qualified-head-original-capture-oct24'); O=H/'ops'; R=H/'repo'
D=pathlib.Path('/tmp/maelstrom-native-recovered-closeout-oct24/repo'); C=pathlib.Path('/home/user/.codex')
sha=lambda b:hashlib.sha256(b).hexdigest()
def save(n,j): (O/n).write_text(json.dumps(j,indent=2)+'\n')
def size(p):return sum(max(f.stat().st_size,f.stat().st_blocks*512) for f in p.rglob('*') if f.is_file()) if p.exists() else 0
ssh='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
env=dict(os.environ,GIT_SSH_COMMAND=ssh)
head='4ba28bf1d8b0644f237e8a4f29f54241446b1bcd'
assert subprocess.check_output(['git','-C',str(D),'rev-parse','HEAD'],text=True).strip()==head
p=subprocess.run(['git','ls-remote','git@github.com:vgrichina/wine-assembly.git','refs/heads/main'],env=env,capture_output=True,text=True,timeout=30)
save('trusted-remote.json',dict(ssh=ssh,returncode=p.returncode,stdout=p.stdout,stderr=p.stderr));assert p.returncode==0 and p.stdout.split()[0]==head
old=pathlib.Path('/tmp/maelstrom-single-return-sync-capture-oct24')
for name,want in [('setup.py','1e2acd2f700df12c10527c9e95ed6dfeb32cffd902d15d0fc4ef68894e69cfdf'),('supervise.py','37c33ade9b889f4116009efa18228eb10524c70053dabca1d305b557b4d312ef')]:assert sha((old/name).read_bytes())==want
mp=pathlib.Path('/tmp/maelstrom-native-errno-capture-oct24/manifest.json');assert sha(mp.read_bytes())=='86111762b21d2c589925d13686bb2285bed23c89cce5243d1c27c407beb244fe'
m=json.loads(mp.read_text()); assert len(m)==247
src=pathlib.Path('/tmp/maelstrom-select-return-capture-oct24/work.py').read_text().replace("BOX='bx_ktknkc9m'","BOX='bx_qp99542b'")
# Reuse the accepted transport/payload primitives, with one task-owned ledger.
src=src[:src.index('def account(')].replace('H=pathlib.Path(__file__).parent','H=pathlib.Path(__file__).parent.parent')
(O/'transport.py').write_text(src)
from transport import remote,payload
j=remote("python3 -c 'import os,json,pathlib,shutil;print(json.dumps(dict(uid=os.getuid(),free=shutil.disk_usage(\"/tmp\").free,memAvailable=int(pathlib.Path(\"/proc/meminfo\").read_text().split(\"MemAvailable:\")[1].split()[0])*1024)))'")
save('remote-admission.json',j); rr=json.loads(j['stdout'])
session=next((C/'sessions/2026/10/24').glob('*'+os.environ['CODEX_SESSION_ID']+'*')); launcher=pathlib.Path('/home/user/wine-assembly/scratch/usage-watch/maelstrom-qualified-head-original-capture-oct24')
sql={str(p):max(p.stat().st_size,p.stat().st_blocks*512) for p in C.glob('*.sqlite*') if p.is_file()};save('sqlite-baseline.json',sql)
charges=dict(remoteClosure=sum(x['bytes'] for x in m),remoteExtra=1800000,localCheckoutGit=3500000,localHelpersEvidence=3000000,transferOverlap=1000000,sessionFull=session.stat().st_size,launcherFull=size(launcher),sqlitePositive=0,futureSQLite=4194304,externalFuture=12000000,publicationFuture=2000000,reserve=8388608)
peak=sum(charges.values());free=shutil.disk_usage(H).free;mem=int(re.search(r'MemAvailable:\s+(\d+)',pathlib.Path('/proc/meminfo').read_text())[1])*1024
a=dict(at=time.time(),charges=charges,peak=peak,cap=67108864,free=free,after=free-peak,remoteFree=rr['free'],remoteAfter=rr['free']-peak,session=str(session),launcher=str(launcher),memAvailable=mem,remoteMemAvailable=rr['memAvailable'],perFileMax=max(x['bytes'] for x in m),standingManifest=str(mp),standingReadOnlyBytes=sum(x['bytes'] for x in m),historicalAccounting='Prior task receipts/deficiencies unchanged; this task charges its full external session and launcher plus positive SQLite growth from this baseline.',instructionReadLimit=65536,codeReadLimit=8192,internalCaptureExtra=2097152)
a['pass']=peak<=67108864 and min(free,rr['free'])-peak>=2982150144 and mem>=805306368 and rr['memAvailable']>=2684354560 and rr['uid']==1000
save('admission.json',a); assert a['pass'],a
args=[x.replace(str(old),str(H)) for x in json.loads((old/'guest-args.json').read_text())]
args=[x for x in args if not x.startswith(('--require=','--count=','--trace-at=','--trace-at-limit=','--trace-at-mem='))]
args[2]=str(H/'runner/test/run-head-observed.js')
args += ['--count=7a3362,7a3366','--trace-at=7a3362','--trace-at-limit=1']
args=[x if not x.startswith('--input=') else '--input='+','.join(v for v in x[8:].split(',') if ':png:' not in v) for x in args]
(H/'guest-args.json').write_text(json.dumps(args,indent=2)+'\n')
runner=pathlib.Path('/tmp/maelstrom-head-yield-observer-oct24/ops/run.js').read_text();assert sha(runner.encode())=='4d7b9587676db38fcf3314807acb2b2a42b5f09d2c98fcf3dccb8a6cde9e1809'
parser=runner[runner.index('const getArg ='):runner.index('// Was `--name=...`')]
code='const fs=require("fs"),assert=require("assert");const args=JSON.parse(fs.readFileSync(process.argv[1])).slice(3);'+parser+';assert.deepEqual(getArgs("vfs-tree"),[process.argv[2]+"/vfs"]);assert.equal(getArgs("vfs-mount").length,0);assert.equal(getArg("trace-at"),"7a3362");assert.equal(getArg("count"),"7a3362,7a3366");assert.equal(+getArg("trace-at-limit"),1);console.log(JSON.stringify({pass:true,tree:getArgs("vfs-tree"),input:getArg("input")}));'
def limits():resource.setrlimit(resource.RLIMIT_CPU,(60,60))
p=subprocess.run(['node','--max-old-space-size=256','-e',code,str(H/'guest-args.json'),str(H)],capture_output=True,text=True,timeout=60,preexec_fn=limits)
save('precheckout-parser.json',dict(returncode=p.returncode,stdout=p.stdout,stderr=p.stderr));assert p.returncode==0,p.stderr
originals=[x for x in m if x['target'].startswith('vfs/')];assert len(originals)==48 and sum(x['bytes'] for x in originals)==2794170
for x in m:
 b=payload(x);assert len(b)==x['bytes'] and sha(b)==x['sha256'],x['target']
save('materialized-source-controls.json',dict(passIdentity=True,files=len(m),bytes=sum(x['bytes'] for x in m),maxFile=max(x['bytes'] for x in m)))
save('intended-originals.json',originals);(H/'manifest.json').write_bytes(mp.read_bytes())
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
(R/'.git/info/sparse-checkout').write_text('/CLAUDE.md\n/AGENTS.md\n/.gitignore\n/tools/maelstrom-head-yield-observer.cjs\n/docs/re-notes/maelstrom-qualified-head-original-capture-20261024*\n')
subprocess.run(['git','-C',str(R),'checkout','-q','-b','task/maelstrom-qualified-head-original-capture-oct24',head],check=True)
subprocess.run(['git','-C',str(R),'remote','add','origin','git@github.com:vgrichina/wine-assembly.git'],check=True)
assert sha((R/'tools/maelstrom-head-yield-observer.cjs').read_bytes())=='fcb1ecac66d1e868ff47f7b9e57c93654bdf82b27663f54182132f668ccce931'
save('setup-complete.json',dict(passSetup=True,guestExecuted=False,peak=peak));print(json.dumps(dict(passSetup=True,peak=peak)))
