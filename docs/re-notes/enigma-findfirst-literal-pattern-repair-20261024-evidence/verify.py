#!/usr/bin/env python3
"""Offline controls; execute installed Node in place, never a guest or build."""
import gzip
import hashlib
import json
import pathlib
import resource
import shutil
import subprocess
import tempfile
import time

HERE = pathlib.Path(__file__).resolve().parent
REPO = HERE.parents[2]
TEST = REPO / 'test/test-vfs-findfirst-literals.js'
SOURCE = REPO / 'lib/filesystem.js'
BASE = gzip.decompress((HERE / 'baseline-filesystem.js.gz').read_bytes()).decode()
CURRENT = SOURCE.read_text()

def sha(data):
    return hashlib.sha256(data).hexdigest()

def cpu_limit():
    resource.setrlimit(resource.RLIMIT_CPU, (60, 60))

def run(label, args, expected):
    available = int(next(line.split()[1] for line in open('/proc/meminfo')
                         if line.startswith('MemAvailable:'))) * 1024
    free = shutil.disk_usage(HERE).free
    gate = {'memAvailable': available, 'hostFree': free,
            'projectedIncremental': 40201062, 'memFloor': 805306368,
            'hostFreeAfterFloor': 2982150144}
    if available < 805306368 or free - 40201062 < 2982150144:
        (HERE / 'denial.json').write_text(json.dumps(gate, indent=2) + '\n')
        raise SystemExit('Resource denial; stop without retry')
    command = ['timeout', '60', 'node', '--max-old-space-size=256'] + args
    start = time.monotonic()
    result = subprocess.run(command, cwd=REPO, text=True, capture_output=True,
                            preexec_fn=cpu_limit)
    receipt = {'label': label, 'command': command, 'gate': gate,
               'elapsedSeconds': time.monotonic() - start,
               'exit': result.returncode, 'stdout': result.stdout,
               'stderr': result.stderr, 'expected': expected}
    (HERE / (label + '.json')).write_text(json.dumps(receipt, indent=2) + '\n')
    assert (result.returncode == 0) == expected, label + ': unexpected test result'
    if not expected:
        assert 'SyntaxError' in result.stderr or 'AssertionError' in result.stderr, label
    print(label, 'PASS' if expected else 'REJECTED')

run('candidate', [str(TEST)], True)
with tempfile.TemporaryDirectory(prefix='findfirst-controls-', dir=HERE) as temp:
    temp = pathlib.Path(temp)
    for name in ['mem-utils.js', 'region-map.generated.js']:
        shutil.copyfile(REPO / 'lib' / name, temp / name)
    controls = {'old-main': BASE}
    callback = "ch => ch === '*' ? '.*' : ch === '?' ? '.' : '\\\\' + ch"
    assert CURRENT.count(callback) == 1
    for label, punctuation in [('plus', '+'), ('brackets', '[]'),
                               ('parentheses', '()'), ('dollar', '$'),
                               ('caret', '^'), ('braces', '{}'),
                               ('pipe', '|'), ('dot', '.')]:
        controls['unescaped-' + label] = CURRENT.replace(
            callback, 'ch => ' + json.dumps(punctuation) + '.includes(ch) ? ch : ' +
            callback.removeprefix('ch => '))
    controls['disabled-star'] = CURRENT.replace("ch === '*' ? '.*'", "ch === '*' ? '\\\\*'")
    controls['disabled-question'] = CURRENT.replace("ch === '?' ? '.'", "ch === '?' ? '\\\\?'")
    identities = {}
    for label, source in controls.items():
        assert source != CURRENT
        target = temp / (label + '.js')
        target.write_text(source)
        identities[label] = sha(target.read_bytes())
        run(label, [str(TEST), str(target)], False)
    (HERE / 'control-identities.json').write_text(json.dumps(identities, indent=2) + '\n')

for test in ['test-vfs.js', 'test-vfs-slash-resolution.js', 'test-vfs-device-namespace.js']:
    run(test.removesuffix('.js'), ['test/' + test], True)
run('test-tier', ['-e', "const t=require('./tools/test-tiers'); const n='test-vfs-findfirst-literals.js'; if(t.classifyTest(n)!=='unit')process.exit(1); console.log(n+': unit by filename convention');"], True)
(HERE / 'verified-identities.json').write_text(json.dumps({
    'baselineSHA256': sha(BASE.encode()), 'candidateSHA256': sha(SOURCE.read_bytes()),
    'testSHA256': sha(TEST.read_bytes()), 'node': subprocess.check_output(['node', '--version'], text=True).strip(),
    'cleanup': 'Temporary control modules removed; no guest, box, build or worker process started',
}, indent=2) + '\n')
