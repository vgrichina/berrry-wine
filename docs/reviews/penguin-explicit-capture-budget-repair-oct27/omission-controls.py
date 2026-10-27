import importlib.util, io, json, types, unittest, hashlib
from pathlib import Path
root=Path('/tmp/penguin-explicit-capture-budget-repair-oct27')
source=(root/'repo/tools/penguin_capture_contract.py').read_text()
spec=importlib.util.spec_from_file_location('tests',root/'repo/test/test_penguin_capture_contract.py')
t=importlib.util.module_from_spec(spec);spec.loader.exec_module(t)
cases=[
 ('max-budget','type(value) is int and 0 < value <= MAX_CAPTURE_BYTES','type(value) is int and 0 < value','test_invalid_profiles_and_default_stability'),
 ('budget-pin',"require(budget == plan._capture_budget, 'capture plan budget mismatch')","pass # omitted construction pin",'test_plan_pins_mismatch_and_collector_cannot_upgrade_midstream'),
 ('raw-charge','self.charged += len(raw)','self.charged += 0','test_exact_and_one_byte_over_both_planners_and_profiles'),
 ('remaining-reserve',"require(self.charged + sum(p['frame_limits'][self.cursor:]) + self.tail <= self.capture_budget,\n                    'remaining capture/tail reserve exceeds API budget')","pass # omitted remaining reserve",'test_used_reserves_poll_overflow_and_late_error_poison_both_profiles'),
]
results=[]
for name,old,new,test in cases:
    assert source.count(old)==1,(name,source.count(old))
    changed=source.replace(old,new)
    mutant=types.ModuleType('mutant');exec(compile(changed,'<omission-'+name+'>','exec'),mutant.__dict__)
    t.c=mutant
    stream=io.StringIO()
    result=unittest.TextTestRunner(stream=stream).run(t.ExplicitBudgetTests(test))
    (root/'ops'/('omission-'+name+'.txt')).write_text(stream.getvalue())
    assert not result.wasSuccessful(),name+' omission escaped'
    assert not result.errors,name+' test setup error instead of rejecting assertion'
    results.append(dict(name=name,originalSHA256=hashlib.sha256(source.encode()).hexdigest(),
                        transformedSHA256=hashlib.sha256(changed.encode()).hexdigest(),
                        old=old,new=new,test=test,tests=result.testsRun,
                        failures=len(result.failures),errors=len(result.errors)))
(root/'ops/omission-results.json').write_text(json.dumps(results,indent=2))
print(json.dumps(results))
