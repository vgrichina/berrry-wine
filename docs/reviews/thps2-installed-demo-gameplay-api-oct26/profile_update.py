from common import *
import signal
assert (O/'stage-ready').exists() and not (O/'continue-guest').exists()
lease=json.load(open(O/'lock.json'));assert pathlib.Path('/proc/'+str(lease['pid'])+'/cmdline').read_bytes().split(b'\0')[:2]==[b'python3',str(O/'stage.py').encode()]
old=json.load(open(O/'transfer-manifest.json'));helper=pathlib.Path('/tmp/enigma-single-frame-independent-closeout-oct24/repo/tools/lossless-capture-png.cjs')
assert sha(helper)=='9dae92170fbf4ef5acf0a2b0be43b93d3b3a7c8ec86f227df708d3b65d67cb4b'
updated=[dict(path=str(helper),target='ops/lossless-capture-png.cjs',bytes=helper.stat().st_size,sha256=sha(helper),kind='file')]
for name in ['capture.cjs','remote_check.py','guest_launch.py']:
 p=O/name;updated.append(dict(path=str(p),target='ops/'+name,bytes=p.stat().st_size,sha256=sha(p),kind='file'))
save('profile-update.json',dict(profile='single-frame',helperSHA256=sha(helper),heldLease=lease,replacesDefaultProfileBeforeAnyGuest=True,attempts=0,fsize=2097152,combinedOutput=2097152,maxPNG=1294816,intermediateMetadataOnly=True,files=updated))
for e in updated:
 # Truncate old owned helper before bounded API write, then verify exact identity.
 api('import pathlib;p=pathlib.Path('+repr(str(H/e['target']))+');p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(b"");print("{}")')
 send(pathlib.Path(e['path']).read_bytes(),e['target'])
r=py('import pathlib,hashlib,json;H=pathlib.Path('+repr(str(H))+');m='+repr(updated)+';print(json.dumps([dict(target=e["target"],sha256=hashlib.sha256((H/e["target"]).read_bytes()).hexdigest(),bytes=(H/e["target"]).stat().st_size) for e in m]))')
assert all(a['sha256']==b['sha256'] and a['bytes']==b['bytes'] for a,b in zip(r,updated));save('profile-remote-hashes.json',r)
save('startup-profile-api.json',api('import subprocess;subprocess.run(["python3",'+repr(str(O/'remote_check.py'))+'],check=True)',60))
print('PASS changed accepted profile/startup configuration')
