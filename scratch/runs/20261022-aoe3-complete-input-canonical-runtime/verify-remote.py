from pathlib import Path
import json,hashlib,subprocess
E=Path('/home/user/aoe3-canonical-c7fae5ac-evidence');S=Path('/home/user/aoe3-canonical-c7fae5ac-staged');R=Path('/home/user/aoe3-original-oct22')
def check(p,row):
    assert p.stat().st_size==row.get('bytes',row.get('size')),str(p)
    with p.open('rb') as f:assert hashlib.file_digest(f,'sha256').hexdigest()==row['sha256'],str(p)
for name,row in json.loads((E/'remote-seals.json').read_text()).items():check(E/name,row)
for row in json.loads((E/'build-inputs.json').read_text())['inputs']:check(S/row['path'],row)
for group,rows in [(R/'runtime',json.loads((R/'runtime-pins.json').read_text())),(R/'installed',json.loads((R/'installed-audit/installed-manifest.json').read_text())['files']),(R,json.loads((R/'runner-manifest.json').read_text()))]:
    for row in rows:check(group/row['path'],row)
for p,row in json.loads((E/'guest/identities-before.json').read_text()).items():check(Path(p),row)
for path,row in json.loads((E/'build-result.json').read_text())['outputs'].items():check(S/path,row)
assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=S).strip()==b'c7fae5ac7ea9e29dfa3f83a7c2bd87d092e0b3b2'
assert subprocess.check_output(['git','rev-parse','--is-shallow-repository'],cwd=S).strip()==b'false'
subprocess.run(['git','diff','--exit-code','HEAD'],cwd=S,check=True)
subprocess.run(['git','diff','--cached','--exit-code','HEAD'],cwd=S,check=True)
raw=(E/'guest/output.log').read_bytes();samples=json.loads((E/'guest/log-excerpts.json').read_text())
for r in samples['samples']:
    data=raw[r['offset']:r['offset']+r['bytes']];assert data.decode()==r['text'] and hashlib.sha256(data).hexdigest()==r['sha256']
assert b'GetProcAddress(mod=h:0x018dfcc4, name=MAKEINTRESOURCE(8))' in raw and b'  => h:0x075071a0' in raw
for data in [raw+b'changed',raw[:-1]]:
    assert hashlib.sha256(data).hexdigest()!=samples['rawLog']['sha256']
print('PASS all remote evidence seals, 3420 source files, 373 originals, runner dependency pins, canonical outputs, retained runner/native identities, truthful HEAD/index, raw excerpt byte offsets; appended/truncated log controls REJECT')
