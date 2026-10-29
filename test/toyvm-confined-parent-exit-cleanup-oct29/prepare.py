from guard import *
import shutil,ast
configure_parent()
D=pathlib.Path('/home/user/wine-assembly/scratch/usage-watch')
dispatch=D/'toyvm-confined-parent-exit-cleanup-oct29-dispatch.json';admit=D/'toyvm-confined-parent-exit-cleanup-oct29-admission.json'
assert hashlib.sha256(dispatch.read_bytes()).hexdigest()=='990fb47b9e3cb099341baa03e56c9aa62f181abcee7b743faeff7de305da2b41'
assert hashlib.sha256(admit.read_bytes()).hexdigest()=='4bd7e7c63e9bfb3f74edae12af683057ec5189332ea2429094b790efdfe7c992'
d=json.loads(dispatch.read_bytes());admission()
for rel,pin in d['sourcePins'].items():
    p=REPO/rel;assert dict(bytes=p.stat().st_size,sha256=hashlib.sha256(p.read_bytes()).hexdigest())==pin
for name in ['fixture.py','guard.py','remote_test.py','limit_contract.py']:ast.parse((ROOT/name).read_text())
assert hashlib.sha256((ROOT/'limit_contract.py').read_bytes()).hexdigest()==d['limitModulePin']['sha256']
receipt=pathlib.Path(d['originalCancellationReceipt']);assert hashlib.sha256(receipt.read_bytes()).hexdigest()==d['originalCancellationReceiptPin']['sha256']
shutil.copyfile(receipt,ROOT/'cancellation.json')
(ROOT/'source-pins.json').write_text(json.dumps(d['sourcePins']))
save('prelaunch.json',dict(dispatchSHA256=hashlib.sha256(dispatch.read_bytes()).hexdigest(),admissionSHA256=hashlib.sha256(admit.read_bytes()).hexdigest(),sourcePins=d['sourcePins'],inputReceiptPin=d['originalCancellationReceiptPin'],fixtureSHA256=hashlib.sha256((ROOT/'fixture.py').read_bytes()).hexdigest(),mountArgv=[],intendedMountedFiles=[],mountValidation='No guest mount options: exact production CLI argparse accepts no mount argument; no guest execution',ssh=ENV['GIT_SSH_COMMAND'],syntaxPASS=True,rootRefReceipt=str(D/'toyvm-confined-parent-exit-cleanup-oct29/root-ref-digest.json'),allocation=25165824,forecast=dict(sourceGit=3*1048576,evidence=1048576,WAL=8*1048576,publish=3*1048576,uncertainty=9*1048576)))
git(['init','-b','task/toyvm-confined-parent-exit-cleanup-oct29'],cwd=REPO,init=True)
git(['config','user.name','Wine Ops'],cwd=REPO,mutate=True)
git(['config','user.email','wine-ops@localhost'],cwd=REPO,mutate=True)
git(['read-tree',d['candidate']],cwd=REPO,mutate=True)
git(['update-ref','HEAD',d['candidate']],cwd=REPO,mutate=True)
git(['config','core.sparseCheckout','true'],cwd=REPO,mutate=True)
(REPO/'.git/info/sparse-checkout').write_text('/test/toyvm-confined-parent-exit-cleanup-oct29/\n')
save('prepare-PASS.json',dict(PASS=True,candidate=d['candidate']))
print('prepare PASS')
