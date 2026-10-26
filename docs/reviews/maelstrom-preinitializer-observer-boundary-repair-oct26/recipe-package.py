from common import *
import difflib
sourcePaths=['tools/maelstrom-initialized-runner-arm.cjs','tools/maelstrom-loader-boundary.cjs','test/test-maelstrom-initialized-runner-arm.cjs','test/test-maelstrom-preinitializer-boundary.cjs','test/test-maelstrom-preinitializer-supplement.cjs','test/maelstrom-loader-host-fixture.cjs']
gate('package')
git('reset','-q',REV,'--',str(E.relative_to(R)))
for p in sourcePaths:git('add','--sparse','--',p)
git('diff','--cached','--check')
testedTree=git('write-tree','--missing-ok').decode().strip()
sourceHashes={p:sha((R/p).read_bytes()) for p in sourcePaths}
save('incidents.json',[
 dict(kind='initial-read-excerpt',detail='Initial combined policy/receipt reads exceeded 8192B excerpt and were tool-truncated. Narrow reads completed policy and source inspection; no source/test evidence inferred from truncation.'),
 dict(kind='fixture-resource-seam',detail='First focused run failed unexpected require ../lib/dib. Original stderr is the first entry in command-stderr.log. Added explicit empty resource decoder seam; production resource registration unchanged.'),
 dict(kind='fixture-observation-seam',detail='Second focused run replaced instance exports with run only; authentic nativeRaw could not read get_image_base. Kept all original fixture exports while overriding run; subsequent affected group passed.'),
 dict(kind='fixture-error-receipt',detail='Common wrapper first-command-failure/first-focused-failure filenames were overwritten by second internal failure; append-only command-stderr.log retains BOTH original failures in order.'),
 dict(kind='readonly-diff-wrapper',detail='Two manual read-only Git diff commands used inherited limits instead of child Git DATA wrapper. They completed with small outputs; all checkout, staging, object operations, commit and publication use child-only Git DATA512MiB. No enforced limit was raised.'),
 dict(kind='cleanup-refinement',detail='Successful cancellation previously rethrew its own cancellation and would produce a cleanup warning. Consume the identical injected error while propagating rollback errors. Reran six affected prearm failures and abort case; added genuine awaited overlay rejection.'),
 dict(kind='acceptance-environment',detail='Six affected legacy wiring cases used MAELSTROM_TEST_FILTER; separate exact startup/limits receipt retained. Normal acceptance and derivation use original unchanged environment. No application/native/guest/build tests executed.'),
])
orig=(O/'loader-original.js').read_text();derived=(O/'derived/lib/dll-loader.js').read_text();oldrunner=pathlib.Path('/tmp/maelstrom-initialized-runner-arm-repair-oct26/ops/corrected-final-run.js').read_text();newrunner=(O/'derived/test/run.js').read_text()
checks={}
for a,b,label in [('function callDllMainOwned(', '\n// An owning Worker', 'ownedDllMain'),('async function callDllMainAsyncOwned(', '\nfunction* dllMainSteps(', 'asyncDllMain'),('function* dllMainSteps(', '\nfunction orderDllInitializers(', 'entireDllMainGenerator'),('function orderDllInitializers(', '\nfunction findDllExport(', 'dependencyOrder')]:
 text=orig[orig.index(a):orig.index(b,orig.index(a))];assert text in derived;checks[label]=dict(bytes=len(text.encode()),sha256=sha(text.encode()),unchanged=True)
# Main observations and their surrounding trailing runtime are byte-exact.
boundary='  for (let batch = 0; batch < MAX_BATCHES && !stopped; batch++) {'
assert newrunner[newrunner.index(boundary):]==oldrunner[oldrunner.index(boundary):]
checks['entireMainLoopAndFollowingRuntime']=dict(sha256=sha(newrunner[newrunner.index(boundary):].encode()),unchanged=True)
save('source-audit.json',dict(base=REV,testedSourceTree=testedTree,sourceHashes=sourceHashes,loaderInputSHA256=sha(orig.encode()),loaderOutputSHA256=sha(derived.encode()),runnerOutputSHA256=sha(newrunner.encode()),unchangedSourceChecks=checks,productionRuntimeFilesChanged=False,qualification='deterministic archived loader/runner derivative plus offline JS tests; no native execution'))
resultNames=['focused-results.json','supplement-results.json','affected-wiring-results.json','prearm-affected-results.json','abort-async-results.json','error-causes-results.json']
for name in resultNames:assert json.load(open(O/name))['pass']
save('checkpoint.json',dict(base=REV,branch=BR,testedSourceTree=testedTree,sourceHashes=sourceHashes,derivatives=json.load(open(O/'derivative-identities.json')),completed=dict(focusedUnique=25,affectedPriorWiring=6,originalRejectingControl='byte-exact and rejecting',followupAffectedRetests={'prearm':6,'abort':1,'errorCausesStrengthened':3},newAwaitedOverlay=1),results={n:sha((O/n).read_bytes()) for n in resultNames},sourceRelation='Final runner derivative unchanged from initial17+7 passes. Loader derivative changed only abort exception consumption; affected six prearm+abort and awaited case passed. Test additions export harness/filter plus strengthened error-cause checks; affected3 passed. Receipt metadata and transformPair exercised by deterministic generation recipe.',reusedGroups=dict(independent=9,wiring=30,CLI=4,guards=29,affectedWiringRerun=6),remaining=['fresh independent acceptance','coordinator integration separately; NO MAIN authorization','separately assigned native/runtime qualification','authentic errno/caller/gameplay unknown'],noRuntime=True))
save('tree-relationship.json',dict(base=REV,baseTree=git('rev-parse',REV+'^{tree}').decode().strip(),testedSourceTree=testedTree,sourcePaths=sourcePaths,publicationAddsOnly='assigned new review evidence path; all six tested source files unchanged',noMainOwnership=True))
# Retain only bounded evidence and recipes, not binaries or duplicate runtime trees.
files=['checkpoint.json','source-audit.json','incidents.json','standing-inputs.json','binary-inputs.json','reused-evidence.json','launch-configuration.json','node-startup.json','node-exact-configuration.json','affected-wiring-node-startup.json','checkout.json','tree-relationship.json','derivative-identities.json','command-stderr.log','first-focused-failure.json','resources-precheckout.json','resources-focused.json','resources-supplement.json','resources-affected-wiring.json','resources-abort-affected.json','resources-error-causes.json','resources-package.json']+resultNames
for n in files:(E/n).write_bytes((O/n).read_bytes())
for n in ['common.py','prepare.py','test.py','package.py']:(E/('recipe-'+n)).write_bytes((O/n).read_bytes())
payloads=[dict(path=p,bytes=(R/p).stat().st_size,sha256=sourceHashes[p]) for p in sourcePaths]
payloads += [dict(path=str(p.relative_to(R)),bytes=p.stat().st_size,sha256=sha(p.read_bytes())) for p in sorted(E.iterdir()) if p.is_file() and p.name!='evidence-manifest.json']
(E/'evidence-manifest.json').write_text(json.dumps(dict(base=REV,testedSourceTree=testedTree,payloads=payloads),indent=2)+'\n')
git('add','--sparse','--',str(E.relative_to(R)))
git('diff','--cached','--check')
print('PACKAGE PASS',len(payloads),'payloads',testedTree)
