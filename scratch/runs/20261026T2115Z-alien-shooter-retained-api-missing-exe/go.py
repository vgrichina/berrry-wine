from ctl import *
r=py('import pathlib,json,shutil;print(json.dumps(dict(memAvailable=int(pathlib.Path("/proc/meminfo").read_text().split("MemAvailable:")[1].split()[0])*1024,free=shutil.disk_usage("/tmp").free)))');save('fresh-preguest-remote.json',r);r=json.loads(r['stdout']);assert r['memAvailable']>=3758096384 and r['free']-10*2**20>=2982150144
m=int(pathlib.Path('/proc/meminfo').read_text().split('MemAvailable:')[1].split()[0])*1024;save('fresh-preguest-local.json',dict(memAvailable=m,requiredNoResidentDeduction=2483027968,projectedFree=shutil.disk_usage(H).free-30*2**20));assert m>=2483027968 and shutil.disk_usage(H).free-30*2**20>=2982150144
save('guest-detach.json',remote('python3 '+shlex.quote(R+'/supervisor.py')+' guest',detach=True));print('LAUNCHED',flush=True)
time.sleep(.6)
print('INITIAL',ctl(dict(action='snapshot')),flush=True)
print('ONE',ctl(dict(action='step',n=1)),flush=True);print('ZERO',ctl(dict(action='snapshot')),flush=True)
