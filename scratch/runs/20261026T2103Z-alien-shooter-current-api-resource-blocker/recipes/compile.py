from work import *
transfer([('supervisor.py',O/'supervisor.py'),('source-pins.json.gz',O/'source-pins.json.gz')])
code='''import pathlib,hashlib,json,gzip,subprocess,os,resource
h=pathlib.Path(ROOT);s=h/'runner';pins=json.loads(gzip.decompress((h/'source-pins.json.gz').read_bytes()))
for x in pins:
 p=s/x['path'];assert p.stat().st_size==x['bytes'] and hashlib.file_digest(p.open('rb'),'sha256').hexdigest()==x['sha256'],x['path']
for op in ['startup','compile','guest']:
 (h/op).mkdir(exist_ok=True);p=h/op/'append-probe';p.open('ab').write(b'ok');assert p.read_bytes()==b'ok';p.unlink()
a=[NODEEXEC,'--max-old-space-size=2048','-e',"console.log(JSON.stringify({executable:process.execPath,version:process.version,argv:process.execArgv,limits:require('fs').readFileSync('/proc/self/limits','utf8'),environment:Object.fromEntries(Object.entries(process.env).filter(([k])=>/^(NODE|WINE)/.test(k))),memory:process.memoryUsage()}))"]
for k in ['WINE_RUN_EXTRA_ARGS','WINE_REGION_MAP','NODE_OPTIONS','NODE_PATH']:os.environ.pop(k,None)
def lim():
 resource.setrlimit(resource.RLIMIT_CPU,(90,90));resource.setrlimit(resource.RLIMIT_FSIZE,(25165824,25165824))
p=subprocess.run(a,capture_output=True,text=True,cwd=s,preexec_fn=lim,timeout=20);assert len(p.stdout)+len(p.stderr)<8192
(h/'startup'/'receipt.json').write_text(json.dumps(dict(argv=a,exit=p.returncode,stdout=p.stdout,stderr=p.stderr)));assert p.returncode==0,p.stderr
a=[NODEEXEC,'--max-old-space-size=2048','-e',"const f=require('fs'),c=require('./test/compile-src.js');const b=c.compileSrcWasm();f.writeFileSync('../current.wasm',b);console.log(JSON.stringify({bytes:b.length,sha256:require('crypto').createHash('sha256').update(b).digest('hex')}))"]
(h/'compile-args.json').write_text(json.dumps(a));print('PASS unchanged239 source pins + append + exact Node startup')
'''.replace('ROOT',repr(R)).replace('NODEEXEC',repr(NODE))
save('startup-api.json',py(code));save('compile-detach.json',remote('python3 '+shlex.quote(R+'/supervisor.py')+' compile',detach=True))
print('COMPILE STARTED',flush=True)
