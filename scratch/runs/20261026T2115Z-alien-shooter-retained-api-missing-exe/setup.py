from work import *
P=pathlib.Path('/tmp/alien-shooter-current-gameplay-api-oct26/ops');OLD='/tmp/alien-shooter-current-gameplay-api-oct26'
r=json.loads(json.loads((O/'retained-verification-api.json').read_text())['stdout']);assert r['missing']==json.loads((P/'removed-reproducible-compiler.json').read_text())['paths'] and not r['bad']
sup=(P/'supervisor.py').read_text().replace("cwd=H/'runner'","cwd=pathlib.Path("+repr(OLD+ '/runner')+")").replace("free-67108864","free-134217728").replace('n+len(b)>1310720','n+len(b)>2097152')
# Keep new receipt root, 89s finite guest, owned PID/starttime cleanup. No prior receipt overwritten.
(O/'supervisor.py').write_text(sup)
wrap=(P/'capture-wrapper.cjs').read_text().replace("require('./runner/node_modules/pngjs')","require('"+OLD+"/runner/node_modules/pngjs')").replace('total>1048576','total>6291456')
(O/'capture-wrapper.cjs').write_text(wrap)
a=json.loads((P/'guest-args.json').read_text());a[2]='--require='+R+'/capture-wrapper.cjs';save('guest-args.json',a)
# Validate exact intended argv via canonical parser again with unchanged registered manifest.
src=pathlib.Path('/tmp/civ2-win16-ordinary-gameplay-oct26/source/test/run.js').read_text();parser=src[src.index('const getArg ='):src.index('// Was `--name=...`')]
code='const assert=require("assert"),args='+json.dumps(a[4:])+';'+parser+';assert.equal(getArg("app"),"alien_shooter");assert(hasFlag("no-build"));assert.equal(getArgs("vfs-mount").length,0);assert.equal(getArgs("vfs-tree").length,0);console.log("PASS unchanged filename-bearing registered manifest route")'
p=subprocess.run(['node','--max-old-space-size=32','-e',code],capture_output=True,text=True,timeout=20);assert p.returncode==0
save('canonical-parser.json',dict(argv=a,parserSHA256=sha(parser.encode()),stdout=p.stdout,enumeration=json.loads((P/'canonical-parser.json').read_text())['enumeration']))
# Whole allocation includes entire retained remote stage, current evidence/publication/session and once-only WAL.
sess=next(pathlib.Path('/home/user/.codex/sessions/2026/10/26').glob('*'+os.environ['CODEX_THREAD_ID']+'.jsonl'));L=ROOT/'scratch/usage-watch/alien-shooter-retained-gameplay-api-oct26'
base=json.loads((O/'sqlite-baseline.json').read_text());wal=sum(max(0,allocated(pathlib.Path(p))-v) for p,v in base.items())
charges=dict(retainedRemote=r['allocated'],newLocal=allocated(H),newRemoteHelpers=131072,remoteOutput=2097152,remotePNG=6291456,localCollected=8388608,publicationAndDashboard=16777216,Git=2097152,launcher=allocated(L)+sum(allocated(p) for p in L.parent.glob(L.name+'.*')),session=allocated(sess),positiveWALOnce=wal,futureGrowth=8388608,reserve=8388608)
free=shutil.disk_usage(H).free;mem=int(pathlib.Path('/proc/meminfo').read_text().split('MemAvailable:')[1].split()[0])*1024
required=(64+320+768+256+3*64+768)*2**20
j=dict(charges=charges,total=sum(charges.values()),cap=134217728,localMemAvailable=mem,localRequiredConservativeNoResidentDeduction=required,projectedHostFree=free-30*2**20,hostFloor=2982150144,remote=r,passGate=sum(charges.values())<=134217728 and free-30*2**20>=2982150144 and mem>=required and r['memAvailable']>=3758096384)
save('admission-before-helpers.json',j);print(json.dumps(j));assert j['passGate']
remote('test ! -e '+shlex.quote(R)+' && mkdir -p '+shlex.quote(R+'/guest'))
transfer([(n,O/n) for n in ['supervisor.py','capture-wrapper.cjs','guest-args.json']])
j=py('''import pathlib,json,subprocess,os,hashlib,resource
h=pathlib.Path('''+repr(R)+''');a=json.loads((h/'guest-args.json').read_text());env=dict(os.environ)
for k in ['WINE_RUN_EXTRA_ARGS','WINE_REGION_MAP','NODE_OPTIONS','NODE_PATH']:env.pop(k,None)
p=subprocess.run(a[:3]+['-e',"console.log(JSON.stringify({execPath:process.execPath,execArgv:process.execArgv,version:process.version,limits:require('fs').readFileSync('/proc/self/limits','utf8'),environment:Object.fromEntries(Object.entries(process.env).filter(([k])=>/^(NODE|WINE)/.test(k)))}))"],cwd='''+repr(OLD+'/runner')+''',env=env,capture_output=True,text=True,timeout=20);assert p.returncode==0,p.stderr
with (h/'diagnostic.jsonl').open('a') as f:f.write(json.dumps(dict(startup=p.stdout,at=__import__('time').time()))+'\\n')
assert (h/'diagnostic.jsonl').stat().st_size>0
print(p.stdout)
''');save('startup-exact-api.json',j);print('SETUP PASS')
