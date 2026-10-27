from run import *
import runpy
p=json.loads((H/'pins.json').read_text())
assert hashlib.sha256(pathlib.Path(p['runner']).read_bytes()).hexdigest()==p['runnerSHA256']
os.environ.update(AIRSTRIKE_PRODUCTION_RUNNER=p['runner'],INDEPENDENT_EVIDENCE=str(H/'flow'))
sys.argv=[str(R/'test/test-airstrike-independent-flow-oct27.py')]
runpy.run_path(sys.argv[0],run_name='__main__')
