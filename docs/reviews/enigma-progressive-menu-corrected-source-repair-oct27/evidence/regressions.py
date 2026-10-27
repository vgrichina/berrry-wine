import os,sys,unittest,json,hashlib,pathlib
base=pathlib.Path('/tmp/enigma-progressive-menu-corrected-source-repair-oct27')
os.environ['ENIGMA_SUPERVISED_EVIDENCE']=str(base/'ops/regression-evidence')
os.environ['ENIGMA_TEST_EVIDENCE_DIR']=str(base/'ops/controller-evidence')
sys.path.insert(0,str(base/'repo/test/fixtures/enigma-controller'))
names=['test_progressive.ProgressReserveTests.test_exhausted_wall_during_review_closes_without_wire_cleanup','test_progressive.ProgressReserveTests.test_stale_second_review_and_listener_identity_refuse_input','test_controller.ControllerTests','test_ownership.OwnershipTests','test_listener.ListenerTests','test_supervised.SupervisedTests']
r=unittest.TextTestRunner(verbosity=2).run(unittest.defaultTestLoader.loadTestsFromNames(names))
files=list((base/'repo/tools').glob('enigma*.py'))+list((base/'repo/test/fixtures/enigma-controller').glob('*.py'))+[base/'repo/test/run.js']
v=dict(passed=r.wasSuccessful(),tests=r.testsRun,pins={str(p.relative_to(base/'repo')):hashlib.sha256(p.read_bytes()).hexdigest() for p in files},guestInvocations=0,remaining=['review','publication'])
(base/'ops/regression-checkpoint.json').write_text(json.dumps(v,indent=2)+'\n')
raise SystemExit(not r.wasSuccessful())
