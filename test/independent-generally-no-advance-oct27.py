#!/usr/bin/env python3
"""Reject cursor reservation after a consumed-ACK integrity failure.

Use --case to adjudicate retained exact-source evidence without replaying it.
For fresh reproduction under the admitted Node supervisor, use --reproduce;
this executes only the consumed-reply scenario from the pinned sibling fixture.
"""
import argparse
import hashlib
import json
from pathlib import Path

p = argparse.ArgumentParser()
p.add_argument('--case')
p.add_argument('--reproduce')
a = p.parse_args()
assert bool(a.case) != bool(a.reproduce)
fixture = Path(__file__).with_name('independent-generally-history-oct27.py')
if a.reproduce:
    import sys
    text = fixture.read_text()
    prefix = text[:text.index("\nfor mode in ('clean', 'consumed-reply', 'acknowledged-request'):")]
    sys.argv = [str(fixture), '--evidence', a.reproduce]
    context = dict(__file__=str(fixture), __name__='reproducer')
    exec(compile(prefix + "\nscenario('consumed-reply')\n", str(fixture), 'exec'), context)
    case = Path(a.reproduce) / 'consumed-reply'
else:
    case = Path(a.case)
helper = Path(__file__).resolve().parents[1] / 'tools/generally-loading-controller.py'
assert hashlib.sha256(helper.read_bytes()).hexdigest() == '2da5e423b9c18b90463a2bf4f3dce8e35780e5d6452b43a5771d575c5dbf95c5'
receipt = json.loads((case / 'seed.receipt').read_text())
cursor = json.loads((case / 'original.cursor').read_text())
cleanup = json.loads((case / 'cleanup.json').read_text())
assert all(not c['alive'] for c in cleanup)
assert receipt['ok'] is False and receipt['error'] == 'consumed ACK changed or removed'
assert [e['request']['id'] for e in receipt['events']] == [61, 62]
requests = sorted(q.name for q in (case / 'mailbox/requests').iterdir())
assert requests == ['0061.json', '0062.json']
expected_next = receipt['events'][-1]['request']['id'] + 1
diagnostic = dict(candidate='helper-sha256:2da5e423b9c18b90463a2bf4f3dce8e35780e5d6452b43a5771d575c5dbf95c5',
                  fixtureSHA256=hashlib.sha256(fixture.read_bytes()).hexdigest(),
                  lastAcknowledged=62, expectedNextAtMost=expected_next,
                  actualCursor=cursor, requests=requests,
                  noRequest63=True, cleanupComplete=True, guestInvocations=0,
                  accepted=cursor['next'] <= expected_next,
                  contract='no request/cursor advance after uncertainty')
print(json.dumps(diagnostic), flush=True)
assert cursor['next'] <= expected_next, 'cursor advanced beyond last acknowledged request after consumed ACK integrity failure'
