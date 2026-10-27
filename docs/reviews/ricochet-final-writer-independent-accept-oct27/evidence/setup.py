import pathlib,json,hashlib,os
O=pathlib.Path(__file__).resolve().parent;R=O.parent/'repo'
D=pathlib.Path('/tmp/ricochet-final-inventory-writer-contract-repair-oct27/repo')
(R/'.git/objects/info/alternates').write_text(str(D/'.git/objects')+'\n')
with (R/'.git/config').open('a') as f:f.write('\n[core]\n\tsparseCheckout = true\n\tsparseCheckoutCone = false\n[remote "origin"]\n\turl = git@github.com:vgrichina/wine-assembly.git\n[user]\n\tname = Wine Ops\n\temail = wine-ops@localhost\n')
(R/'.git/info/sparse-checkout').write_text('/tools/ricochet/\n/test/ricochet-*\n/docs/reviews/ricochet-final-*\n/docs/reviews/ricochet-measured-cpu-round-gameplay-oct27/\n')
print('own orphan sparse repo configured; donor objects read-only alternate; exact launcher SSH in runner')
