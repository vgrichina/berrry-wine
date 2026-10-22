"""Offline controls only. Never starts a guest or accesses the box."""
import pathlib,hashlib,json,subprocess,tarfile,tempfile,os
E=pathlib.Path(__file__).resolve().parent
A=pathlib.Path('/home/user/wine-assembly-mm-timer-qualified-integrate-oct22/scratch/runs/20261022-mm-timer-canonical-qualification/qualification-artifacts.tar.gz')
def sha(b):return hashlib.sha256(b).hexdigest()
assert sha(A.read_bytes())=='3e308c0012e996070a01c1f77d6f399e9aaf7adb2d2620b27af018a80d29e248'
assert sha((E/'historical-exports.wat.txt').read_bytes())=='bcbf5b24281cc993e0e6f897fc99c69f2c14730f9056dcfd098d3c2892f3afc6'
for script in ['observer.js','control-test.js','primitive-probe.js','coverage-gate.js']:subprocess.run(['node','--check',str(E/script)],check=True)
results={}
with tempfile.TemporaryDirectory(prefix='aoe3-observer-control-') as d:
 with tarfile.open(A) as t:b=t.extractfile('build/wine-assembly.wasm').read()
 assert len(b)==1878971 and sha(b)=='f644bbb26edc077239dac17b8b2cfda482aafd9eb44af4c4776d4fe153d5a1a7'
 p=pathlib.Path(d)/'module.wasm';p.write_bytes(b)
 for script in ['control-test.js','primitive-probe.js','coverage-gate.js']:
  r=subprocess.run(['node',str(E/script)],env=dict(os.environ,AOE3_CONTROL_MODULE=str(p)),capture_output=True,text=True)
  assert r.returncode==0,(script,r.stdout,r.stderr)
  x=json.loads(r.stdout);assert x['pass'];results[script]=x
assert results['coverage-gate.js']['guestRunAuthorized'] is False
if (E/'seals.json').exists():
 for n,h in json.loads((E/'seals.json').read_text()).items():assert sha((E/n).read_bytes())==h,n
print(json.dumps(dict(passAll=True,results=results,guestRuns=0)))
