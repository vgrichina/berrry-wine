import ast,hashlib,importlib.util,io,json,types,unittest
from pathlib import Path
R=Path('/tmp/penguin-explicit-budget-independent-accept-oct27');D=Path('/tmp/penguin-explicit-capture-budget-repair-oct27')
report=D/'repo/docs/reviews/penguin-explicit-capture-budget-repair-oct27'
manifest=json.loads((report/'manifest.json').read_text())
for n,h in manifest.items():assert hashlib.sha256((report/n).read_bytes()).hexdigest()==h,n
assert len(manifest)==96
source=(D/'repo/tools/penguin_capture_contract.py').read_text()
baseline=Path('/tmp/penguin-accepted-causal-main-integration-oct27/repo/tools/penguin_capture_contract.py').read_text()
reuse=json.loads((D/'ops/reuse-launch.json').read_text())
def excerpts(s):
 tree=ast.parse(s);return {n.name:ast.get_source_segment(s,n) for n in tree.body if isinstance(n,(ast.FunctionDef,ast.ClassDef))}
a,b=excerpts(source),excerpts(baseline)
for name,h in reuse['unchangedLaunchFunctions'].items():
 assert a[name]==b[name] and hashlib.sha256(a[name].encode()).hexdigest()==h,name
test=(D/'repo/test/test_penguin_capture_contract.py').read_text()
oldtest=Path('/tmp/penguin-accepted-causal-main-integration-oct27/repo/test/test_penguin_capture_contract.py').read_text()
assert excerpts(test)['LaunchTests']==excerpts(oldtest)['LaunchTests']
for path,h in reuse['priorReceipts'].items():assert hashlib.sha256(Path(path).read_bytes()).hexdigest()==h
prior=json.loads((D/'ops/final-targeted.json').read_text())
assert prior['exit']==0 and prior['stopReason'] is None and prior['cleanupComplete']
assert 'Ran 16 tests' in (D/'ops/final-targeted.stderr').read_text()
controls=json.loads((D/'ops/omission-results.json').read_text())
assert len(controls)==4 and all(v['failures']>0 and v['errors']==0 for v in controls)
result=dict(manifestPayloadsVerified=len(manifest),pins=json.loads((report/'checkpoint.json').read_text())['pins'],targetedTestsReused=16,rejectingControlsReused=4,launchReuse=reuse,qualification='unchanged exact-source receipts; no replay of passed groups')
(R/'ops/reused-groups.json').write_text(json.dumps(result,indent=2))
spec=importlib.util.spec_from_file_location('independent',R/'ops/independent-tests.py');t=importlib.util.module_from_spec(spec);spec.loader.exec_module(t)
mutations=[
 ('no-raw-charge','self.charged += len(raw)','self.charged += 0','test_late_error_is_charged_then_poisoned'),
 ('no-nested-pin',"        plan_budget(self.plan['canonical'], self.capture_budget)","        pass # nested pin omitted",'test_nested_reconstruction_cannot_upgrade_consumed_collector'),
 ('no-maximum','type(value) is int and 0 < value <= MAX_CAPTURE_BYTES','type(value) is int and 0 < value','test_invalid_profiles_every_supported_entry'),
 ('no-closed-ledger',"require(not self.failed and not self.finished, 'collector is closed')","pass # closed ledger omitted",'test_late_error_is_charged_then_poisoned')]
results=[]
for name,old,new,method in mutations:
 assert old in source
 changed=source.replace(old,new);module=types.ModuleType('mutant_'+name)
 exec(compile(changed,str(R/'ops'/('mutant-'+name+'.py')),'exec'),module.__dict__)
 t.c=module;stream=io.StringIO();suite=unittest.TestSuite([t.Independent(method)])
 observed=unittest.TextTestRunner(stream=stream,verbosity=2).run(suite)
 (R/'ops'/('mutation-'+name+'.txt')).write_text(stream.getvalue())
 record=dict(name=name,originalSHA256=hashlib.sha256(source.encode()).hexdigest(),transformedSHA256=hashlib.sha256(changed.encode()).hexdigest(),old=old,new=new,test=method,failures=len(observed.failures),errors=len(observed.errors))
 results.append(record)
 assert record['failures']>0 and record['errors']==0,record
(R/'ops/independent-mutations.json').write_text(json.dumps(results,indent=2))
print('PASS 96 retained payload hashes; 16 tests + 4 controls reused; byte-identical launch reuse; 4 independent mutants rejected with assertion failures and no errors')
