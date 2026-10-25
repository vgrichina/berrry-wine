from control import *
admission('tests')
m=json.loads((OUT/'merged-tree.json').read_text());assert git('write-tree').decode().strip()==m['tree'];identities()
E['ACCEPT_REPO']=str(R);E.pop('ACCEPT_SOURCE',None)
d='docs/reviews/save-sync-upload-independent-accept-oct25/'
results={}
for label,argv,expected in [
 ('supplied',['node','--test','test/test-save-sync-owned-upload.js'],15),
 ('independent',['node',d+'independent.js'],13),
 ('existing-upload-validation',['node','test/test-save-sync-upload-validation.js'],None),
 ('offline-url-deadline',['node',d+'offline.js'],47),
 ('overlay-existing',['node','test/test-vfs-overlay.js'],20),
 ('renderer-focused',['node','--test','test/test-d3d9-immutable-rgba-snapshot.js'],6),
 ('syntax-save-sync',['node','--check','lib/save-sync.js'],None),
 ('syntax-supplied',['node','--check','test/test-save-sync-owned-upload.js'],None),
 ('syntax-renderer',['node','--check','lib/d3d9-host.js'],None),
 ('syntax-overlay',['node','--check','lib/overlay-store.js'],None)]:
 rc,a,b=run(argv,cwd=R,env=E,label=label);text=(a+b).decode();assert rc==0,(label,text[-1800:])
 if expected:
  import re
  if label=='offline-url-deadline':assert 'checks: 47' in text
  elif label=='overlay-existing':assert 'All 20 overlay cases pass' in text
  else:assert re.search(r'(?:#|ℹ) pass '+str(expected)+r'\b',text) and re.search(r'(?:#|ℹ) fail 0\b',text),text[-1000:]
 results[label]=dict(argv=argv,exitCode=rc,expectedPass=expected,outputSHA256=hashlib.sha256(a+b).hexdigest())
 print(label,'PASS',expected)
# Controls unchanged: original review seals and exact immutable test/source blobs bind reuse.
for p in ['lib/save-sync.js','test/test-save-sync-owned-upload.js',d+'independent.js',d+'offline.js']:
 assert git('rev-parse',':'+p)==git('rev-parse',REVIEW+':'+p)
controls=json.loads((DONOR.parent/'ops/tests.json').read_text())
controls=[r for r in controls if r['label'].startswith('reject-')];assert len(controls)==4 and all(r['exitCode']==1 for r in controls)
save('tests',dict(tree=m['tree'],results=results,allPass=True,reusedRejectingControls=controls,controlReuseReason='Exact candidate and independent fixture bytes unchanged; integration touches no dependencies used by controls; accepted external seals verified. No duplicate semantic review.'))
