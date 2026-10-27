import hashlib,json,pathlib,runpy,sys
D=pathlib.Path('/tmp/ricochet-consumed-control-accounting-repair-oct27/repo')
O=pathlib.Path(__file__).parent
pins=json.loads(pathlib.Path('/home/user/wine-assembly/scratch/usage-watch/ricochet-consumed-accounting-independent-accept-oct27-admission.json').read_text())['sourcePinsVerified']
actual={p:hashlib.sha256((D/p).read_bytes()).hexdigest() for p in pins}
assert actual==pins
(O/'verified-pins.json').write_text(json.dumps(actual,indent=2))
sys.argv=[str(D/'test/ricochet-runtime-accounting.test.py'),'AccountingTests.test_00_exact_transformed_production_boundary']
runpy.run_path(sys.argv[0],run_name='__main__')
