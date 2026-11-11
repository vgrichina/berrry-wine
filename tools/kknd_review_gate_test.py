"""Local regression against retained full raw KKnD stages; never starts a guest.

python3 tools/kknd_review_gate_test.py --retained RUN0120 --out UNIQUE_OUTPUT
The retained images remain in their original run. No network transport is loaded.
"""
import argparse
import copy
import fcntl
import hashlib
import importlib.util
import json
from pathlib import Path
import runpy
import subprocess
import sys
import threading
import time
import types

import kknd_review_gate as gate


def load(path, name):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def check(value, reason):
    if not value:
        raise AssertionError(reason)


def worker(retained, root, action):
    root = Path(root)
    def publish(commands):
        gate.atomic_publish(root, commands)
        with (root / 'dispatches.jsonl').open('a') as f:
            f.write(json.dumps(commands) + '\n')
    def settled(index):
        (root / f'waiting-{index}').touch()
        end = time.monotonic() + 15
        while not (root / 'release').exists():
            check(time.monotonic() < end, 'fixture wait deadline')
            time.sleep(.01)
        return json.loads(gate.read_frame(retained, 55)[1])
    return gate.perform(action, {}, root, publish, settled,
                        lambda stage: gate.read_frame(retained, stage))


def main(retained, out):
    retained, out = Path(retained).resolve(), Path(out).resolve()
    out.mkdir(parents=True, exist_ok=False)
    records = []
    frames = {n: gate.read_frame(retained, n) for n in [52, 55, 59, 63]}
    reviews = {n: json.loads((retained / f'reviews/review-{n}.json').read_text()) for n in frames}
    source_pins = []
    for n, (frame, raw_state) in frames.items():
        state = json.loads(raw_state)
        check(state == reviews[n]['state'], 'retained state drift')
        check(hashlib.sha256(frame).hexdigest() == state['capture']['sha256'], 'retained PNG drift')
        for kind, data in [('png', frame), ('json', raw_state)]:
            source_pins.append(dict(stage=n, kind=kind, size=len(data), sha256=hashlib.sha256(data).hexdigest(),
                                    source=str(retained / f'retrieved/output-fixed/stage-{n}.{kind}.xz')))
    (out / 'retained-raw-pins.json').write_text(json.dumps(source_pins, indent=2))
    old = load(retained / 'review_gate.py', 'retained_review_gate')
    # Load the actual old durable caller with inert imports. Any accidental
    # transport call raises, and there is no Boat/API connection in this test.
    def forbidden(*args, **kwargs):
        raise AssertionError('remote/network dispatch forbidden')
    sys.modules['remote'] = types.SimpleNamespace(t=types.SimpleNamespace(remote=forbidden), R=retained)
    sys.modules['stream'] = types.SimpleNamespace(read=forbidden, view=forbidden)
    sys.modules['review_gate'] = old
    old_operate = load(retained / 'operate.py', 'retained_operate')
    sys.modules['review_gate'] = gate
    patched_operate = load(retained / 'operate.py', 'patched_operate')

    def case(name, review, index=None, reader=None, caller=gate.perform, accept=False, args=None, pending=None):
        root = out / name
        root.mkdir()
        state = dict(index=index if index is not None else review['stage'] + 1,
                     pending=pending, reviewed=review)
        state_path = root / 'operator-state.json'
        state_path.write_text(json.dumps(state, indent=2))
        before = state_path.read_bytes()
        calls = []
        def publish(commands):
            calls.append(('publish', commands))
            gate.atomic_publish(root, commands)
        def settled(index):
            calls.append(('settled', index))
            return {}
        try:
            if caller is gate.perform:
                caller('pair', args or {}, root, publish, settled, reader or (lambda stage: frames[stage]))
            else:
                # Actual operate.perform creates Operator with its original
                # signature. Its default reader uses collected stage files.
                collected = root / 'retrieved/output-fixed'
                collected.mkdir(parents=True)
                for suffix, data in zip(['png', 'json'], (reader or (lambda stage: frames[stage]))(review['stage'])):
                    (collected / f"stage-{review['stage']}.{suffix}").write_bytes(data)
                caller('pair', args or {}, root, publish, settled)
            check(accept, name + ': unexpected acceptance')
            commands = calls[0][1]
            check(list(commands) == list(range(state['index'], state['index'] + len(commands))), 'command indices')
            check([c['buttons'] for c in commands.values()] == ([1, 1, 0] if args and args.get('end') else [1, 0]), 'balanced release')
            check(calls[1] == ('settled', max(commands)), 'must wait for independent release')
            check(json.loads(state_path.read_text())['index'] == state['index'] + len(commands), 'durable index')
            reason = 'accepted balanced pair and actual settle callback'
        except (ValueError, AssertionError, FileNotFoundError, KeyError) as error:
            if accept or isinstance(error, AssertionError) and str(error).endswith('unexpected acceptance'):
                raise
            check(calls == [], name + ': callback invoked before refusal')
            check(before == state_path.read_bytes(), 'refusal changed durable state')
            check(not list(root.glob('fixed-command-*')), 'refusal published command')
            reason = str(error)
        records.append(dict(case=name, accepted=accept, callbacks=calls, reason=reason))

    case('old-stage52-wrong-review-acceptance', reviews[52], caller=old_operate.perform, accept=True)
    case('new-stage52-predispatch-refusal', reviews[52])
    case('actual-operate-stage52-refusal', reviews[52], caller=patched_operate.perform)
    for n in [55, 59, 63]:
        case(f'white-stage{n}', reviews[n], accept=True)
    case('actual-operate-white55', reviews[55], caller=patched_operate.perform, accept=True)
    case('stale-white-review', reviews[55], index=58)
    case('wrong-frame-white-for-prohibited', reviews[52], reader=lambda stage: frames[55])
    case('wrong-frame-prohibited-for-white', reviews[55], reader=lambda stage: frames[52])
    case('white-frame-bytes-with-wrong-state', reviews[52], reader=lambda stage: (frames[55][0], frames[52][1]))
    case('missing-current-frame', reviews[55], reader=lambda stage: (_ for _ in ()).throw(FileNotFoundError('absent frame')))
    case('unreviewed-hover', reviews[55], pending=reviews[55])
    unreviewed = copy.deepcopy(reviews[55]); unreviewed['personallyReviewed'] = False
    case('no-personal-review', unreviewed)
    for classification in ['prohibited', 'water', 'fog']:
        v = copy.deepcopy(reviews[55]); v['classification'] = classification
        case('personal-' + classification, v)
    # Metadata remains internally consistent, but the settled hover binding is
    # changed. A caller cannot move the proof to a different target or stage.
    for name, change in [
        ('wrong-cursor-position', lambda v: v.update(x=v['x'] + 1)),
        ('wrong-hover-index', lambda v: v['state']['lastCommand'].update(index=54)),
        ('held-cursor', lambda v: v['state']['mouse'].update(buttons=1)),
        ('not-hover', lambda v: v['state']['lastCommand'].update(kind='run')),
        ('wrong-stage-name', lambda v: v['state']['capture'].update(path='stage-54.png')),
        ('faulted-frame', lambda v: v['state'].update(faults=['fixture fault'])),
    ]:
        v = copy.deepcopy(reviews[55]); change(v)
        v['capture'] = copy.deepcopy(v['state']['capture'])
        case(name, v, reader=lambda stage, v=v: (frames[55][0], json.dumps(v['state']).encode()))
    # Alter one mandatory opaque pixel in the real white cursor, reencode and
    # repin the entire frame. This must still fail, beyond merely SHA mismatch.
    mutation = subprocess.run(['node', '-e', "const {PNG}=require('pngjs'),fs=require('fs');"
                               "const p=PNG.sync.read(fs.readFileSync(0));"
                               "p.data[((260-9)*640+480-8)*4]=0;"
                               "process.stdout.write(PNG.sync.write(p));"],
                              input=frames[55][0], capture_output=True, check=True).stdout
    v = copy.deepcopy(reviews[55]); v['capture'].update(size=len(mutation), sha256=hashlib.sha256(mutation).hexdigest())
    v['state']['capture'] = copy.deepcopy(v['capture'])
    (out / 'mutated-white.png').write_bytes(mutation)
    case('repinned-corrupt-white-cursor', v, reader=lambda stage: (mutation, json.dumps(v['state']).encode()))
    case('original-pin-corrupt-frame', reviews[55], reader=lambda stage: (mutation, frames[55][1]))
    # Selection/menu gestures retain the same review and balanced-release
    # semantics without requiring a ground cursor at their non-ground targets.
    for classification in ['selection', 'menu']:
        v = copy.deepcopy(reviews[52]); v['classification'] = classification
        case('unchanged-' + classification, v, accept=True,
             args=dict(end=[450, 350]) if classification == 'selection' else None)

    # Exercise the original durable caller adapter and its separate stream EOF
    # and parent wait receipts, with a new local process for each request.
    monitored = runpy.run_path(str(retained / 'caller-custody.py'))['monitored']
    root = out / 'serialization'; root.mkdir()
    (root / 'operator-state.json').write_text(json.dumps(dict(index=56, pending=None, reviewed=reviews[55])))
    before = (root / 'operator-state.json').read_bytes()
    argv = [sys.executable, str(Path(__file__).resolve()), '--worker', str(retained), str(root)]
    result, errors = {}, []
    def active():
        try:
            result['active'] = monitored(argv + ['pair'], root, 'active', timeout=20)
        except BaseException as error:
            errors.append(error)
    thread = threading.Thread(target=active); thread.start()
    end = time.monotonic() + 12
    while not (root / 'waiting-57').exists():
        check(not errors and time.monotonic() < end, 'active request did not enter settle')
        time.sleep(.02)
    check(monitored(argv + ['stop'], root, 'overlap', timeout=10) == 75, 'concurrent request accepted')
    check((root / 'operator-state.json').read_bytes() == before, 'committed before actual settle')
    check(len((root / 'dispatches.jsonl').read_text().splitlines()) == 1, 'duplicate dispatch')
    (root / 'release').touch(); thread.join(25)
    check(not thread.is_alive() and not errors and result['active'] == 0, 'active did not finish')
    check(json.loads((root / 'operator-state.json').read_text())['index'] == 58, 'bad index after actual wait')
    for label, code in [('active', 0), ('overlap', 75)]:
        wait = json.loads((root / f'{label}-wait.json').read_text())
        check(wait['actualParentWait'] and wait['streamsJoined'] and wait['returnCode'] == code, 'missing actual parent wait')
        for stream in ['stdout', 'stderr']:
            check(json.loads((root / f'{label}-{stream}-eof.json').read_text())['separateEOF'], 'missing separate EOF')
    # Reload after acceptance: the review is consumed and cannot replay.
    case('accepted-review-cannot-replay', reviews[55], index=58)
    records.append(dict(case='actual-durable-caller-serialization', accepted=True,
                        activeWait=0, overlapWait=75, separateEOF=True, dispatchBatches=1))
    (out / 'verdicts.json').write_text(json.dumps(records, indent=2))
    print(json.dumps(dict(passed=True, cases=len(records), originals=0, boxes=0, remoteDispatches=0), indent=2))


if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == '--worker':
        sys.exit(worker(*sys.argv[2:]))
    parser = argparse.ArgumentParser()
    parser.add_argument('--retained', required=True)
    parser.add_argument('--out', required=True)
    args = parser.parse_args()
    main(args.retained, args.out)
