from common import *
P=pathlib.Path('/tmp/maelstrom-runner-arm-independent-accept-oct26')
manifest=P/'repo/docs/reviews/maelstrom-runner-arm-independent-accept-oct26/evidence-manifest.json'
assert sha(manifest.read_bytes())=='a19979847bda02cad750d2ad2241f6f7101a22da27d304bb3669d63274884b83'
rows=json.load(open(P/'ops/standing-inputs.json'))
for row in rows: assert sha(pathlib.Path(row['path']).read_bytes())==row['sha256'],row['path']
for name,h in [('global-order-reproducer.cjs','0b9b4be5e0a8a1ff0b69140ea13e01ea3ce402a2dcabc36a986488682cd95808'),('independent-challenges.cjs','01a62ff25f8d8a79820caa27d697bc09d089e064d79167111a8cd02682965d5f')]:
 p=P/'repo/docs/reviews/maelstrom-runner-arm-independent-accept-oct26'/name;assert sha(p.read_bytes())==h
save('standing-inputs.json',rows)
save('reused-evidence.json',dict(independentManifestSHA256=sha(manifest.read_bytes()),groups=['9 independent','30 wiring','4 CLI','29 guards'],replayed=0,qualification='unchanged helper/mode/completion checks retained; affected runner boundary checks superseded by current focused tests'))
gate('before-tests')
