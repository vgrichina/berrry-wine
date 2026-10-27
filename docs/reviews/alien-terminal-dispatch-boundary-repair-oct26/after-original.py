# Preserve the original test bytes, injection, assertions and first failure.
# Its historical driver returns 1 when dispatch-boundary passes (it expected
# rejection). Interpret that exact existing convention without editing it.
import runpy,sys,json,os
from pathlib import Path
p=Path('/tmp/alien-terminal-dispatch-boundary-repair-oct26/repo/test/alien-terminal-failfast-independent-accept-oct26.py')
sys.argv=[str(p),'dispatch-boundary']
try:runpy.run_path(str(p),run_name='__main__')
except SystemExit as error:assert error.code==1,error.code
j=json.load(open(Path(os.environ['TMPDIR'])/'dispatch-boundary-receipt.json'))
assert j['sends']==j['expectedSends'] and j['restartSentNothing']
assert j['ledger']['pending']==dict(index=1,command=dict(action='png',path='/tmp/offline-only.png'))
print('UNCHANGED REPRODUCER: assertions pass; legacy rejection-mode exit1 interpreted')
