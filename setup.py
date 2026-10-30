from supervisor import *
controls=[]
for label,kw in [('omitted',{}),('root',{'cwd':'/home/user/wine-assembly'}),('donor',{'cwd':'/tmp/tuxracer-tested-syntax-publication-oct29/repo'}),('outside',{'cwd':'/tmp'})]:
    try: run([sys.executable,'-c','raise Exception("must not spawn")'],name='negative-'+label,**kw)
    except (TypeError,ValueError): controls.append(label)
    else: raise AssertionError(label)
assert run([sys.executable,'-c','import os; print(os.getcwd())'],cwd=ROOT,name='sentinel').strip()==str(ROOT)
save('containment',dict(rejectedBeforeSpawn=controls,sentinel=True))
save('launch-configuration',dict(SSH=SSH,mountArgv=[],intendedMountedFiles=[],mountValidation='empty argv: no mount execution or filename parsing applicable',runtime=False))
git(['init'],'init',initial=True)
git(['config','user.name','Wine Ops Worker'],'name',mutate=True)
git(['config','user.email','wine-ops@localhost'],'email',mutate=True)
git(['config','core.sparseCheckout','true'],'sparse-config',mutate=True)
paths=['tools/recovery/tuxracer-original-win32-recovery-oct28.py','tools/recovery/test-tuxracer-real-media-tcl-syntax-gap-oct29.py','tools/recovery/tuxracer-real-media-tcl-syntax-gap-oct29-report.md','tools/recovery/test-tuxracer-published-syntax-independent-accept-oct29.py','tools/recovery/tuxracer-published-syntax-independent-accept-oct29-report.md','tools/recovery/tuxracer-published-syntax-independent-accept-oct29-evidence.json']
admission('sparse-definition')
(ROOT/'.git/info/sparse-checkout').write_text('\n'.join('/'+p for p in paths)+'\n')
git(['checkout','-b','task/tuxracer-published-syntax-independent-accept-oct29','e57ec87fb3a37260abb5c7e45ad8d37f3cc4e803'],'checkout',mutate=True)
d=json.loads(Path('/home/user/wine-assembly/scratch/usage-watch/tuxracer-published-syntax-independent-accept-oct29-dispatch.json').read_text())
for p,pin in d['sourceAndTestPins'].items():
    assert hashlib.sha256((ROOT/p).read_bytes()).hexdigest()==pin['sha256']
save('pins',dict(candidate=d['candidate'],sourceAndTestPins=d['sourceAndTestPins'],inventory=d['sourceInputs']['inventory'],mediaRoot=d['sourceInputs']['extracted']))
source=ROOT/'tools/recovery/tuxracer-original-win32-recovery-oct28.py'
inp=d['sourceInputs']
run([sys.executable,str(source),'literal-sources',inp['extracted'],inp['inventory']['path']],cwd=ROOT,name='original-media-cli')
run([sys.executable,str(ROOT/paths[1]),'--source',str(source),'--media-root',inp['extracted'],'--inventory',inp['inventory']['path'],'--prior',inp['observedClosure'],'--cli-output',str(E/'original-media-cli.stdout'),'--task-dir',str(ROOT),'--result',str(E/'unchanged-targeted-result.json')],cwd=ROOT,name='unchanged-targeted')
print('Pinned original-media API/CLI and unchanged targeted test PASS')
