from work import *
# Complete fresh gate immediately before the one guest, including both hosts.
a=account('launch')
probe=py('import os,json,pathlib,shutil,hashlib;print(json.dumps(dict(uid=os.getuid(),free=shutil.disk_usage("/tmp").free,memAvailable=int(pathlib.Path("/proc/meminfo").read_text().split("MemAvailable:")[1].split()[0])*1024,tools=[dict(path=p,bytes=pathlib.Path(p).stat().st_size,sha256=hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()) for p in [shutil.which("python3"),shutil.which("node")]])))')
save('resource-immediate-api.json',probe);j=json.loads(probe['stdout']);assert j['uid']==1000 and j['free']-a['peak']>=2982150144 and j['memAvailable']>=2684354560
# Send strengthened supervisor, locally tested with a real resistant descendant.
b=(H/'supervise.py').read_bytes();save('send-final-supervise.json',py('import pathlib,base64;pathlib.Path('+repr(str(H/'supervise.py'))+').write_bytes(base64.b64decode('+repr(base64.b64encode(b).decode())+'))'))
save('watchdog-descendant-api.json',remote('python3 '+shlex.quote(str(H/'supervise.py'))+' negative-control',15))
save('guest-supervisor-api.json',remote('python3 '+shlex.quote(str(H/'supervise.py'))+' guest',75))
print(json.dumps(json.load(open(H/'guest-supervisor-api.json'))),flush=True)
