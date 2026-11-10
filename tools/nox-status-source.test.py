"""Compile and execute the exact emitted Nox status query on finalized evidence.

No browser, transport, guest, or process signal is used. Only Path construction
is mapped from the remote run root to its finalized, hash-verified local files.
"""
import ast
import builtins
import contextlib
import hashlib
import io
import json
from pathlib import Path
import runpy
import subprocess
import sys
import time
import types


def emitted(wrapper, root, run, corrected=True):
    tree = ast.parse(wrapper.read_text())
    scope = dict(t=types.SimpleNamespace(ROOT=root), R=run,
                 mode='original', folder='original')
    for node in ast.walk(tree):
        if isinstance(node, ast.Assign) and any(
                isinstance(t, ast.Name) and t.id == 'code' for t in node.targets):
            if not corrected and isinstance(node.value, ast.Call) and isinstance(node.value.func, ast.Attribute) and node.value.func.attr == 'cleandoc':
                continue
            scope['code'] = eval(compile(ast.Expression(node.value), str(wrapper), 'eval'), scope)
    return scope['code']


def main():
    wrapper, finalized, out = map(lambda p: Path(p).resolve(), sys.argv[1:])
    out.mkdir(exist_ok=False)
    run = wrapper.parent
    root = '/home/user/'+run.name.split('-', 1)[1]+'-runtime'
    code = emitted(wrapper, root, run)
    (out/'exact-emitted.py').write_text(code)
    broken = emitted(wrapper, root, run, corrected=False)
    try:
        compile(broken, 'original-broken-status.py', 'exec')
    except IndentationError as error:
        assert error.lineno == 2
    else:
        raise AssertionError('original line-2 indentation defect not reproduced')
    compiled = compile(code, 'exact-emitted.py', 'exec')
    receipt = json.loads((finalized/'retrieval-verified.json').read_text())
    assert receipt['passed'] and receipt['independentReread']
    for pin in receipt['artifacts']:
        data = (finalized/pin['local']).read_bytes()
        assert len(data) == pin['size'] and hashlib.sha256(data).hexdigest() == pin['sha256']
    # The retriever deduplicates content into review/ and other local paths.
    # Recreate only its path view with symlinks to the verified actual files.
    view = out/'actual-finalized'
    view.mkdir()
    finalized_prefix = 'scratch/runs/'+finalized.name+'/'
    for pin in receipt['artifacts']:
        assert pin['path'].startswith(finalized_prefix)
        relative = Path(pin['path'][len(finalized_prefix):])
        assert not relative.is_absolute() and '..' not in relative.parts
        link = view/relative
        link.parent.mkdir(parents=True, exist_ok=True)
        link.symlink_to((finalized/pin['local']).resolve())
    prefix = str(Path(root)/run.relative_to(Path.cwd()))
    # Resolve only the exact owned run path; all /proc reads remain real reads.
    def mapped_path(*parts):
        p = Path(*parts)
        if str(p) == root:
            return MappedRoot()
        return p

    class MappedRoot:
        def __truediv__(self, relative):
            assert str(Path(root)/relative) == prefix
            return view

    def importing(name, *args, **kwargs):
        if name == 'pathlib':
            return types.SimpleNamespace(Path=mapped_path)
        return builtins.__import__(name, *args, **kwargs)

    stdout = io.StringIO()
    with contextlib.redirect_stdout(stdout):
        exec(compiled, {'__builtins__': {**vars(builtins), '__import__': importing}})
    observed = json.loads(stdout.getvalue())
    expected_wait = json.loads((view/'original-parent-wait.json').read_text())
    assert observed['parentWait'] == expected_wait
    assert observed['failure']['runtime-parent-death']['wait'] == expected_wait
    assert 'ready.json' in observed['files']
    assert observed['latest'] == json.loads((view/'generated-attributed/original/latest.json').read_text())
    (out/'observed.json').write_text(json.dumps(observed, indent=2))
    result = dict(passed=True, originalIndentationReproduced=True,
                  exactNewEmission=True, compiled=True,
                  executedAgainstFinalizedActualFiles=True, readOnly=True,
                  sha256=hashlib.sha256(code.encode()).hexdigest(),
                  parentWait=expected_wait, artifactsVerified=len(receipt['artifacts']))
    (out/'result.json').write_text(json.dumps(result, indent=2))
    print(json.dumps(result))


