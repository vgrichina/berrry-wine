#!/usr/bin/env python3
"""Only the two authentic bootstrap members; exact ISO ranges, no retries."""
import hashlib, json, pathlib, urllib.request
ROOT = pathlib.Path(__file__).resolve().parents[3]
DONOR = pathlib.Path('/home/user/wine-assembly-shadow-man-original-recover-runtime-oct22/scratch/runs/20261022-shadow-man-original-recover-runtime/raw/recovery/extracted-members.json')
listing = json.loads(pathlib.Path('/home/user/wine-assembly-shadow-man-original-recover-runtime-oct22/scratch/runs/20261022-shadow-man-original-source/listing-Demos-Shadowman.json').read_text())
hashes = {m['name']: m['sha256'] for m in json.loads(DONOR.read_text())['extractedMembers']}
out = ROOT / 'local/source/Demos/Shadowman'
out.mkdir(parents=True, exist_ok=True)
receipts = []
for name in ['_inst32i.ex_', '_Setup.dll']:
    m = next(m for m in listing['members'] if m['name'] == name)
    assert m['bytes'] < 1048576
    req = urllib.request.Request(listing['url'], headers={'Range': f"bytes={m['offset']}-{m['offset']+m['bytes']-1}", 'Accept-Encoding': 'identity'})
    with urllib.request.urlopen(req, timeout=45) as response:
        expected = f"bytes {m['offset']}-{m['offset']+m['bytes']-1}/674328576"
        assert response.status == 206 and response.headers['Content-Range'] == expected
        data = response.read(m['bytes']+1)
        assert len(data) == m['bytes'] and hashlib.sha256(data).hexdigest() == hashes[name]
        assert not (out/name).exists()
        (out/name).write_bytes(data)
        receipts.append({'path': 'Demos/Shadowman/'+name, 'bytes': len(data), 'sha256': hashes[name], 'contentRange': expected, 'status': 206, 'url': listing['url']})
assert sum(m['bytes'] for m in receipts) <= 4194304
pathlib.Path(__file__).with_name('acquisition.json').write_text(json.dumps(receipts, indent=2)+'\n')
print(json.dumps(receipts))
