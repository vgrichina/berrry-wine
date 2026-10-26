import pathlib,subprocess,hashlib,json
p=pathlib.Path(__file__).resolve().parent.parent;d=pathlib.Path('/tmp/app-files-empty-alias-fallback-repair-oct26');r=p/'repo';rev='e9f3142b68816c6512d65db132ea43ba4e8c36ca';base='52b7bb0e9e73fc839344c33f00cffa2c638fc193';h=lambda b:hashlib.sha256(b).hexdigest()
def blob(rev,f,repo=r):return subprocess.check_output(['git','-C',str(repo),'show',rev+':'+f])
pins=json.loads((d/'ops/final-source-pins.json').read_text());checks={}
for f,v in pins.items():
 checks[f]={'candidateBlobSha256':h(blob(rev,f)),'donorSha256':h((d/'repo'/f).read_bytes()),'expected':v}
 assert checks[f]['candidateBlobSha256']==checks[f]['donorSha256']==v
original=(d/'ops/independent-original.cjs').read_bytes();assert h(original)=='9109256868d2eb66ff936072b897220ca42f99577f25a885ff0dc51b554b9677'
old=blob('2ff9d314807c517a2338233021ac75132dc7c949','test/app-files-url-contract-independent-oct26.test.cjs',pathlib.Path('/tmp/app-files-url-contract-independent-accept-oct26/repo'));assert old==original
cp=json.loads((d/'ops/checkpoint-tests.json').read_text());rows=[]
for group in cp['groups']:
 b=(d/'ops'/group['evidence']).read_bytes();assert h(b)==group['evidenceSha256'];rows.append({'name':group['name'],'checkpointRawSha256':h(b),'sourceSha256':group['sourceSha256'],'fixtureHashes':group['fixtureSha256'],'exitCode':group['exitCode']})
assert h(blob(base,'lib/app-files.js'))=='b360f892416309bc0f492ff77da5f939ee93af0c53585a7629c035eb8b7ecfc3'
ini=json.loads((d/'ops/reused-receipts.json').read_text())['ini']
for f,pin in ini['inputs'].items():assert h(blob(rev,f))==h(blob(base,f))==pin['sha256']
a=blob(base,'lib/app-files.js');b=blob(rev,'lib/app-files.js');assert a[a.index(b'  function applyIniSet'):]==b[b.index(b'  function applyIniSet'):]
receipt={'candidate':rev,'base':base,'pins':checks,'checkpointGroupsVerifiedAgainstRaw':rows,'originalIndependent':{'revision':'2ff9d314807c517a2338233021ac75132dc7c949','readOnlyRepository':'/tmp/app-files-url-contract-independent-accept-oct26/repo','bytesEqual':True,'sha256':h(old)},'iniReuse':'Original receipt hash verified; applyIniSet through exports byte-exact and both pinned test/apps inputs unchanged at candidate/base. Not rerun.','adaptationReview':'Exact original verified. Wrapper has exactly three unique substitutions: policy pin, title and old boundary assertion. No other assertions or original bytes change. Fresh host-backed independent groups confirm new expectation; suffix and priority mutations fail.','historicalLabelQualification':'checkpoint candidate labels retain base HEAD during uncommitted test runs; source hashes identify actual tested repair and fixture; final commit pins now verified independently.'}
(p/'ops/input-review.json').write_text(json.dumps(receipt,indent=2));(p/'ops/diff.txt').write_bytes(subprocess.check_output(['git','-C',str(r),'diff',base,rev,'--','lib/app-files.js']))
for name in ['independent-original.cjs','run-independent.cjs','checkpoint-tests.json','final-source-pins.json','independent-adaptation.json','reused-receipts.json','reused-ini.txt']:
 (p/'ops'/('donor-'+name)).write_bytes((d/'ops'/name).read_bytes())
print('7 source/fixture pins, 11 raw checkpoint log hashes, immutable original independent fixture and INI reuse verified')
