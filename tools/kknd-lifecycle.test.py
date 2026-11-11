#!/usr/bin/env python3
"""Local HTTP + real Linux custody regression. No Boat access or boxes.

python3 tools/kknd-lifecycle.test.py EVIDENCE_DIR [HISTORICAL_RUN_DIR]
The optional historical run executes its exact lifecycle.py in the failing
composition. Historical files are referenced, never copied or repaired.
"""
import ctypes
import hashlib
import http.server
import importlib.util
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import threading
import time
import urllib.request

sys.dont_write_bytecode = True
SELF = Path(__file__).resolve()
SCRIPT = SELF.with_name('kknd-lifecycle.py')
spec = importlib.util.spec_from_file_location('lifecycle', SCRIPT)
life = importlib.util.module_from_spec(spec)
spec.loader.exec_module(life)
d = life.durable


def until(predicate, seconds=15):
    end = time.monotonic()+seconds
    while not predicate():
        assert time.monotonic() < end, 'bounded test wait expired'
        time.sleep(.02)


def api(url, method='GET'):
    request = urllib.request.Request(url, data=b'{}' if method == 'POST' else None, method=method)
    with urllib.request.urlopen(request, timeout=2) as response:
        return json.load(response)


def fixture(action, root, url, mode):
    if action == 'allocate':
        # In fail-before the exact historical daemon starts beneath finite
        # allocation custody. After repair prearm is supplied by its sibling
        # lifecycle custodian, and allocation has no lifecycle responsibility.
        if (root/'historical.json').exists():
            source = d.read(root/'historical.json')['source']
            subprocess.run([sys.executable, source, 'daemon', str(root)], check=True)
            until(lambda: all((root/(role+'-armed.json')).exists() for role in ('supervisor', 'normal', 'watchdog')))
        else:
            assert (root/'prearmed.json').exists()
        if mode == 'no-id-error':
            return 23
        # Owned session-escaping pipe holder must still be killed and waited
        # after successful finite allocation. It cannot take the siblings down.
        child = os.fork()
        if child == 0:
            os.setsid()
            signal.signal(signal.SIGTERM, signal.SIG_IGN)
            while True:
                time.sleep(1)
        life.emit(root, 'allocation-orphan', pid=child)
        box = api(url+'/allocate', 'POST')
        life.emit(root, 'boat-created', box=box, deadlineEpoch=d.read(root/'allocation-deadline.json')['deadlineEpoch'])
        print('finite allocation success', flush=True)
        if mode == 'timeout':
            while True:
                time.sleep(1)
        return 23 if mode == 'allocated-error' else 0
    if action == 'stop':
        result = api(url+'/stop', 'POST')
        life.emit(root, 'adapter-stop-receipt', **result)
        status = api(result['statusUrl'])
        box = api(url+'/box')
        life.emit(root, 'adapter-independent-confirmation', status=status, box=box)
        assert status['state'] == 'completed' and status['forced'] is False and status['error'] is None
        assert box['state'] == 'archived'
        life.emit(root, 'normal-stop-confirmed', confirmed=True, forced=False, statusUrl=result['statusUrl'])
        return 0
    raise ValueError(action)


class FakeAPI(http.server.ThreadingHTTPServer):
    daemon_threads = True


def check_stream(root, label, stream):
    receipt = d.read(root/(label+'-'+stream+'-eof.json'))
    data = (root/(label+'-'+stream+'.log')).read_bytes()
    assert receipt['separateEOF'] is True
    assert receipt['size'] == len(data) and receipt['sha256'] == hashlib.sha256(data).hexdigest()


def check_job(root):
    outcome = d.observe(root)
    assert outcome['custodyComplete'] is True
    for label in ('command', 'watchdog'):
        assert d.read(root/(label+'-wait.json'))['actualParentWait'] is True
        for stream in ('stdout', 'stderr'):
            check_stream(root, label, stream)
    return outcome


