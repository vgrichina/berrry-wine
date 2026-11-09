"""Execute the retained failed consumers and the composed continuation, offline."""
import contextlib
import ctypes
import gzip
import hashlib
import importlib.util
import io
import json
import os
import select
import socket
import subprocess
import sys
import tempfile
import time
import types
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RUN = ROOT / 'scratch/runs/20261109-redline-truncated-log-cleanup-repair-1325'
BASE = ROOT / 'scratch/runs/20261109-redline-distinct-label-training-1235'
FAILED = ROOT / 'scratch/runs/20261109-redline-traced-native-fixture-1295'
spec = importlib.util.spec_from_file_location('repair', ROOT / 'tools/redline-terminal-cleanup.py')
repair = importlib.util.module_from_spec(spec)
spec.loader.exec_module(repair)
RUN.mkdir(parents=True, exist_ok=True)
OUT = Path(tempfile.mkdtemp(prefix='controls-', dir=RUN))


def identity(pid):
    raw = Path('/proc', str(pid), 'stat').read_text()
    return dict(pid=pid, start=raw[raw.rfind(')')+2:].split()[19])


def inert_waits(inherited):
    # Adopt the inert writer so its wait is real, separate from pipe EOF.
    assert ctypes.CDLL(None).prctl(36, 1, 0, 0, 0) == 0
    release_r, release_w = os.pipe()
    program = ("import os,sys,time\n"
               "print('ready',flush=True)\n"
               + (f"pid=os.fork()\nif pid==0:\n os.read({release_r},1)\n os.write(2,b'writer done')\n os._exit(0)\nprint(pid,flush=True)\n" if inherited else '')
               + "os.read(0,1)\n")
    child = subprocess.Popen([sys.executable, '-c', program], stdin=subprocess.PIPE,
                             stdout=subprocess.PIPE, stderr=subprocess.PIPE, pass_fds=[release_r])
    os.close(release_r)
    assert child.stdout.readline() == b'ready\n'
    owned = [identity(child.pid)]
    if inherited:
        writer = int(child.stdout.readline())
        owned.append(identity(writer))
    child.stdin.write(b'x'); child.stdin.close()
    assert child.wait(timeout=3) == 0
    eof_before_release = not select.select([child.stdout], [], [], .05)[0]
    if inherited:
        assert eof_before_release, 'actual root wait does not imply inherited pipe EOF'
    os.write(release_w, b'x') if inherited else None
    os.close(release_w)
    stdout = child.stdout.read(); stderr = child.stderr.read()
    child.stdout.close(); child.stderr.close()
    if inherited:
        assert os.waitpid(writer, 0) == (writer, 0)
    for row in owned:
        assert not Path('/proc', str(row['pid'])).exists()
    return dict(complete=True, owned=owned, reaped=owned, remaining=[], unreaped=[], failure=None), dict(
        actualRootWait=0, stdoutEOF=True, stderrEOF=True, inheritedWaitSeparate=inherited,
        rootWaitBeforeWriterEOF=eof_before_release if inherited else None,
        stdoutSHA=hashlib.sha256(stdout).hexdigest(), stderrSHA=hashlib.sha256(stderr).hexdigest())


def execute(source, local, remote_root, stage='fixture', helper_kind=None):
    downloads = []
    def remote(name, code, timeout):
        # This is the actual generated filesystem/socket consumer; never CDP.
        stream = io.StringIO()
        with contextlib.redirect_stdout(stream):
            exec(compile(code, name, 'exec'), {})
        return dict(stdout=stream.getvalue())
    def save(name, value):
        (local / (name if name.endswith('.json') else name+'.json')).write_text(json.dumps(value))
    def download(src, dest, row):
        data = Path(src).read_bytes()
        assert len(data) == row['size'] and hashlib.sha256(data).hexdigest() == row['sha256']
        Path(dest).write_bytes(data); downloads.append(row['path'])
    control = types.ModuleType('control')
    control.R = local; control.RUN = remote_root.name; control.REMOTE = str(remote_root.parent)
    control.remote = remote; control.t = types.SimpleNamespace(download=download)
    control.durable = save; control.save = save
    sys.modules['control'] = control
    sys.argv = ['actual-consumer.py', stage]
    with contextlib.redirect_stdout(io.StringIO()):
        if helper_kind:
            name = 'terminal-cleanup.py' if helper_kind == 'cleanup' else 'recover.py'
            sys.argv = ['redline-terminal-cleanup.py', helper_kind, str(FAILED/name), stage]
            repair.main()
        else:
            exec(compile(source, 'actual-consumer.py', 'exec'), {})
    return downloads


