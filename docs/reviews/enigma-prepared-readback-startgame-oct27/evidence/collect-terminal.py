gate('terminal-collection')
assert time.time()>=1793075474.894+121
code='''import pathlib,json,time,tarfile,hashlib,zlib,shutil
h=pathlib.Path(ROOT);o=h/'ops';l=o/'launch'
cli=json.loads((o/'cli-exit.json').read_text());out=json.loads((l/'supervisor-outcome.json').read_text());startup=json.loads((l/'node-startup.json').read_text());controller=json.loads((l/'controller/outcome.json').read_text());sp=json.loads((o/'supervisor-pid.json').read_text())
ids=[dict(pid=p,start=str(s)) for p,s in out['owned']]+[sp];rows=[]
for r in ids:
 p=pathlib.Path('/proc')/str(r['pid'])/'stat'
 try:
  x=p.read_text().split(') ')[1].split();live=x[19]==r['start'] and x[0] not in ['Z','X'];observed=dict(state=x[0],start=x[19])
 except FileNotFoundError:live=False;observed=None
 rows.append(dict(**r,live=live,observed=observed))
v=dict(at=time.time(),identities=rows,ownedProcessAbsence=not any(r['live'] for r in rows),cli=cli,controller=controller,supervisor=out,nodeStartupExit=startup['exit'],box='bx_nmvbu5c7',state='API exec succeeds; info state not queried',expiry='2026-10-27T05:12:05Z',shutdownOwner='coordinator',free=shutil.disk_usage(h).free)
(o/'terminal-summary.json').write_text(json.dumps(v,indent=2));assert v['ownedProcessAbsence']
archive=o/'terminal-evidence.tar.gz'
with tarfile.open(archive,'w:gz') as t:
 for p in sorted(o.rglob('*')):
  if p.is_file() and p!=archive and p.suffix!='.png':t.add(p,arcname=str(p.relative_to(o)),recursive=False)
b=archive.read_bytes();print(json.dumps(dict(summary=v,archive=dict(path=str(archive),bytes=len(b),sha256=hashlib.sha256(b).hexdigest(),wire=len(zlib.compress(b,9))))))
'''.replace('ROOT',repr(str(H)))
j=json.loads(py(code)['stdout']);save('terminal-meta.json',j);f=j['archive'];fetch(f['path'],'terminal-evidence.tar.gz',f['wire'],f['sha256'],True)
import tarfile
target=O/'terminal';target.mkdir(exist_ok=True)
with tarfile.open(O/'terminal-evidence.tar.gz') as t:t.extractall(target,filter='data')
print(json.dumps(j['summary']))
