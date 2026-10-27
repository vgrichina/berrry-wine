import run as c,json
p=c.R/'.git/objects/info/alternates'
c.dump('alternates-initial-overinclusive.json',dict(stores=p.read_text().splitlines(),incident='checkout succeeded but nested immutable donor graph produced nesting warnings; no donor writes; narrowed to canonical acceptance donor plus root object store'))
stores=['/tmp/airstrike-caption-independent-accept-publication-oct27/repo/.git/objects',str(c.ROOT/'.git/objects')]
p.write_text('\n'.join(stores)+'\n')
c.dump('alternates.json',dict(readOnly=True,stores=stores,noDonorMutations=True))
print('Narrowed immutable alternates to canonical acceptance and root stores.')
