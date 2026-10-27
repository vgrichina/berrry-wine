import os,importlib.util,unittest,json
from pathlib import Path
M=Path('/tmp/alien-terminal-dispatch-boundary-repair-oct26/omission-postwal-source');os.environ['ALIEN_CONTROL_ROOT']=str(M)
s=importlib.util.spec_from_file_location('regression',M/'test/test-alien-terminal-dispatch-boundary-oct26.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
r=unittest.TextTestRunner(verbosity=2).run(unittest.TestSuite([m.Crashes('test_custom_transport_post_intent_guard')]))
assert len(r.failures)==1 and not r.errors
print(json.dumps(dict(omitted='post-WAL-guard',unchangedRegressionRejected=True,failures=len(r.failures),errors=len(r.errors))))
