"""Verify the single collected run; does not launch a guest or synthetic runner."""
import hashlib
import json
from pathlib import Path

r = Path(__file__).resolve().parent
load = lambda n: json.loads((r / n).read_text())
s, d, p = load('summary.json'), load('runtime-evidence.json'), load('preflight.json')
assert d['exit'] == 0 and d['startup']['exit'] == 0
assert d['reason'] == 'bounded production completion' and d['elapsed'] < 115
assert d['peakRSS'] < 2 * 1073741824
assert s['guestInvocations'] == 1 and not s['productionDefectProved']
assert not s['gameplayAccepted'] and not s['currentMainClaim']
events = d['events']
assert events[1]['command'] == {'action': 'trace-api', 'on': False}
assert events[1]['ack']['value']['batch'] == 0
assert events[2]['command'] == {'action': 'frozen', 'mode': 'off'}
assert any(w['title'] == 'Enigma - Main Menu'
           for w in events[3]['ack']['value']['windows'])
trace = d['traceSelected']
assert any('[input-dequeue]' in t and 'msg=0x200 ' in t for t in trace)
assert not any('[input-dequeue]' in t and ('msg=0x201 ' in t or 'msg=0x202 ' in t)
               for t in trace)
assert any('-> native child 0x10001' in t for t in trace)
boundary = [json.loads(t.split(' ', 1)[1]) for t in trace
            if t.startswith('[message-boundary]')]
unqualified = [b for b in boundary if b['kind'] == 'post-handler-unqualified']
assert unqualified and all(b['successfulReturn'] is None and b['msg'] is None
                           for b in unqualified)
rows = load('capture-manifest.json')
images = [x for x in rows if x['path'].endswith('.png')]
assert len(images) == 3 and len({x['sha256'] for x in images}) == 1
assert hashlib.sha256((r / s['image']).read_bytes()).hexdigest() == s['imageSHA256']
runtime = next(x for x in rows if x['path'] == 'runtime-evidence.json')
assert hashlib.sha256((r / 'runtime-evidence.json').read_bytes()).hexdigest() == runtime['sha256']
assert next(x for x in rows if x['path'] == 'stdout.log')['bytes'] < 2 * 1048576
assert p['PASS'] and p['rowsChecked'] == 2663 and p['mount']['files'] == 2460
assert load('accounting-fixture.json')['compactOverflowRejected']
assert load('accounting-fixture.json')['rawPhysicallyCharged'] >= 2 * 1048576
assert load('publication-closure.json')['PASS']
life = load('closeout.json')
assert life['verifiedStopped'] and life['snapshotVerifiedAt'] > d['utcEnd']
assert life['stoppedAt'] >= life['snapshotVerifiedAt']
print(json.dumps({'PASS': True, 'guestInvocations': 1, 'buttonDequeueObserved': False,
                  'returnedMSGQualified': False, 'gameplayAccepted': False}))
