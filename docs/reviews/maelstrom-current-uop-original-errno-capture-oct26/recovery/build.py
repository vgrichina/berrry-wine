from common import *
import tarfile,base64,zlib
assert time.time()+360<1793008800
j=remoteInventory();save('remote-initial.json',j);assert j['uid']==1000 and j['memAvailable']>=2684354560 and j['free']-67108864>=2982150144
# Transfer a compressed phase archive, independently hash-readback then extract.
archive=O/'source-phase.tar.gz'
if archive.exists():archive.unlink()
files=[O/'sources.json.gz',O/'current-manifest.json',O/'supervise.py',*(O/'anchors').glob('*'),*(H/'canonical').rglob('*.js'),*(R/'tools').glob('*.cjs')]
account('pre-build-transfer',remoteProjection=12582912)
receipts=[]
for p in files:
 receipts.append(put(p,p));save('build-transfer.json',receipts)
j=remoteInventory();save('remote-precompile.json',j);account('precompile',j['allocated'],12582912)
for mode in ['startup','compile']:
 if mode=='compile':
  j=remoteInventory();save('remote-immediate-precompile.json',j);account('immediate-precompile',j['allocated'],12582912)
 j=remote('python3 '+shlex.quote(str(O/'supervise.py'))+' '+mode,timeout=330 if mode=='compile' else 30,detach=mode=='compile');save(mode+'-api.json',j)
 if mode=='startup':
  r=json.loads(j['stdout']);assert r['exit']==0 and not r['remainingGroup']
print(json.dumps(dict(compileDetached=json.load(open(O/'compile-api.json')))))
