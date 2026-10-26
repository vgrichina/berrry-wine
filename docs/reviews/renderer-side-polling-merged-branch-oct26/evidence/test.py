from common import *
import re, resource as limits
resource('pretests')
pins=json.loads((OPS/'sourcepins.json').read_text())
assert git('write-tree').decode().strip()==pins['testedTree']
tests=[('independent29',['--test','test/renderer-modifier-independent-accept.test.cjs'],29,0),('supplied37',['--test','test/renderer-physical-modifiers.test.cjs'],37,0),('side28',['--test','test/renderer-side-modifier-polling.test.cjs'],28,0),('legacy',['../ops/run-legacy.cjs'],None,0),('challenges25',['--test','test/renderer-side-polling-independent-oct26.test.cjs'],25,0),('aggregate-known-limitation',['--test','../ops/aggregate-latch-repro.cjs'],0,3)]
checkpoint={'base':BASE,'candidate':CAND,'review':REVIEW,'testedTree':pins['testedTree'],'rendererSha256':pins['mergedRendererSha256'],'fixturePinsSha256':sha((OPS/'sourcepins.json').read_bytes()),'groups':[],'remaining':[x[0] for x in tests],'blockers':[],'baselineAndParentReceiptsReused':'review-reuse.json'}
previous=json.loads((OPS/'checkpoint.json').read_text()) if (OPS/'checkpoint.json').exists() else None
def cap(): limits.setrlimit(limits.RLIMIT_FSIZE,(131072,131072))
for name,args,passing,failing in tests:
 cmd=['timeout','25s','node','--max-old-space-size=16',*args]
 log=OPS/(name+'.log'); err=OPS/(name+'.stderr')
 retained=next((g for g in previous['groups'] if g['name']==name),None) if previous else None
 if retained:
  assert retained['testedTree']==pins['testedTree'] and retained['logSha256']==sha(log.read_bytes())
  returncode=retained['exitCode']
 else:
  with log.open('wb') as out,err.open('wb') as e:
   result=subprocess.run(cmd,cwd=REPO,env=ENV,stdout=out,stderr=e,timeout=30,preexec_fn=cap)
  returncode=result.returncode
 b=log.read_bytes(); stderr=err.read_bytes(); assert len(b)<=131072 and len(stderr)<=131072
 passed=re.findall(r'^(?:#|ℹ) pass (\d+)',b.decode(),re.M); failed=re.findall(r'^(?:#|ℹ) fail (\d+)',b.decode(),re.M)
 good=returncode==(1 if failing else 0) and not stderr
 if passing is not None: good=good and passed==[str(passing)] and failed==[str(failing)]
 else: good=good and b'PASS Win32 keyboard messages preserve ordering' in b
 testpath=REPO/args[-1]; testhash=sha(testpath.read_bytes())
 row={'name':name,'command':cmd,'cwd':str(REPO),'exitCode':returncode,'expectedFailingCharacterization':bool(failing),'pass':int(passed[0]) if passed else None,'fail':int(failed[0]) if failed else None,'accepted':good,'testSha256':testhash,'log':log.name,'logSha256':sha(b),'stderrSha256':sha(stderr),'testedTree':pins['testedTree'],'rendererSha256':sha((REPO/'lib/renderer-input.js').read_bytes()),'allFixtureAndDependencyPins':pins['dependenciesAndFixtures'],'at':time.time(),'reusedRetainedExecution':bool(retained)}
 checkpoint['groups'].append(row); checkpoint['remaining'].remove(name)
 if not good: checkpoint['blockers'].append('unexpected result '+name)
 write(OPS/'checkpoint.json',checkpoint)
 print(name,'PASS expected result' if good else 'UNEXPECTED',returncode,passed,failed)
 assert good,name
assert git('write-tree').decode().strip()==pins['testedTree']
checkpoint['remaining']=['task branch publication','coordinator main integration decision','separately authorized runtime validation']
write(OPS/'checkpoint.json',checkpoint)
