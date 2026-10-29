"""Validate the compact receipt and raw evidence without recompilation."""
import hashlib,json,pathlib
R=pathlib.Path(__file__).resolve().parent
candidate='898d2ec8d9db7d4f9236d9eb705adfd431ea19c9'
r=json.loads((R/'result.json').read_text());m=json.loads((R/'packet-manifest.json').read_text())
assert r['candidate']==m['candidate']==candidate
assert r['exit']==0 and r['denial'] is None and r['validation']['exit']==0
assert r['argv'][1:]==['--max-old-space-size=6144','tools/build-compile-wat.js']
assert set(r['artifacts'])=={'wine-assembly.wasm','wine-assembly.compat.wasm'}
for label in ['startup','compile','validation']:
 rec=json.loads((R/(label+'.json')).read_text());assert rec['exit']==0 and rec['denial'] is None
 assert rec['peakProcessTreeRSS']<=8*1024**3 and rec['elapsedSeconds']<=900
 for ext,pin in rec['logs'].items():
  b=(R/(label+ext)).read_bytes();assert len(b)==pin['bytes'] and hashlib.sha256(b).hexdigest()==pin['sha256']
s=json.loads((R/'startup.stdout').read_text());assert s['version']=='v24.22.1' and s['execPath']==r['argv'][0]
assert 'Max data size             unlimited' in s['limits'] and 'Max address space         unlimited' in s['limits']
values=[json.loads(x) for x in (R/'validation.stdout').read_text().splitlines()]
assert len(values)==2 and all(x['valid'] and x['hash']==x['mirror']=='9a3bc9149d58209c' for x in values)
state=json.loads((R/'boat-state.json').read_text())['sandbox']
assert state['id']=='bx_8tpkm3z3' and state['state']=='stopped' and state['snapshotAvailable']
assert state['stop']['status']=='completed'
for x,pin in json.loads((R/'evidence-manifest.json').read_text()).items():
 b=(R/x).read_bytes();assert len(b)==pin['bytes'] and hashlib.sha256(b).hexdigest()==pin['sha256'],x
print('PASS: source-pinned receipt, raw hashes, startup contract, two validations, layout mirrors and snapshot-stopped lifecycle')
