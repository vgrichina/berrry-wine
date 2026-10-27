gate('startup')
c=json.loads((O/'launch-config.json').read_text());c['controller']['cleanup_seconds']=12;save('launch-config.json',c)
cfg=json.dumps(c);py('import pathlib,hashlib;p=pathlib.Path('+repr(str(O/'launch-config.json'))+');b='+repr(cfg)+'.encode();p.write_bytes(b);print(hashlib.sha256(b).hexdigest())')
code='''import pathlib,json,os,subprocess,importlib.util,hashlib
O=pathlib.Path(OPS);env={'HOME':'/home/user','PATH':'/home/user/.nvm/versions/node/v24.22.1/bin:/usr/local/bin:/usr/bin:/bin','LANG':'C.UTF-8','TZ':'UTC','PYTHONDONTWRITEBYTECODE':'1'};os.environ.clear();os.environ.update(env)
s=importlib.util.spec_from_file_location('s',O/'trusted-supervisor.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
js='console.log(JSON.stringify({version:process.version,execArgv:process.execArgv,limits:require("fs").readFileSync("/proc/self/limits","utf8"),environmentSHA256:require("crypto").createHash("sha256").update(JSON.stringify(Object.fromEntries(Object.entries(process.env).sort()))).digest("hex")}))'
argv=['/home/user/.nvm/versions/node/v24.22.1/bin/node','--max-old-space-size=2048','-e',js]
wrapper="import subprocess,pathlib,sys; o=pathlib.Path("+repr(str(O))+");out=(o/'startup.stdout').open('xb');err=(o/'startup.stderr').open('xb');p=subprocess.Popen("+repr(argv)+",env="+repr(env)+",cwd="+repr(str(O.parent/'runner'))+",stdout=out,stderr=err);sys.exit(p.wait())"
r=m.supervise(['/usr/bin/python3','-c',wrapper],rss_limit=134217728,cpu_limit=90,wall_limit=120,output_limit=2097152);out=r.pop('output');(O/'startup.supervisor.log').write_bytes(out);(O/'startup-check.json').write_text(json.dumps(r));assert r['exit']==0 and not r['stopReason']
v=dict(receipt=r,stdout=json.loads((O/'startup.stdout').read_text()),stderr=(O/'startup.stderr').read_text(),configSHA256=hashlib.sha256((O/'launch-config.json').read_bytes()).hexdigest(),environment=env)
ready=json.loads((O/'readiness.json').read_text());ready['exactStartup']=v;ready['configSHA256']=v['configSHA256'];(O/'readiness.json').write_text(json.dumps(ready,indent=2));print(json.dumps(v))
'''.replace('OPS',repr(str(O)))
v=json.loads(py(code)['stdout']);save('startup-check.json',v)
rs=json.loads((O/'runtime-manifest.json').read_text());save('comma-inventory.json',dict(files=[r['target'] for r in rs if ',' in r['target']],mountTree=str(H/'vfs')))
print(json.dumps(dict(startup='PASS',peakRSS=v['receipt']['peakRSS'],commaFiles=[r['target'] for r in rs if ',' in r['target']])))