def wait_controls():
    pending_path, ready_path, out = map(lambda p: Path(p).resolve(), sys.argv[2:])
    out.mkdir(exist_ok=False)
    helper = Path(__file__).with_name('nox-status-source.py')
    api = runpy.run_path(str(helper))
    classify, wait = api['startup_state'], api['await_startup']
    pending = json.loads(pending_path.read_text())
    ready = json.loads(ready_path.read_text())
    assert classify(pending) == 'WAIT' and classify(ready) == 'READY'
    # The actual failed caller demanded READY from this first pending sample.
    # Its fetch assertion necessarily fails before any remote fetch.
    old_refused = not ('ready.json' in pending['files'] and pending['latest'])
    assert old_refused
    clone = lambda value: json.loads(json.dumps(value))
    reports = []

    def scenario(name, values, *, deadline=2, read_delay=0):
        clock, reads, cancellations, seen = [0.0], [], [], []
        def read():
            reads.append(len(reads))
            clock[0] += read_delay
            v = values[min(len(reads)-1, len(values)-1)]
            if isinstance(v, BaseException):
                raise v
            return clone(v)
        def sleep(seconds):
            assert 0 <= seconds <= .25
            clock[0] += seconds
        try:
            result = wait(read, cancellations.append, deadline=deadline,
                          now=lambda: clock[0], sleep=sleep, observe=seen.append)
        except Exception as error:
            result = None
            assert len(cancellations) == 1
            outcome = type(error).__name__
        else:
            assert result == ready and not cancellations
            outcome = 'READY'
        report = dict(name=name, outcome=outcome, reads=len(reads),
                      cancellations=len(cancellations), deadline=deadline,
                      lastTime=clock[0], imageFetches=0, gameProtocol=0)
        reports.append(report)
        return report

    assert scenario('actual-pending-then-actual-ready', [pending, ready])['reads'] == 2
    partial = clone(pending); partial['latest'] = ready['latest']
    assert scenario('capture-before-ready-ack', [partial, ready])['reads'] == 2
    for name, failed in [('failure-record', {**pending, 'failure': {'first': 'failed'}}),
                         ('parent-ended', {**pending, 'parentWait': {'returnCode': 0}}),
                         ('malformed', {}),
                         ('ready-without-image', {**pending, 'files': ['ready.json']}),
                         ('wrong-image', {**ready, 'latest': {**ready['latest'], 'label': 'later'}}),
                         ('nonresponse', TimeoutError('original query timeout'))]:
        report = scenario(name, [failed, ready])
        assert report['reads'] == 1 and report['cancellations'] == 1
    assert scenario('expired-before-query', [ready], deadline=0)['reads'] == 0
    report = scenario('pending-does-not-renew-deadline', [pending], deadline=.5)
    assert report['reads'] == 2 and report['lastTime'] == .5
    assert scenario('late-ready-refused', [ready], deadline=1, read_delay=1)['cancellations'] == 1
    # Exercise the actual CLI and subprocess boundary with file-only peers.
    # Both status replies retain the actual records above; no browser is used.
    for mode in ['pending-ready', 'query-failure', 'query-already-cancelled', 'expired']:
        case = out/mode; case.mkdir()
        (case/'runtime-config.json').write_text(json.dumps(dict(browserDeadline=int((time.time()+(0 if mode == 'expired' else 10))*1000))))
        (case/'statuses.json').write_text(json.dumps([pending, ready]))
        (case/'status.py').write_text("""from pathlib import Path
import json,sys
r=Path(__file__).resolve().parent
p=r/'reads.json';n=json.loads(p.read_text()) if p.exists() else 0
p.write_text(json.dumps(n+1))
if MODE == 'query-already-cancelled':
 (r/'first-runtime-failure.json').write_text('{}')
 raise SystemExit(4)
if MODE == 'query-failure':raise SystemExit(4)
print(json.dumps(json.loads((r/'statuses.json').read_text())[min(n,1)]))
""".replace('MODE', repr(mode)))
        (case/'terminal-cancel.py').write_text("""from pathlib import Path
r=Path(__file__).resolve().parent
with (r/'cancel-called.json').open('x') as f:f.write('{}')
with (r/'first-runtime-failure.json').open('x') as f:f.write('{}')
""")
        process = subprocess.run([sys.executable, str(helper), str(case)], capture_output=True, text=True, timeout=12)
        (case/'stdout').write_text(process.stdout); (case/'stderr').write_text(process.stderr)
        reads = json.loads((case/'reads.json').read_text()) if (case/'reads.json').exists() else 0
        if mode == 'pending-ready':
            assert process.returncode == 0 and reads == 2
            assert json.loads((case/'startup-status.json').read_text()) == ready
            assert not (case/'first-runtime-failure.json').exists()
            repeated = subprocess.run([sys.executable, str(helper), str(case)], capture_output=True, text=True, timeout=3)
            assert repeated.returncode != 0 and json.loads((case/'reads.json').read_text()) == 2
            assert not (case/'cancel-called.json').exists()
        else:
            assert process.returncode != 0 and reads == (0 if mode == 'expired' else 1)
            assert (case/'first-runtime-failure.json').exists() and not (case/'startup-status.json').exists()
            assert (case/'cancel-called.json').exists() == (mode != 'query-already-cancelled')
        reports.append(dict(name='actual-cli-'+mode, passed=True, status=process.returncode, reads=reads))
    inputs = [dict(path=str(p), size=p.stat().st_size, sha256=hashlib.sha256(p.read_bytes()).hexdigest()) for p in [pending_path, ready_path, helper]]
    result = dict(passed=True, controls=len(reports), actualPendingFetchRefusalReproduced=old_refused,
                  immutableOriginalDeadline=True, noBrowser=True, noGuestWrites=True,
                  noImageFetchOrInput=True, inputs=inputs, results=reports)
    (out/'result.json').write_text(json.dumps(result, indent=2))
    print(json.dumps(result))


if __name__ == '__main__':
    if sys.argv[1] == '--wait-controls':
        wait_controls()
    else:
        main()
