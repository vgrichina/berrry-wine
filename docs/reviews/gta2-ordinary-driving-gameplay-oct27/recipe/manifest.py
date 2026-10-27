from run import *
rows=[]
for p in R.rglob('*'):
 if '.git' in p.parts or not p.is_file():continue
 b=p.read_bytes();rows.append(dict(path=str(p),target='runner/'+p.relative_to(R).as_posix(),bytes=len(b),sha256=hashlib.sha256(b).hexdigest(),kind='source',revision='4a2bec145ef34b0d084b96b09a682a16e89703fd'))
for x in json.loads((H/'game-closure.json').read_text())['files']:
 p=pathlib.Path(x['path']);rel=p.relative_to(ROOT).as_posix();rows.append(dict(path=str(p),target='runner/'+rel,bytes=x['bytes'],sha256=x['sha256'],kind='game'))
dep=pathlib.Path('/tmp/wa-toolhelp-remote-input-20261019/node_modules/pngjs')
for p in dep.rglob('*'):
 if p.is_file():rows.append(dict(path=str(p),target='runner/node_modules/pngjs/'+p.relative_to(dep).as_posix(),bytes=p.stat().st_size,sha256=hashlib.sha256(p.read_bytes()).hexdigest(),kind='dependency'))
rows.append(dict(path=str(S),target='trusted-supervisor.py',bytes=S.stat().st_size,sha256=hashlib.sha256(S.read_bytes()).hexdigest(),kind='trusted'))
dump('stage-manifest.json',rows)
assert sum(x['bytes'] for x in rows)<160*M
print(json.dumps(dict(files=len(rows),bytes=sum(x['bytes'] for x in rows),manifestSHA256=hashlib.sha256((H/'stage-manifest.json').read_bytes()).hexdigest(),readOnlyOriginals=True,sourceGit=size(R),ops=size(H))))
