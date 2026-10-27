import pathlib,os,json,time,hashlib,subprocess
H=pathlib.Path('/tmp/enigma-remote-host-validated-startgame-oct27');O=H/'ops'
env={'HOME':'/home/user','PATH':'/home/user/.nvm/versions/node/v24.22.1/bin:/usr/local/bin:/usr/bin:/bin','LANG':'C.UTF-8','TZ':'UTC','PYTHONDONTWRITEBYTECODE':'1'}
c=json.loads((O/'launch-config.json').read_text());assert time.time()+120<c['cutoff_at'];assert (O/'readiness.json').exists()
(O/'startup-environment.json').write_text(json.dumps(dict(at=time.time(),environment=env,environmentSHA256=hashlib.sha256(json.dumps(env,sort_keys=True).encode()).hexdigest(),inheritedLimits=pathlib.Path('/proc/self/limits').read_text(),configSHA256=hashlib.sha256((O/'launch-config.json').read_bytes()).hexdigest())))
with (O/'supervisor-stdout.log').open('xb') as out,(O/'supervisor-stderr.log').open('xb') as err:
 p=subprocess.Popen(['/usr/bin/python3',str(H/'repo/runner/tools/enigma-supervised-gameplay.py'),'--launch-config',str(O/'launch-config.json')],cwd=H/'repo/runner',env=env,stdout=out,stderr=err,start_new_session=True)
 (O/'supervisor-pid.json').write_text(json.dumps(dict(pid=p.pid,start=pathlib.Path('/proc/'+str(p.pid)+'/stat').read_text().split(') ')[1].split()[19],at=time.time())))
 try:r=p.wait(timeout=118)
 except subprocess.TimeoutExpired:
  p.terminate();r=p.wait(timeout=1)
 (O/'cli-exit.json').write_text(json.dumps(dict(exit=r,at=time.time())))
print(json.dumps(dict(supervisorExit=r)))
