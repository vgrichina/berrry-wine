import hashlib,json,pathlib,shutil,subprocess,datetime
R=pathlib.Path('/home/user/deus-ex-training')
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
assets=json.loads((R/'evidence/assets.json').read_text())
sources=json.loads((R/'evidence/source-manifest.json').read_text())
for x in sources+assets['files']:
 p=R/x['path'];assert p.stat().st_size==x['size'],x['path'];assert sha(p)==x['sha256'],x['path']
module=sha(R/'wine-assembly.wasm')
assert module=='f644bbb26edc077239dac17b8b2cfda482aafd9eb44af4c4776d4fe153d5a1a7'
assert shutil.disk_usage(R).free>2147483648
result=dict(at=datetime.datetime.now(datetime.timezone.utc).isoformat(),sourceFiles=len(sources),assetFiles=len(assets['files']),moduleSha256=module,freeBytes=shutil.disk_usage(R).free,node=subprocess.check_output(['node','--version'],text=True).strip(),nodeSha256=sha(pathlib.Path(shutil.which('node'))),systemSupport=dict(path='test/binaries/tlbs/stdole2.tlb',sha256=sha(R/'test/binaries/tlbs/stdole2.tlb')))
(R/'evidence/runtime-identity.json').write_text(json.dumps(result,indent=2));print(json.dumps(result,indent=2))
