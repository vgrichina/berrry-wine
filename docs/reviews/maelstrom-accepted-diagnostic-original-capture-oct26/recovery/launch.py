import pathlib,json,os,time,fcntl,subprocess,base64,zlib,shlex
from common import *
# One local owner spans qualification and the sole remote attempt.
lock=open('/tmp/wine-qualification-heavy.lock','a+');fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
save('local-lock.json',dict(pid=os.getpid(),path=lock.name,acquired=True))
assert time.time()+90<1792992900
account('preflight')
# Restrict total TERM/KILL/reap to the inherited five-second cleanup envelope.
p=H/'supervise.py';s=p.read_text().replace('deadline=time.monotonic()+5\n while','deadline=time.monotonic()+3\n while');p.write_text(s)
enc=base64.b64encode(zlib.compress(p.read_bytes())).decode()
j=py('import pathlib,zlib,base64,hashlib;p=pathlib.Path('+repr(str(p))+');p.write_bytes(zlib.decompress(base64.b64decode('+repr(enc)+')));print(hashlib.sha256(p.read_bytes()).hexdigest())');save('supervisor-update-api.json',j);assert j['stdout'].strip()==sha(p.read_bytes())
for mode in ['inherited-limit-check','negative-control','output-control']:
 j=remote('python3 '+shlex.quote(str(H/'supervise.py'))+' '+mode,20);save(mode+'-api.json',j)
j=remote('cd '+shlex.quote(str(H))+' && node --max-old-space-size=256 validate-tree.cjs',30);save('mount-actual-api.json',j)
j=py('import pathlib,json,os,shutil,resource;h=pathlib.Path('+repr(str(H))+');print(json.dumps(dict(uid=os.getuid(),memAvailable=int(pathlib.Path("/proc/meminfo").read_text().split("MemAvailable:")[1].split()[0])*1024,free=shutil.disk_usage(h).free,allocated=sum(max(p.stat().st_size,p.stat().st_blocks*512) for p in h.rglob("*") if p.is_file()),inheritedFSIZE=resource.getrlimit(resource.RLIMIT_FSIZE))))');save('fresh-preguest-api.json',j);rr=json.loads(j['stdout']);assert rr['uid']==1000 and rr['memAvailable']>=2684354560 and rr['free']-67108864>=2982150144
account('preguest',rr['allocated'])
save('checkpoint-ready.json',dict(candidate='44e344fdb26daab9a07210656597902ba27cb5f7',module='aca2e70da288cea022848e8d4dee7645feebfa9eb106580433841a8527c483a1',mount=True,supervisorControls=True,adapterControl=True,attempts=0))
assert not (O/'one-guest-launch.json').exists();save('one-guest-launch.json',dict(at=time.time(),attempt=1,box=BOX))
j=remote('python3 '+shlex.quote(str(H/'supervise.py'))+' guest',80);save('guest-supervisor-api.json',j)
save('local-lock-release.json',dict(pid=os.getpid(),released=True));fcntl.flock(lock,fcntl.LOCK_UN);lock.close()
print(json.dumps(dict(guestAttempt=1,receipt=j['stdout'])))
