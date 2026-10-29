import ast, hashlib, json, pathlib
ROOT=pathlib.Path(__file__).resolve().parents[2]
OWN=pathlib.Path(__file__).parent
HOST=pathlib.Path("/tmp/toyvm-seven-guards-selector-independent-accept-oct29")
DISPATCH=pathlib.Path("/home/user/wine-assembly/scratch/usage-watch/toyvm-seven-guards-selector-independent-accept-oct29-dispatch.json")
def pin(p):
 b=p.read_bytes();return dict(bytes=len(b),sha256=hashlib.sha256(b).hexdigest())
def read(p):return json.loads(p.read_text())
d=read(DISPATCH); cpath=pathlib.Path(d["canonicalReceipt"])
assert pin(cpath)==d["canonicalReceiptPin"]
c=read(cpath); inp=HOST/"inputs"; art=inp/"candidate-tests"
assert pin(art/"artifact-hashes.json")=={k:c["artifactManifest"][k] for k in ("bytes","sha256")}
m=read(art/"artifact-hashes.json")
for name,value in m.items():assert pin(art/name)==value,("artifact",name)
for path,value in d["sourcePins"].items():assert pin(ROOT/path)==value,("production",path)
for path,key in [(HOST/"ops.py","taskSupervisorPin"),(HOST/"limit_contract.py","limitModulePin"),(pathlib.Path("/usr/bin/python3"),"pythonExecutablePin")]:assert pin(path)==d[key]
bp=ROOT/"test/toyvm-kernel-profile-accounting-backend-oct28/fuse_backend.py"
s=bp.read_text(); ns=(art/"namespace-donor.py.txt").read_text(); sel=(art/"selector-donor.py.txt").read_text()
assert pin(HOST/"inputs/namespace-backend.py")==pin(art/"namespace-donor.py.txt")
assert hashlib.sha256(ns.encode()).hexdigest()==c["namespaceDonor"]["sha256"]
assert hashlib.sha256(sel.encode()).hexdigest()==c["selectorDonor"]["sha256"]
def parts(s):
 lines=s.splitlines(keepends=True); tree=ast.parse(s)
 cls=next(n for n in tree.body if isinstance(n,ast.ClassDef) and n.name=="Backend")
 serve=next(n for n in cls.body if isinstance(n,ast.FunctionDef) and n.name=="serve")
 return "".join(lines[:serve.lineno-1]),"".join(lines[serve.lineno-1:serve.end_lineno]),"".join(lines[serve.end_lineno:])
a,b,z=parts(s);na,nb,nz=parts(ns);sa,sb,sz=parts(sel)
assert (a,z)==(na,nz),"bytes outside serve differ"
assert b==sb,"serve donor differs"
def nonserve(s):
 tree=ast.parse(s)
 for n in ast.walk(tree):
  if isinstance(n,ast.ClassDef) and n.name=="Backend":n.body=[f for f in n.body if not (isinstance(f,ast.FunctionDef) and f.name=="serve")]
 return ast.dump(tree,include_attributes=False)
assert nonserve(s)==nonserve(ns)
nsa=read(inp/"namespace-acceptance.json");sea=read(inp/"selector-acceptance.json")
assert nsa["commit"].startswith("a18fbb80") and nsa["remote"]["exactRemoteConfirmed"] and nsa["remote"]["sha"]==nsa["commit"]
assert nsa["afterSourcePins"][str(bp.relative_to(ROOT))]==pin(art/"namespace-donor.py.txt")
assert sea["remoteVerified"]
report=dict(PASS=True,candidate=d["candidate"],sourcePins=d["sourcePins"],canonicalReceipt=pin(cpath),manifest=pin(art/"artifact-hashes.json"),artifactsVerified=len(m),namespaceAcceptance=pin(inp/"namespace-acceptance.json"),namespaceAcceptanceCommit=nsa["commit"],selectorAcceptance=pin(inp/"selector-acceptance.json"),outsideServeBytesEqual=True,nonServeASTEqual=True,serveBytesEqual=True,mount="N/A no mount argv",node="N/A no Node",rootRef="reuse coordinator initial digest",controls="reuse unchanged prelaunch-controls.json")
(OWN/"preflight.json").write_text(json.dumps(report,indent=2)+"\n")
print(json.dumps(report))
