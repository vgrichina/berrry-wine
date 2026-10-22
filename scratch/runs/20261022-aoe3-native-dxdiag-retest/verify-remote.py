from pathlib import Path
import hashlib,json
E=Path('/home/user/aoe3-native-dxdiag-retest-oct22')
seals=json.loads((E/'remote-seals.json').read_text())
for n,r in seals.items():
 p=E/n;b=p.read_bytes();assert len(b)==r['bytes'] and hashlib.sha256(b).hexdigest()==r['sha256'],n
d=json.loads((E/'guest/excerpts.json').read_text());raw=(E/'guest/output.log').read_bytes()
for r in d['samples']:
 b=raw[r['offset']:r['offset']+r['bytes']];assert b.decode()==r['text'] and hashlib.sha256(b).hexdigest()==r['sha256']
for b in [raw+b'changed',raw[:-1]]:assert hashlib.sha256(b).hexdigest()!=d['raw']['sha256']
P=Path('/home/user/aoe3-canonical-c7fae5ac-evidence');R=Path('/home/user/aoe3-original-oct22')
assert (E/'overlay/run.js').read_bytes()==(P/'guest/original-run-relocated.js').read_bytes()
base=json.loads((R/'installed-audit/launch-registry.json').read_text());overlay=json.loads((E/'overlay/registry.json').read_text());key='reg:HKCR\\CLSID\\{A65B8071-3BFE-4213-9A5B-491DA4461CA7}\\InprocServer32'
assert {k:v for k,v in overlay.items() if k!=key}==base
assert len(overlay)==len(base)+1 and json.loads(overlay[key])==dict(values={'':dict(type=1,data='c:\\windows\\system\\dxdiagn.dll')})
print('PASS complete remote seals, raw/exact byte-offset excerpts, runner byte identity, registry exactly one real CLSID key, appended/truncated raw controls REJECT')
