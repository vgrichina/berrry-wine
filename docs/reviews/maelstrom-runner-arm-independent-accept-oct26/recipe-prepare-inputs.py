from common import *
import tarfile
T=pathlib.Path('/tmp/maelstrom-mode-transition-observer-repair-oct26')
paths={
 D/'tools/maelstrom-initialized-runner-arm.cjs':'6c69aa23d0e35f5d10cc7726720c05e0c98f9c3b2e24186430ef2169317b4055',
 D/'test/test-maelstrom-initialized-runner-arm.cjs':'67c36f8d6f23ea47d8518060199d01d91ac8dfc834649cbb2fab6b894b56530f',
 D.parent/'ops/corrected-final-run.js':'2f10a91ed0d909094ad122c5fc6fc5856d79d449603bb74c7cdeca63cefa0e9a',
 T/'ops/capture-run.js':'5b2596b3746e17427d26a50466ed36adcfec9f9f119755f05b1fa4bc3c79be58',
 T/'repo/test/test-maelstrom-mode-transition.cjs':'57758fa0a9b6d769fce63d873a2ebf7aca3fb62f18f1c7298d5e309054384491',
 T/'repo/tools/maelstrom-native-errno-latch.cjs':'52d044f14d6ee129b2b6f5b81335f7d2c00b70a9f7513b7bd179203936150da8',
 T/'repo/tools/maelstrom-original-errno-adapter.cjs':'85d86f19ce431c7c9248ef080e4267451f6027b5d8927dd2ebdf0d955d3dd075'}
for row in json.load(open(T/'repo/docs/reviews/maelstrom-mode-transition-observer-repair-oct26/fixture-inputs.json')):paths[T/'repo'/row['path']]=row['sha256']
archive=pathlib.Path('/tmp/maelstrom-qualified-original-api-capture-recovered-oct26/ops/closure.tar.gz')
paths[archive]='656a1569d905f49385a7e3a3e6b878f81b96aa547d275f5fcf521cfaa254dd4e'
for p,h in paths.items():assert sha(p.read_bytes())==h,str(p)
save('standing-inputs.json',[dict(path=str(p),bytes=p.stat().st_size,sha256=h,readOnly=True) for p,h in paths.items()]+[dict(path=NODE,bytes=pathlib.Path(NODE).stat().st_size,sha256=sha(pathlib.Path(NODE).read_bytes()),installedInPlace=True)])
with tarfile.open(archive) as tar:loader=tar.extractfile('runner/lib/dll-loader.js').read()
assert sha(loader)=='8dde0a569d1c8a10b4c12119ac5fde37e4aeb45629290fd1feb24fb6291a6145'
runner=(D.parent/'ops/corrected-final-run.js').read_bytes()
def excerpt(b,first,last):
 out=b''.join(b.splitlines(keepends=True)[first-1:last]);return dict(firstLine=first,lastLine=last,bytes=len(out),sha256=sha(out),text=out.decode())
snips={'runnerLoad':excerpt(runner,5702,5733),'initializerLoop':excerpt(loader,961,971),'owned':excerpt(loader,1095,1109),'steps':excerpt(loader,1127,1303),'wrapper':excerpt(loader,2066,2069)}
# Every retained excerpt is byte-exact. Full-file hashes bind the omitted context.
save('loader-excerpts.json',dict(archivePath=str(archive),archiveSHA256=sha(archive.read_bytes()),archiveMember='runner/lib/dll-loader.js',loaderSHA256=sha(loader),runnerSHA256=sha(runner),excerpts=snips))
(E/'loader-excerpts.json').write_bytes((O/'loader-excerpts.json').read_bytes())
print('PINNED INPUTS PASS')
