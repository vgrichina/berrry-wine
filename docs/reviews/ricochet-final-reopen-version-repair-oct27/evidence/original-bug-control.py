import importlib.util,pathlib,unittest,os,json,hashlib
O=pathlib.Path(os.environ['RICOCHET_ACCEPT_OPS']);R=O.parent/'repo'
def load(name,p):
 s=importlib.util.spec_from_file_location(name,p);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
T=load('focused_tests',R/'test/ricochet-final-reopen-version.test.py');P=O/'original-runtime-accounting.py';assert hashlib.sha256(P.read_bytes()).hexdigest()=='580a0fa000c2784f3bbfdb91ad100a6c91c1b1a558729b27756727d183f558de';T.A=load('original_accounting',P)
r=unittest.TextTestRunner(verbosity=2).run(unittest.defaultTestLoader.loadTestsFromTestCase(T.FinalReopenTests))
(O/'original-bug-control.json').write_text(json.dumps(dict(tests=r.testsRun,failures=[t.id() for t,e in r.failures],errors=[t.id() for t,e in r.errors],expected='six mutation cases fail unchanged assertions; two legitimate windows pass',originalSHA256=hashlib.sha256(P.read_bytes()).hexdigest()),indent=2))
assert r.testsRun==8 and len(r.failures)==6 and not r.errors
print('PASS: original bug kills all six rejection assertions; both legitimate controls pass')
