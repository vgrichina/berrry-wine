import sys, pathlib,os,json,time,shutil,subprocess,resource
sys.path.insert(0,'/tmp/alien-shooter-pinned-startup-gameplay-api-oct26/ops')
import work as w
w.H=pathlib.Path('/tmp/alien-shooter-title-to-menu-gameplay-api-oct26');w.O=w.H/'ops';w.R=str(w.H)
O=w.O
clients=[]
for p in pathlib.Path('/proc').glob('[0-9]*'):
 try:
  a=(p/'cmdline').read_bytes().split(b'\0')
  if a and a[0].endswith(b'/codex'):clients.append(dict(pid=int(p.name),rss=int((p/'statm').read_text().split()[1])*4096))
 except (OSError,ValueError):pass
mem=int(pathlib.Path('/proc/meminfo').read_text().split('MemAvailable:')[1].split()[0])*1024
growth=0 # resident clients already reflected in MemAvailable; no prospective new client
required=max(3221225472,(768+768+1024+3*64)*2**20+growth)
charges=json.loads((w.ROOT/'scratch/runs/alien-shooter-pinned-startup-gameplay-api-oct26/final-accounting.json').read_text())['total']+32*2**20
j=dict(at=time.time(),memAvailable=mem,required=required,clients=clients,growth=growth,projection=charges,allocation=256*2**20,hostFree=shutil.disk_usage('/tmp').free,projectedFree=shutil.disk_usage('/tmp').free-64*2**20,hostFloor=2982150144)
w.save('admission-corrected.json',j);print(json.dumps(j),flush=True)
assert mem>=required and j['projectedFree']>=2982150144 and charges<=256*2**20,'resource admission blocked'
# Reuse exact mount enumeration and trusted SSH, no checkout needed for evidence-only isolated repo.
prior=pathlib.Path('/tmp/alien-shooter-required-exe-gameplay-api-oct26/ops/canonical-parser.json')
v=json.loads(prior.read_text());w.save('mount-enumeration.json',dict(prior=str(prior),sha256=w.sha(prior.read_bytes()),enumeration=v['enumeration'],supplementaryExecutable=v['supplementaryExecutable'],unchanged=True))
shutil.copy2('/tmp/alien-shooter-pinned-startup-gameplay-api-oct26/ops/capture-wrapper.cjs',O/'capture-wrapper.cjs')
a=json.loads((w.ROOT/'scratch/runs/alien-shooter-pinned-startup-gameplay-api-oct26/guest-args.json').read_text());a[2]='--require='+w.R+'/capture-wrapper.cjs';a=[('--max-seconds=90' if x.startswith('--max-seconds=') else x) for x in a];w.save('guest-args.json',a)
s=pathlib.Path('/tmp/civ2-win16-ordinary-gameplay-oct26/source/test/run.js').read_text();parser=s[s.index('const getArg ='):s.index('// Was `--name=...`')]
p=subprocess.run(['node','--max-old-space-size=32','-e','const assert=require("assert"),args='+json.dumps(a[4:])+';'+parser+';assert.equal(getArg("app"),"alien_shooter");assert(hasFlag("no-build"));assert.equal(getArgs("vfs-mount").length,0);assert.equal(getArgs("vfs-tree").length,0);console.log("PASS")'],capture_output=True,text=True,timeout=20)
assert p.returncode==0;w.save('canonical-parser.json',dict(argv=a,parserSHA256=w.sha(parser.encode()),stdout=p.stdout,enumerationReceipt='mount-enumeration.json'))
s=pathlib.Path('/tmp/alien-shooter-pinned-startup-gameplay-api-oct26/ops/supervisor-remaining.py').read_text().replace('(57 if OP==\'guest\' else 119)','(90 if OP==\'guest\' else 119)').replace('wallGuest=57','wallGuest=90').replace('time.time()<CUTOFF','time.time()+90<CUTOFF').replace('201326592','268435456')
(O/'supervisor.py').write_text(s)
w.transfer([(n,O/n) for n in ['capture-wrapper.cjs','guest-args.json','supervisor.py']])
w.py('import pathlib;pathlib.Path('+repr(w.R+'/guest')+').mkdir()')
j=w.py('''import pathlib,json,subprocess,os,resource,hashlib,shutil
h=pathlib.Path('''+repr(w.R)+''');old=pathlib.Path('/tmp/alien-shooter-current-gameplay-api-oct26');a=json.loads((h/'guest-args.json').read_text());env=dict(os.environ)
for k in ['WINE_RUN_EXTRA_ARGS','WINE_REGION_MAP','NODE_OPTIONS','NODE_PATH']:env.pop(k,None)
def limits():
 resource.setrlimit(resource.RLIMIT_CPU,(90,90));resource.setrlimit(resource.RLIMIT_FSIZE,(25165824,25165824))
p=subprocess.run(a[:3]+['-e',"console.log(JSON.stringify({exec:process.execPath,args:process.execArgv,limits:require('fs').readFileSync('/proc/self/limits','utf8')}))"],cwd=old/'runner',env=env,preexec_fn=limits,capture_output=True,text=True,timeout=15)
v=dict(exit=p.returncode,stdout=p.stdout,stderr=p.stderr,memAvailable=int(pathlib.Path('/proc/meminfo').read_text().split('MemAvailable:')[1].split()[0])*1024,free=shutil.disk_usage('/tmp').free,identities={})
for n in ['current.wasm','runner/test/run.js','runner/test/binaries/candidates/reflexive-alien-shooter/game/AlienShooter.exe','runner/src/api_table.json','runner/lib/host-import-sigs.generated.json','runner/lib/d3d-render-worker.js']:
 q=old/n;v['identities'][n]=dict(bytes=q.stat().st_size,sha256=hashlib.file_digest(q.open('rb'),'sha256').hexdigest())
print(json.dumps(v));assert p.returncode==0
''');w.save('node-startup-identities.json',j)
v=json.loads(j['stdout']);assert v['memAvailable']>=3758096384;assert v['identities']['current.wasm']['sha256']=='f3f3cd439c50a2bc441de67c5f138e32cc060186d84d37d85de2b200ca806d75';assert v['identities']['runner/test/run.js']['sha256']=='87ab63d768eb59a09a8b69df2ccb3843270dd867a67405abd82f02c25c1628e7'
print('PREPARED',flush=True)
