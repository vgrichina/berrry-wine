from run import *
p=json.loads((H/'pins.json').read_text())
assert hashlib.sha256(pathlib.Path(p['runner']).read_bytes()).hexdigest()==p['runnerSHA256']
os.environ.update(AIRSTRIKE_PRODUCTION_RUNNER=p['runner'],AIRSTRIKE_PROTOCOL_EVIDENCE=str(H/'first-boundary'),AIRSTRIKE_BRIDGE_FIXTURES=str(H))
import runpy
sys.argv=[str(R/'test/test-airstrike-frozen-dispatch.py'),'FrozenDispatch.test_00_production_queue_step_and_frozen_zero_before_next_input','-v']
runpy.run_path(sys.argv[0],run_name='__main__')
