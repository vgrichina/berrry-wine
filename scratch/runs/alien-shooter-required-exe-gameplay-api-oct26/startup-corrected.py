from work import *
OLD='/tmp/alien-shooter-current-gameplay-api-oct26'
j=py('''import pathlib,json,subprocess,os,resource,hashlib
h=pathlib.Path('''+repr(R)+''');old=pathlib.Path('''+repr(OLD)+''');a=json.loads((h/'guest-args.json').read_text());env=dict(os.environ)
for k in ['WINE_RUN_EXTRA_ARGS','WINE_REGION_MAP','NODE_OPTIONS','NODE_PATH']:env.pop(k,None)
p=subprocess.run(a[:3]+['-e',"console.log(JSON.stringify({execPath:process.execPath,execArgv:process.execArgv,version:process.version,limits:require('fs').readFileSync('/proc/self/limits','utf8'),environment:Object.fromEntries(Object.entries(process.env).filter(([k])=>/^(NODE|WINE)/.test(k)))}))"],cwd=old/'runner',env=env,capture_output=True,text=True,timeout=20);assert p.returncode==0,p.stderr
with (h/'diagnostic.jsonl').open('a') as f:f.write(json.dumps(dict(startup=p.stdout,at=__import__('time').time()))+'\\n')
seeds=[q for q in (old/'runner/test/binaries/dlls').glob('*') if q.is_file()];assert not seeds
print(json.dumps(dict(startup=json.loads(p.stdout),dllSeeds=[dict(path=str(q.relative_to(old)),bytes=q.stat().st_size,sha256=hashlib.file_digest(q.open('rb'),'sha256').hexdigest()) for q in seeds],runnerSHA256=hashlib.file_digest((old/'runner/test/run.js').open('rb'),'sha256').hexdigest(),exeSHA256=hashlib.file_digest((old/'runner/test/binaries/candidates/reflexive-alien-shooter/game/AlienShooter.exe').open('rb'),'sha256').hexdigest(),wasmSHA256=hashlib.file_digest((old/'current.wasm').open('rb'),'sha256').hexdigest())))
''');save('startup-exact-and-production-readback.json',j);print('READY PASS',flush=True)
