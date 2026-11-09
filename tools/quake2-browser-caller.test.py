"""Production remote-parent regression; real Node/preload, no Chrome.

DIRECT_NODE uses a test-only outer-parent seam when another task holds the
shared runtime lock. It still executes the exact selected Node argv, waits it,
and drains both pipes. Without the seam, the actual kernel supervisor runs.
"""
import ast
import gzip
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import time
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
RUN = Path(os.environ['Q2_BROWSER_CALLER_TEST_RUN']).resolve()
RUN.mkdir(parents=True, exist_ok=False)
spec = importlib.util.spec_from_file_location('caller', ROOT/'tools/quake2-native-launch-client.py')
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
policy = 'quake2-current-primary-3e491c08-v1'
base_env = {**os.environ, 'QUAKE2_CURRENT_BROWSER_COMPOSITION': '1',
            'QUAKE2_BROWSER_POLICY_VERSION': policy,
            'QUAKE2_NATIVE_CUSTODY_VERSION': 'publishedf977ebf7c',
            'QUAKE2_NATIVE_WRITER_WITNESS': '1', 'DRIVER_PREFLIGHT': '1', 'Q2_INPUT_WIRE': '1'}
base_env.pop('QUAKE2_NATIVE_COMPOSITION', None)
base_env['NODE_OPTIONS'] = '--require='+str(ROOT/'tools/quake2-current-browser-policy.cjs')+' --require='+str(ROOT/'tools/quake2-input-wire-observation.cjs')
pins = json.loads(Path(os.environ['Q2_BROWSER_CALLER_TEST_PINS']).read_text())
direct = os.environ.get('Q2_BROWSER_CALLER_DIRECT_NODE') == '1'
# The regression precedes publication. Only these explicitly repaired
# providers are refreshed in this test input, never in production preparation.
for p in pins['files']:
    if p['path'] in ['tools/quake2-native-launch-client.py', 'tools/quake2-native-driver-composition.cjs', 'tools/quake2-input-wire-observation.cjs']:
        b = (ROOT/p['path']).read_bytes()
        p.update(size=len(b), sha256=hashlib.sha256(b).hexdigest())

for mode in ['historical-caller', 'current', 'wrong-policy', 'mixed-preloads', 'default']:
    r = RUN/mode
    r.mkdir()
    (r/'runtime-pins.json').write_text(json.dumps(pins))
    deadline = int((time.time()+90)*1000)
    (r/'lifecycle.json').write_text(json.dumps(dict(browserDeadline=deadline)))
    env = {**base_env, 'BROWSER_DEADLINE': str(deadline)}
    if mode == 'wrong-policy': env['QUAKE2_BROWSER_POLICY_VERSION'] = 'wrong'
    if mode == 'mixed-preloads': env['QUAKE2_NATIVE_COMPOSITION'] = '1'
    if mode == 'default':
        env.pop('QUAKE2_CURRENT_BROWSER_COMPOSITION')
        env['NODE_OPTIONS'] = '--require='+str(ROOT/'tools/quake2-input-wire-observation.cjs')
    parent = m.remote_parent
    if mode == 'historical-caller':
        source = subprocess.check_output(['git', 'show', 'a826c223c0633f19414118033e6f5f8b8651065c:tools/quake2-native-launch-client.py'], cwd=ROOT)
        node = next(n for n in ast.parse(source).body if isinstance(n, ast.FunctionDef) and n.name == 'remote_parent')
        ns = dict(m.__dict__)
        exec(compile(ast.Module(body=[node], type_ignores=[]), 'historical-remote-parent', 'exec'), ns)
        parent = ns['remote_parent']
    calls = []
    original = m.supervise_caller
    def supervise(run, command, due):
        calls.append(dict(command=command, deadline=due, historical=os.environ.get('QUAKE2_NATIVE_COMPOSITION')))
        if direct:
            child = subprocess.Popen(json.loads(command[-1]), cwd=ROOT, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            stdout, stderr = child.communicate(timeout=15)
            (run/'direct-node.stdout').write_bytes(stdout)
            (run/'direct-node.stderr').write_bytes(stderr)
            receipt = dict(pid=child.pid, status=child.returncode, actualWait=True,
                           stdioEOF=True, stdoutEOF=True, stderrEOF=True, custody='NOT_TESTED')
            (run/'caller-parent-wait.json').write_text(json.dumps(receipt))
            return receipt
        return original(run, command, due)
    # Baseline function has its own globals; keep the actual supervisor there.
    if mode == 'historical-caller': ns['supervise_caller'] = supervise
    with patch.dict(os.environ, env, clear=True), patch.object(m, 'supervise_caller', supervise):
        try:
            status = parent(r)
            assert mode not in ['wrong-policy', 'mixed-preloads']
        except ValueError as error:
            assert mode in ['wrong-policy', 'mixed-preloads'] and not calls
            (r/'refusal.json').write_text(json.dumps(dict(error=str(error), beforeSpawn=True)))
            continue
    (r/'selection.json').write_text(json.dumps(calls))
    receipt = json.loads((r/'caller-parent-wait.json').read_text())
    assert receipt['actualWait'] and receipt['stdoutEOF'] and receipt['stderrEOF']
    if direct:
        output = (r/'direct-node.stdout').read_bytes()+(r/'direct-node.stderr').read_bytes()
    else:
        kernel = json.loads((r/'kernel-drain.json').read_text())
        assert kernel['complete'] and len(kernel['owned']) == len(kernel['reaped'])
        assert not any(kernel[k] for k in ['remaining', 'unreaped', 'unresolvedPtrace', 'unresolvedLineage', 'unresolvedResumes'])
        output = gzip.decompress((r/'kernel-command.log.gz').read_bytes())
    if mode == 'current':
        assert status == 0, receipt
        assert calls[0]['historical'] != '1'
        assert calls[0]['command'][-1].find('quake2-current-browser-policy.cjs') >= 0
        preflight = json.loads(output)
        assert preflight['passed'] and not preflight['chromiumStarted'] and not preflight['originalStarted']
        assert not (r/'original').exists(), 'preflight must stop before Chrome'
    elif mode == 'historical-caller':
        assert status != 0, 'old remote parent must fail the explicit policy'
        assert b'use only the versioned Q2 browser preload' in output
    else:
        assert status == 0
        assert calls[0]['historical'] == '1'
        assert calls[0]['command'][-1].find('quake2-native-driver-composition.cjs') >= 0
print(json.dumps(dict(passed=True, actualRemoteParent=True, actualNodePreload=True,
                     actualKernelDrains=not direct, directNodeTestSeam=direct, historicalCallerFailed=True,
                     currentPreflightPassed=True, invalidSelectionsBeforeSpawn=True,
                     defaultPreserved=True, chromeStarted=False, nativeQualification=False)))
