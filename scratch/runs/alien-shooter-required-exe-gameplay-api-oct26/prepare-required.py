from work import *
OLD='/tmp/alien-shooter-current-gameplay-api-oct26';P=pathlib.Path(OLD)/'ops';PR=pathlib.Path('/tmp/alien-shooter-retained-gameplay-api-oct26/ops')
# Initial complete conservative budget, actual retained bytes are remeasured next.
base={str(p):allocated(p) for p in pathlib.Path('/home/user/.codex').glob('*.sqlite*')};save('sqlite-baseline.json',base)
sess=next(pathlib.Path('/home/user/.codex/sessions/2026/10/26').glob('*'+os.environ['CODEX_THREAD_ID']+'.jsonl'));L=ROOT/'scratch/usage-watch/alien-shooter-required-exe-gameplay-api-oct26'
def admission(remoteBytes,remoteNew=0):
 wal=sum(max(0,allocated(pathlib.Path(p))-n) for p,n in base.items())
 c=dict(retainedRemote=remoteBytes,requiredExe=716800,remoteHelpers=131072,remoteOutputs=8388608,localHelpers=allocated(H),localCollected=8388608,publicationDashboard=16777216,Git=2097152,launcher=allocated(L)+sum(allocated(p) for p in L.parent.glob(L.name+'.*')),session=allocated(sess),positiveWALOnce=wal,futureGrowth=8388608,reserve=8388608)
 mem=int(pathlib.Path('/proc/meminfo').read_text().split('MemAvailable:')[1].split()[0])*1024;free=shutil.disk_usage(H).free
 j=dict(charges=c,total=sum(c.values()),cap=134217728,memAvailable=mem,requiredNoResidentDeduction=2483027968,projectedHostFree=free-36*2**20,hostFloor=2982150144)
 j['passGate']=j['total']<=j['cap'] and mem>=j['requiredNoResidentDeduction'] and j['projectedHostFree']>=j['hostFloor'];save('admission-current.json',j);print(json.dumps(j),flush=True);assert j['passGate']
admission(49197056)
exec((O/'verify.py').read_text())
r=json.loads(json.loads((O/'retained-verification-api.json').read_text())['stdout']);assert r['missing']==json.loads((P/'removed-reproducible-compiler.json').read_text())['paths'] and not r['bad'];assert r['memAvailable']>=3758096384
admission(r['allocated'])
exe=ROOT/'test/binaries/candidates/reflexive-alien-shooter/game/AlienShooter.exe';assert exe.stat().st_size==712724 and sha(exe.read_bytes())=='aae2547ccec2e235344bc9cf6e5e9ef4c9923b13c9e8fbd1fe14c65b64252446'
# Target only the specifically authorized original executable; no staging entrypoint.
j=py('import pathlib;h=pathlib.Path('+repr(R)+');assert not h.exists();(h/"guest").mkdir(parents=True);p=pathlib.Path('+repr(OLD+'/runner/test/binaries/candidates/reflexive-alien-shooter/game/AlienShooter.exe')+');assert not p.exists()');save('before-transfer.json',j)
transfer([(OLD+'/runner/test/binaries/candidates/reflexive-alien-shooter/game/AlienShooter.exe',exe)])
supp=dict(path=OLD+'/runner/test/binaries/candidates/reflexive-alien-shooter/game/AlienShooter.exe',bytes=712724,sha256=sha(exe.read_bytes()),mode=exe.stat().st_mode&511,provenance='docs/re-notes/reflexive.md',corrects='historical omission in 431 fixture / 594 stage manifests; earlier noGuest remains true')
save('supplementary-executable-manifest.json',supp)
j=py('import pathlib,hashlib,json;p=pathlib.Path('+repr(supp['path'])+');print(json.dumps(dict(path=str(p),bytes=p.stat().st_size,sha256=hashlib.file_digest(p.open("rb"),"sha256").hexdigest(),mode=p.stat().st_mode&511)))');save('required-exe-readback.json',j);v=json.loads(j['stdout']);assert all(v[k]==supp[k] for k in ['path','bytes','sha256','mode'])
# Exact canonical parser, enumerate existing files plus supplemental executable without changing registered app route.
a=json.loads((O/'guest-args.json').read_text());src=pathlib.Path('/tmp/civ2-win16-ordinary-gameplay-oct26/source/test/run.js').read_text();parser=src[src.index('const getArg ='):src.index('// Was `--name=...`')]
code='const assert=require("assert"),args='+json.dumps(a[4:])+';'+parser+';assert.equal(getArg("app"),"alien_shooter");assert(hasFlag("no-build"));assert.equal(getArgs("vfs-mount").length,0);assert.equal(getArgs("vfs-tree").length,0);console.log("PASS canonical registered app parser")'
p=subprocess.run(['node','--max-old-space-size=32','-e',code],capture_output=True,text=True,timeout=20);assert p.returncode==0;save('canonical-parser.json',dict(argv=a,parserSHA256=sha(parser.encode()),stdout=p.stdout,enumeration=json.loads((P/'canonical-parser.json').read_text())['enumeration'],supplementaryExecutable=supp))
transfer([(n,O/n) for n in ['supervisor.py','capture-wrapper.cjs','guest-args.json']])
j=py('''import pathlib,json,subprocess,os,resource,hashlib
h=pathlib.Path('''+repr(R)+''');old=pathlib.Path('''+repr(OLD)+''');a=json.loads((h/'guest-args.json').read_text());env=dict(os.environ)
for k in ['WINE_RUN_EXTRA_ARGS','WINE_REGION_MAP','NODE_OPTIONS','NODE_PATH']:env.pop(k,None)
p=subprocess.run(a[:3]+['-e',"console.log(JSON.stringify({execPath:process.execPath,execArgv:process.execArgv,version:process.version,limits:require('fs').readFileSync('/proc/self/limits','utf8'),environment:Object.fromEntries(Object.entries(process.env).filter(([k])=>/^(NODE|WINE)/.test(k)))}))"],cwd=old/'runner',env=env,capture_output=True,text=True,timeout=20);assert p.returncode==0,p.stderr
with (h/'diagnostic.jsonl').open('a') as f:f.write(json.dumps(dict(startup=p.stdout,at=__import__('time').time()))+'\\n')
seeds=[q for q in (old/'runner/test/binaries/dlls').glob('*') if q.is_file()];assert seeds
print(json.dumps(dict(startup=json.loads(p.stdout),dllSeeds=[dict(path=str(q.relative_to(old)),bytes=q.stat().st_size,sha256=hashlib.file_digest(q.open('rb'),'sha256').hexdigest()) for q in seeds],runnerSHA256=hashlib.file_digest((old/'runner/test/run.js').open('rb'),'sha256').hexdigest(),exeSHA256=hashlib.file_digest((old/'runner/test/binaries/candidates/reflexive-alien-shooter/game/AlienShooter.exe').open('rb'),'sha256').hexdigest(),wasmSHA256=hashlib.file_digest((old/'current.wasm').open('rb'),'sha256').hexdigest())))
''');save('startup-exact-and-production-readback.json',j);print('READY PASS',flush=True)
