#!/usr/bin/env python3
"""Offline evidence/source verification; does not launch any guest or build."""
import copy,gzip,hashlib,json,pathlib
E=pathlib.Path(__file__).resolve().parent; W=E.parents[2]
def read(p):return json.loads((E/p).read_text())
def event(p):return json.loads((E/p).read_text().splitlines()[0])
def validate(x):
 assert x['baseline']['dynamic']==0 and x['baseline']['oleaut']==x['baseline']['image']
 assert x['candidate']['dynamic']!=0 and x['candidate']['oleaut'] not in [0,x['candidate']['image']]
 assert x['baseline']['moduleSha256']!=x['candidate']['moduleSha256']
 assert x['source']['sha256']=='ce23f23ed7fcd525e2e4b4b1afa4d8eeacdb344fc7ca25903e3f78b45eaa9305'
 assert x['pins']['count']==373 and x['pins']['passAll']
 assert x['process']['processes']=='' and set(x['process']['portsConnectEx'].values())=={111}
 assert x['box']['state']=='idle' and x['box']['health']=='ok' and x['box']['stop'] is None
x=dict(baseline=event('raw/baseline-final.log'),candidate=event('raw/test-oleaut32-ordinals.log'),source=read('source-identity.json'),pins=read('raw/original-pins-final.json'),process=read('raw/process-state.json'),box=read('box-state.json')['sandbox'])
validate(x)
for row in read('collected-manifest.json'):
 p=E/row['path'];assert p.stat().st_size==row['bytes'] and hashlib.sha256(p.read_bytes()).hexdigest()==row['sha256'],p
for name in ['original-pins-before.json.gz','original-pins-after.json.gz']:
 rows=json.loads(gzip.decompress((E/'raw'/name).read_bytes()));assert len(rows)==373 and all(p['ok'] for p in rows)
assert '8 stdcall VariantInit(ptr)' in (E/'raw/oleaut32.spec').read_text()
rows=[r for r in read('source-manifest.json') if r['path'].startswith(('src/','lib/','tools/')) or r['path']=='test/test-oleaut32-ordinals.js']
assert len(rows)==1078
for r in rows:assert hashlib.sha256((W/r['path']).read_bytes()).hexdigest()==r['sha256'],r['path']
assert hashlib.sha256(''.join(r['path']+'\0'+r['sha256']+'\n' for r in sorted(rows,key=lambda r:r['path'])).encode()).hexdigest()==x['source']['sha256']
assert len(read('source-gates.json'))==12 and all(r['exit']==0 for r in read('source-gates.json'))
for p in ['raw/test-getprocaddress-sparse-name.log','raw/baseline-sparse-regression.log']:
 text=(E/p).read_text();assert 'real named export resolves' in text and '0 !== 2105344' in text
expected={'test-oleaut32-ordinals','test-directx-ordinals','test-directsound-ordinals','test-bstr-byte-length','test-bstr-reallocation'}
results=read('raw/validation-results.json')+read('raw/remaining-results.json');latest={r['label']:r['exit'] for r in results}
assert {k for k in expected if latest[k]==0}==expected and latest['test-getprocaddress-sparse-name']==1
negatives=0
for change in [lambda y:y['baseline'].__setitem__('dynamic',123),lambda y:y['candidate'].__setitem__('dynamic',0),lambda y:y['candidate'].__setitem__('oleaut',y['candidate']['image']),lambda y:y['source'].__setitem__('sha256','stale'),lambda y:y['pins'].__setitem__('passAll',False)]:
 bad=copy.deepcopy(x);change(bad)
 try:validate(bad)
 except AssertionError:negatives+=1
 else:raise AssertionError('false positive accepted')
print('PASS baseline/candidate actual dynamic difference; 1078 source files; 373 original pins; 5 candidate test files pass; identical baseline/candidate sparse failure; 12 focused checks; 5 evidence negatives rejected')
