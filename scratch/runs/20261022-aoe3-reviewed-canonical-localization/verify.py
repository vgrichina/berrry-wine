#!/usr/bin/env python3
"""Offline verification only: never builds or starts a guest."""
import pathlib, json, hashlib
E = pathlib.Path(__file__).resolve().parent
read = lambda name: json.loads((E / name).read_text())
b = read('build-result.json')
assert b['attempt'] == 1 and b['exit'] == 1 and b['module'] is None
assert b['candidateTip'] == '854f3bdd3d73434b048ee0e6070c00914628d8f4'
assert b['command'] == ['bash', 'tools/build.sh']
assert all(b[k] == {'count': 373, 'passAll': True} for k in ['pinsBefore', 'pinsAfter'])
log = (E / 'build.log').read_bytes()
assert hashlib.sha256(log).hexdigest() == b['logSHA256'] and len(log) == b['logBytes']
assert b'changed producer lib/host-imports.js:host-file (sha256); review its lifetime' in log
rows = read('source-manifest.json')
assert len(rows) == 1078
identity = hashlib.sha256(b''.join(x['path'].encode()+b'\0'+x['sha256'].encode()+b'\n' for x in rows)).hexdigest()
assert identity == b['sourceFingerprint'] == 'ce23f23ed7fcd525e2e4b4b1afa4d8eeacdb344fc7ca25903e3f78b45eaa9305'
assert read('root-seals.json')['passed']
r = read('runtime-handback.json')
assert r['runtimeProcesses'] == [] and r['ports'] == {'8123': 111, '8124': 111}
s = read('box-state.json')['sandbox']
assert s['id'] == 'bx_32262dnp' and s['state'] == 'idle' and s['health'] == 'ok' and s['stop'] is None
assert s['archiveAfter'] == '2026-10-22T12:53:29.069Z'
assert read('failure-ledger.json')['guestRuns'] == 0
h = read('HANDOFF.json')
assert h['measuredAllocationBytes'] < 67108864 and h['freeBytes'] > 2982150144
for x in read('evidence-seals.json'):
    p = E / x['path']
    assert p.stat().st_size == x['bytes'] and hashlib.sha256(p.read_bytes()).hexdigest() == x['sha256'], p
print('PASS exact candidate/source; canonical build1 exit1 enforced census stop; module absent; guest0; 373 pre/post pins; source1078; protected root; running handback; evidence seals/allocation')
