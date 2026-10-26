from common import *
import base64,signal
summary=json.load(open(O/'guest-summary.json'));dest=H/'evidence';dest.mkdir(exist_ok=True)
for e in summary['files']:
 out=dest/e['name']
 if out.exists() and out.stat().st_size==e['bytes'] and sha(out)==e['sha256']:continue
 with out.open('wb') as f:
  for offset in range(0,e['bytes'],3072):
   r=py('import pathlib,base64,json;f=open('+repr(str(H/'guest'/e['name']))+',"rb");f.seek('+str(offset)+');print(json.dumps(dict(data=base64.b64encode(f.read(3072)).decode())))')
   f.write(base64.b64decode(r['data']))
 assert out.stat().st_size==e['bytes'] and sha(out)==e['sha256']
 print('collected',e['name'],e['bytes'],flush=True)
# Preserve the exact startup receipt, including actual inherited Node limits.
r=py('import pathlib,json;print(json.dumps(json.loads(pathlib.Path('+repr(str(O/'startup.json'))+').read_text())))');save('startup-final.json',r)
# Process cleanup was performed by supervisor; verify task-specific guest process absence.
r=py('''import pathlib,json
matches=[]
for p in pathlib.Path('/proc').iterdir():
 if not p.name.isdigit():continue
 try:
  cmd=(p/'cmdline').read_bytes().split(b'\\0')
  if cmd and pathlib.Path(cmd[0].decode(errors='replace')).name=='node' and any(b'/tmp/thps2-installed-demo-gameplay-api-oct26/' in x for x in cmd):matches.append(int(p.name))
 except OSError:pass
print(json.dumps(dict(remainingGuestNode=matches,box='bx_xfbwmcty',leftRunning=True)))
''');assert not r['remainingGuestNode'];save('cleanup.json',r)
lease=json.load(open(O/'lock.json'));assert not (O/'continue-guest').exists();os.kill(lease['pid'],signal.SIGTERM)
save('lock-release.json',dict(holder=lease['pid'],released=time.time(),guestAttempts=1,automaticContinuationNeverCreated=True))
print('CLEANUP VERIFIED; shared box lock released',flush=True)
