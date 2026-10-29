import json,hashlib,pathlib
d=json.loads(pathlib.Path('/home/user/wine-assembly/scratch/usage-watch/toyvm-readdir-repair-independent-accept-oct29-dispatch.json').read_text());r=pathlib.Path('/tmp/toyvm-readdir-repair-independent-accept-oct29/repo')
assert json.loads(pathlib.Path('/tmp/toyvm-readdir-repair-independent-accept-oct29/prelaunch-controls.json').read_text())["PASS"]
for n,p in d["sourcePins"].items():
 b=(r/n).read_bytes();assert {"bytes":len(b),"sha256":hashlib.sha256(b).hexdigest()}==p,n
print("PASS dispatch pins and literal absolute startup receipt")
