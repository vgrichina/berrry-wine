import pathlib,json,resource,hashlib,os,importlib.util,time,shutil
H=pathlib.Path('/tmp/penguin-published-projectile-gameplay-oct27')
assert time.time()<1793098980,'guest cutoff11:03UTC'
assert shutil.disk_usage(H).free-268435456>=2982150144
assert int(pathlib.Path('/proc/meminfo').read_text().split('MemAvailable:')[1].split()[0])*1024>=2684354560
p=pathlib.Path('/tmp/penguin-published-projectile-gameplay-oct27/penguin_capture_contract.py');assert hashlib.sha256(p.read_bytes()).hexdigest()=='efcf3c5656a40800a4add90f1882d24830b8cb142626161dd3535d0027491c0b'
sp=importlib.util.spec_from_file_location('contract',p);c=importlib.util.module_from_spec(sp);sp.loader.exec_module(c)
node='/home/user/.nvm/versions/node/v24.22.1/bin/node';limits=c.limits_now();limits.update(CPU=[90,90],FSIZE=[4194304,4194304])
artifacts={str(H/x['target']):x['sha256'] for x in json.loads((H/'manifest.json').read_text())}
for x in ['startup.js','guest-args.json']:artifacts[str(H/x)]=hashlib.sha256((H/x).read_bytes()).hexdigest()
profile=dict(executable=node,executable_sha256=hashlib.sha256(pathlib.Path(node).read_bytes()).hexdigest(),flags=['--max-old-space-size=512'],startup=[str(H/'startup.js')],guest=json.loads((H/'guest-args.json').read_text()),cwd=str(H/'runner'),env=dict(PATH=str(pathlib.Path(node).parent)+':/usr/bin:/bin',LANG='C.UTF-8',LC_ALL='C.UTF-8',TZ='UTC'),limits=limits,resources=dict(rss=2147483648,startup_wall=20,guest_wall=90,total_wall=120,text=2097152,png=4194304,selected=8388608,remote=16777216,api=1048576),artifacts=artifacts,capture_dir=str(H/'captures'))
(H/'captures').mkdir()
q=H/'profile.json';q.write_bytes(c.wire(profile));digest=hashlib.sha256(q.read_bytes()).hexdigest()
print(json.dumps(dict(status='starting',profileSHA256=digest)),flush=True)
c.supervise(q,digest,H/'execution')
print('complete',flush=True)
