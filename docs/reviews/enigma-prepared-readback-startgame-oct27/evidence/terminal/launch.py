import os,sys,json,pathlib,subprocess,time,hashlib,resource
h=pathlib.Path('/tmp/enigma-prepared-readback-startgame-oct27'); retained=pathlib.Path('/tmp/enigma-separated-stream-runtime-oct27')
env={'HOME': '/home/user', 'PATH': '/home/user/.nvm/versions/node/v24.22.1/bin:/usr/local/bin:/usr/bin:/bin', 'LANG': 'C.UTF-8', 'TZ': 'UTC', 'PYTHONDONTWRITEBYTECODE': '1'}
c=json.loads((h/'ops/launch-config.json').read_text())
assert time.time()+120 < c['cutoff_at']
assert int(pathlib.Path('/proc/meminfo').read_text().split('MemAvailable:')[1].split()[0])*1024 >= 3758096384
assert (h/'ops/mount-reused.json').is_file()
receipt=dict(at=time.time(),environment=env,environmentSHA256=hashlib.sha256(json.dumps(env,sort_keys=True).encode()).hexdigest(),inheritedLimits=pathlib.Path('/proc/self/limits').read_text(),configSHA256=hashlib.sha256((h/'ops/launch-config.json').read_bytes()).hexdigest(),identities={p:hashlib.sha256((retained/p).read_bytes()).hexdigest() for p in ['runner/test/run.js','runner/lib/host-imports.js','modules/wine-assembly.wasm','runner/tools/enigma-supervised-gameplay.py','runner/tools/enigma-frozen-gameplay-controller.py','vfs/Enigma-1.01/enigma.exe']})
(h/'ops/startup-environment.json').write_text(json.dumps(receipt,indent=2))
with (h/'ops/supervisor-stdout.log').open('xb') as out,(h/'ops/supervisor-stderr.log').open('xb') as err:
 p=subprocess.Popen(['/usr/bin/python3',str(retained/'runner/tools/enigma-supervised-gameplay.py'),'--launch-config',str(h/'ops/launch-config.json')],cwd=retained/'runner',env=env,stdout=out,stderr=err,start_new_session=True)
 (h/'ops/supervisor-pid.json').write_text(json.dumps(dict(pid=p.pid,start=pathlib.Path('/proc/'+str(p.pid)+'/stat').read_text().split(') ')[1].split()[19])))
 try:r=p.wait(timeout=118)
 except subprocess.TimeoutExpired:
  p.terminate();r=p.wait(timeout=1)
 (h/'ops/cli-exit.json').write_text(json.dumps(dict(exit=r,at=time.time())))
print(json.dumps(dict(supervisorExit=r)))
