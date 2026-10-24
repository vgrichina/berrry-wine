"""Offline rejecting oracle for the exact candidate supervisor finalization.

No guest, process-group, box or native interface is invoked. Only the child and
clock interfaces are mocked; receipt reads/writes and all supervisor code under
review are real. Exit 1 means the candidate fails the denial-propagation oracle.
"""
import gzip
import json
import os
import pathlib
import subprocess
import sys
import tempfile

repo = pathlib.Path(__file__).resolve().parents[1]
evidence = repo / 'docs/re-notes/enigma-runner-repairs-independent-20261024'
with tempfile.TemporaryDirectory(prefix='enigma-supervisor-independent-') as tmp:
    root = pathlib.Path(tmp)
    adapter = root / 'candidate.cjs'
    adapter.write_bytes(gzip.decompress((evidence / 'candidate-terminal.cjs.gz').read_bytes()))
    original = root / 'original.py'
    original.write_bytes(gzip.decompress((evidence / 'original-supervise.py.gz').read_bytes()))
    transform = subprocess.run(
        ['node', '--max-old-space-size=256', '-e',
         'process.stdout.write(require(process.argv[1]).transformSupervisor(require("fs").readFileSync(process.argv[2],"utf8")))',
         str(adapter), str(original)], capture_output=True, timeout=10, check=True)
    source = transform.stdout.decode()
    helper = source[source.index('def terminal_capture():'):source.index('H=pathlib.Path')]
    start = source.index(' while p.poll() is None:\n', source.index("why='natural'"))
    end = source.index('\nfinally:', start)
    # Keep the actual try/loop/finally, through the actual END OF FILE.
    program = helper + '''
class Child:
 def poll(self):return None
class Clock:
 def monotonic(self):return 0
p=Child();time=Clock();start=0;why='natural';offset=0;tail=b''
log=open(E/'output.log','wb')
def stop(child):return dict(returncode=1,remainingGroup=False)
try:
''' + source[start:end] + source[end:]
    receipt = dict(version=1, terminal=True, reason='capture-byte-limit', artifactAccepted=False,
                   runnerSHA256='4d7b9587676db38fcf3314807acb2b2a42b5f09d2c98fcf3dccb8a6cde9e1809',
                   captureSHA256='6d64a146f2daf8b598dbf13e3c13f890dbc783d8f5286aacba6d343758d22079',
                   name='AssertionError', code='ERR_ASSERTION', message='capture byte limit')
    raw = root / 'raw.json'
    raw.write_text(json.dumps(receipt))
    env = dict(os.environ, ENIGMA_TERMINAL_RECEIPT=str(raw))
    prelude = 'import os,json,pathlib\nE=pathlib.Path(' + repr(str(root)) + ')\n'
    script = root / 'actual-supervisor-boundary.py'
    script.write_text(prelude + program)
    # This AND-list observes the real interpreter exit, without swallowing it.
    sentinel = root / 'dependent-ran'
    dependent = root / 'dependent.py'
    dependent.write_text('import pathlib\npathlib.Path(' + repr(str(sentinel)) + ').touch()\n')
    actual = subprocess.run(['bash', '-c', '"$1" "$2" && "$1" "$3"',
                             'probe', sys.executable, str(script), str(dependent)],
                            env=env, capture_output=True, timeout=10)
    record = json.loads((root / 'terminal.json').read_text())
    assert record['reason'] == 'capture-byte-limit'
    assert record['captureTerminal'] == receipt
    assert record['returncode'] == 1
    observed = dict(exit=actual.returncode, dependentRan=sentinel.exists(), receipt=record)
    # Positive control: the same actual fragment with an explicit failing exit
    # must prevent the AND-list's dependent command. No candidate is repaired.
    sentinel.unlink(missing_ok=True)
    script.write_text(prelude + program + '\nraise SystemExit(1)\n')
    control = subprocess.run(['bash', '-c', '"$1" "$2" && "$1" "$3"',
                              'probe', sys.executable, str(script), str(dependent)],
                             env=env, capture_output=True, timeout=10)
    assert control.returncode == 1 and not sentinel.exists()
    print(json.dumps(dict(actual=observed, expected=dict(exit=1, dependentRan=False),
                         rejectingControl=dict(exit=control.returncode, dependentRan=sentinel.exists()),
                         guest=False, boundary='actual transformed supervisor polling loop and complete finalization'), indent=2))
    if observed['exit'] == 0 or observed['dependentRan']:
        sys.exit(1)
