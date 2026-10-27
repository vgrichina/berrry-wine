from fetch import *
code=r'''import pathlib,tarfile,json,hashlib,os,shutil,time
h=pathlib.Path('/tmp/enigma-retained-canonical-native-msg-qualification-oct26');o=h/'ops'
labels=['tail','compat','tail-hooks-thread','compat-hooks-thread','tail-hardware','compat-hardware','tail-unrelated','compat-unrelated']
groups={}
for n in labels:
 j=json.load(open(o/(n+'-result.json')));assert not j.get('blocked');groups[n]=dict(cases=len(j['cases']),pass_=all(x['pass'] for x in j['cases']),module=j['sha256'])
assert sum(x['cases'] for x in groups.values())==120
active=[]
for p in pathlib.Path('/proc').glob('[0-9]*'):
 try:
  a=p.joinpath('cmdline').read_bytes().split(b'\0')
  if a and b'node' in a[0] and any(str(h).encode() in x for x in a[1:]):active.append(int(p.name))
 except OSError:pass
assert not active
j=dict(candidate='425755ee5ee9be0734c7aca187521100f5487674',groups=groups,totalPairedCases=120,perBackend=60,scope='synthetic native canonical decoded execution',productionRunnerQualified=False,originalGame=False,ownedNodeChildren=active,box='bx_xw8d895f',state='RUNNING coordinator owned',expiry='2026-10-27T00:37:17.515Z',at=time.time(),memAvailable=int(pathlib.Path('/proc/meminfo').read_text().split('MemAvailable:')[1].split()[0])*1024,free=shutil.disk_usage(h).free,remaining=['exact production-runner/native-game initializer wiring','step ACK all requested batches then frozen zero credits before input','original-game behavior'])
(o/'final-checkpoint.json').write_text(json.dumps(j,indent=2))
with tarfile.open(h/'evidence.tar.gz','w:gz') as t:
 for p in sorted(o.iterdir()):
  if p.is_file():t.add(p,arcname='ops/'+p.name)
 for n in ['harness-hooks.js','harness-hooks-thread.js','harness-extra.js','harness-hardware.js','harness-unrelated.js','remote-hooks-v2.py','remote-hooks-thread.py','remote-extra.py','remote-hardware.py','remote-unrelated.py']:
  t.add(h/'transport'/n,arcname='versions/'+n)
print(json.dumps(j))
'''
j=api(code,'final-collect');save('remote-final-summary.json',json.loads(j['stdout']))
print(fetch(REMOTE+'/evidence.tar.gz',O/'remote-evidence.tar.gz','evidence'))
import tarfile
with tarfile.open(O/'remote-evidence.tar.gz') as t:t.extractall(O/'retained',filter='data')
print('retained evidence verified')
