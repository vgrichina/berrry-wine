from control import *
limits();signal.alarm(60)
C=pathlib.Path('/home/user/.codex')
older=json.loads(read('/tmp/maelstrom-status-event-validation-repair-oct26/ops/sqlite-baseline.json'))
dump(O/'sqlite-baseline.json',{str(p):min(p.stat().st_size,older.get(str(p),p.stat().st_size)) for p in C.glob('*.sqlite')})
dump(O/'incidents.json',dict(current=["Initial pwd had no per-child limits. Bootstrap inspections used CPU60/file24MiB/VM128MiB/timeout60 kill5, but lacked output supervisor, used unbounded read_text/read_bytes for some local files, and first tool output truncated. No retrospective compliance. Full controls apply after bootstrap; conservative inherited DB baseline includes growth."],historical='Donor ops/incidents.json, published review incidents and original failure retained unchanged; no retrospective compliance.'))
dump(O/'configuration.json',dict(ssh=SSH,mountArgv=[],intendedMountedFiles=[],validation='No mount/runtime operation. Reuse unchanged donor configuration.json no-mount receipt; no parser invocation needed for empty mount argv.',rootInitialReceipt=str(ROOT/'scratch/usage-watch'/TASK/'root-ref-digest.json')))
gate('before-setup')
assert run('donor-pin',['git','-C',str(DONOR),'rev-parse','HEAD'],B)==BASE
assert sha(DONOR/'docs/reviews/maelstrom-state-acceptance-retained-closeout-oct26/remaining-independent.cjs')=='10421b75e1ed40dae8e51368537eb76b1f9aba75460cfc3831bd840d556d02e5'
run('git-init',['git','init','-q',str(R)],B)
a=json.loads(read(ROOT/'scratch/usage-watch/maelstrom-state-oracle-reconcile-accept-oct26.admission.json'))
leaves=[str(DONOR/'.git/objects')]+json.loads(read('/tmp/maelstrom-terminal-callback-closure-repair-oct26/ops/pins.json'))['flatLeaves']
V=O/'v';L=O/'l';V.mkdir();L.mkdir()
for i,leaf in enumerate(dict.fromkeys(leaves)):
 v=V/str(i);v.mkdir();(L/str(i)).symlink_to(leaf)
 for e in os.scandir(leaf):
  if e.name not in ('info','alternates'):(v/e.name).symlink_to('../../l/'+str(i)+'/'+e.name)
(R/'.git/objects/info/alternates').write_text(''.join(os.path.relpath(v,R/'.git/objects')+'\n' for v in V.iterdir()))
paths=['/tools/maelstrom-native-errno-latch.cjs','/tools/maelstrom-original-errno-adapter.cjs','/tools/maelstrom-select-completion-hook.cjs','/test/maelstrom-adapter-scalar-anchor.test.cjs','/test/maelstrom-native-latch-rejection.test.cjs','/test/maelstrom-native-errno-latch.test.cjs','/test/maelstrom-native-errno-source-snapshot.test.cjs','/test/maelstrom-original-errno-adapter.cjs','/test/maelstrom-select-hook-model.cjs','/docs/reviews/maelstrom-rejection-diagnostics-independent-oct26/independent.cjs','/docs/reviews/maelstrom-state-acceptance-retained-closeout-oct26/','/test/maelstrom-terminal-callback-closure.test.cjs','/test/maelstrom-status-event-validation.test.cjs','/docs/reviews/maelstrom-terminal-callback-closure-repair-oct26/']
git('sparse-enable','config','core.sparseCheckout','true');git('sparse-mode','config','core.sparseCheckoutCone','false');(R/'.git/info/sparse-checkout').write_text('\n'.join(paths)+'\n')
gate('before-checkout');git('checkout','checkout','-b',BRANCH,BASE)
for k in ['user.name','user.email']:git('config-'+k,'config',k,run('donor-'+k,['git','-C',str(DONOR),'config',k],B))
git('origin','remote','add','origin',run('donor-origin',['git','-C',str(DONOR),'remote','get-url','origin'],B));git('ssh','config','core.sshCommand',SSH)
dump(O/'pins.json',dict(candidate=BASE,tree=git('base-tree','rev-parse','HEAD^{tree}'),flatLeaves=leaves,checkedOut={str(p.relative_to(R)):sha(p) for p in R.rglob('*') if p.is_file() and '.git' not in p.parts},standingSourceInputs=sha('/tmp/maelstrom-native-latch-rejection-reason-oct26/ops/source-inputs.json')))
run('claim',['bash','-c','echo "2026-10-26 '+TASK+' CLAIM independent ACCEPT/REJECT terminal callback closure; candidatebbcc8685 root tracked/index/refs and donors READONLY; no workers/integration/runtime; own bounded watcher." >> messageboard.txt\ntail -c 1024 messageboard.txt'],ROOT)
print('setup PASS',json.dumps(gate('after-checkout')))
