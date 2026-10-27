import pathlib,json
O=pathlib.Path('/tmp/generally-callback-census-boundary-repair-oct27/ops');R=O.parent/'repo'
rows=json.loads((O/'selected-inputs.json').read_text())
extra=['test/renderer-physical-modifiers.test.cjs','test/renderer-side-modifier-polling.test.cjs','test/test-file-bundle.js','test/test-keyboard-message-lparam.js','test/test-set-keyboard-state.js']
for label in ['inventory','compiler-inventory']:
 for line in (O/(label+'.stdout')).read_text().splitlines():
  meta,p=line.split('\t');v=meta.split()
  if p in extra or p.startswith('tools/watx-src/'):
   rows.append(dict(path=p,oid=v[2],bytes=int(v[3])))
rows=list({x['path']:x for x in rows}.values())
(O/'selected-inputs.json').write_text(json.dumps(rows,indent=2))
(R/'.git/info/sparse-checkout').write_text('\n'.join('/'+x['path'] for x in rows)+'\n')
print('exact source closure',len(rows),sum(x['bytes'] for x in rows))
