from work import *
ID=H.name;OLD='/tmp/alien-shooter-current-gameplay-api-oct26';P=pathlib.Path(OLD)/'ops';PREV=pathlib.Path('/tmp/alien-shooter-required-exe-gameplay-api-oct26/ops');SOURCE=pathlib.Path('/tmp/civ2-win16-ordinary-gameplay-oct26/source')
base={str(p):allocated(p) for p in pathlib.Path('/home/user/.codex').glob('*.sqlite*')};save('sqlite-baseline.json',base)
sess=next(pathlib.Path('/home/user/.codex/sessions/2026/10/26').glob('*'+os.environ['CODEX_THREAD_ID']+'.jsonl'));L=ROOT/'scratch/usage-watch'/ID
save('trusted-ssh-config.json',dict(command=SSH,rootRef=json.loads((L/'root-ref-digest.json').read_text())))
def admit(remoteBytes=51000000,newRemote=131072):
 clients=[]
 for p in pathlib.Path('/proc').glob('[0-9]*'):
  try:
   a=(p/'cmdline').read_bytes().split(b'\0')
   if a and a[0].endswith(b'/codex') and b'wine-worker' in a:clients.append(dict(pid=int(p.name),rss=int((p/'statm').read_text().split()[1])*4096))
  except (OSError,ValueError):pass
 growth=sum(max(0,335544320-c['rss']) for c in clients)
 required=(64+768+256+3*64+768)*2**20+growth
 c=dict(retainedRemote=remoteBytes,newRemote=newRemote,pinnedTable=724992,localOwned=allocated(H),previousTaskLocal=allocated(PREV.parent),previousTaskRemote=40960,launcher=allocated(L)+sum(allocated(p) for p in L.parent.glob(L.name+'.*')),session=allocated(sess),positiveWALOnce=sum(max(0,allocated(pathlib.Path(p))-n) for p,n in base.items()),outputsPublicationGit=32*2**20,future=16*2**20,reserve=8*2**20)
 mem=int(pathlib.Path('/proc/meminfo').read_text().split('MemAvailable:')[1].split()[0])*1024
 j=dict(charges=c,total=sum(c.values()),cap=201326592,clients=clients,clientGrowth=growth,memAvailable=mem,required=required,projectedHostFree=shutil.disk_usage(H).free-40*2**20,hostFloor=2982150144)
 j['passGate']=j['total']<=j['cap'] and mem>=required and j['projectedHostFree']>=j['hostFloor'];save('admission-current.json',j);print(json.dumps(j),flush=True);assert j['passGate']
