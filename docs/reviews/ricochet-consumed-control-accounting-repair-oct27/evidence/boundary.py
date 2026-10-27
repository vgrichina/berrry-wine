import ast,hashlib,pathlib,tempfile,json,types,unittest.mock as mock,sys
T=pathlib.Path('/tmp/ricochet-consumed-control-accounting-repair-oct27');R=T/'repo';O=T/'ops'
D=R/'docs/reviews/ricochet-measured-cpu-round-gameplay-oct27/remote-tools'
p=D/'remote-supervisor.py';b=p.read_bytes();assert hashlib.sha256(b).hexdigest()=='eebc983956aa092b71a527f41f5516c51376c1acf19872cb808025833953ba63'
tree=ast.parse(b);fn=next(n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name=='check');source=ast.get_source_segment(b.decode(),fn)
with tempfile.TemporaryDirectory(dir=O) as d:
 h=pathlib.Path(d);(h/'serial').mkdir();(h/'guest').mkdir();control=h/'serial/continue.json';control.write_text('{}');(h/'retained').write_bytes(b'x'*8192)
 original=pathlib.Path.stat;calls=0
 def racing(p,*a,**kw):
  global calls
  if p==control:
   calls+=1
   if calls==2:p.unlink()
  return original(p,*a,**kw)
 # Only map the second production root to owned fixture data; function is byte-exact.
 class Paths:
  @staticmethod
  def Path(p):return h/'unused' if str(p)=='/tmp/ricochet-cleanup-round-play-oct27' else pathlib.Path(p)
 g=dict(H=h,E=h/'guest',pathlib=Paths,shutil=__import__('shutil'),time=__import__('time'))
 exec(compile(ast.Module(body=[fn],type_ignores=[]),str(p),'exec'),g)
 with mock.patch.object(pathlib.Path,'stat',racing):
  try:g['check']()
  except FileNotFoundError as e:failure=repr(e)
  else:raise AssertionError('production race did not reproduce')
 assert calls==2 and not control.exists() and (h/'retained').stat().st_size==8192
 receipt=dict(passExpectedRejection=True,sourceSHA256=hashlib.sha256(b).hexdigest(),functionSHA256=hashlib.sha256(source.encode()).hexdigest(),failure=failure,controlOnlyConsumed=True,guestExecuted=False,notes='exact pinned AST check; only second root mapping, no guest/startup/top-level execution')
 (O/'boundary-original.json').write_text(json.dumps(receipt,indent=2));print(json.dumps(receipt))
