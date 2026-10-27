import hashlib,json,pathlib
O=pathlib.Path(__file__).resolve().parent;R=O.parent/'repo';B=R/'docs/reviews/ricochet-final-inventory-writer-contract-repair-oct27'
manifest=json.loads((B/'manifest.json').read_text())
for name,item in manifest.items():
 b=(R/name).read_bytes();assert len(b)==item['bytes'] and hashlib.sha256(b).hexdigest()==item['sha256'],name
paths=list((R/'tools/ricochet').glob('*.py'))+list((R/'test').glob('*.py'))+[B/'integrate.py']
for p in paths:compile(p.read_bytes(),str(p),'exec')
if len(__import__('sys').argv)>1:
 entries={}
 for line in pathlib.Path(__import__('sys').argv[1]).read_text().splitlines():
  head,name=line.split('\t',1);mode,kind,h=head.split();entries[name]=h
 expected=set(manifest)|{str((B/'manifest.json').relative_to(R))}
 assert set(entries)==expected,(set(entries)-expected,expected-set(entries))
 for name,h in entries.items():
  b=(R/name).read_bytes();assert hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()==h,name
print(json.dumps(dict(manifestPayloads=len(manifest),syntax=len(paths),completeCommittedClosure='verified' if len(__import__('sys').argv)>1 else 'pending ls-tree receipt')))
