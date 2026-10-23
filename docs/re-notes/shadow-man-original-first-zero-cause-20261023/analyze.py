#!/usr/bin/env python3
"""Offline retained-record decision checks. Never imports a runtime or fixture."""
import copy
import hashlib
import json
from pathlib import Path

H = Path(__file__).resolve().parent
CANDIDATE = 'b41a7c5f4b752d1f0bdab1141a11d4fed4dc6f9a'
MODULE = '8fac39936b6df2418ad86cab118cef19a65a727f649fbc14c412b37818904686'
RUNNER = '4d7b9587676db38fcf3314807acb2b2a42b5f09d2c98fcf3dccb8a6cde9e1809'
ADDRESS = 0x4015d4


def digest(b):
    return hashlib.sha256(b).hexdigest()


def jsseal(x):
    return digest(json.dumps(x, separators=(',', ':'), ensure_ascii=False).encode())


def trace(path):
    return [json.loads(line) for line in path.read_text().splitlines()]


def validate(rows):
    """Identity and envelope validation are prerequisites to diagnostic decisions."""
    assert len([r for r in rows if 'receipt' in r]) == 1
    for envelope in rows:
        payload = envelope.get('receipt', envelope.get('record'))
        if payload is None:
            continue
        assert jsseal(payload) == envelope['sha256'], 'changed envelope'
        m = payload['metadata']
        assert m['actualModule'] == {'moduleSha256': MODULE, 'moduleBytes': 1879746}, 'module identity'
        assert m['runnerSha256'] == RUNNER, 'runner identity'
    records = [r['record'] for r in rows if 'record' in r]
    assert [r['sequence'] for r in records] == list(range(len(records)))
    assert len({r['metadata']['pid'] for r in records}) == 1
    assert records[0]['kind'] == 'sender-pre'
    assert records[-1]['kind'] == 'first-zero' and records[-1]['registers']['eip'] == 0
    return records


def required_order(rows):
    records = validate(rows)
    kinds = [r['kind'] for r in records]
    expected = ['sender-pre', 'decoded-block', 'modal-frame-consume', 'modal-frame-complete', 'first-zero']
    assert all(k in kinds for k in expected), 'missing required events'
    assert [kinds.index(k) for k in expected] == sorted(kinds.index(k) for k in expected), 'wrong order'
    block = records[kinds.index('decoded-block')]
    assert block['registers']['eip'] == ADDRESS and block['code']['address'] == ADDRESS
    assert rows[-1] == {'terminal': True, 'reason': 'first-zero', 'exit': 86}, 'unsuccessful terminal'
    return True


def rejection(fn, contains):
    try:
        fn()
    except AssertionError as e:
        assert contains in str(e), str(e)
        return 'PASS'
    raise AssertionError('negative control unexpectedly accepted')


def reseal(rows):
    for r in rows:
        if 'record' in r:
            r['sha256'] = jsseal(r['record'])
        elif 'receipt' in r:
            r['sha256'] = jsseal(r['receipt'])


