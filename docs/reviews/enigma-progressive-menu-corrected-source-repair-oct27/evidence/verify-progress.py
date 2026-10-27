import os,sys,unittest,json,hashlib,pathlib
base=pathlib.Path('/tmp/enigma-progressive-menu-corrected-source-repair-oct27')
os.environ['ENIGMA_SUPERVISED_EVIDENCE']=str(base/'ops/progress-evidence')
sys.path.insert(0,str(base/'repo/test/fixtures/enigma-controller'))
names=['test_progressive.ProgressEntryTests.test_loading_to_menu_production_boundary','test_progressive.ProgressEntryTests.test_never_ready_quits_with_after_capture_reserved','test_progressive.ProgressEntryTests.test_later_pending_step_stops_original_owner_no_replay','test_progressive.ProgressReserveTests']
r=unittest.TextTestRunner(verbosity=2).run(unittest.defaultTestLoader.loadTestsFromNames(names))
files=['tools/enigma-frozen-gameplay-controller.py','tools/enigma-supervised-gameplay.py','test/run.js',*[str(p.relative_to(base/'repo')) for p in (base/'repo/test/fixtures/enigma-controller').glob('*.py')]]
v=dict(passed=r.wasSuccessful(),tests=r.testsRun,pins={p:hashlib.sha256((base/'repo'/p).read_bytes()).hexdigest() for p in files},guestInvocations=0,remaining=['affected regression groups','review','publication'])
(base/'ops/progress-checkpoint.json').write_text(json.dumps(v,indent=2)+'\n')
raise SystemExit(not r.wasSuccessful())
