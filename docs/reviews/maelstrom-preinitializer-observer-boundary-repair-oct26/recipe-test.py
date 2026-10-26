from common import *
gate('focused')
argv=[NODE,'--max-old-space-size=192',str(R/'test/test-maelstrom-preinitializer-boundary.cjs'),str(O),'/tmp/maelstrom-mode-transition-observer-repair-oct26','/tmp/maelstrom-runner-arm-independent-accept-oct26/repo/docs/reviews/maelstrom-runner-arm-independent-accept-oct26']
try:
 out=run(argv,cwd=R);j=json.loads(out);save('focused-results.json',j)
 save('checkpoint.json',dict(base=REV,sourceHashes={str(p.relative_to(R)):sha(p.read_bytes()) for p in [R/'tools/maelstrom-initialized-runner-arm.cjs',R/'tools/maelstrom-loader-boundary.cjs',R/'test/test-maelstrom-preinitializer-boundary.cjs',R/'test/maelstrom-loader-host-fixture.cjs']},result=j,remaining=['dependency and supplemental boundary cases','review','commit/push','independent acceptance; no runtime authorization']))
 print('PASS',len(j['results']))
except Exception as e:
 save('first-focused-failure.json',dict(error=str(e)))
 raise
