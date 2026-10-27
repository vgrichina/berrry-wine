"""Small Linux diagnostics only. Run under unchanged trusted outer controls."""
import hashlib
import importlib.util
import inspect
import json
import os
from pathlib import Path
import resource
import subprocess
import sys
import tempfile
import time

HERE = Path(__file__).resolve().parent
TRUSTED = Path('/tmp/gl-required-version-independent-integrate-oct26/repo/test/helpers/palette-browser-supervisor.py')
CANDIDATE = HERE / 'helpers/palette-browser-supervisor-candidate-oct27.py'
PIN = '9d10f7c8c75b5f0dfebff2299eef8ddc27988cf112e0e9c255e89f772c2cee85'


def load(path):
    spec = importlib.util.spec_from_file_location('helper', path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def burn(duration):
    start = time.process_time()
    while time.process_time() - start < duration:
        pass
    return time.process_time() - start


def command(mode):
    if mode == 'flat':
        return [sys.executable, '-S', '-c', 'import time\ns=time.process_time()\nwhile time.process_time()-s<.25: pass']
    return [sys.executable, str(Path(__file__).resolve()), 'fixture', mode]


def fixture(mode):
    if mode == 'flat':
        burn(.25)
    elif mode == 'nested':
        subprocess.run(command('flat'), check=True)
        time.sleep(.04)
    elif mode == 'short':
        for _ in range(20):
            pid = os.fork()
            if not pid:
                burn(.004)
                os.write(1, ('SHORT ' + str(os.getpid()) + '\n').encode())
                os._exit(0)
            os.waitpid(pid, 0)
    elif mode == 'siblings':
        children = [subprocess.Popen(command('flat')) for _ in range(3)]
        for child in children:
            assert child.wait() == 0
    elif mode == 'orphan':
        pid = os.fork()
        if pid:
            os.waitpid(pid, 0)
            time.sleep(.45)
        else:
            os.setsid()
            if os.fork():
                os._exit(0)
            burn(.20)
            os._exit(0)
    elif mode == 'cleanup':
        pid = os.fork()
        if not pid:
            os.setsid()
            burn(.10)
            time.sleep(5)
            os._exit(0)
        time.sleep(.20)
    elif mode == 'auto-reap':
        import signal
        signal.signal(signal.SIGCHLD, signal.SIG_IGN)
        if not os.fork():
            used = burn(.25)
            os.write(1, ('LOSTCPU ' + str(used) + '\n').encode())
            os._exit(0)
        time.sleep(.60)
    else:
        raise AssertionError(mode)


def inner(mode, helper=CANDIDATE):
    m = load(helper)
    cmd = [sys.executable, str(Path(__file__).resolve()), 'inner', 'nested'] if mode == 'wrapper' else command(mode)
    # Explicit defaults are not overridden: CPU90/wall120 and trusted controls.
    result = m.supervise(cmd, rss_limit=128 * 1024**2)
    result['output'] = result['output'].decode()
    own = resource.getrusage(resource.RUSAGE_SELF)
    print(json.dumps(dict(receipt=result, monitorOwnLifetimeAtPrint=own.ru_utime + own.ru_stime)), flush=True)
    assert result['exit'] == 0 and result['stopReason'] is None and result['cleanupComplete']


def measured(mode):
    with tempfile.TemporaryFile() as out, tempfile.TemporaryFile() as err:
        p = subprocess.Popen([sys.executable, str(Path(__file__).resolve()), 'inner', mode], stdout=out, stderr=err)
        _, status, usage = os.wait4(p.pid, 0)
        p.returncode = os.waitstatus_to_exitcode(status)
        out.seek(0)
        err.seek(0)
        stderr = err.read().decode()
        assert p.returncode == 0, (mode, stderr, out.read().decode())
        record = json.load(out)
    whole = usage.ru_utime + usage.ru_stime
    receipt = record['receipt']
    diagnostic = receipt['uniqueCPUReceipt']
    # Outer wait4 includes interpreter bootstrap/serialization/exit. Separate
    # full monitor own CPU at print, rather than subtracting a guessed overlap.
    # Residual exit/printing CPU is bounded here by 60ms. Normal observed
    # residual is retained; this tolerance does not certify arbitrary workloads.
    residual = whole - record['monitorOwnLifetimeAtPrint'] - diagnostic['observedReapCPUSeconds']
    assert abs(residual) < .06, (mode, residual)
    assert diagnostic['status'] == 'incomplete' and diagnostic['uniqueCPUSeconds'] is None
    assert diagnostic['diagnosticOnly'] and diagnostic['reapConsistency'] == 'consistent-but-not-complete'
    assert diagnostic['supervisorOwnIntervalSeconds'] >= 0
    if mode == 'short':
        short = {int(line.split()[1]) for line in receipt['output'].splitlines() if line.startswith('SHORT ')}
        assert len(short) == 20
        assert short - {identity[0] for identity in receipt['owned']}, 'must exercise a child entirely between samples'
    if mode == 'wrapper':
        nested = json.loads(receipt['output'])['receipt']
        assert nested['uniqueCPUReceipt']['uniqueCPUSeconds'] is None
        # Parent counts the nested wrapper's reap ONCE, not its JSON subtotal.
        assert len(diagnostic['reapEvents']) == 1
    if mode == 'auto-reap':
        lost = float(next(line.split()[1] for line in receipt['output'].splitlines() if line.startswith('LOSTCPU ')))
        assert lost >= .25
        assert diagnostic['observedReapCPUSeconds'] < lost - .15, (lost, diagnostic)
        # Even outer wait4 misses auto-reaped grandchild CPU: it is not an
        # unconditional independent unique CPU oracle for arbitrary commands.
        assert whole - record['monitorOwnLifetimeAtPrint'] < lost - .15, (whole, lost, record['monitorOwnLifetimeAtPrint'])
        record['independentlyReportedLostOwnCPUSeconds'] = lost
    record.update(mode=mode, outerWait4CPUSeconds=whole, separatedMonitorResidualSeconds=residual, stderr=stderr)
    return record


def checks():
    assert hashlib.sha256(TRUSTED.read_bytes()).hexdigest() == PIN
    additions = json.loads((HERE / 'helpers/unique-cpu-additions-oct27.json').read_text())
    restored = CANDIDATE.read_text()
    for old, new in reversed(additions):
        assert restored.count(new) == 1
        restored = restored.replace(new, old)
    assert hashlib.sha256(restored.encode()).hexdigest() == PIN, 'enforcing source changed'
    m = load(CANDIDATE)
    sig = inspect.signature(m.supervise)
    assert sig.parameters['cpu_limit'].default == 90
    assert sig.parameters['wall_limit'].default == 120
    evidence = load(HERE / 'helpers/unique-cpu-evidence-oct27.py')
    event = dict(identity=[123, '10'], userSeconds=.2, systemSeconds=.1)
    reused = dict(identity=[123, '11'], userSeconds=.2, systemSeconds=.1)
    assert not evidence.validate([event, reused], .6)[1], 'PID reuse must be identity-keyed'
    assert evidence.validate([event, event], .6)[1], 'double-charge identity mutation must reject'
    assert evidence.validate([], .3)[1], 'missing usage mutation must reject'
    inflated = dict(event, userSeconds=.5)
    assert evidence.validate([inflated], .3)[1], 'inflated charge must reject independent kernel cross-check'
    assert evidence.validate([event], .3, ['missing descendant usage'])[1]
    r = evidence.Evidence([], None)
    r.missing((123, '10'), 'missing wait4')
    assert r.finish(True)['reapConsistency'] == 'reject'
    assert evidence.Evidence([], (123, '10')).finish(True)['uniqueCPUSeconds'] is None
    assert evidence.Evidence([(123, '10')], None).finish(False)['reapConsistency'] == 'reject'
    rows = [measured(mode) for mode in ('flat', 'nested', 'short', 'siblings', 'orphan', 'cleanup', 'wrapper', 'auto-reap')]
    # Check real entry point rejection without spending90 CPU or lowering caps.
    # The existing check hook requests rejection; diagnostic must not clear it.
    for helper in (TRUSTED, CANDIDATE):
        r = load(helper).supervise([sys.executable, '-c', 'import time;time.sleep(.2)'], rss_limit=128*1024**2, check=lambda: 'retained rejection control')
        assert r['stopReason'] == 'retained rejection control' and r['cleanupComplete']
        if helper == CANDIDATE:
            assert r['uniqueCPUReceipt']['uniqueCPUSeconds'] is None
        # Synthetic accounting input exercises the real unchanged CPU90 branch
        # without an expensive90CPU burn or changing its configured limit.
        mod = load(helper)
        original_snapshot = mod.snapshot
        def over_limit_snapshot():
            rows = original_snapshot()
            for row in rows.values():
                if row['ppid'] == os.getpid():
                    row['cpu'] = max(row['cpu'], 100)
            return rows
        mod.snapshot = over_limit_snapshot
        r = mod.supervise([sys.executable, '-S', '-c', 'import time;time.sleep(.2)'], rss_limit=128*1024**2)
        assert r['stopReason'] == 'aggregate CPU limit' and r['cpuSeconds'] >= 100 and r['cleanupComplete']
        if helper == CANDIDATE:
            assert r['uniqueCPUReceipt']['uniqueCPUSeconds'] is None
            assert r['uniqueCPUReceipt']['observedIntervalSubtotalSeconds'] < 1
    print(json.dumps(dict(result='PASS bounded evidence checks; finalized metric UNKNOWN', controls=['source restoration pin', 'CPU90/wall120 defaults', 'PID identity reuse', 'duplicate/missing/inflated usage reject', 'unchanged rejection survives diagnostic'], rows=rows), indent=2))


if __name__ == '__main__':
    if len(sys.argv) == 1:
        checks()
    elif sys.argv[1] == 'fixture':
        fixture(sys.argv[2])
    elif sys.argv[1] == 'inner':
        inner(sys.argv[2])
    elif sys.argv[1] == 'measure':
        print(json.dumps(measured(sys.argv[2]), indent=2))
    else:
        raise AssertionError(sys.argv)
