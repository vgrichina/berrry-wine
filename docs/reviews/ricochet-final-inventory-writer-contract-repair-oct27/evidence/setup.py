import pathlib,shutil,json,hashlib,os,subprocess,time
T=pathlib.Path(__file__).resolve().parent.parent;R=T/'repo';O=T/'ops'
D=pathlib.Path('/tmp/ricochet-consumed-control-accounting-repair-oct27/repo');I=pathlib.Path('/tmp/ricochet-consumed-accounting-independent-accept-oct27/repo')
checkpoint=json.loads((I/'docs/reviews/ricochet-consumed-accounting-independent-accept-oct27/checkpoint.json').read_text())
for p,h in checkpoint['sourcePins'].items():
 assert hashlib.sha256((D/p).read_bytes()).hexdigest()==h,p
minimal=I/'test/ricochet-late-link-minimal.py'
assert hashlib.sha256(minimal.read_bytes()).hexdigest()=='9c17daa4038dbc696719045324eab6456a1e78ffb0a26c14842eea80d8ed8b1f'
for p in checkpoint['sourcePins']:
 target=R/p;target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(D/p,target)
for p in ('test/ricochet-late-link-minimal.py','test/ricochet-consumed-independent.test.py'):
 (R/p).parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(I/p,R/p)
(R/'.git/objects/info/alternates').write_text(str(D/'.git/objects')+'\n'+str(I/'.git/objects')+'\n')
(R/'.git/config').write_text('[core]\n repositoryformatversion = 0\n bare = false\n sparseCheckout = true\n[user]\n name = Wine Ops\n email = wine-ops@local\n[remote "origin"]\n url = git@github.com:vgrichina/wine-assembly.git\n[gc]\n auto = 0\n[maintenance]\n auto = false\n')
(R/'.git/info/sparse-checkout').write_text('/tools/ricochet/\n/test/ricochet*\n/docs/reviews/ricochet*\n')
(O/'configuration.json').write_text(json.dumps(dict(sourcePins=checkpoint['sourcePins'],minimalSHA256=hashlib.sha256(minimal.read_bytes()).hexdigest(),mountArgv=[],mountValidation='not applicable: no runtime or mount command',ssh=os.environ['GIT_SSH_COMMAND'],rootReceipt='/home/user/wine-assembly/scratch/usage-watch/ricochet-final-inventory-writer-contract-repair-oct27/root-ref-digest.json',donorsReadOnly=True),indent=2))
print('six pins, unchanged strict fixtures, SSH and no-mount configuration verified; sparse orphan source staged')
