"""Verify sealed acquisition receipts; does not download, restore or launch."""
import hashlib, json, pathlib
r = pathlib.Path(__file__).parent
seals = json.loads((r / 'SHA256SUMS.json').read_text())
for name, expected in seals.items():
    data = (r / name).read_bytes()
    assert len(data) == expected['bytes']
    assert hashlib.sha256(data).hexdigest() == expected['sha256']
a = json.loads((r / 'acquisition.json').read_text())
assert len(a['candidates']) == 4 and not a['recovered']
assert a['packageBytes'] == 21195858
assert a['packageSha256'] == '8aae38165e08b68bb63cfd21b8c28ed1d4d8f1bb400a0162588d5b86acdc827e'
assert a['ftp']['exitcode'] == 28 and a['ftp']['size_download'] == 0
assert a['terra']['http_code'] == 404 and a['terra']['size_download'] == 0
assert a['guestProbes'] == 0 and not a['restoreCompleted']
s = json.loads((r / 'runtime.json').read_text())
assert s['id'] == 'bx_wbedea9e' and s['state'] == 'idle' and s['stop'] is None
v = json.loads((r / 'recipes-receipt.json').read_text())
assert v['exitCode'] == 0
h = json.loads(v['stdout'])
assert h['predecessor.tgz'] == 'fea97ead7fe1b0f4f9bba0264d8073e5956857150dba2d97a2b1a4a62190f9cb'
assert h['recover-layout.py'] == 'f206c28269a76c834b0817c0258d1db4bacd3f9e568cf0da3ddb5073fadc7ae5'
assert h['restore.py'] == '05e22145aeb2a392500329aede7cca01a182ab452240be80ce47427f9bd06cad'
print(json.dumps(dict(pass_=True, seals=len(seals), candidates=4, recovered=False, restored=False, guestProbes=0, box=s['id'])))
