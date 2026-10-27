gate('readiness')
c=json.loads((O/'launch-config.json').read_text());c['controller']['capture_bytes']=700000;c['controller']['progress']['capture_total_bytes']=2800000;save('launch-config.json',c)
runner=pathlib.Path(next(r for r in json.loads((O/'runtime-manifest.json').read_text()) if r['target']=='runner/test/run.js')['source']).read_text()
parser=(O/'parser-check.cjs').read_text();canonical=runner[runner.index('const getArg ='):runner.index('const hasFlag =')];assert canonical in parser
save('parser-identity.json',dict(runnerSHA256=sha(runner.encode()),parserSHA256=sha(parser.encode()),canonicalExcerptSHA256=sha(canonical.encode()),canonicalEqual=True))
for n in ['launch-config.json','runtime-manifest.json','parser-check.cjs','remote-launch.py']:put(str(O/n),(O/n).read_bytes(),n.replace('.','-'))
put(str(O/'trusted-supervisor.py'),TRUST.read_bytes(),'trusted-supervisor')
code='''import pathlib,json,hashlib,shutil,os,subprocess,importlib.util,time
H=pathlib.Path(TASK_HOME);O=H/'ops';rs=json.loads((O/'runtime-manifest.json').read_text());bad=[]
for r in rs:
 p=H/r['target'];b=p.read_bytes()
 if len(b)!=r['bytes'] or hashlib.sha256(b).hexdigest()!=r['sha256']:bad.append(r['target'])
used=sum(p.lstat().st_blocks*512 for p in [H,*H.rglob('*')]);free=shutil.disk_usage(H).free;mem=int(pathlib.Path('/proc/meminfo').read_text().split('MemAvailable:')[1].split()[0])*1024
assert not bad and used+100663296<=268435456 and free-(268435456-used)>=2982150144 and mem>=4294967296
env={'HOME':'/home/user','PATH':'/home/user/.nvm/versions/node/v24.22.1/bin:/usr/local/bin:/usr/bin:/bin','LANG':'C.UTF-8','TZ':'UTC','PYTHONDONTWRITEBYTECODE':'1'};os.environ.clear();os.environ.update(env)
s=importlib.util.spec_from_file_location('s',O/'trusted-supervisor.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
wrapper="import pathlib,subprocess,sys; o=pathlib.Path("+repr(str(O))+"); out=(o/'mount.stdout').open('xb'); err=(o/'mount.stderr').open('xb'); p=subprocess.Popen(['/home/user/.nvm/versions/node/v24.22.1/bin/node','--max-old-space-size=2048',str(o/'parser-check.cjs')],stdout=out,stderr=err); sys.exit(p.wait())"
r=m.supervise(['/usr/bin/python3','-c',wrapper],rss_limit=134217728,cpu_limit=90,wall_limit=120,output_limit=2097152);output=r.pop('output');(O/'mount.supervisor.log').write_bytes(output);(O/'mount-check.json').write_text(json.dumps(r));assert r['exit']==0 and not r['stopReason']
v=dict(at=time.time(),files=len(rs),bytes=sum(r['bytes'] for r in rs),bad=bad,actual=used,allocation=268435456,reserve=100663296,free=free,memAvailable=mem,mount=json.loads((O/'mount.stdout').read_text()),environment=env,environmentSHA256=hashlib.sha256(json.dumps(env,sort_keys=True).encode()).hexdigest(),inheritedLimits=pathlib.Path('/proc/self/limits').read_text(),nodePath='/home/user/.nvm/versions/node/v24.22.1/bin/node',nodeSHA256=hashlib.sha256(pathlib.Path('/home/user/.nvm/versions/node/v24.22.1/bin/node').read_bytes()).hexdigest(),nodeFlags=['--max-old-space-size=2048'],nodeVersion=subprocess.check_output(['/home/user/.nvm/versions/node/v24.22.1/bin/node','--version']).decode().strip(),startupBeforeGuest='accepted supervisor performs exact-configuration startup before command; startup distinct streams and limits required',owner='new original supervised process only',listener='127.0.0.1:18127 validated by accepted supervisor')
(O/'readiness.json').write_text(json.dumps(v,indent=2));print(json.dumps(v))
'''.replace('TASK_HOME',repr(str(H)))
v=json.loads(py(code)['stdout']);save('readiness-remote.json',v)
used=sum(p.stat().st_size for p in (O/'responses').iterdir());per=((700000+4095)//4096)*8192
plan=dict(at=time.time(),usedAPI=used,imagesMax=4,perImage=700000,perImageFullEnvelope=per,totalImageEnvelope=4*per,operationsReserve=524288,cleanupReserve=1048576,cap=8388608,reviewSeconds=28,actionSeconds=30,cleanupSeconds=10,guestSeconds=110)
plan['pass']=used+4*per+524288+1048576<=8388608;save('capture-readiness.json',plan);assert plan['pass'],plan
print(json.dumps(dict(closure='PASS',mount=v['mount'],plan=plan)))
