import pathlib,json
H=pathlib.Path(__file__).parent;R=H.parent/'repo';G=R/'.git'
(G/'config').write_text('''[core]
 repositoryformatversion = 0
 filemode = true
 bare = false
 sparseCheckout = true
[user]
 name = Wine Ops Worker
 email = wine-ops@local
[gc]
 auto = 0
[maintenance]
 auto = false
[remote "origin"]
 url = git@github.com:vgrichina/wine-assembly.git
''')
(G/'HEAD').write_text('ref: refs/heads/task/enigma-frame-accounting-corrected-admission-oct27\n')
(G/'info/sparse-checkout').write_text('/tools/*.py\n/test/fixtures/enigma-controller/\n/docs/reviews/enigma-frame-accounting-corrected-admission-oct27/\n')
# Immutable read-only view contains only pinned content-addressed donor objects.
(G/'objects/info/alternates').write_text('/tmp/enigma-retained-review-budget-publication-oct27/ops/immutable-donor-object-view\n')
print('Sparse report orphan configured; strict SSH inherited by Git child only; no checkout/fetch/repack')
