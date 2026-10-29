import json,hashlib,pathlib
D=pathlib.Path('/home/user/wine-assembly/scratch/usage-watch/toyvm-unlink-rmdir-absolute-checkpoint-accept-oct29-dispatch.json')
R=pathlib.Path('/tmp/toyvm-unlink-rmdir-absolute-checkpoint-accept-oct29/repo')
S=pathlib.Path('/tmp/toyvm-unlink-rmdir-absolute-checkpoint-accept-oct29/prelaunch-controls.json')
d=json.loads(D.read_text());assert json.loads(S.read_text())['PASS']
for name,want in d['sourcePins'].items():
 data=(R/name).read_bytes();assert {'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()}==want,name
print('PASS exact dispatch five pins and absolute startup receipt; no behavioral tests')
