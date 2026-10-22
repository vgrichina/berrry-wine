"""Inventory canonical archive and matching preserved runtime before copying."""
import hashlib, json, pathlib, subprocess, tarfile
from remote import E,W,REMOTE,save,run,transfer
REV='c26252c4a95babe583ade1d1c6e2da0c050be45c'
QUAL='ce4ce4f95eacaedff1b3e386f3ce3ae5d85bd16c'
A=pathlib.Path('/home/user/wine-assembly-mm-timer-qualified-integrate-oct22/scratch/runs/20261022-mm-timer-canonical-qualification/qualification-artifacts.tar.gz')
D=pathlib.Path('/home/user/wine-assembly-aoe3-original-recover-launch-oct22/scratch/runs/20261022-aoe3-original-recover-launch')
def git(*args):return subprocess.check_output(['git','-C',str(W),*args],stderr=subprocess.DEVNULL)
def sha(b):return hashlib.sha256(b).hexdigest()
assert sha(A.read_bytes())=='3e308c0012e996070a01c1f77d6f399e9aaf7adb2d2620b27af018a80d29e248'
with tarfile.open(A) as t: module=t.extractfile('build/wine-assembly.wasm').read()
assert sha(module)=='f644bbb26edc077239dac17b8b2cfda482aafd9eb44af4c4776d4fe153d5a1a7'
trees={r:{p:git('rev-parse',r+':'+p).decode().strip() for p in ['src','lib','tools','host.js','index.html','package-lock.json']} for r in [REV,QUAL]}
assert trees[REV]==trees[QUAL]
pins=json.loads((D/'runtime-pins.json').read_text())
tracked=[];fixtures=[]
for x in pins:
    if x['path']=='build/wine-assembly.wasm':assert x['sha256']==sha(module);continue
    try:b=git('show',REV+':'+x['path'])
    except subprocess.CalledProcessError:
        assert x['path'].startswith('test/binaries/'),x['path']
        b=(pathlib.Path('/home/user/wine-assembly')/x['path']).read_bytes()
        fixtures.append(x['path'])
    assert len(b)==x['size'] and sha(b)==x['sha256'],x['path']
    tracked.append(x['path'])
runner=json.loads((D/'runner-manifest.json').read_text())
save('module-inventory.json',dict(source=REV,qualification=QUAL,trees=trees,archive=str(A),archiveSha256=sha(A.read_bytes()),moduleSha256=sha(module),moduleBytes=len(module),verifiedGitFiles=len(tracked)-len(fixtures),fixtureFiles=fixtures,runtimeFiles=len(pins),runnerFiles=len(runner),decision='Reuse exact proven archive/module, no build. Historical source only.'))
save('runtime-pins.json',pins);save('runner-pins.json',runner)
transfer(json.dumps(dict(runtime=pins,runner=runner)).encode(),'runtime-expected.json')
code='''import pathlib,hashlib,json,shutil
R=pathlib.Path(%r);D=pathlib.Path('/home/user/aoe3-original-oct22');spec=json.loads((R/'runtime-expected.json').read_text())
def digest(p):
 with p.open('rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()
for x in spec['runtime']:
 p=D/'runtime'/x['path'];assert p.stat().st_size==x['size'] and digest(p)==x['sha256'],str(p)
for x in spec['runner']:
 p=D/x['path'];assert p.stat().st_size==x['size'] and digest(p)==x['sha256'],str(p)
assert {p.relative_to(D/'runtime').as_posix() for p in (D/'runtime').rglob('*') if p.is_file()}=={x['path'] for x in spec['runtime']}
shutil.copytree(D/'runtime',R/'runtime');shutil.copytree(D/'runner',R/'runner')
for x in spec['runtime']:
 p=R/'runtime'/x['path'];assert p.stat().st_size==x['size'] and digest(p)==x['sha256']
for x in spec['runner']:
 p=R/x['path'];assert p.stat().st_size==x['size'] and digest(p)==x['sha256']
print(json.dumps(dict(passAll=True,runtimeFiles=len(spec['runtime']),runnerFiles=len(spec['runner']),allFilesExact=True)))
'''%REMOTE
print(run(code,'runtime-staging.json')['stdout'])
