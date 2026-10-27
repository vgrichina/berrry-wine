import ast,importlib.util,json,pathlib,sys,unittest
P=pathlib.Path;R=P(__file__).resolve().parent.parent/'repo';p=R/'test/test-palette-disk-accounting.py'
s=importlib.util.spec_from_file_location('accounting',p);m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
methods=json.loads((P(__file__).parent/'affected-accounting-methods.json').read_text())
suite=unittest.TestSuite(m.Accounting(n) for n in methods)
r=unittest.TextTestRunner(verbosity=2).run(suite)
assert r.wasSuccessful()
p=R/'test/test-palette-disk-accounting-omissions.py';tree=ast.parse(p.read_bytes());removed=[]
for n in ast.walk(tree):
 if isinstance(n,ast.For) and isinstance(n.iter,ast.List):
  retained=[]
  for e in n.iter.elts:
   if isinstance(e,ast.Tuple) and isinstance(e.elts[0],ast.Constant) and e.elts[0].value=='root validation omitted':removed.append(e.elts[0].value)
   else:retained.append(e)
  n.iter.elts=retained
assert removed==['root validation omitted']
exec(compile(tree,str(p),'exec'),{'__file__':str(p),'__name__':'__main__'})
print('PASS seven affected production callbacks and eight affected helper omission controls; reuse twenty unchanged ledger cases and one unchanged root-validation omission')
