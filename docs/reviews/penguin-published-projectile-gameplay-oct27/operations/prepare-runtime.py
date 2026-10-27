from common import *
node=json.loads((H/'remote-admission.json').read_text())['node'];m=json.loads((H/'manifest.json').read_text())
old='/tmp/penguin-postloop-shot-acceptance-oct24'
args=json.loads(pathlib.Path(old+'/decision-args.json').read_text())
args=[a.replace(old,REMOTE) for a in args[2:] if not a.startswith('--trace-eip') and not a.startswith('--input=') and not a.startswith('--vfs-include=')]
args+=['--vfs-tree='+REMOTE+'/game','--input=33000:mousemove:420:360,34000:mousedown:420:360,34500:mouseup:420:360,34800:mousemove:260:220,39999:png:'+REMOTE+'/captures/b39999.png,40000:keydown:65,40060:png:'+REMOTE+'/captures/b40060.png,40100:png:'+REMOTE+'/captures/b40100.png,40200:keyup:65,40295:png:'+REMOTE+'/captures/b40295.png']
assert args[0]==REMOTE+'/runner/test/run.js'
save('guest-args.json',args)
startup=r'''const fs=require('fs'),path=require('path'),crypto=require('crypto'),vm=require('vm');
const H=ROOT,argv=JSON.parse(fs.readFileSync(H+'/guest-args.json'));
const source=fs.readFileSync(H+'/runner/test/run.js','utf8');
const {expandIncludePatterns}=require(H+'/runner/lib/vfs-host-files');
const parserSource=source.slice(source.indexOf('const getArg ='),source.indexOf('const hasFlag ='));
const parsed=vm.runInNewContext(parserSource+'({trees:getArgs("vfs-tree"),dlls:getArg("dlls",null)})',{args:argv});
const trees=parsed.trees;
if(trees.length!==1||trees[0]!==H+'/game')throw Error('actual tree argv');
const rows=expandIncludePatterns(trees[0],['**/*']);
const manifest=JSON.parse(fs.readFileSync(H+'/manifest.json')).filter(x=>x.target.startsWith('game/'));
const actual=new Map(rows.map(x=>[path.relative(H,x.hostPath).replaceAll('\\','/'),x]));
if(actual.size!==manifest.length)throw Error('tree count');
for(const x of manifest){const r=actual.get(x.target);if(!r)throw Error('missing '+x.target);if(crypto.createHash('sha256').update(fs.readFileSync(r.hostPath)).digest('hex')!==x.sha256)throw Error('hash '+x.target)}
const dlls=parsed.dlls.split(',');if(dlls.length!==7||dlls.some(p=>!fs.statSync(p).isFile()))throw Error('DLL argv');
const receipt={node:process.execPath,version:process.version,execArgv:process.execArgv,argv,tree:trees[0],files:rows,commaFiles:rows.filter(x=>x.hostPath.includes(',')),dlls,parserSHA256:crypto.createHash('sha256').update(fs.readFileSync(H+'/runner/lib/vfs-host-files.js')).digest('hex'),runnerSHA256:crypto.createHash('sha256').update(source).digest('hex'),cwd:process.cwd(),memoryUsage:process.memoryUsage(),status:'PASS_EXACT_STARTUP_AND_CANONICAL_TREE_ENUMERATION'};
fs.writeFileSync(H+'/startup-mount-receipt.json',JSON.stringify(receipt,null,2));console.log(JSON.stringify({status:receipt.status,node:receipt.node,version:receipt.version,files:rows.length,commaFiles:receipt.commaFiles.length,dlls:dlls.length}));
'''.replace('ROOT',json.dumps(REMOTE))
(H/'startup.js').write_text(startup)
# Remote owning launcher chooses inherited DATA/AS/RSS without changing them.
launch='''import pathlib,json,resource,hashlib,os,importlib.util,time,shutil
H=pathlib.Path(ROOT)
assert time.time()<1793098980,'guest cutoff11:03UTC'
assert shutil.disk_usage(H).free-268435456>=2982150144
assert int(pathlib.Path('/proc/meminfo').read_text().split('MemAvailable:')[1].split()[0])*1024>=2684354560
p=pathlib.Path(HELPERPATH);assert hashlib.sha256(p.read_bytes()).hexdigest()==HELPERHASH
sp=importlib.util.spec_from_file_location('contract',p);c=importlib.util.module_from_spec(sp);sp.loader.exec_module(c)
node=NODE;limits=c.limits_now();limits.update(CPU=[90,90],FSIZE=[4194304,4194304])
artifacts={str(H/x['target']):x['sha256'] for x in json.loads((H/'manifest.json').read_text())}
for x in ['startup.js','guest-args.json']:artifacts[str(H/x)]=hashlib.sha256((H/x).read_bytes()).hexdigest()
profile=dict(executable=node,executable_sha256=hashlib.sha256(pathlib.Path(node).read_bytes()).hexdigest(),flags=['--max-old-space-size=512'],startup=[str(H/'startup.js')],guest=json.loads((H/'guest-args.json').read_text()),cwd=str(H/'runner'),env=dict(PATH=str(pathlib.Path(node).parent)+':/usr/bin:/bin',LANG='C.UTF-8',LC_ALL='C.UTF-8',TZ='UTC'),limits=limits,resources=dict(rss=2147483648,startup_wall=20,guest_wall=90,total_wall=120,text=2097152,png=4194304,selected=8388608,remote=16777216,api=1048576),artifacts=artifacts,capture_dir=str(H/'captures'))
(H/'captures').mkdir()
q=H/'profile.json';q.write_bytes(c.wire(profile));digest=hashlib.sha256(q.read_bytes()).hexdigest()
print(json.dumps(dict(status='starting',profileSHA256=digest)),flush=True)
c.supervise(q,digest,H/'execution')
print('complete',flush=True)
'''.replace('ROOT',repr(REMOTE)).replace('HELPERPATH',repr(REMOTE+'/penguin_capture_contract.py')).replace('HELPERHASH',repr(sha(HELPER.read_bytes()))).replace('NODE',repr(node))
(H/'launch.py').write_text(launch)
# Four measured historical full-frame profiles, explicit budget, no guest images used yet.
p=pathlib.Path('/tmp/penguin-visible-projectile-gameplay-oct27/repo/docs/re-notes/penguin-visible-projectile-gameplay-20261027/decision')
planning=H/'planning';planning.mkdir(exist_ok=True)
paths=[]
for name,src in [('b39999.png','b39999.png'),('b40060.png','b40060.png'),('b40100.png','b40060.png'),('b40295.png','b40060.png')]:
 q=planning/name;q.write_bytes((p/src).read_bytes());paths.append(q)
plan=contract.plan_provider_images(paths,used=used(),tail_reserve=M,chunk_bytes=4096,envelope_overhead=1024,capture_budget=8*M)
save('pre-guest-capture-plan.json',{k:v for k,v in plan.items() if k not in ('canonical','records')})
save('runtime-config.json',dict(box=BOX,node=node,guestArgs=args,env=dict(PATH=str(pathlib.Path(node).parent)+':/usr/bin:/bin',LANG='C.UTF-8',LC_ALL='C.UTF-8',TZ='UTC'),helperSHA256=sha(HELPER.read_bytes()),historicalRunner=True,productionCaptureContractIntegrated='4a2bec145ef34b0d084b96b09a682a16e89703fd',reusedTests='16 targeted +10 independent; no rerun',captureSlots=[39999,40060,40100,40295],taskCaptureBudget=8*M,terminalReserve=M,priorUsed=used(),plannedTotal=plan['total'],bounds='actual images max4MiB each16MiB remote; provider plan must fit8MiB; no unbounded stdout or loading captures'))
print(json.dumps(dict(status='prepared',fourFrameMeasuredPlan=plan['total'],priorUsed=used(),argsSHA256=sha((H/'guest-args.json').read_bytes()))))