def case(mode, old, drain, waits):
    directory = OUT / (('old-' if old else 'new-') + mode)
    r = directory / 'remote' / 'run'; local = directory / 'local'
    out = r / 'native-fixture'
    out.mkdir(parents=True); local.mkdir()
    profile = out / 'chrome-profile'; profile.mkdir(); (profile/'unique').write_bytes(b'profile')
    custody = r/'fixture-custody'; custody.mkdir()
    (custody/'kernel-drain.json').write_text(json.dumps(drain))
    (r/'runtime-pins.json').write_text('{"files":[]}')
    # Existing declared browser status is deliberately false even for valid gzip.
    shutdown = dict(actualBrowserExit=dict(code=1, signal=None), streamEOF=False, streamsTruncated=True)
    (out/'shutdown.json').write_text(json.dumps(shutdown))
    (r/'fixture-process-joins.json').write_text(json.dumps(waits))
    blob = gzip.compress(b'diagnostic only\n', mtime=0)
    if mode in ('incomplete', 'inherited'): blob = blob[:10]
    if mode == 'empty': blob = b''
    if mode == 'crc': blob = blob[:-8] + bytes([blob[-8] ^ 1]) + blob[-7:]
    if mode != 'absent':
        (out/'chrome-stderr.gz').write_bytes(blob)
        (out/'chrome-stdout.gz').write_bytes(blob)
    (r/'unique-last.bin').write_bytes(b'unique-last-byte-sequence')
    errors = {}
    for kind, name in [('cleanup','terminal-cleanup.py'),('retrieval','recover.py')]:
        source = repair.wrapper_source(FAILED/name)
        assert source == (BASE/name).read_text(), 'exact failed 1295 forwarding consumer'
        if not old: source = repair.compose(kind, source)
        try:
            execute(source, local, r, helper_kind=kind if not old else None)
        except (EOFError, gzip.BadGzipFile) as error:
            errors[kind] = type(error).__name__
    malformed = mode in ('incomplete','inherited','crc')
    if old:
        if malformed:
            assert set(errors) == {'cleanup','retrieval'}, errors
            assert profile.exists(), 'old abort prevents profile drain'
            assert not (local/'fixture-retrieval-verified.json').exists()
        elif mode == 'empty':
            assert not errors, 'old gzip decoder silently accepts empty no-member'
        else: assert not errors
    else:
        assert not errors
        assert not profile.exists()
        receipt = json.loads((local/'fixture-retrieval-verified.json').read_text())
        assert receipt['passed'] and receipt['collectionIsNotBrowserEOF'] and not receipt['fixturePASS']
        assert len(receipt['gzipDiagnostics']) == 2
        for status in receipt['gzipDiagnostics']:
            assert status['EOF'] == (mode == 'valid')
            assert status['gzipCRC'] == ('PASS' if mode == 'valid' else 'INVALID')
        assert (local/'retrieved/unique-last.bin').read_bytes() == b'unique-last-byte-sequence'
        assert json.loads((local/'retrieved/native-fixture/shutdown.json').read_text()) == shutdown
        rows = [row for row in receipt['files'] if row['path'].endswith('.gz')]
        assert len(rows) == (0 if mode == 'absent' else 2)
        for row in rows:
            assert row['shaSizeVerified']
            assert (local/'retrieved'/row['path']).read_bytes() == blob
            assert row['gzipCRC'] == ('INVALID' if malformed or mode == 'empty' else 'PASS')
            assert row['EOF'] == (mode == 'valid')
        # The same actual consumer skips downloads of existing verified bytes.
        assert execute(repair.compose('retrieval',(BASE/'recover.py').read_text()), local, r) == []
        cleanup = json.loads((r/'fixture-terminal-independent-cleanup.json').read_text())
        assert cleanup['collectionIsNotBrowserEOF']
        assert len(cleanup['gzipDiagnostics']) == 2
        # Existing corrupt retrieval is refused, never replaced or redownloaded.
        (local/'retrieved/unique-last.bin').write_bytes(b'wrong')
        try: execute(repair.compose('retrieval',(BASE/'recover.py').read_text()), local, r)
        except AssertionError: pass
        else: raise AssertionError('SHA-size mismatch must refuse')
    return dict(mode=mode, old=old, errors=errors, physicalDrain=not profile.exists(),
                oldEmptyFalseValidity=old and mode=='empty', waits=waits)


