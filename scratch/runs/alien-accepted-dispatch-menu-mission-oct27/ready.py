from work import *
from control import admission
assert (O/'closure-readback.json').exists()
transfer([('phase.py',O/'phase.py')])
j=py('''import pathlib,json,hashlib,shutil,time
h=pathlib.Path('''+repr(R)+''');bad=[]
for x in json.loads((h/'expected.json').read_text()):
 p=h/x['target']
 if p.stat().st_size!=x['bytes'] or p.stat().st_mode&0o777!=x['mode'] or hashlib.file_digest(p.open('rb'),'sha256').hexdigest()!=x['sha256']:bad.append(x['target'])
m=int(pathlib.Path('/proc/meminfo').read_text().split('MemAvailable:')[1].split()[0])*1024;free=shutil.disk_usage(h).free;allocated=sum(p.lstat().st_blocks*512 for p in [h,*h.rglob('*')])
r=dict(at=time.time(),bad=bad,files=610,memAvailable=m,free=free,allocated=allocated,remoteCap=268435456,projected=allocated+(16+4+32+8)*2**20,remoteGuestPhysicalCap=3*2**30,hostFloor=768*2**20,expiry='2026-10-27T01:22:31.959Z',cutoff='2026-10-27T00:55:00Z')
(h/'pre-guest.json').write_text(json.dumps(r));print(json.dumps(r));assert not bad and m>=3758096384 and free-(268435456-allocated)>=805306368 and r['projected']<=268435456 and time.time()<1793062500
''');save('immediate-preguest-readback.json',j);admission()
save('readiness.json',dict(guestInvocations=0,inputs=610,canonicalModule='f3f3cd439c50a2bc441de67c5f138e32cc060186d84d37d85de2b200ca806d75',controller='a9d65e0459445616d16b7a85fd99c1c93ec992ac',captures=8,eachBytes=2097152,dimensions=[640,480],wall=120,cpu=90,plan='configuration capture -> inspect OK -> title capture -> inspect Enter -> menu -> inspect New Game -> player/campaign -> mission -> action/after -> normal Quit; no uncertain replay',acceptedGroups='REUSED exact accepted README+publication no repeated tests'))
print(j['stdout'])
