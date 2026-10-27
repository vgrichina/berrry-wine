import os,sys,unittest,pathlib,json,hashlib
base=pathlib.Path('/tmp/enigma-progressive-menu-corrected-source-repair-oct27')
os.environ['ENIGMA_SUPERVISED_EVIDENCE']=str(base/'ops/final-affected-evidence')
sys.path.insert(0,str(base/'repo/test/fixtures/enigma-controller'))
names=['test_progressive.ProgressEntryTests','test_progressive.ProgressReserveTests.test_reviewed_menu_still_requires_action_reserves']
r=unittest.TextTestRunner(verbosity=2).run(unittest.defaultTestLoader.loadTestsFromNames(names))
files=list((base/'repo/tools').glob('enigma*.py'))+list((base/'repo/test/fixtures/enigma-controller').glob('*'))+[base/'repo/test/run.js']
v=dict(passed=r.wasSuccessful(),tests=r.testsRun,pins={str(p.relative_to(base/'repo')):hashlib.sha256(p.read_bytes()).hexdigest() for p in files if p.is_file()},guestInvocations=0,remaining=['review','publication'])
(base/'ops/final-affected-checkpoint.json').write_text(json.dumps(v,indent=2)+'\n')
raise SystemExit(not r.wasSuccessful())
