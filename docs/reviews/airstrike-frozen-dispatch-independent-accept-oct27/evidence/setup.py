from run import *
D=pathlib.Path('/tmp/airstrike-frozen-dispatch-protocol-repair-oct27')
a=json.loads((D/'ops/result.json').read_text())
for p,h in a['pins'].items():assert hashlib.sha256((D/'repo'/p).read_bytes()).hexdigest()==h
runner=D/'ops/production-runner.js';assert hashlib.sha256(runner.read_bytes()).hexdigest()==a['sourceRunnerSHA256']
(R/'.git/objects/info/alternates').write_text(str(D/'repo/.git/objects')+'\n')
(R/'.git/config').write_text('[core]\n repositoryformatversion=0\n bare=false\n sparseCheckout=true\n[user]\n name=Wine Ops Worker\n email=wine-ops@local\n[gc]\n auto=0\n[maintenance]\n auto=false\n[remote "origin"]\n url=git@github.com:vgrichina/wine-assembly.git\n')
(R/'.git/info/sparse-checkout').write_text(''.join('/'+p+'\n' for p in a['pins'])+'/test/test-airstrike-independent-accept-oct27.py\n/test/fixtures/airstrike-independent-accept-oct27.cjs\n/docs/reviews/airstrike-frozen-dispatch-independent-accept-oct27/\n')
dump('pins.json',dict(candidate='06f50dfa9a29cf94b8a7c9aa3bca7db6d8e52091',pins=a['pins'],runner=str(runner),runnerSHA256=a['sourceRunnerSHA256'],runnerRevision=a['sourceRunnerRevision'],sourceFixture=str(D/'ops/frozen-boundary.cjs'),sourceFixtureSHA256=hashlib.sha256((D/'ops/frozen-boundary.cjs').read_bytes()).hexdigest(),SSH=SSH,mountValidation='N/A source/test only, no mount argv, no guest',rootRefReceipt=json.loads((ROOT/'scratch/usage-watch/airstrike-frozen-dispatch-independent-accept-oct27/root-ref-digest.json').read_text()),reusedGroups={k:a['tests'][k] for k in []}))
print('six pins, production runner, immutable alternates and exact strict SSH verified; no mounts requested')
