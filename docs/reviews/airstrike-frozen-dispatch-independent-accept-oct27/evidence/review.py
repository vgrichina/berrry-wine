from run import *
p=json.loads((H/'pins.json').read_text())
for path,sha in p['pins'].items():assert hashlib.sha256((R/path).read_bytes()).hexdigest()==sha
Q=R/'docs/reviews/airstrike-frozen-dispatch-independent-accept-oct27'
m=json.loads((Q/'manifest.json').read_text())
for path,sha in m.items():assert hashlib.sha256((Q/path).read_bytes()).hexdigest()==sha,path
assert 'manifest.json' not in m
result=json.loads((H/'result.json').read_text())
for path,sha in result['independentPins'].items():assert hashlib.sha256((R/path).read_bytes()).hexdigest()==sha
assert gate() is None
print('PASS',len(m),'evidence hashes, four independent test/fixture pins and six unchanged candidate pins; physical/disk/task admission PASS')
