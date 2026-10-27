from run import *
assert gate() is None
objects=[];queue=[ROOT/'.git/objects',pathlib.Path('/tmp/penguin-accepted-explicit-budget-main-integrate-oct27/repo/.git/objects')]
while queue:
 p=queue.pop().resolve()
 if str(p) in objects:continue
 objects.append(str(p));a=p/'info/alternates'
 if a.exists():queue.extend(pathlib.Path(x) if x.startswith('/') else p/x for x in a.read_text().splitlines())
(R/'.git/objects/info/alternates').write_text('\n'.join(objects)+'\n')
(R/'.git/config').write_text('[core]\n repositoryformatversion = 0\n bare = false\n sparseCheckout = true\n sparseCheckoutCone = false\n[remote "origin"]\n url = git@github.com:vgrichina/wine-assembly.git\n fetch = +refs/heads/main:refs/remotes/origin/main\n[gc]\n auto = 0\n[user]\n name = Wine Ops\n email = wine-ops@users.noreply.github.com\n')
(R/'.git/info').mkdir(exist_ok=True)
(R/'.git/info/sparse-checkout').write_text('/*\n!/*/\n/src/\n/lib/\n/tools/\n/vendor/\n/test/\n!/test/binaries/\n')
dump('setup.json',dict(objects=objects,ssh=SSH,sshSHA256=hashlib.sha256(SSH.encode()).hexdigest(),rootReceipt=str(ROOT/'scratch/usage-watch/gta2-ordinary-driving-gameplay-oct27/root-ref-digest.json'),watcherSession=83545))
print('setup complete')