admit()
m=json.loads((P/'runtime-manifest.json').read_text());enc=base64.b64encode(gzip.compress(json.dumps(m).encode())).decode()
j=py('''import pathlib,json,gzip,base64,hashlib,shutil
h=pathlib.Path('''+repr(OLD)+''');m=json.loads(gzip.decompress(base64.b64decode('''+repr(enc)+''')));bad=[];missing=[]
for x in m:
 p=h/'runner'/x['path']
 if not p.exists():missing.append(x['path']);continue
 if p.stat().st_size!=x['bytes'] or hashlib.file_digest(p.open('rb'),'sha256').hexdigest()!=x['sha256'] or p.stat().st_mode&511!=x['mode']:bad.append(x['path'])
print(json.dumps(dict(missing=missing,bad=bad,verified=len(m)-len(missing)-len(bad),allocated=sum(p.lstat().st_blocks*512 for p in [h,*h.rglob('*')]),memAvailable=int(pathlib.Path('/proc/meminfo').read_text().split('MemAvailable:')[1].split()[0])*1024,free=shutil.disk_usage('/tmp').free,wasm=hashlib.file_digest((h/'current.wasm').open('rb'),'sha256').hexdigest(),exe=hashlib.file_digest((h/'runner/test/binaries/candidates/reflexive-alien-shooter/game/AlienShooter.exe').open('rb'),'sha256').hexdigest(),runner=hashlib.file_digest((h/'runner/test/run.js').open('rb'),'sha256').hexdigest())))''');save('retained-verification.json',j);v=json.loads(j['stdout']);assert not v['bad'] and v['missing']==json.loads((P/'removed-reproducible-compiler.json').read_text())['paths'];assert v['wasm']=='f3f3cd439c50a2bc441de67c5f138e32cc060186d84d37d85de2b200ca806d75';assert v['exe']=='aae2547ccec2e235344bc9cf6e5e9ef4c9923b13c9e8fbd1fe14c65b64252446';assert v['runner']==sha((SOURCE/'test/run.js').read_bytes());assert v['memAvailable']>=3758096384
admit(v['allocated'])
pins=json.loads((ROOT/'scratch/usage-watch/civ2-win16-pinned-inputs-oct26.json').read_text());pin=next(x for x in pins['files'] if x['path']=='src/api_table.json');p=SOURCE/pin['path'];assert p.stat().st_size==pin['bytes'] and sha(p.read_bytes())==pin['sha256']=='562acd9c5870750d29cc88ed1ec12112c9da7164b8d9c3fe470a109842d39486'
# Inspect production startup dependencies before transfer/guest; static reading of exact pinned source.
s=(SOURCE/'test/run.js').read_text();reads=[dict(line=i,text=l.strip()) for i,l in enumerate(s.splitlines(),1) if 'readFileSync' in l or 'require(' in l]
save('startup-read-inspection.json',dict(runnerSHA256=sha(s.encode()),reads=reads,requiredTable=pin,conditionalNotes='02-thread-table.wat diagnostic read caught; win16 ordinals NE-only; compiler no-build excluded; fonts/system data verified runtime manifest; renderer/host/runtime requires covered standing runtime manifest'))
py('import pathlib;h=pathlib.Path('+repr(R)+');assert not h.exists();(h/"guest").mkdir(parents=True);assert not pathlib.Path('+repr(OLD+'/runner/src/api_table.json')+').exists()')
transfer([(OLD+'/runner/src/api_table.json',p)])
save('manifest-addendum.json',dict(source=str(p),target=OLD+'/runner/src/api_table.json',**pin,mode=p.stat().st_mode&511,standingManifest='scratch/usage-watch/civ2-win16-pinned-inputs-oct26.json',historicalENOENTPreserved=str(PREV/'retained/guest/output.log')))
a=json.loads((O/'guest-args.json').read_text());parser=s[s.index('const getArg ='):s.index('// Was `--name=...`')];code='const assert=require("assert"),args='+json.dumps(a[4:])+';'+parser+';assert.equal(getArg("app"),"alien_shooter");assert(hasFlag("no-build"));assert.equal(getArgs("vfs-mount").length,0);assert.equal(getArgs("vfs-tree").length,0);console.log("PASS")'
x=subprocess.run([NODE,'--max-old-space-size=32','-e',code],capture_output=True,text=True,timeout=20);assert x.returncode==0
save('canonical-parser.json',dict(argv=a,parserSHA256=sha(parser.encode()),stdout=x.stdout,priorEnumerationReceipt=str(PREV/'canonical-parser.json'),priorReceiptSHA256=sha((PREV/'canonical-parser.json').read_bytes()),unchangedFilenameMounts=True))
transfer([(n,O/n) for n in ['supervisor.py','capture-wrapper.cjs','guest-args.json']])
# Node startup under the exact supervisor limits, then read-only ordinary dependency closure probe.
j=py('''import pathlib,json,subprocess,os,resource,hashlib
h=pathlib.Path('''+repr(R)+''');old=pathlib.Path('''+repr(OLD)+''');a=json.loads((h/'guest-args.json').read_text());env=dict(os.environ)
for k in ['WINE_RUN_EXTRA_ARGS','WINE_REGION_MAP','NODE_OPTIONS','NODE_PATH']:env.pop(k,None)
def limits():
 resource.setrlimit(resource.RLIMIT_CPU,(90,90));resource.setrlimit(resource.RLIMIT_FSIZE,(25165824,25165824))
code="const fs=require('fs'),path=require('path'),{SYSTEM_DATA_FILES}=require('./lib/process-boot'),{fontMounts,BUNDLED_BITMAP_FONTS}=require('./lib/font-substitutions');let required=[...SYSTEM_DATA_FILES.map(x=>x.url),...BUNDLED_BITMAP_FONTS.map(x=>'fonts/'+x),'fonts/substitutions.json',...fontMounts(JSON.parse(fs.readFileSync('fonts/substitutions.json')),{subset:true}).map(x=>'fonts/'+x.file),'src/api_table.json','lib/host-import-sigs.generated.json'];for(let p of required)fs.accessSync(p);console.log(JSON.stringify({execPath:process.execPath,execArgv:process.execArgv,version:process.version,limits:fs.readFileSync('/proc/self/limits','utf8'),required,environment:Object.fromEntries(Object.entries(process.env).filter(([k])=>/^(NODE|WINE)/.test(k)))}))"
p=subprocess.run(a[:3]+['-e',code],cwd=old/'runner',env=env,preexec_fn=limits,capture_output=True,text=True,timeout=20)
with (h/'diagnostic.jsonl').open('a') as f:f.write(json.dumps(dict(startup=p.stdout,stderr=p.stderr,returncode=p.returncode))+'\\n')
print(json.dumps(dict(exit=p.returncode,stdout=p.stdout,stderr=p.stderr,tableSHA256=hashlib.file_digest((old/'runner/src/api_table.json').open('rb'),'sha256').hexdigest())))
assert p.returncode==0
''');save('startup-exact-closure.json',j);print(j['stdout'],flush=True)
print('READY actual guest',flush=True)
