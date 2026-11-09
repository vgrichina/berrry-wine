"""Execute the actual wrapper with process/network effects refused by audit hooks."""
import gzip
import hashlib
import json
from pathlib import Path
import runpy
import sys

ROOT = Path(__file__).resolve().parents[1]
OUT = Path(sys.argv[1]).resolve()
OLD = ROOT / 'scratch/runs/20261108-q3-composed-visible-progress-2325'
WRAPPER = ROOT / 'tools/q3-native-prelaunch.py'
RUNTIME = OLD / 'runtime.py'
calls = []
attempts = []
tamper = False
active = None


class Refused(RuntimeError):
    pass


def audit(event, args):
    if event in ('subprocess.Popen', 'os.fork', 'os.posix_spawn', 'os.system',
                 'os.exec', 'socket.connect', 'socket.getaddrinfo'):
        attempts.append(event)
        raise Refused(event)


def trace(frame, event, arg):
    if event == 'call' and frame.f_code.co_filename == str(ROOT / 'tools/native_kernel_custody.py'):
        assert frame.f_code.co_name not in ('supervise', 'ptrace'), 'native startup refused'
    if frame.f_code.co_filename == str(ROOT / 'tools/native-startup-barrier.py'):
        name = frame.f_code.co_name
        if event == 'call' and name in ('publish', 'require'):
            calls.append(name)
        if event == 'return' and name == 'publish' and tamper:
            # Change only this control's manifest after the real publish.
            p = active / 'startup-manifest.json'
            p.write_bytes(p.read_bytes() + b'\n')
    return trace


sys.addaudithook(audit)
sys.setprofile(trace)
# Exact retained failing wrapper; no duplicated import snippet.
try:
    runpy.run_path(str(OLD / 'launch-code.py'), run_name='__main__')
except ModuleNotFoundError as error:
    assert error.name == 'native_startup_barrier', error
else:
    raise AssertionError('retained defect did not reproduce')
assert not attempts
print('retained actual wrapper: native_startup_barrier import failure reproduced')

providers = [WRAPPER, RUNTIME, ROOT / 'tools/native-startup-barrier.py',
             ROOT / 'tools/native_kernel_custody.py']
wrapper_functions = runpy.run_path(str(WRAPPER), run_name='q3_prelaunch_functions')
providers += [ROOT / 'tools/q3-native-driver-composition.cjs']
providers += [ROOT / name for name in wrapper_functions['composition_providers'](ROOT)
              if ROOT / name not in providers]
pins = {'files': [dict(path=str(p.relative_to(ROOT)), size=p.stat().st_size,
                      sha256=hashlib.sha256(p.read_bytes()).hexdigest()) for p in providers]}
for case in ('check', 'spawn-refused', 'bad-pin', 'changed-generation', 'missing-provider', 'bad-import',
             'missing-screenshot', 'missing-composition', 'stale-composition-pin'):
    active = OUT / case
    active.mkdir()
    selected = json.loads(json.dumps(pins))
    runtime = RUNTIME
    if case == 'bad-pin':
        selected['files'][1]['sha256'] = '0' * 64
    if case == 'missing-provider':
        selected['files'] = [p for p in selected['files'] if p['path'] != 'tools/native_kernel_custody.py']
    if case in ('missing-screenshot', 'missing-composition'):
        omitted = {'missing-screenshot': 'tools/q3-screenshot-completion.cjs',
                   'missing-composition': 'tools/q3-native-driver-composition.cjs'}[case]
        selected['files'] = [p for p in selected['files'] if p['path'] != omitted]
    if case == 'stale-composition-pin':
        next(p for p in selected['files'] if p['path'] == 'tools/q3-screenshot-completion.cjs')['sha256'] = '0' * 64
    if case == 'bad-import':
        runtime = active / 'invalid-runtime.py'
        runtime.write_text('import q3_deliberately_absent_prelaunch_control\n')
        selected['files'].append(dict(path=str(runtime.relative_to(ROOT)),
            size=runtime.stat().st_size, sha256=hashlib.sha256(runtime.read_bytes()).hexdigest()))
    with gzip.open(active / 'runtime-pins.json.gz', 'xb') as stream:
        stream.write(json.dumps(selected).encode())
    calls.clear()
    attempts.clear()
    tamper = case == 'changed-generation'
    sys.argv = [str(WRAPPER), str(ROOT), str(active), str(runtime)]
    if case == 'check':
        sys.argv.append('--check-only')
    try:
        runpy.run_path(str(WRAPPER), run_name='__main__')
    except Refused:
        assert case == 'spawn-refused'
    except ValueError as error:
        assert case in ('bad-pin', 'changed-generation', 'missing-provider', 'missing-screenshot',
                        'missing-composition', 'stale-composition-pin'), error
        print(case, str(error))
    except ModuleNotFoundError as error:
        assert case == 'bad-import' and error.name == 'q3_deliberately_absent_prelaunch_control'
    else:
        assert case == 'check'
    assert calls == ({'check': ['publish', 'require'], 'spawn-refused': ['publish', 'require'],
                      'bad-pin': ['publish'], 'changed-generation': ['publish', 'require'],
                      'missing-provider': [], 'bad-import': ['publish'], 'missing-screenshot': [],
                      'missing-composition': [], 'stale-composition-pin': []}[case]), calls
    assert attempts == (['subprocess.Popen'] if case == 'spawn-refused' else [])
    assert (active / 'one-original-claim.json.gz').exists() == (case == 'spawn-refused')
    assert not (active / 'runtime-parent-actual-wait.json.gz').exists()
    if case in ('check', 'spawn-refused', 'changed-generation', 'bad-import'):
        custody = sys.modules['native_kernel_custody']
        assert Path(custody.__file__).resolve() == ROOT / 'tools/native_kernel_custody.py'
        assert callable(custody.supervise) and callable(custody.identity)
    print(case, 'PASS', 'barrierCalls=' + repr(calls), 'refused=' + repr(attempts))
sys.setprofile(None)
print('PASS: actual wrapper imports and barrier call sites; no child/network/native startup')
