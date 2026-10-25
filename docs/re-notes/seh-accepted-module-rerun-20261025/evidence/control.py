import pathlib,subprocess,json
O=pathlib.Path(__file__).resolve().parent;R=O.parent/'repo'
old=json.load(open('/tmp/seh-current-canonical-qualifier-oct25/ops/module-tail-attempt.json'))['argv']
argv=old[:];argv[1]='--max-old-space-size=256';argv[4]=str(R/'docs/re-notes/seh-current-canonical-qualifier-20261025/qualify.cjs');argv[-1]='0'*64
p=subprocess.run(argv,capture_output=True,timeout=50)
assert len(p.stdout)+len(p.stderr)<=131072
assert p.returncode!=0 and b'expected hash not allowed' in p.stderr and not p.stdout
(O/'adaptation-rejection.json').write_text(json.dumps(dict(argv=argv,exit=p.returncode,stdout=p.stdout.decode(),stderr=p.stderr.decode(),passControl=True,beforeNativeModule=True,adaptation='Only qualifier path selects accepted pinned sparse file. Contract/absolute binary/guard unchanged.',historicalControls='/tmp/seh-current-canonical-qualifier-oct25/ops/controls.json',acceptedFinalTests='/tmp/seh-trust-anchor-independent-closeout-oct25/ops/final-tree-tests.json',acceptedIndependentAttacks='/tmp/seh-trust-anchor-independent-closeout-oct25/ops/final-tree-controls.json'),indent=2)+'\n')
print('Adapted accepted qualifier path rejects unallowed hash before native call PASS')
