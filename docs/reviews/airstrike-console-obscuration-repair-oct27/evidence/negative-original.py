import importlib.util,pathlib,unittest,sys,json
import run as c
s=importlib.util.spec_from_file_location('regression',c.R/'test/test-airstrike-console-obscuration.py');t=importlib.util.module_from_spec(s);s.loader.exec_module(t)
p=pathlib.Path('/tmp/airstrike-accepted-frozen-dispatch-main-integrate-oct27/repo/tools/airstrike-menu-controller.py');t.m=t.load('original',p)
result=unittest.TextTestRunner(stream=sys.stderr,verbosity=2).run(unittest.TestSuite([t.Startup('test_reviewed_activation_then_fresh_startup_before_any_key')]))
assert len(result.failures)==1 and len(result.errors)==0 and result.testsRun==1
c.dump('negative-original-pass.json',dict(expectedAssertionFailures=1,errors=0,originalSHA256=c.hashlib.sha256(p.read_bytes()).hexdigest(),discriminating=True))
print('Original accepted controller fails new startup transition oracle as expected.')
