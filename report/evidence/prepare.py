gate('prepare')
accepted=pathlib.Path('/tmp/enigma-accepted-full-frame-main-integration-oct27/repo')
receipt=accepted.parent/'ops/receipt-manifest.json'
assert sha(receipt.read_bytes())=='fe03f3ce22d21da496489ebbe5d35e5087f5cd6057b91a5e86675c6c033a13c7'
M=ROOT/'scratch/usage-watch/enigma-progressive-published-runtime-map-oct27.json';rs=json.loads(M.read_text())['files']
pins={'runner/tools/enigma-frozen-gameplay-controller.py':('tools/enigma-frozen-gameplay-controller.py','78929d7f6dcf11f9481579b9f90eee9122c00b7088493e03c5ea7e76f4b50416'),'runner/tools/enigma-supervised-gameplay.py':('tools/enigma-supervised-gameplay.py','8da9bd8dd47ae03dea50c7f55c2f988906f95252a4d8ef95e0cfb62bd6e17858')}
rs=[r for r in rs if r['target'] not in pins]
for t,(p,d) in pins.items():
 b=(accepted/p).read_bytes();assert sha(b)==d;rs.append(dict(target=t,source=str(accepted/p),bytes=len(b),sha256=d))
for r in rs:
 p=pathlib.Path(r.get('source',r.get('path')));b=p.read_bytes();assert len(b)==r['bytes'] and sha(b)==r['sha256'],r['target']
assert len(rs)==2665 and sum(r['bytes'] for r in rs)==37537228
assert next(r for r in rs if r['target']=='runner/test/run.js')['sha256']=='6dc104b3c10db701c0b1aec5954dd00cc29a7b6009970a5876ccc27426e7fa9e'
mp=pathlib.Path('/tmp/enigma-reconciled-canonical-boat-build-oct26/modules/wine-assembly.wasm');mb=mp.read_bytes();assert len(mb)==1880854 and sha(mb)=='af202eea3c5c11aadb117b5c8eed1851d50ce2ce4246a4122845699b472fcc2b';rs.append(dict(target='modules/wine-assembly.wasm',source=str(mp),bytes=len(mb),sha256=sha(mb)))
save('runtime-manifest.json',rs)
save('pins.json',dict(revision='3b7667ff13bc727ed41d2131a3e063422a7bd66a',files=len(rs),bytes=sum(r['bytes'] for r in rs),receiptSHA256=sha(receipt.read_bytes()),mapSHA256=sha(M.read_bytes()),description='retained emulator with earlier diagnostic static DLL overlays plus accepted current controllers',staleCloseoutHashes=2,reusedTests='accepted merged source checks and independent tests; not rerun'))
old=pathlib.Path('/tmp/enigma-published-progressive-startgame-oct27/ops');c=json.loads((old/'launch-config.json').read_text());c=json.loads(json.dumps(c).replace('/tmp/enigma-published-progressive-startgame-oct27',str(H/'repo')).replace(str(H/'repo/ops'),str(O)))
c['cutoff_at']=1793104980
c['controller'].update(max_captures=3,request_timeout=1,review_seconds=48,review_plan=dict(checkpoint_seconds=[24,24],progress_seconds=18),progress=dict(max_checkpoints=2,total_seconds=110,cpu_reserve=15,api_bytes=1048576,capture_total_bytes=2100000))
save('launch-config.json',c)
# Materialize exact verified closure, no checkout/ref mutation or compilation.
for r in rs:
 p=H/'repo'/r['target'];p.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(r.get('source',r.get('path')),p)
runner=(H/'repo/runner/test/run.js').read_text();canonical=runner[runner.index('const getArg ='):runner.index('const hasFlag =')]
parser=(pathlib.Path('/tmp/enigma-full-frame-terminal-startgame-oct27/ops/parser-check.cjs')).read_text();parser=parser.replace('/tmp/enigma-cleanup-startgame-oct27',str(H/'repo')).replace('/tmp/enigma-full-frame-terminal-startgame-oct27/ops',str(O));assert canonical in parser
(O/'parser-check.cjs').write_text(parser)
save('parser-identity.json',dict(canonicalSHA256=sha(canonical.encode()),runnerSHA256=sha(runner.encode()),argv=c['command'],ssh=SSH))
print(json.dumps(dict(files=len(rs),bytes=sum(r['bytes'] for r in rs),pins='PASS',plannedSeconds=94,plusReady=102)))
