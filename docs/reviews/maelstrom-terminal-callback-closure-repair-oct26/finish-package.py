from control import *
limits();signal.alarm(60);gate('finish-package')
E=R/'docs/reviews'/TASK
dump(O/'regression-baseline-output.json',dict(raw=read(O/'regression-baseline.log').decode(),rawSHA256=sha(O/'regression-baseline.log'),reason='Exact Node assertion output stored as a JSON string to preserve whitespace without adding whitespace errors to the Git patch. Raw ops log unchanged.'))
inc=json.loads(read(O/'incidents.json'));inc['current'].append('Packaging git diff --cached --check rejected trailing whitespace in exact expected-failure Node assertion stdout. Raw log retained unchanged in ops; committed JSON encodes exact text and rawSHA256. No oracle/test/result changed and no repaired-candidate failure.');dump(O/'incidents.json',inc)
shutil.copyfile(O/'regression-baseline-output.json',E/'regression-baseline-output.json');shutil.copyfile(O/'incidents.json',E/'incidents.json');shutil.copyfile(O/'finish-package.py',E/'finish-package.py')
(E/'regression-baseline.log').unlink()
manifest=[dict(path=str(p.relative_to(R)),bytes=p.stat().st_size,sha256=sha(p)) for p in sorted(E.iterdir()) if p.is_file() and p.name!='evidence-manifest.json']
dump(E/'evidence-manifest.json',manifest);dump(O/'committed-evidence-manifest.json',manifest)
git('stage-clean-evidence','add','--sparse','--',str(E.relative_to(R)));git('final-diff-check-corrected','diff','--cached','--check')
names=git('all-staged-names','diff','--cached','--name-only').splitlines()
assert all(p.startswith('docs/reviews/'+TASK+'/') or p in ['tools/maelstrom-original-errno-adapter.cjs','test/maelstrom-terminal-callback-closure.test.cjs'] for p in names)
print(json.dumps(dict(testedTree=json.loads(read(O/'tested-tree.json'))['testedTree'],manifestEntries=len(manifest),stagedFiles=len(names),resources=gate('ready-push')),indent=2))
