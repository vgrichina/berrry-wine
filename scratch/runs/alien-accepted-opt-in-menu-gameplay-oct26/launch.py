from work import *
assert json.loads((O/'checkpoint.json').read_text())['guestInvocations']==0
# Every immutable input is compared again immediately before ONE guest.
j=py('''import pathlib,json,hashlib,shutil,time
h=pathlib.Path('''+repr(R)+''');bad=[]
for x in json.loads((h/'expected-with-executable.json').read_text()):
 p=h/x['target']
 if p.stat().st_size!=x['bytes'] or p.stat().st_mode&0o777!=x['mode'] or hashlib.file_digest(p.open('rb'),'sha256').hexdigest()!=x['sha256']:bad.append(x['target'])
m=int(pathlib.Path('/proc/meminfo').read_text().split('MemAvailable:')[1].split()[0])*1024;free=shutil.disk_usage(h).free;allocated=sum(p.lstat().st_blocks*512 for p in [h,*h.rglob('*')])
r=dict(at=time.time(),bad=bad,files=603,memAvailable=m,free=free,allocated=allocated,remoteCap=268435456,projectedWithCapturesLogsGrowthReserve=allocated+(16+4+32+8)*2**20,remainingInputIdentity=True)
(h/'pre-guest.json').write_text(json.dumps(r));print(json.dumps(r));assert not bad and m>=3758096384 and free-(268435456-allocated)>=805306368 and r['projectedWithCapturesLogsGrowthReserve']<=268435456 and time.time()<1793058420
''');save('immediate-preguest-readback.json',j)
# Local API control admission, child pool future counted once per native resident.
mem=int(pathlib.Path('/proc/meminfo').read_text().split('MemAvailable:')[1].split()[0])*1024
clients=[]
for p in pathlib.Path('/proc').glob('[0-9]*'):
 try:
  a=(p/'cmdline').read_bytes().split(b'\0')
  if a and a[0].endswith(b'/codex'):clients.append(int(p.name))
 except OSError:pass
v=dict(memAvailable=mem,required=(768+256+len(clients)*64+320)*2**20,free=shutil.disk_usage(H).free,projectedFree=shutil.disk_usage(H).free-(64+96*2)*2**20,clients=clients)
save('immediate-local-admission.json',v);assert mem>=v['required'] and v['projectedFree']>=2982150144
save('guest-detach.json',remote('python3 '+shlex.quote(R+'/supervisor.py')+' guest',detach=True));print('GUEST LAUNCHED',flush=True)
