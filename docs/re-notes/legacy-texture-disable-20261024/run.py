import pathlib,subprocess,os,json,time,hashlib,resource,shutil
B=pathlib.Path(__file__).parent;R=B/'repo'
assert int(next(x.split()[1] for x in pathlib.Path('/proc/meminfo').read_text().splitlines() if x.startswith('MemAvailable:')))*1024>=805306368
assert shutil.disk_usage(B).free>=2982150144+24*1024**2
args=__import__('sys').argv[1:];label=args.pop(0);env={**os.environ,'GIT_NO_LAZY_FETCH':'1'}
if label.startswith('baseline'):env['LEGACY_CAPS_CORE']=str(B/'baseline-core.wat')
env['LEGACY_DISABLE_GPU']=str(B/'baseline-gpu.js')
env['LEGACY_DISABLE_RECEIPT']=str(B/(label+'-receipt.json'));env['LEGACY_CAPS_RECEIPT']=str(B/(label+'-caps.json'))
def limits():resource.setrlimit(resource.RLIMIT_CPU,(60,60));resource.setrlimit(resource.RLIMIT_FSIZE,(24*1024**2,24*1024**2))
p=subprocess.run(['timeout','60','node','--max-old-space-size=256',*args],cwd=R,env=env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,preexec_fn=limits)
assert len(p.stdout)<8192
assert not (B/(label+'.log')).exists(), 'never overwrite retained run logs'
(B/(label+'.log')).write_bytes(p.stdout)
with (B/'runs.jsonl').open('a') as f:f.write(json.dumps(dict(label=label,command=args,exit=p.returncode,bytes=len(p.stdout),sha256=hashlib.sha256(p.stdout).hexdigest(),time=time.time()))+'\n')
print(label,p.returncode,p.stdout.decode()[-2200:])
