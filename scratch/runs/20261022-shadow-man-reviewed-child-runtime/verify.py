"""Verify this no-guest admission handback, not installer functionality."""
import hashlib,json,pathlib
E=pathlib.Path(__file__).resolve().parent;W=E.parents[2]
def sha(b):return hashlib.sha256(b).hexdigest()
def admission(a):
 assert a['verdict']=='BLOCKED_FULL_VFS_DESCENDANT_BOUND' and not a['admitted'] and not a['run']
 assert a['guestAttempts']==0 and a['childrenGrandchildren']['observed']==0
 assert a['childrenGrandchildren']['upperBound'] is None
 assert a['sourceFiles']==23 and a['sourceBytes']==73339636
 assert a['usableBytes']==a['capBytes']-a['reserveBytes']==251658240
 assert a['childAndGrandchildInputOutputSourceOnly']==4*a['sourceBytes']==293358544
 assert a['childAndGrandchildInputOutputSourceOnly']>a['capBytes']==268435456
 assert a['phaseActualBytes']<a['phaseCapBytes']==2147483648 and a['freeBytes']>2982150144
spec=json.loads((E/'source-manifest.json').read_text())
assert len(spec['files'])==158 and sum(x['size'] for x in spec['files'])==7213816
for x in spec['files']:
 b=(W/x['path']).read_bytes();assert len(b)==x['size'] and sha(b)==x['sha256']
 assert hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()==x['blob']
b=(W/'build/wine-assembly.wasm').read_bytes();assert len(b)==1878971 and sha(b)=='f644bbb26edc077239dac17b8b2cfda482aafd9eb44af4c4776d4fe153d5a1a7'
a=json.loads((E/'raw/admission.json').read_text());admission(a)
for field,value in [('admitted',True),('guestAttempts',1),('capBytes',536870912)]:
 try:admission(dict(a,**{field:value}))
 except AssertionError:pass
 else:raise AssertionError('negative control accepted '+field)
source=json.loads((E/'raw/original-seals.json').read_text());assert len(source)==23 and sum(x['size'] for x in source)==73339636
assert next(x for x in source if x['path']=='Setup.exe')['sha256']=='5656e87da0641c9dcfcd0ee8949ce72b3fa6a7d0e8b1fd985a16f6bd6c34ce52'
support=json.loads((E/'raw/support-manifest.json').read_text());assert len(support)==6 and sum(x['size'] for x in support)==531602
box=json.loads((E/'box-info.json').read_text())['sandbox'];assert box['id']=='bx_495585da' and box['state']=='idle' and box['stop'] is None
handback=json.loads(json.loads((E/'handback-api.json').read_text())['stdout']);assert not handback['ownedGuestProcesses'] and handback['guestAttempts']==0
for p,s in json.loads((E/'protected-seals.json').read_text()).items():assert sha(pathlib.Path(p).read_bytes())==s,p
for x in json.loads((E/'evidence-seals.json').read_text()):
 b=(E/x['path']).read_bytes();assert len(b)==x['size'] and sha(b)==x['sha256'],x['path']
print('PASS: exact closure/module, original/support receipts, rejected aggregate admission, zero guest attempts, running-box handback, protected/evidence seals; 3 negative controls rejected')
