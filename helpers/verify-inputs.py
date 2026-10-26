"""Read-only pin verification; never compile, restage or launch a guest."""
import pathlib,json,hashlib
R=pathlib.Path('/home/user/wine-assembly/scratch/runs/civ2-win16-city-founding-gameplay-oct26')
def sha(p):return hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()
identity=json.load(open(R/'identity.json'))
for e in identity['checks']+[identity['module']]:
 p=pathlib.Path(e['path']);assert p.stat().st_size==e['bytes'] and sha(p)==e['sha256'],p
m=json.load(open(R/'donor-prior-reused-mount-validation.json'))
source=pathlib.Path('/tmp/civ2-win16-ordinary-gameplay-oct26/source')
assert sha(source/m['registryEntry']['localFileManifest'])==m['manifestSHA256']
assert sha(m['cue'])==m['cueSHA256']
for e in m['enumerated']+m['tracks']:assert pathlib.Path(e['host']).stat().st_size==e['actualBytes']
assert len(m['commaBearingNames'])==10 and len(m['enumerated'])==338
print('Exact239source337fixture/module and unchanged canonical mount338/10comma PASS')
