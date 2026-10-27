from work import *
assert json.load(open(H/'remote-rehash.json'))['exitCode']==0
args=[x.replace('/tmp/penguin-postloop-shot-acceptance-oct24',R) for x in json.load(open('/tmp/penguin-postloop-shot-acceptance-oct24/decision-args.json'))]
args[0]='/home/user/.nvm/versions/node/v24.22.1/bin/node'
args=[x if not x.startswith('--input=') else '--input=33000:mousemove:420:360,34000:mousedown:420:360,34500:mouseup:420:360,34800:mousemove:260:220,39999:png:'+R+'/ops/decision/b39999.png,40000:keydown:65,40060:png:'+R+'/ops/decision/b40060.png,40100:png:'+R+'/ops/decision/b40100.png,40200:png:'+R+'/ops/decision/b40200.png,40200:keyup:65' for x in args]
save('decision-args.json',args)
references=[]
for p in [pathlib.Path('/tmp/penguin-postloop-shot-acceptance-oct24/preflight-api.json'),pathlib.Path('/tmp/penguin-postloop-shot-acceptance-oct24/reused-checkpoint.json'),pathlib.Path('/tmp/penguin-postloop-shot-acceptance-oct24/repo/docs/re-notes/penguin-command-postloop-shot-acceptance-20261024.md')]:
 references.append(dict(path=str(p),sha256=sha(p.read_bytes()),reused=True))
save('reused-checkpoints.json',dict(references=references,claims='Exact closure passed original numerical acceptance and codec/layout preflight; no broad suite or build repeated.',historicalModule=True,currentMainClaim=False))
for n in ['supervise.py','decision-args.json','startup.cjs']:send((H/n).read_bytes(),'ops/'+n)
pre='''import pathlib,json,hashlib,os,re,shutil
T=pathlib.Path(ROOT);pids=[]
for p in pathlib.Path('/proc').glob('[0-9]*'):
 try:
  a=(p/'cmdline').read_bytes().decode(errors='replace').split('\\0')
  if a and pathlib.Path(a[0]).name=='node' and str(T/'runner/test/run.js') in a:pids.append(int(p.name))
 except (FileNotFoundError,ProcessLookupError,PermissionError):pass
assert not pids,pids
ident={n:hashlib.sha256((T/n).read_bytes()).hexdigest() for n in ['runner/test/run.js','runtime/build/wine-assembly.wasm','game/penguin-command.exe']}
assert list(ident.values())==['3c59fd034391e069f24a6047cf96cd8dac84a791d7d7591d55e5f7cb6e161a5e','8fac39936b6df2418ad86cab118cef19a65a727f649fbc14c412b37818904686','14d6e430c26c44c94ef5c176eca2f66edd82dd66fd155d29a5596e3d6e170fc1']
print(json.dumps(dict(identities=ident,noOwnedProcess=True,memAvailable=int(re.search(r'MemAvailable:\\s+(\\d+)',pathlib.Path('/proc/meminfo').read_text())[1])*1024,free=shutil.disk_usage('/tmp').free,owned=sum(p.stat().st_size for p in T.rglob('*') if p.is_file()))))
'''.replace('ROOT',repr(R))
save('fresh-identity-process.json',py(pre))
save('startup-api.json',remote('python3 '+shlex.quote(R+'/ops/supervise.py')+' startup',25))
for name in ['startup/command.json','startup/terminal.json','startup/output.log','launch-parser-startup.json']:
 dest=H/name;dest.parent.mkdir(parents=True,exist_ok=True);get(R+'/ops/'+name,dest)
receipt=json.load(open(H/'launch-parser-startup.json'));assert receipt['pass'] and receipt['canonicalParser']
save('preguest-local-accounting.json',dict(at=time.time(),owned=size(T),free=shutil.disk_usage('/tmp').free,otherAggregateFuture=67108864+2*50331648,remainingOwnFuture=50331648-size(T),projected=shutil.disk_usage('/tmp').free-(67108864+3*50331648-size(T))))
assert json.load(open(H/'preguest-local-accounting.json'))['projected']>=2982150144
assert not (H/'guest-launch-api.json').exists()
save('guest-launch-api.json',remote('python3 '+shlex.quote(R+'/ops/supervise.py')+' guest',100))
print('GUEST FINISHED',flush=True)
seals={}
for name in ['output.log','command.json','terminal.json','b39999.png','b40060.png','b40100.png','b40200.png']:
 dest=H/'decision'/name;dest.parent.mkdir(exist_ok=True);seals[name]=get(R+'/ops/decision/'+name,dest)
save('capture-seals.json',seals)
get(R+'/ops/capture-reservation.json',H/'capture-reservation.json')
print((H/'decision/terminal.json').read_text(),flush=True)