def suite():
    results = []
    for mode in ('valid','incomplete','empty','crc','absent','inherited'):
        drain, waits = inert_waits(mode == 'inherited')
        for old in (True, False): results.append(case(mode, old, drain, waits))
    for kind, name in [('cleanup','terminal-cleanup.py'),('retrieval','recover.py')]:
        source = (BASE/name).read_text()
        try: repair.compose(kind, source.replace('verified=[]', 'verified = []').replace("ports=[]", "ports = []"))
        except ValueError: pass
        else: raise AssertionError('changed wrapper must be refused')
    # The exact existing cleanup assertions still refuse unsafe physical cleanup.
    r = OUT/'new-valid/remote/run'; local = OUT/'refusals'; local.mkdir()
    profile = r/'native-fixture/chrome-profile'; profile.mkdir()
    source = repair.compose('cleanup',(BASE/'terminal-cleanup.py').read_text())
    drain_path = r/'fixture-custody/kernel-drain.json'
    original = drain_path.read_text()
    for change in (dict(complete=False), dict(remaining=[identity(os.getpid())]),
                   dict(unreaped=[identity(os.getpid())]), dict(reaped=[])):
        drain_path.write_text(json.dumps({**json.loads(original), **change}))
        try: execute(source, local, r)
        except AssertionError: pass
        else: raise AssertionError('custody refusal lost')
        assert profile.exists()
    drain_path.write_text(original)
    live = subprocess.Popen([sys.executable,'-c','import sys;sys.stdin.read()',str(profile)], stdin=subprocess.PIPE)
    try:
        try: execute(source, local, r)
        except AssertionError: pass
        else: raise AssertionError('live profile identity refused')
        assert profile.exists()
    finally:
        live.stdin.close(); assert live.wait(timeout=3) == 0
    with socket.socket() as listener:
        listener.bind(('127.0.0.1',0)); listener.listen()
        (r/'native-fixture/process.json').write_text(json.dumps(dict(port=listener.getsockname()[1])))
        try: execute(source, local, r)
        except AssertionError: pass
        else: raise AssertionError('open port must refuse')
        assert profile.exists()
    (OUT/'results.json').write_text(json.dumps(results, indent=2))
    print('PASS actual cleanup/retrieval old-abort or empty-false-validity FAIL / new drain+retain PASS; six modes, real waits and separate EOF; '+str(OUT))


if __name__ == '__main__':
    # Observable independent process deadline before any inert child is created.
    if '--suite' in sys.argv:
        suite()
    else:
        (OUT/'deadline-armed.json').write_text(json.dumps(dict(supervisor=os.getpid(), deadline=time.time()+40)))
        result = subprocess.run([sys.executable, __file__, '--suite'], timeout=40, capture_output=True)
        (OUT/'suite-stdout.log').write_bytes(result.stdout)
        (OUT/'suite-stderr.log').write_bytes(result.stderr)
        (OUT/'supervisor-wait.json').write_text(json.dumps(dict(code=result.returncode, stdoutEOF=True, stderrEOF=True)))
        print(result.stdout.decode(), end=''); print(result.stderr.decode(), end='', file=sys.stderr)
        assert result.returncode == 0
