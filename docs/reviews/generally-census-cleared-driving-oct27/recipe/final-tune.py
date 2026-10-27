from common import *
p=H/'remote.py';t=p.read_text().replace("if out.stat().st_size+err.stat().st_size>output:return 'output allocation'", "logbytes=out.stat().st_size+err.stat().st_size\n  if label=='guest':logbytes+=sum(p.stat().st_size for p in [H/'launch.stdout',H/'launch.stderr'] if p.exists())\n  if logbytes>output:return 'output allocation'")
p.write_text(t)
rs=json.loads((H/'stage-manifest.json').read_text())
for x in rs:
 if x['target']=='ops/remote.py':
  b=p.read_bytes();x.update(bytes=len(b),sha256=sha(b))
save('stage-manifest.json',rs);p=H/'stage-manifest.json';rs.append(dict(source=str(p),target='ops/stage-manifest.json',bytes=p.stat().st_size,sha256=sha(p.read_bytes())));save('transfer-manifest.json',rs)
print('remote guest output control includes launch stdout AND stderr; file cap24MiB; no Git DATA in Node ancestors')
