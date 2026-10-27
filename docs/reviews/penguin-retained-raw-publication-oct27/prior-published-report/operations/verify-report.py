from common import *
import tarfile
E=H.parent/'repo/docs/reviews/penguin-published-projectile-gameplay-oct27';manifest=json.loads((E/'manifest.json').read_text())
for n,x in manifest.items():
 p=E/n;assert p.stat().st_size==x['bytes'] and sha(p.read_bytes())==x['sha256'],n
a=json.loads((E/'api-manifest.json').read_text());seen=set()
with tarfile.open(E/'original-api-responses.tar.gz','r:gz') as archive:
 for info in archive:
  assert info.isfile() and info.name in a and info.name not in seen
  b=archive.extractfile(info).read();assert len(b)==a[info.name]['bytes'] and sha(b)==a[info.name]['sha256'];seen.add(info.name)
assert seen==set(a)
r=json.loads((E/'receipt.json').read_text());assert r['status']=='BLOCKED_CAPTURE_RESOURCE_GUARD_NO_VISUAL_ACCEPTANCE'
assert not r['visual']['inspected'] and r['inputReceipt']['keydownDispatched']==40032
assert (E/r['blocker']['publicationOnlyCapacityChange']).exists()
q=dict(status='PASS_BLOCKED_REPORT_INTEGRITY',payloadFiles=len(manifest),apiStreams=len(a),apiBytes=sum(x['bytes'] for x in a.values()),manifestSHA256=sha((E/'manifest.json').read_bytes()),noVisualAcceptance=True)
save('report-integrity.json',q);print(json.dumps(q))
