import pathlib,hashlib,json,subprocess
b=pathlib.Path('/tmp/renderer-side-polling-independent-accept-oct26');r=b/'repo';e=r/'docs/reviews/renderer-side-modifier-polling-repair-oct26/evidence';sha='54af699eee71ed0cebc95de71ffd9248e6814679'
h=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
manifest=json.loads((e/'hashes.json').read_text()); checks=[]
for name,v in manifest.items():
 p=e/name;assert p.stat().st_size==v['bytes'] and h(p)==v['sha256'],name;checks.append(name)
pins={}
for name in ['lib/renderer-input.js','lib/mem-utils.js','lib/region-map.generated.js','test/renderer-physical-modifiers.test.cjs','test/renderer-side-modifier-polling.test.cjs']:
 data=subprocess.check_output(['git','-C',str(r),'show',sha+':'+name]);assert data==(r/name).read_bytes();pins[name]={'sha256':h(r/name),'gitBlob':subprocess.check_output(['git','-C',str(r),'rev-parse',sha+':'+name]).decode().strip()}
for name in ['test/renderer-modifier-independent-accept.test.cjs']:
 assert h(r/name)==json.loads((e/'sourcepins.json').read_text())['unchanged'][name];pins[name]={'sha256':h(r/name),'origin':str(e/'renderer-modifier-independent-accept.test.cjs')}
for name in ['independent-baseline.tap','supplied-baseline.tap','independent-before.tap','side-before.tap','baseline-renderer-input.js','candidate-renderer-input.js','legacy-keyboard-message-lparam.cjs']:
 pins[name]={'sha256':h(e/name)}
assert pins['lib/renderer-input.js']['sha256']=='209e06f67ec38940ecab071890a296e665500e43a52b9bd96abd4ec90fccf304'
out={'candidate':sha,'parent':subprocess.check_output(['git','-C',str(r),'rev-parse',sha+'^']).decode().strip(),'pins':pins,'verifiedDonorPayloads':checks,'manifestSha256':h(e/'hashes.json'),'baselineFailuresReused':{'independent':'2 pass / 27 fail','supplied':'1 pass / 36 fail'},'preRepairFailuresReused':{'independent':'23 pass / 6 fail','side':'1 pass / 27 fail'}}
(b/'ops/sourcepins.json').write_text(json.dumps(out,indent=2)+'\n');print('Verified',len(checks),'donor payloads and exact candidate/test pins')
