from run import *
D=pathlib.Path('/tmp/airstrike-complete-controller-main-integration-oct27/repo')
pins={'tools/airstrike-observation-bridge.py':'72df7a6e70d41bb3bb6c659e43b73f053bea1269c1b1a134f4060976a7d5f65f','tools/airstrike-menu-controller.py':'e96344c2a89dba87c28eba0aba9cd3ea5b400cc0245734b2bbc9248e110e7ebb'}
for p,h in pins.items():assert hashlib.sha256((D/p).read_bytes()).hexdigest()==h
assert hashlib.sha256((H/'production-runner.js').read_bytes()).hexdigest()=='4d7b9587676db38fcf3314807acb2b2a42b5f09d2c98fcf3dccb8a6cde9e1809'
(R/'.git/objects/info/alternates').write_text(str(D/'.git/objects')+'\n')
(R/'.git/config').write_text('[core]\n repositoryformatversion=0\n bare=false\n sparseCheckout=true\n[user]\n name=Wine Ops Worker\n email=wine-ops@local\n[gc]\n auto=0\n[maintenance]\n auto=false\n[remote "origin"]\n url=git@github.com:vgrichina/wine-assembly.git\n')
(R/'.git/info/sparse-checkout').write_text('/tools/airstrike-observation-bridge.py\n/tools/airstrike-menu-controller.py\n/test/test-airstrike-observation-bridge.py\n/test/test-airstrike-menu-controller.py\n/test/test-airstrike-frozen-dispatch.py\n/test/fixtures/airstrike-frozen-dispatch.cjs\n/docs/reviews/airstrike-frozen-dispatch-protocol-repair-oct27/\n')
dump('pins.json',dict(base='565ceadbe8e63c88754bda4590df156cbba6bf85',pins=pins,donor=str(D),SSH=SSH,mount='N/A source/test only; no mounts or guest execution',rootRefReceipt=json.loads((ROOT/'scratch/usage-watch/airstrike-frozen-dispatch-protocol-repair-oct27/root-ref-digest.json').read_text())))
(H/'setup-incidents.txt').write_text('Initial policy/supervisor read exceeded 8192B display allowance (tool output 8278 tokens); retained in original events, no retrospective compliance claimed. Subsequent displays bounded. Missing exploratory local.py read retained. No runtime attempted.\n')
print('pinned source, exact SSH, sparse read-only donor alternates configured')
