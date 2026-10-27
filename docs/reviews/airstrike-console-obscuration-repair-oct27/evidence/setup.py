import pathlib,json,hashlib,tarfile
import run as c
D=pathlib.Path('/tmp/airstrike-accepted-frozen-dispatch-main-integrate-oct27/repo')
A=pathlib.Path('/tmp/airstrike-accepted-dispatch-quit-oct27/ops')
config=(D/'.git/config').read_text();url=config.split('[remote "origin"]')[1].split('url')[1].split('=',1)[1].splitlines()[0].strip()
(c.R/'.git/config').write_text('[core]\n repositoryformatversion = 0\n bare = false\n sparseCheckout = true\n[remote "origin"]\n url = '+url+'\n[user]\n name = Wine Ops\n email = wine-ops@localhost\n')
(c.R/'.git/HEAD').write_text('ref: refs/heads/task/airstrike-console-obscuration-repair-oct27\n')
(c.R/'.git/objects/info/alternates').write_text(str(D/'.git/objects')+'\n')
(c.R/'.git/info/sparse-checkout').write_text('/tools/airstrike-menu-controller.py\n/tools/airstrike-observation-bridge.py\n/test/test-airstrike*\n/docs/reviews/airstrike-console-obscuration-repair-oct27/\n')
pins={}
for name in ['tools/airstrike-menu-controller.py','tools/airstrike-observation-bridge.py','test/test-airstrike-menu-controller.py','test/test-airstrike-observation-bridge.py','test/test-airstrike-frozen-dispatch.py']:
 b=(D/name).read_bytes();p=c.R/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(b);pins[name]=hashlib.sha256(b).hexdigest()
with tarfile.open(A/'git-sources.tar') as t:b=t.extractfile('test/run.js').read()
assert hashlib.sha256(b).hexdigest()=='4d7b9587676db38fcf3314807acb2b2a42b5f09d2c98fcf3dccb8a6cde9e1809'
(c.H/'production-run.js').write_bytes(b)
img=A/'retained/9b55685e506a4124abd456510ebaf254.png';assert hashlib.sha256(img.read_bytes()).hexdigest()=='a0d213dfefdda68876792c1819711dd3c470dfece91b0d9280f6462ce01aee61'
c.dump('input-pins.json',dict(pins=pins,runnerSHA256=hashlib.sha256(b).hexdigest(),runnerRevision='b41a7c5f4b752d1f0bdab1141a11d4fed4dc6f9a',acceptedMain='c220ffccd69932bb2e5f05189f4845581de0d723',image=str(img),ssh=c.SSH,mountValidation='No guest invocation or filename-bearing mounts in source/test task; retained unchanged prior configuration only.'))
print('Pinned production runner extracted, five source/test files copied; isolated sparse orphan report repo, immutable read-only alternates.')