def tests(root, historical):
    assert ctypes.CDLL(None).prctl(36, 1, 0, 0, 0) == 0
    root.mkdir(parents=True, exist_ok=False)
    requests = []
    states = {}
    class Handler(http.server.BaseHTTPRequestHandler):
        def log_message(self, *args):
            pass

        def do_GET(self):
            self.respond()

        def do_POST(self):
            self.rfile.read(int(self.headers.get('Content-Length', 0)))
            self.respond()

        def respond(self):
            case, action = self.path.strip('/').split('/')
            requests.append(dict(at=time.time(), method=self.command, case=case, action=action))
            status = 200
            if action == 'allocate':
                states[case] = 'running'
                result = dict(id='fake-'+case, state='running')
            elif action == 'stop':
                assert self.command == 'POST'
                if case == 'stop-error':
                    status = 500
                    result = dict(error='deliberate ambiguous stop error')
                else:
                    states[case] = 'archived'
                    result = dict(statusUrl=base+'/'+case+'/status')
            elif action == 'status':
                result = dict(state='completed', forced=False, error=None)
            else:
                result = dict(state=states[case])
            data = json.dumps(result).encode()
            self.send_response(status)
            self.send_header('Content-Length', str(len(data)))
            self.end_headers()
            self.wfile.write(data)
    server = FakeAPI(('127.0.0.1', 0), Handler)
    base = 'http://127.0.0.1:'+str(server.server_port)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    # This unrelated sibling must survive every owned descendant cleanup.
    sentinel = subprocess.Popen([sys.executable, '-c', 'import time;time.sleep(120)'],
                                stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    results = []
    try:
        modes = (['fail-before'] if historical else []) + ['normal', 'observer-loss', 'deadline', 'normal-loss', 'allocated-error', 'no-id-error', 'timeout', 'stop-error']
        for mode in modes:
            case = root/mode
            case.mkdir()
            deadline = time.time()+(5 if mode in ('deadline', 'normal-loss', 'timeout') else 10)
            life.emit(case, 'allocation-deadline', deadlineEpoch=deadline, immutable=True)
            config = dict(deadlineEpoch=deadline, allocationSeconds=4, stopSeconds=3,
                allocationArgv=[sys.executable, str(SELF), '--fixture', 'allocate', str(case), base+'/'+mode, mode],
                stopArgv=[sys.executable, str(SELF), '--fixture', 'stop', str(case), base+'/'+mode, mode])
            d.publish(case/'input-config.json', config)
            if mode == 'fail-before':
                life.emit(case, 'historical', source=str(historical/'lifecycle.py'))
                (case/'parent-fixed.py').symlink_to(historical/'parent-fixed.py')
                (case/'mock.json').write_text('{}')
                finite = case/'allocation-custody'
                # Exact same wrapper and allocation command as pass-after.
                d.submit(finite, config['allocationArgv'], 4)
                until(lambda: (finite/'outcome.json').exists())
                outcome = check_job(finite)
                assert outcome['returnCode'] == 0
                waits = d.read(finite/'watchdog-terminal.json')['adopted']
                pids = [d.read(case/(role+'-armed.json'))['pid'] for role in ('supervisor', 'normal', 'watchdog')]
                assert all(any(w['pid'] == pid and w['returnCode'] == -9 and w['actualWaitpid'] for w in waits) for pid in pids)
                before = (case/'watchdog-heartbeat.jsonl').read_bytes()
                life.emit(case, 'normal-stop-request')
                life.emit(case, 'retrieval-verified', passed=True)
                time.sleep(.4)
                assert (case/'watchdog-heartbeat.jsonl').read_bytes() == before
                assert not (case/'normal-stop-confirmed.json').exists()
                assert not (case/'watchdog-wait.json').exists()  # missing stays missing
                life.emit(case, 'expected-failure', allocationReturnCode=0, adoptedWaits=waits,
                          ongoingHeartbeat=False, missingHistoricalWaitsRemainMissing=True)
                results.append(dict(mode=mode, expectedFailure=True))
                continue
            observer = subprocess.Popen([sys.executable, str(SCRIPT), 'run', str(case), str(case/'input-config.json')],
                                        stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            until(lambda: (case/'prearmed.json').exists())
            assert d.read(case/'prearmed.json')['at'] < d.read(case/'boat-created.json')['at'] if (case/'boat-created.json').exists() else True
            if mode == 'observer-loss':
                observer.terminate()
                stdout, stderr = observer.communicate(timeout=3)
                life.emit(case, 'observer-actual-wait', returnCode=observer.returncode, pid=observer.pid, actualParent=os.getpid(), actualParentWait=True)
                for name, data in [('stdout', stdout), ('stderr', stderr)]:
                    (case/('observer-'+name+'.log')).write_bytes(data)
                    life.emit(case, 'observer-'+name+'-eof', separateEOF=True, size=len(data), sha256=hashlib.sha256(data).hexdigest())
                assert observer.returncode == -signal.SIGTERM
                # Identical second observer only observes; no second allocation.
                life.submit(case, config)
            until(lambda: (case/'allocation-result.json').exists())
            allocation = check_job(case/'allocation-custody')
            allocated = (case/'boat-created.json').exists()
            if allocated:
                orphan = d.read(case/'allocation-orphan.json')['pid']
                assert any(w['pid'] == orphan and w['returnCode'] == -9 for w in d.read(case/'allocation-custody/watchdog-terminal.json')['adopted'])
            if mode in ('normal', 'observer-loss', 'deadline', 'normal-loss', 'stop-error'):
                assert allocation['returnCode'] == 0
                # Read only AFTER the entire finite wrapper has returned and
                # reaped its orphan. Require several new independent heartbeats.
                initial = len((case/'watchdog-heartbeat.jsonl').read_text().splitlines())
                until(lambda: len((case/'watchdog-heartbeat.jsonl').read_text().splitlines()) >= initial+3)
                rows = [json.loads(line) for line in (case/'watchdog-heartbeat.jsonl').read_text().splitlines()]
                assert sum(row['at'] > allocation['at'] for row in rows) >= 3
                assert all(row['deadlineEpoch'] == deadline for row in rows)
                life.emit(case, 'post-allocation-heartbeat-proof', allocationOutcomeAt=allocation['at'], observations=rows, countAfter=sum(row['at'] > allocation['at'] for row in rows))
                if mode == 'normal-loss':
                    pid = d.read(case/'normal-armed.json')['pid']
                    fd = os.pidfd_open(pid)
                    signal.pidfd_send_signal(fd, signal.SIGKILL)
                    os.close(fd)
                elif mode not in ('deadline',):
                    life.emit(case, 'normal-stop-request')
                    life.emit(case, 'retrieval-verified', passed=True)
            until(lambda: (case/'lifecycle-custody/outcome.json').exists(), 20)
            final = check_job(case/'lifecycle-custody')
            for role in ('normal', 'watchdog'):
                assert d.read(case/(role+'-wait.json'))['actualParentWait']
                for stream in ('stdout', 'stderr'):
                    check_stream(case, role, stream)
            if mode == 'normal-loss':
                assert d.read(case/'normal-wait.json')['returnCode'] == -9
                assert d.read(case/'watchdog-wait.json')['returnCode'] == 0
            if mode != 'observer-loss':
                stdout, stderr = observer.communicate(timeout=3)
                life.emit(case, 'observer-actual-wait', returnCode=observer.returncode, pid=observer.pid, actualParent=os.getpid(), actualParentWait=True)
                for name, data in [('stdout', stdout), ('stderr', stderr)]:
                    (case/('observer-'+name+'.log')).write_bytes(data)
                    life.emit(case, 'observer-'+name+'-eof', separateEOF=True, size=len(data), sha256=hashlib.sha256(data).hexdigest())
            stops = [row for row in requests if row['case'] == mode and row['action'] == 'stop']
            assert len(stops) == (0 if mode == 'no-id-error' else 1), (mode, stops)
            if mode not in ('no-id-error', 'stop-error'):
                assert life.confirmed(case)
                assert states[mode] == 'archived'
                check_job(case/'stop-custody')
                if mode in ('deadline', 'normal-loss', 'timeout'):
                    assert d.read(case/'stop-attempt.json')['role'] == 'watchdog'
                    assert stops[0]['at'] >= deadline
                if mode in ('normal', 'observer-loss'):
                    assert stops[0]['at'] < deadline
            assert final['returnCode'] == (0 if mode in ('normal', 'observer-loss', 'deadline') else 1)
            assert sentinel.poll() is None, 'unrelated sibling was killed'
            results.append(dict(mode=mode, passed=True, allocationReturnCode=allocation['returnCode'],
                                lifecycleReturnCode=final['returnCode'], normalStopCount=len(stops)))
        life.emit(root, 'results', passed=True, cases=results)
    finally:
        life.emit(root, 'fake-api-requests', requests=requests)
        server.shutdown()
        server.server_close()
        sentinel.terminate()
        out, err = sentinel.communicate(timeout=3)
        life.emit(root, 'unrelated-sentinel-wait', actualParentWait=True, pid=sentinel.pid, returnCode=sentinel.returncode)
        for stream, data in [('stdout', out), ('stderr', err)]:
            (root/('sentinel-'+stream+'.log')).write_bytes(data)
            life.emit(root, 'sentinel-'+stream+'-eof', separateEOF=True, size=len(data), sha256=hashlib.sha256(data).hexdigest())
        # Our subreaper owns detached durable owners, including the observer
        # loss case. Retain their real waits too, without PID-absence inference.
        end = time.monotonic()+25
        adopted = []
        while True:
            try:
                pid, status = os.waitpid(-1, os.WNOHANG)
            except ChildProcessError:
                break
            if pid:
                adopted.append(dict(pid=pid, rawStatus=status, returnCode=os.waitstatus_to_exitcode(status), actualWaitpid=True, actualParent=os.getpid()))
            else:
                assert time.monotonic() < end, 'test-owned lifecycle failed to terminate'
                time.sleep(.02)
        life.emit(root, 'test-adopted-actual-waits', waits=adopted)
    print(json.dumps(results), flush=True)


if __name__ == '__main__':
    if sys.argv[1] == '--fixture':
        sys.exit(fixture(sys.argv[2], Path(sys.argv[3]), sys.argv[4], sys.argv[5]))
    tests(Path(sys.argv[1]).resolve(), Path(sys.argv[2]).resolve() if len(sys.argv) > 2 else None)
