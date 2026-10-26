import ast,pathlib,tempfile,unittest.mock as mock,json,shutil,importlib.util
D=pathlib.Path('/tmp/gl-published-webgl-api-qualification-oct26');P=pathlib.Path
source=(D/'ops/remote-run.py').read_text();tree=ast.parse(source)
ns=dict(P=P,shutil=shutil,M=1048576,future=0,accounting=dict(samples=0,peakProjected=0,minFree=None,minMem=None))
exec(compile(ast.Module(body=[n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name in ['alloc','check']],type_ignores=[]),str(D/'ops/remote-run.py'),'exec'),ns)
spec=importlib.util.spec_from_file_location('old',D/'repo/test/helpers/palette-browser-supervisor.py');old=importlib.util.module_from_spec(spec);spec.loader.exec_module(old)
results=[]
for kind in ['file','symlink','dir']:
 with tempfile.TemporaryDirectory() as t:
  root=P(t);tmp=root/'tmp';tmp.mkdir();v=tmp/'SingletonSocket';(root/'required').write_bytes(b'x'*16384)
  if kind=='dir':v.mkdir()
  elif kind=='symlink':v.symlink_to('/absent/chromium/socket')
  else:v.write_bytes(b'x'*4096)
  original=P.is_symlink;fired=[]
  def vanish(p):
   if p==v and not fired:
    fired.append(True);p.rmdir() if kind=='dir' else p.unlink()
   return original(p)
  ns['H']=root
  with mock.patch.object(P,'is_symlink',vanish):
   try:ns['check']();raise AssertionError('old callback unexpectedly accepted')
   except FileNotFoundError:pass
  # Reset same deterministic race for shared helper: it returns zero for whole root.
  v.mkdir() if kind=='dir' else v.symlink_to('/absent/socket') if kind=='symlink' else v.write_bytes(b'x'*4096)
  fired.clear();check=old.accounting_check(dict(roots=[str(root)],reserve=8*1048576,future=0,walBaseline={}))
  with mock.patch.object(P,'is_symlink',vanish):assert check() is None
  assert check.receipt['peakBytes']==8*1048576
  results.append(dict(kind=kind,callback='ENOENT rejects',shared='whole mandatory root incorrectly charged zero',raceFired=bool(fired)))
print(json.dumps(dict(productionWrapper=str(D/'ops/remote-run.py'),results=results),indent=2))
