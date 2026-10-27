import os,sys,unittest,json,pathlib
base=pathlib.Path('/tmp/enigma-progressive-menu-independent-accept-oct27')
sys.path.insert(0,str(base/'repo/test/fixtures/enigma-controller'))
os.environ['ENIGMA_SUPERVISED_EVIDENCE']=str(base/'ops/ownership-evidence')
name='test_supervised.SupervisedTests.test_live_original_competitors_and_changed_outputs_cannot_attach'
r=unittest.TextTestRunner(verbosity=2).run(unittest.defaultTestLoader.loadTestsFromName(name))
(base/'ops/ownership-checkpoint.json').write_text(json.dumps(dict(unchangedMethod=name,success=r.wasSuccessful(),testsRun=r.testsRun)))
raise SystemExit(not r.wasSuccessful())
