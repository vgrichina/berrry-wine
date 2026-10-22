"""Bounded offline instrumentation controls. No runtime/guest startup/build."""
import pathlib, hashlib, json, subprocess, tarfile, tempfile, os
E=pathlib.Path(__file__).resolve().parent
DONOR=pathlib.Path('/home/user/wine-assembly-aoe3-observer-boundary-quota-oct22/scratch/runs/20261022-aoe3-observer-boundary-quota')
ORIGINAL=pathlib.Path('/home/user/wine-assembly-aoe3-unsupported-dialog-diagnosis-oct22/scratch/runs/20261022-aoe3-unsupported-dialog-diagnosis')
A=pathlib.Path('/home/user/wine-assembly-mm-timer-qualified-integrate-oct22/scratch/runs/20261022-mm-timer-canonical-qualification/qualification-artifacts.tar.gz')
def sha(b):return hashlib.sha256(b).hexdigest()
assert sha(A.read_bytes())=='3e308c0012e996070a01c1f77d6f399e9aaf7adb2d2620b27af018a80d29e248'
pe=(ORIGINAL/'original/age3.exe').read_bytes()
assert sha(pe)=='5d7fb9a8ae28e3e3758cee1346b2960f20ba7b4feaa511fa7f52ceffeeeca256'
# These ranges lie within .text, raw offset==RVA per retained PE section map.
fragments=[dict(address=start,bytes=list(pe[start-0x400000:end-0x400000])) for start,end in [(0x8e98b1,0x8e98e0),(0x8e98ec,0x8e9904)]]
assert bytes(fragments[0]['bytes'][:6])==bytes.fromhex('ff159408b300')
assert bytes(fragments[0]['bytes'][22:25])==bytes.fromhex('ff5228')
assert bytes(fragments[0]['bytes'][40:43])==bytes.fromhex('ff5238')
assert bytes(fragments[1]['bytes'][-3:])==bytes.fromhex('ff5650')
assert sha((DONOR/'historical-exports.wat.txt').read_bytes())=='bcbf5b24281cc993e0e6f897fc99c69f2c14730f9056dcfd098d3c2892f3afc6'
assert sha((DONOR/'observer.js').read_bytes())=='b89ab5bba916de36a324b6068d7df09f26ef227f8940ca58995677b946032032'
for n in ['instance-hook.js','indirect-control.js','mechanics-gate.js']:subprocess.run(['node','--check',str(E/n)],check=True)
with tempfile.TemporaryDirectory(prefix='aoe3-indirect-') as d:
 with tarfile.open(A) as t:b=t.extractfile('build/wine-assembly.wasm').read()
 assert len(b)==1878971 and sha(b)=='f644bbb26edc077239dac17b8b2cfda482aafd9eb44af4c4776d4fe153d5a1a7'
 p=pathlib.Path(d);(p/'module.wasm').write_bytes(b);(p/'fixture.json').write_text(json.dumps(dict(fragments=fragments)))
 env=dict(os.environ,AOE3_CONTROL_MODULE=str(p/'module.wasm'),AOE3_CONTROL_FIXTURE=str(p/'fixture.json'),AOE3_OBSERVER=str(DONOR/'observer.js'))
 r=subprocess.run(['node',str(E/'indirect-control.js')],env=env,capture_output=True,text=True)
 if r.returncode:raise RuntimeError(r.stdout+r.stderr)
 x=json.loads(r.stdout);assert x['pass']
 (E/'actual-wasm-controls.json').write_text(json.dumps(x,indent=2)+'\n')
 subprocess.run(['python3',str(E/'prepare-harness.py'),'--output-dir',str(p/'prepared'),'--deployment-dir','/home/user/aoe3-original-oct22/diagnostics-indirect-next'],check=True,capture_output=True,text=True)
 gate=subprocess.run(['node',str(E/'mechanics-gate.js'),str(E/'actual-wasm-controls.json')],check=True,capture_output=True,text=True)
 (E/'mechanics-gate-result.json').write_text(json.dumps(json.loads(gate.stdout),indent=2)+'\n')
(E/'opcode-fixtures.json').write_text(json.dumps(dict(originalExeSha256=sha(pe),fragments=fragments,syntheticCallees=True),indent=2)+'\n')
print(json.dumps(dict(passed=True,actualHistoricalWasm=True,originalRouteEvidence=False,records=len(x['rows']),blockHooks=len(x['raw']),readOnlySeals=x['readOnlySeals'],negativeControls=x['negativeControls'],observerSha256=sha((DONOR/'observer.js').read_bytes()))))
