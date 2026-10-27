import os,sys,unittest,json,hashlib,pathlib,resource,time,shutil
base=pathlib.Path('/tmp/enigma-progressive-menu-independent-accept-oct27'); repo=base/'repo'; ops=base/'ops'
source=pathlib.Path('/tmp/enigma-progressive-menu-corrected-source-repair-oct27/repo/docs/reviews/enigma-progressive-menu-corrected-source-repair-oct27/evidence/acceptance-checkpoint.json')
checkpoint=json.loads(source.read_text())
pins={p:hashlib.sha256((repo/p).read_bytes()).hexdigest() for p in checkpoint['pins']}
assert pins==checkpoint['pins'],pins
(ops/'pinned-inputs.json').write_text(json.dumps(dict(candidate='9fb63a8ca3b56880321aabfa507a2c0aee61cb4a',sourceBaseline=checkpoint['sourceBaseline'],pins=pins,checkpointSHA256=hashlib.sha256(source.read_bytes()).hexdigest(),reusedMethods=checkpoint['passedMethods'],inheritedLimits={n:resource.getrlimit(getattr(resource,n)) for n in ('RLIMIT_CPU','RLIMIT_FSIZE','RLIMIT_DATA','RLIMIT_AS')},at=time.time(),memAvailable=pathlib.Path('/proc/meminfo').read_text().split('MemAvailable:')[1].split()[0],diskFree=shutil.disk_usage(base).free),indent=2))
os.environ['ENIGMA_SUPERVISED_EVIDENCE']=str(ops/'boundary-evidence')
sys.path.insert(0,str(repo/'test/fixtures/enigma-controller'))
r=unittest.TextTestRunner(verbosity=2).run(unittest.defaultTestLoader.loadTestsFromName('test_progressive.ProgressEntryTests.test_loading_to_menu_production_boundary'))
(ops/'boundary-checkpoint.json').write_text(json.dumps(dict(candidate='9fb63a8ca3b56880321aabfa507a2c0aee61cb4a',passBoundary=r.wasSuccessful(),testsRun=r.testsRun,unchangedFixtureSHA256=pins['test/fixtures/enigma-controller/test_progressive.py'],remaining=['independent approval/budget/ownership adversaries and rejecting mutations']),indent=2))
raise SystemExit(not r.wasSuccessful())
