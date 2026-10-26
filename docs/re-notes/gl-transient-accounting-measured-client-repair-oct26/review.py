import ast,hashlib,pathlib,difflib,json
P=pathlib.Path;H=P('/tmp/gl-transient-accounting-measured-client-repair-oct26');R=H/'repo';D=P('/tmp/gl-published-webgl-api-qualification-oct26')
old=(D/'repo/test/helpers/palette-browser-supervisor.py').read_text();new=(R/'test/helpers/palette-browser-supervisor.py').read_text()
a={n.name:ast.dump(n) for n in ast.parse(old).body if isinstance(n,ast.FunctionDef)};b={n.name:ast.dump(n) for n in ast.parse(new).body if isinstance(n,ast.FunctionDef)}
for n in a:
 if n!='accounting_check':assert a[n]==b[n],n
w=(R/'test/fixtures/gl-transient-accounting/remote-run.py').read_text();original=(D/'ops/remote-run.py').read_text()
assert w==original.replace("def alloc(p):return sum(q.lstat().st_blocks*512 for q in [p,*p.rglob('*')] if not q.is_symlink())","def alloc(p):\n if p != H:raise ValueError('unexpected accounting root')\n return disk.allocated()").replace("spec.loader.exec_module(sup)\n","spec.loader.exec_module(sup)\ndisk=sup.AllocatedDisk([H],transient_roots=[H/'tmp'],ceiling=1024*M)\n")
print(json.dumps(dict(unchangedSupervisorFunctions=[n for n in a if n!='accounting_check'],wrapperChangesOnly='alloc delegates to shared pinned bounded disk; one ledger initializer with explicit tmp subtree and unchanged1024MiB ceiling',acceptedDetachedAdoptedReceipts='1e19d8c01e5d7e40f1e8ad60df5079ee9d9d4d4e reused, not rerun',fixtureSHA256=hashlib.sha256(w.encode()).hexdigest()),indent=2))
