import pathlib,sys,runpy,importlib.util,hashlib,json
H=pathlib.Path('/tmp/gl-detached-peak-rss-repair-oct26')
P=pathlib.Path('/tmp/gl-launch-controls-retained-challenges-oct26')
f=P/'ops/detached-peak-baseline-corrected.py'
assert hashlib.sha256(f.read_bytes()).hexdigest()=='40d190267cb84f8bbd76594a80a268d207f980b50f7ec5d9c682c8968ec43602'
mode=sys.argv[1]
paths=[P/'tmp'/n for n in ('ready','release','done','measured-peak.json','detached-pid')]+[P/'ops'/n for n in ('detached-control.json','peak-challenge.json')]
saved={p:p.read_bytes() if p.exists() else None for p in paths}
if mode=='after':
 original=importlib.util.spec_from_file_location
 def redirect(name,location,*a,**kw):
  if str(location)=='/tmp/gl-browser-launch-control-repair-oct26/source/test/helpers/palette-browser-supervisor.py':
   location=H/'repo/test/helpers/palette-browser-supervisor.py'
  return original(name,location,*a,**kw)
 importlib.util.spec_from_file_location=redirect
# Only module source selection changes after repair. Fixture bytes, child commands,
# cap, synchronization, oracle and all cleanup/sentinel checks are unchanged.
try:
 for p in paths: p.unlink(missing_ok=True)
 sys.argv=[str(f)]
 runpy.run_path(str(f),run_name='__main__')
finally:
 for p,b in saved.items():
  if p.exists(): (H/'ops'/(mode+'-'+p.name)).write_bytes(p.read_bytes())
  if b is None: p.unlink(missing_ok=True)
  else: p.write_bytes(b)
