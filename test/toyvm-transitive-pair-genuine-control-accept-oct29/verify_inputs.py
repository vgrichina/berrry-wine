from pathlib import Path
import ast,json,hashlib
P=Path('/tmp/toyvm-transitive-pair-genuine-control-accept-oct29')
R=P/'repo'
D=json.loads(Path('/home/user/wine-assembly/scratch/usage-watch/toyvm-transitive-pair-genuine-control-accept-oct29-dispatch.json').read_text())
def pin(b): return dict(bytes=len(b),sha256=hashlib.sha256(b).hexdigest())
assert Path.cwd()==R
for key,file in [('taskSupervisor','ops.py'),('limitModule','limit_contract.py')]:
 assert pin((P/file).read_bytes())==D[key+'Pin']
assert pin(Path('/usr/bin/python3').read_bytes())==D['pythonExecutablePin']
assert all(pin((R/n).read_bytes())==v for n,v in D['sourcePins'].items())
receipt=Path(D['canonicalReceipt'])
assert pin(receipt.read_bytes())==D['canonicalReceiptPin']
q=json.loads(receipt.read_text())
for n,v in q['artifacts'].items(): assert pin((P/'inputs/prior-independent-tests'/Path(n).name).read_bytes())==v
for n,v in q['inputArtifactsBefore'].items(): assert pin((P/'inputs/candidate-tests'/Path(n).name).read_bytes())==v
pre=Path('/home/user/wine-assembly/scratch/usage-watch/genuine-control-behavior-preflight-oct29/control-behavior-preflight.json')
smoke=json.loads(pre.read_text())
assert pre.read_bytes()==(P/'control-behavior-preflight.json').read_bytes()
assert smoke['pass'] and smoke['sourcePins']==D['sourcePins']
legacy=(P/'inputs/genuine-legacy-caller.py').read_bytes()
assert pin(legacy)==smoke['legacyPin']
assert hashlib.sha256((P/'inputs/prior-independent-tests/oracle.py').read_bytes()).hexdigest()==smoke['oracleSha256']
caller=next(iter(D['sourcePins']))
candidate=ast.parse((R/caller).read_bytes()); control=ast.parse(legacy)
def loader(tree):return next(n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name=='load_backend')
a,b=loader(candidate),loader(control)
assert ast.dump(a)!=ast.dump(b)
# Reconstruct only the supplied body mutation as an AST identity proof.
expected=ast.parse((R/caller).read_bytes())
f=loader(expected)
indices=[i for i,n in enumerate(f.body) if isinstance(n,ast.Expr) and isinstance(n.value,ast.Call) and isinstance(n.value.func,ast.Name) and n.value.func.id=='exec']
assert len(indices)==1
idx=indices[0]
assert isinstance(f.body[idx-1],ast.Assign) and isinstance(f.body[idx-1].value,ast.Call) and f.body[idx-1].value.func.id=='compile'
f.body[idx-1:idx+1]=ast.parse('spec.loader.exec_module(module)').body
assert ast.dump(expected)==ast.dump(control),'control changed beyond single loader statement'
def pins(tree):return ast.literal_eval(next(n.value for n in tree.body if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='BACKEND_PINS' for t in n.targets)))
assert pins(candidate)==pins(control)
assert all(hashlib.sha256((R/'test'/n).read_bytes()).hexdigest()==v for n,v in pins(control).items())

print('all source/input pins and exact compile+exec-to-loader AST mutation verified')
