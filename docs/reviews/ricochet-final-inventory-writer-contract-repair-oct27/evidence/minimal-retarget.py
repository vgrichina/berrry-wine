import pathlib,hashlib
R=pathlib.Path(__file__).resolve().parent.parent/'repo'
p=R/'test/ricochet-late-link-minimal.py';b=p.read_bytes()
assert hashlib.sha256(b).hexdigest()=='9c17daa4038dbc696719045324eab6456a1e78ffb0a26c14842eea80d8ed8b1f'
text=b.decode().replace('/tmp/ricochet-consumed-control-accounting-repair-oct27/repo/tools/ricochet/runtime-accounting.py',str(R/'tools/ricochet/runtime-accounting.py')).replace('857e30508c1e4db1c943b765a0e7551842973032cc5431eb08235dabda903364',hashlib.sha256((R/'tools/ricochet/runtime-accounting.py').read_bytes()).hexdigest())
exec(compile(text,str(p),'exec'),globals())
