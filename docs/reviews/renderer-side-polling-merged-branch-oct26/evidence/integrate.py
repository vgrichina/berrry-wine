from common import *
resource('preintegration')
for name in ['physical','side']:
 git('apply','--check',str(OPS/(name+'.patch')))
 git('apply',str(OPS/(name+'.patch')))
assert (REPO/'lib/renderer-input.js').read_bytes()==git('show',CAND+':lib/renderer-input.js')
pins=json.loads((REVIEWDIR/'evidence/sourcepins.json').read_text())['pins']
paths=['test/renderer-modifier-independent-accept.test.cjs','test/renderer-physical-modifiers.test.cjs','test/renderer-side-modifier-polling.test.cjs','test/renderer-side-polling-independent-oct26.test.cjs']
fixtures={}
for p in paths:
 if p.endswith('/renderer-modifier-independent-accept.test.cjs'):
  origin=DONORS[2]/'docs/reviews/renderer-side-modifier-polling-repair-oct26/evidence/renderer-modifier-independent-accept.test.cjs'
  b=origin.read_bytes(); assert git('show',REVIEW+':'+str(origin.relative_to(DONORS[2])))==b
  revision=REVIEW; sourcePath=str(origin.relative_to(DONORS[2]))
 else:
  revision=REVIEW if 'independent-oct26' in p else CAND
  sourcePath=p; b=git('show',revision+':'+p)
 assert sha(b)==pins[p]['sha256'],p
 target=REPO/p; target.parent.mkdir(parents=True,exist_ok=True); target.write_bytes(b)
 fixtures[p]={'revision':revision,'path':sourcePath,'sha256':sha(b),'blob':git('hash-object',str(target)).decode().strip()}
for p in ['lib/mem-utils.js','lib/region-map.generated.js']:
 assert sha((REPO/p).read_bytes())==pins[p]['sha256'],p
 fixtures[p]={'revision':BASE,'sha256':sha((REPO/p).read_bytes()),'blob':git('rev-parse',BASE+':'+p).decode().strip(),'acceptedDependencyPinUnchanged':True}
for n in ['legacy-keyboard-message-lparam.cjs','run-legacy.cjs','aggregate-latch-repro.cjs']:
 b=(REVIEWDIR/'evidence'/n).read_bytes(); (OPS/n).write_bytes(b)
 fixtures['ops/'+n]={'revision':REVIEW,'path':str((REVIEWDIR/'evidence'/n).relative_to(DONORS[2])),'sha256':sha(b)}
# Index starts at the entire base tree. Explicitly stage owned paths only.
git('add','--sparse','--','lib/renderer-input.js',*paths)
tree=git('write-tree').decode().strip()
changed=git('diff','--cached','--name-only',BASE).decode().splitlines()
assert set(changed)==set(['lib/renderer-input.js',*paths]),changed
write(OPS/'sourcepins.json',{'base':BASE,'candidate':CAND,'review':REVIEW,'testedTree':tree,'mergedRendererSha256':sha((REPO/'lib/renderer-input.js').read_bytes()),'mergedRendererBlob':git('hash-object','lib/renderer-input.js').decode().strip(),'mergedRendererExactlyCandidate':True,'dependenciesAndFixtures':fixtures,'changedPaths':changed})
print('tested tree',tree,'changed paths',changed)