def main():
    # Reuse accepted packaging receipts; hash only the focused inputs actually used.
    for f in json.loads((H/'focused-inputs.json').read_text()):
        b = (H/f['retained']).read_bytes()
        assert len(b) == f['bytes'] and digest(b) == f['sha256'], f['retained']
    source_ids = json.loads((H/'source-identities.json').read_text())
    for name, identity in source_ids.items():
        assert identity['candidate'] == CANDIDATE
        b = (H/Path(name).name).read_bytes()
        assert len(b) == identity['bytes'] and digest(b) == identity['sha256']
    pins = {
        'test/run.js': RUNNER,
        'tools/shadow-man-null-preload.cjs': '78dcac659f82f4c93325d126d072d006e0c6995bac53f9a182431a956eb8e42b',
        'tools/shadow-man-null-capture.cjs': '3440377e102575906809bb36a1ba10c291a00f87ae63f05dac5ae24394529cea',
    }
    for name, pin in pins.items():
        assert digest((H/'actual-source'/name).read_bytes()) == pin, name
    module_path = Path('/home/user/wine-assembly-shadow-man-span-static-canonical-oct23/build/wine-assembly.wasm')
    b = module_path.read_bytes()  # Bytes only: no parser/compiler/instantiation.
    assert b[:8] == b'\0asm\x01\0\0\0' and len(b) == 1879746 and digest(b) == MODULE

    original = trace(H/'original/original-evidence/null-capture.jsonl')
    synthetic = trace(H/'synthetic/capture.capture.jsonl')
    o, s = validate(original), validate(synthetic)
    op, sp = original[0]['receipt'], synthetic[0]['receipt']
    assert op['selection']['pid'] == 28583
    assert {k: op['selection'][k] for k in ['actionSequence','batch','cmdId','hwnd']} == dict(actionSequence=3,batch=24720,cmdId=3,hwnd=65564)
    assert op['prior']['boundary'] == dict(savedEip=0,savedEsp=0,pumpHwnd=65564,returnAddress=ADDRESS,ended=0,sharedPumpHwnd=65564,sharedEnded=0,syncDepth=0,eventCount=0)
    assert all(sp['prior']['boundary'][k] == 0 for k in ['pumpHwnd','returnAddress','ended','sharedPumpHwnd','sharedEnded'])
    assert [r['kind'] for r in o] == ['sender-pre','first-zero']
    assert [r['boundary']['eventCount'] for r in o] == [1,2]
    assert all(r['boundary']['token'] == '13' and r['boundary']['root'] == '2' and r['boundary']['syncDepth'] == 1 for r in o)
    assert o[0]['registers']['esp'] == o[-1]['registers']['esp'] == 122683216
    assert o[0]['registers']['eip'] == 0x7500218
    assert o[-1]['boundary']['ended'] == o[-1]['boundary']['sharedEnded'] == 1
    assert o[-1]['boundary']['pumpHwnd'] == 65564 and o[-1]['boundary']['returnAddress'] == ADDRESS
    assert o[0]['code']['bytes'][:2] == 'c3' and s[0]['code']['bytes'][:2] == '68'
    # Identify stack slots, without pretending residual bytes prove execution.
    stack = bytes.fromhex(o[-1]['stack']['bytes'])
    at = o[-1]['registers']['esp']-20-o[-1]['stack']['address']
    assert int.from_bytes(stack[at:at+4], 'little') == 0x7500210
    for n in ['configuration-dispatch.json','ok-dispatch.json']:
        d = json.loads((H/'original/original-evidence'/n).read_text())
        assert d['exit'] == 0 and '[sync] ABANDONED wndproc' in d['stdout'] and 'yield_reason=15' in d['stdout']

    tests = {'original_required_order_rejected': rejection(lambda: required_order(original), 'missing required events')}
    assert required_order(synthetic)  # Diagnostic comparator only; no new native acceptance.
    tests['synthetic_retained_order_only'] = 'PASS'
    for kind in ['decoded-block','modal-frame-consume','modal-frame-complete']:
        altered = copy.deepcopy(synthetic)
        altered = [r for r in altered if r.get('record',{}).get('kind') != kind]
        for i, r in enumerate(r for r in altered if 'record' in r):
            r['record']['sequence'] = i
        reseal(altered)
        tests['reject_missing_'+kind] = rejection(lambda: required_order(altered), 'missing required events')
    for identity in ['module','runner']:
        altered = copy.deepcopy(synthetic)
        for r in altered:
            p = r.get('record', r.get('receipt'))
            if p is None:
                continue
            if identity == 'module':
                p['metadata']['actualModule']['moduleSha256'] = '0'*64
            else:
                p['metadata']['runnerSha256'] = '0'*64
        reseal(altered)  # Even internally resealed false identities must fail.
        tests['reject_resealed_'+identity] = rejection(lambda: required_order(altered), identity+' identity')
    swapped = copy.deepcopy(synthetic)
    a, z = swapped[3]['record'], swapped[4]['record']
    a['kind'], z['kind'] = z['kind'], a['kind']
    reseal(swapped)
    tests['reject_reordered_modal_events'] = rejection(lambda: required_order(swapped), 'wrong order')
    result = dict(verdict='PREEXISTING_MODAL_VERSUS_CALLBACK_CREATED_MODAL; ZERO_WRITER_UNOBSERVED',
                  candidate=CANDIDATE, moduleSha256=MODULE, moduleBytes=1879746,
                  originalKinds=[r['kind'] for r in o], syntheticKinds=[r['kind'] for r in s],
                  originalCaptureAccepted=False, syntheticReexecuted=False,
                  originalPrearm=op['prior'], syntheticPrearm=sp['prior'],
                  earliestDemonstrableDifference='pre-arm existing modal returnAddress0x4015d4 versus no modal; original C3 versus synthetic callback push-immediate at same VA',
                  zeroWriter='unknown; CACA0005 consistent but not recorded',
                  missingObservation='immediate native zero-producing transfer provenance',
                  tests=tests)
    (H/'diagnosis.json').write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps({'offlineChecks':tests,'originalCaptureAccepted':False,'zeroWriter':'unproven','nativeExecution':False}))


if __name__ == '__main__':
    main()
