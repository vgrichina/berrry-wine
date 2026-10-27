import ast,hashlib,json,pathlib
P=pathlib.Path;H=P(__file__).resolve().parent.parent;O=H/'ops';R=H/'repo';D=P('/tmp/gl-confinement-independent-publication-oct27/repo')
def sha(p):
 h=hashlib.sha256()
 with p.open('rb') as f:
  for b in iter(lambda:f.read(65536),b''):h.update(b)
 return h.hexdigest()
def methods(p):
 return {n.name:ast.dump(n,include_attributes=False) for c in ast.parse(p.read_bytes()).body if isinstance(c,ast.ClassDef) for n in c.body if isinstance(n,ast.FunctionDef) and n.name.startswith('test_')}
p='test/test-palette-disk-accounting.py';a,b=methods(D/p),methods(R/p);affected=json.loads((O/'affected-accounting-methods.json').read_text());reused=sorted(set(a)-set(affected));assert len(reused)==20
assert all(a[n]==b[n] for n in reused)
for p in ['test/test-gl-output-namespace-independent.py','test/test-palette-disk-accounting-omissions.py','test/test-gl-runner-output-namespace-omissions.py','test/helpers/palette-browser-supervisor.py']:
 assert sha(R/p)==sha(D/p),p
receipts={}
base=P('/tmp/gl-runner-mutable-evidence-namespace-repair-oct26/repo/docs/reviews/gl-runner-mutable-evidence-namespace-repair-oct26')
for name,expected in [('accounting-controlled-headroom','97b68dfc10f298c7fc63f94913a1f8a2420d0b88a9e6077d3850bc642425f7d6'),('accounting-omissions-final','e57faa23cbab171fb0d9bb462048b5fb5944d42d994fa010a56417916eb06c31')]:
 p=base/(name+'.json');assert sha(p)==expected;j=json.loads(p.read_text());assert j['exit']==0 and j['stopReason'] is None and j['cleanupComplete'];receipts[name]={'path':str(p),'sha256':expected,'exit':j['exit'],'cleanupComplete':j['cleanupComplete']}
r=(R/'test/fixtures/gl-transient-accounting/remote-run.py').read_text();c=(R/'test/fixtures/gl-transient-accounting/collect-evidence.py').read_text()
assert r[r.index('class OutputFiles:'):r.index('P=pathlib.Path;M=')]==c[c.index('class OutputFiles:'):c.index('def collect(task_root):')]
j={'candidate':'2b825a30d178a34aca28b50307d87049693ba529','unchangedIndependentReproducer':sha(R/'test/test-gl-output-namespace-independent.py'),'mirrorClassExact':True,'reusedAccountingMethods':reused,'reusedAccountingMethodASTs':{n:hashlib.sha256(a[n].encode()).hexdigest() for n in reused},'reexecutedAffectedAccountingMethods':affected,'reusedHelperOmission':'root validation omitted (unchanged helper and test_root_replacement_and_symlink_ancestors AST)','reexecutedAffectedHelperOmissions':8,'retainedReceipts':receipts,'fault40Child2':'Prior receipts retained; runner output lifecycle affected, so rerun affected-faults-child.json','normalAndRouting':'affected real Node and six routing omissions rerun; no browser/guest/observations','testScope':'new staging/publication/cleanup/accounting controls use actual production entry; helper read races additionally remain covered'}
(O/'dependency-audit.json').write_text(json.dumps(j,indent=2));print('PASS twenty unchanged accounting cases and one helper omission reused by exact AST/helper/receipt hash; seven accounting and eight helper omissions rerun; mirrored helper exact')
