from run import *
import runpy
p=json.loads((H/'pins.json').read_text())
for path,sha in p['pins'].items():assert hashlib.sha256((R/path).read_bytes()).hexdigest()==sha
assert hashlib.sha256(pathlib.Path(p['runner']).read_bytes()).hexdigest()==p['runnerSHA256']
os.environ.update(AIRSTRIKE_PRODUCTION_RUNNER=p['runner'],INDEPENDENT_EVIDENCE=str(H/'independent-normal-corrected'))
sys.argv=[str(R/'test/test-airstrike-independent-accept-oct27.py'),'Independent.test_00_independent_exact_completion_order_and_actual_log']
runpy.run_path(sys.argv[0],run_name='__main__')
