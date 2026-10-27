import pathlib,json
O=pathlib.Path('/tmp/generally-callback-census-boundary-repair-oct27/ops');R=O.parent/'repo'
rows=[]
for label in ['inventory','root-inventory','tooling-inventory']:
 for line in (O/(label+'.stdout')).read_text().splitlines():
  meta,p=line.split('\t');v=meta.split()
  if v[1]!='blob':continue
  if p.startswith('src/') and (p.endswith(('.wat','.watx')) or p=='src/api_table.json') or p.startswith('lib/') and p.endswith('.js') or '/' not in p and p.endswith('.js') or p.startswith('tools/') or p.startswith('test/') and any(x in p for x in ['callback-ownership-census','host-census-independent','host-worker-lifecycle','host-raf-present','renderer-dialog-button-queue','renderer-dialog-caption-drag','renderer-mouse-drag-mask','renderer-input-button-hold','js-com-callback-ownership']):
   rows.append(dict(path=p,oid=v[2],bytes=int(v[3])))
rows=list({x['path']:x for x in rows}.values())
assert sum(x['bytes'] for x in rows)<40*1024**2
(O/'selected-inputs.json').write_text(json.dumps(rows,indent=2))
(R/'.git/info/sparse-checkout').write_text('\n'.join('/'+x['path'] for x in rows)+'\n')
print('exact sparse paths',len(rows),'bytes',sum(x['bytes'] for x in rows))
