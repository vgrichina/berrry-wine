import pathlib,json,hashlib,copy,shutil
E=pathlib.Path(__file__).resolve().parent
for row in json.loads((E/'raw/manifest.json').read_text()):
 p=E/'raw'/row['path'];assert p.stat().st_size==row['size'];assert hashlib.sha256(p.read_bytes()).hexdigest()==row['sha256']
a=json.loads((E/'raw/analysis.json').read_text())
def check(a):
 assert a['guestAttempts']==a['childAttempts']==a['retries']==0
 assert a['preserved'] and a['originalSeals']==390 and a['previousSeals']==102
 assert a['mediaBytes']==73339636 and a['extractedPayloadBytes']==656970
 assert a['defaultTwoSnapshotLowerBound']==2*(a['mediaBytes']+a['extractedPayloadBytes'])
 assert a['defaultTwoSnapshotLowerBound']>a['cap'] and a['noMediaCopyViolationAtFirstInputSnapshot']
 assert a['fixture']['passAll'] and a['fixture']['unreadLazySourceExported']
 assert not a['cleanup']['guestProcesses'] and all(a['cleanup']['portsClosed'].values())
 assert a['module']['sha256']=='f644bbb26edc077239dac17b8b2cfda482aafd9eb44af4c4776d4fe153d5a1a7'
check(a)
for key,value in [('guestAttempts',1),('preserved',False),('noMediaCopyViolationAtFirstInputSnapshot',False),('cap',200000000)]:
 b=copy.deepcopy(a);b[key]=value
 try:check(b)
 except AssertionError:continue
 raise AssertionError('reject control passed '+key)
assert shutil.disk_usage(E).free>=2982150144
print('PASS: raw manifests, zero guest attempts, offline transport blocker, 390+102 preservation receipts, cleanup and four rejecting controls')
