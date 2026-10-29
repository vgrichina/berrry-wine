from ops import *
admission('identity-and-pins')
d=json.loads(pathlib.Path('/home/user/wine-assembly/scratch/usage-watch/toyvm-real-cli-rss-limit-oct29-dispatch.json').read_text())
for args,want,name in [(['rev-parse','--show-toplevel'],str(REPO),'toplevel'),(['rev-parse','--absolute-git-dir'],str(REPO/'.git'),'gitdir'),(['rev-parse','HEAD'],d['candidate'],'head'),(['branch','--show-current'],'task/toyvm-real-cli-rss-limit-oct29','branch')]:
 rc,out,err=git(args,name=name);assert rc==0 and out.strip()==want,(name,rc,out,err)
assert REPO.resolve()==REPO
for rel,pin in d['sourcePins'].items():
 b=(REPO/rel).read_bytes();assert len(b)==pin['bytes'] and hashlib.sha256(b).hexdigest()==pin['sha256']
assert hashlib.sha256((OWN/'limit_contract.py').read_bytes()).hexdigest()==d['limitModulePin']['sha256']
stores=json.loads(pathlib.Path(d['objectStores']).read_text())['stores']
assert (REPO/'.git/objects/info/alternates').read_text().splitlines()==stores
record('pins',d)
record('mount-contract',dict(mountArgv=[],intendedGuestFiles=[],guestMountParserInvoked=False,reason='No guest mount arguments; production CLI argparse and synchronous FUSE only. Boat file staging separately enumerated.'))
print('identity/sourcepins/readonly alternates PASS')
