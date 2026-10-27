import pathlib,json,hashlib,shutil
H=pathlib.Path(__file__).parent;R=H.parent/'repo';D=pathlib.Path('/tmp/enigma-reviewed-menu-budget-repair-oct27')
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
m=json.loads((D/'ops/receipt-manifest.json').read_text())
for p,h in m['sourcePins'].items():assert sha(D/'repo'/p)==h,p
paths=set(json.loads((D/'ops/input-pins.json').read_text())['pins'])|set(m['sourcePins'])
for p in paths:
 q=R/p;q.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(D/'repo'/p,q)
shutil.copytree(D/'ops',H/'retained-donor',ignore=shutil.ignore_patterns('board-watch.log'))
for p in (D/'ops').iterdir():
 if p.is_file() and p.name not in ('run.py','setup.py','package.py','board-watch.log'):
  shutil.copyfile(p,H/p.name)
for name in ('original-boundary','original-boundary-v2','original-boundary-v3','original-boundary-v4','repaired-boundary','preflight-matrix','preflight-final','final-preflight','final-adequate','final-adequate-v2','progressive-affected'):
 if (D/'ops'/name).exists():shutil.copytree(D/'ops'/name,H/name)
(H/'recovery-pins.json').write_text(json.dumps(dict(sourceRevision=m['sourceRevision'],donor=str(D),sourcePins={p:sha(R/p) for p in sorted(paths)},donorManifestSHA256=sha(D/'ops/receipt-manifest.json'),retainedFiles=[dict(path=str(p.relative_to(H/'retained-donor')),bytes=p.stat().st_size,sha256=sha(p)) for p in sorted((H/'retained-donor').rglob('*')) if p.is_file()]),indent=2)+'\n')
print('Recovered pinned source closure and all causal donor receipts; donor untouched')
