import os,sys,pathlib,unittest,json,hashlib
H=pathlib.Path(__file__).parent;R=H.parent/'repo';F=R/'test/fixtures/enigma-controller'
sys.path.insert(0,str(F));os.environ['ENIGMA_REVIEW_EVIDENCE']=str(H/'tests-final')
names=sys.argv[1:]
result=unittest.TextTestRunner(verbosity=2).run(unittest.defaultTestLoader.loadTestsFromNames(names))
pins={str(p.relative_to(R)):hashlib.sha256(p.read_bytes()).hexdigest() for p in R.rglob('*.py')}
(H/('checkpoint-'+names[0].split('.')[0]+'.json')).write_text(json.dumps(dict(tests=result.testsRun,successful=result.wasSuccessful(),sourcePins=pins,failed=len(result.failures),errors=len(result.errors)),indent=2))
raise SystemExit(0 if result.wasSuccessful() else 1)
