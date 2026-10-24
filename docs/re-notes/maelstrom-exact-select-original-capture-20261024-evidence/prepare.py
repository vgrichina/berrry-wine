import pathlib,json,os,subprocess,hashlib,shutil,time,re,importlib.util,resource
H=pathlib.Path(__file__).resolve().parent.parent; O=H/'ops'; C=pathlib.Path('/home/user/.codex')
sha=lambda b:hashlib.sha256(b).hexdigest()
def save(n,j): (O/n).write_text(json.dumps(j,indent=2)+'\n')
def allocated(p):return max(p.stat().st_size,p.stat().st_blocks*512)
session=next((C/'sessions/2026/10/24').glob('*'+os.environ['CODEX_SESSION_ID']+'*'))
launcher=pathlib.Path('/home/user/wine-assembly/scratch/usage-watch/maelstrom-exact-select-original-capture-oct24')
baseline={str(p):allocated(p) for p in C.glob('*.sqlite') if p.is_file()};save('sqlite-baseline.json',baseline)
wal=[dict(path=str(p),bytes=p.stat().st_size,allocated=allocated(p)) for p in C.glob('*.sqlite-wal')]
charges=dict(owned=sum(allocated(p) for p in H.rglob('*') if p.is_file()),fullSession=allocated(session),fullLauncher=sum(allocated(p) for p in launcher.rglob('*') if p.is_file()),fullWAL=sum(x['allocated'] for x in wal),positiveSQLite=0,futureSparseGitEvidence=4*1024**2,futureExternal=8*1024**2,reserve=8*1024**2,remoteNew=0,transferOverlap=0)
free=shutil.disk_usage(H).free;mem=int(re.search(r'MemAvailable:\s+(\d+)',pathlib.Path('/proc/meminfo').read_text())[1])*1024
receipt=dict(at=time.time(),charges=charges,peak=sum(charges.values()),cap=64*1024**2,free=free,afterProjection=free-20*1024**2,memAvailable=mem,wal=wal,session=str(session),launcher=str(launcher),scope='Static blocker/preflight and publication only; zero staging or guest authorized after temporal gate fails',perFileLimit=24*1024**2,extraCaptureCap=2*1024**2,preAdmission='Instruction/source inspection and small ops creation only; no prior runtime admission claimed')
receipt['pass']=receipt['peak']<=receipt['cap'] and receipt['afterProjection']>=2982150144 and mem>=805306368
save('resource-precheckout.json',receipt);assert receipt['pass']
tools=[]
for n in ['node','python3','git','ssh']:
 p=pathlib.Path(shutil.which(n)).resolve();tools.append(dict(path=str(p),bytes=p.stat().st_size,sha256=sha(p.read_bytes()),newBytes=0))
save('standing-tools.json',tools)
runner=pathlib.Path('/tmp/maelstrom-head-yield-observer-oct24/ops/run.js');source=runner.read_text();assert sha(source.encode())=='4d7b9587676db38fcf3314807acb2b2a42b5f09d2c98fcf3dccb8a6cde9e1809'
args=json.load(open('/tmp/maelstrom-single-return-sync-capture-oct24/guest-args.json'))
args=[x.replace('/tmp/maelstrom-single-return-sync-capture-oct24',str(H)) for x in args if not x.startswith(('--trace-','--count='))]
args=[re.sub(r'\d+:png:[^,]+,?','',x).rstrip(',') if x.startswith('--input=') else x for x in args]
args=[('--wasm=/tmp/maelstrom-select-hook-recovered-canonical-native-oct24/ops/select-hook.wasm' if x.startswith('--wasm=') else x) for x in args]
save('planned-guest-args.json',args)
canonical=pathlib.Path('/tmp/maelstrom-startup-divergence-cause-oct24/repo/tools/maelstrom-startup-divergence.py')
assert sha(canonical.read_bytes())=='0ffbfdee6d64f66613731e8a4fbc00883320ee623cdd9bc45c66362b81067394'
spec=importlib.util.spec_from_file_location('canonical',canonical);mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
sizes=mod.effective_sizes(source,[args]);assert sizes[0]['size']==1000
parser=source[source.index('const getArg ='):source.index('// Was `--name=...`')]
js='const assert=require("assert"),fs=require("fs");const args=JSON.parse(fs.readFileSync(process.argv[1])).slice(4);'+parser+';assert.deepEqual(getArgs("vfs-tree"),[process.argv[2]+"/vfs"]);assert.deepEqual(getArgs("vfs-mount"),[]);console.log(JSON.stringify({tree:getArgs("vfs-tree"),mount:getArgs("vfs-mount")}));'
assert len(js.encode())<=8192
def limits():resource.setrlimit(resource.RLIMIT_CPU,(60,60));resource.setrlimit(resource.RLIMIT_FSIZE,(131072,131072))
r=subprocess.run(['node','--max-old-space-size=256','-e',js,str(O/'planned-guest-args.json'),str(H)],capture_output=True,text=True,timeout=60,preexec_fn=limits)
assert r.returncode==0,r.stderr
manifest=json.load(open('/tmp/maelstrom-native-errno-capture-oct24/manifest.json'));original=[x for x in manifest if x['target'].startswith('vfs/')]
assert len(original)==48 and sum(x['bytes'] for x in original)==2794170
for x in original:
 b=pathlib.Path(x['path']).read_bytes();assert len(b)==x['bytes'] and sha(b)==x['sha256']
assert any(',' in x['target'] for x in original)
save('mount-and-pacing.json',dict(passChecks=True,executed=False,argv=args,effective=sizes,parser=json.loads(r.stdout),canonical=str(canonical),canonicalSHA256=sha(canonical.read_bytes()),intendedFiles=original,commasPreserved=True,qualification='Planned filename-bearing argv only; no files staged or guest executed. Canonical exact parser/effective_sizes reused; historical module-dependent main() not invoked.'))
save('schedule.json',json.load(open('/home/user/wine-assembly/scratch/usage-watch/maelstrom-exact-select-original-capture-oct24.task.runtime.json')))
print(json.dumps(dict(resource=receipt['pass'],peak=receipt['peak'],mount=True,pacing=sizes,guestExecuted=False)))
