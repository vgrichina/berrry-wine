#!/usr/bin/env python3
"""One-shot API commands and a bounded local caller with actual child custody.

Transport matches the retained provision.Transport interface. A recovered result
is evidence on CommandObservationError, never permission to continue input.
Use this module's CLI as lifecycle-parent, with the existing manager argv after
--. Deadlines use the local monotonic clock; they are never renewed by recovery.
"""
import argparse
import hashlib
import http.client
import json
import math
import os
from pathlib import Path
import runpy
import selectors
import shlex
import signal
import socket
import subprocess
import sys
import threading
import time
import urllib.error
from urllib.parse import quote, urlsplit


class CommandObservationError(RuntimeError):
    def __init__(self, first_failure, result=None):
        super().__init__('command observation failed; input remains terminal')
        self.first_failure, self.result = first_failure, result


class Transport:
    def __init__(self, base, token, box, record, *, timeout=30, cancel=None,
                 deadline=None):
        if not 0 < timeout <= 30 or not math.isfinite(timeout):
            raise ValueError('API timeout exceeds strict cap')
        self.base, self.token, self.box = base.rstrip('/'), token, box
        self.record, self.timeout = record, timeout
        self.cancel = cancel if cancel is not None else threading.Event()
        self.deadline = deadline
        self.failure = None
        self.lock = threading.RLock()

    def check(self):
        if self.failure is not None or self.cancel.is_set():
            raise InterruptedError('terminal transport; no later effects/replay')
        if self.deadline is not None and time.monotonic() >= self.deadline:
            raise TimeoutError('caller deadline expired')

    def _fail(self, error, method, route):
        if self.failure is None:
            self.failure = dict(event='api-terminal', method=method, route=route,
                                error=type(error).__name__, detail=str(error), noRetry=True)
            self.cancel.set()
            self.record(dict(self.failure))

    def _request(self, method, route, body, due):
        """Private wire primitive; recovery can only call its captured GET route."""
        left = min(self.timeout, due-time.monotonic())
        if left <= 0:
            raise TimeoutError('existing command deadline expired')
        url = urlsplit(self.base + '/' + route)
        cls = http.client.HTTPSConnection if url.scheme == 'https' else http.client.HTTPConnection
        connection = cls(url.hostname, url.port, timeout=left)
        stopped = threading.Event()
        expired = threading.Event()
        sockets = []

        def monitor():
            while not stopped.wait(.005):
                if time.monotonic() >= due or (self.cancel.is_set() and self.failure is None):
                    expired.set()
                    if sockets or connection.sock:
                        try:
                            (sockets[0] if sockets else connection.sock).shutdown(socket.SHUT_RDWR)
                        except OSError:
                            pass
                    return

        watcher = threading.Thread(target=monitor)
        watcher.start()
        try:
            connection.request(method, url.path + ('?' + url.query if url.query else ''),
                               body=None if body is None else json.dumps(body).encode(),
                               headers={'Authorization': 'Bearer ' + self.token,
                                        'Content-Type': 'application/json'})
            sockets.append(connection.sock)
            response = connection.getresponse()
            raw = response.read(1048577)
            if expired.is_set() or time.monotonic() >= due:
                raise TimeoutError('API absolute deadline')
            if not 200 <= response.status < 300:
                raise urllib.error.HTTPError(url.geturl(), response.status, 'API refused', {}, None)
            if len(raw) > 1048576:
                raise ValueError('API response bound exceeded')
            return json.loads(raw)
        finally:
            stopped.set()
            watcher.join()
            connection.close()

    def api(self, method, route, body=None):
        with self.lock:
            self.check()
            due = min(time.monotonic()+self.timeout, self.deadline or float('inf'))
            try:
                result = self._request(method, route, body, due)
                self.check()
                return result
            except Exception as error:
                self._fail(error, method, route)
                raise

    def url(self, path):
        value = self.api('POST', 'sandboxes/' + self.box + '/files/upload-url',
                         dict(path=path, ttlSeconds=900))
        if value.get('method') != 'PUT' or value.get('path') != path or not value.get('url'):
            error = ValueError('signed capability path/method refusal')
            self._fail(error, 'POST', 'files/upload-url')
            raise error
        return value['url']

    def remote(self, label, code, timeout):
        # Compatibility with the production provider callback, which supplies
        # Python source. Gameplay callers use execute with their exact shell
        # command and their already-established absolute observation deadline.
        return self.execute(label, shlex.join(['python3', '-B', '-c', code]),
                            timeout=timeout, deadline=time.monotonic()+timeout+10)

    def execute(self, label, command, *, timeout, deadline):
        """Submit the exact command once; observe it within the caller's bound.

        The native.request route has a 60s deadline established before POST.
        Pass that same deadline here, without adding remote()'s provider grace.
        """
        with self.lock:
            self.check()
            if not math.isfinite(timeout) or timeout <= 0 or not math.isfinite(deadline):
                raise ValueError('invalid command timeout')
            due = min(deadline, self.deadline or float('inf'))
            route = 'sandboxes/' + self.box + '/commands'
            self.record(dict(event='command-attempt', label=label,
                             commandSHA256=hashlib.sha256(command.encode()).hexdigest(), deadline=due))
            try:
                value = self._request('POST', route, dict(command=command, detached=True,
                                      timeoutSeconds=max(1, int(timeout))),
                                      min(due, time.monotonic()+self.timeout))
                if (value.get('success') is not True or value.get('type') != 'command.started'
                        or value.get('command') != command or not value.get('startedAt')
                        or type(value.get('processId')) is not int or value['processId'] <= 0):
                    raise ValueError('detached command identity not acknowledged; no replay')
                identity = {k: value[k] for k in ('processId', 'command', 'startedAt')}
                self.record(dict(event='command-started', label=label, value=value))
                poll = route + '/' + quote(str(identity['processId']), safe='') + '?tailBytes=1048576'
                recovery_reads = 0
                while time.monotonic() < due:
                    if self.failure is None:
                        self.check()
                    try:
                        state = self._request('GET', poll, None, min(due, time.monotonic()+self.timeout))
                    except (http.client.RemoteDisconnected, ConnectionError, TimeoutError) as error:
                        self._fail(error, 'GET', poll)
                        # Three additional status GETs maximum; never a new POST.
                        recovery_reads += 1
                        if recovery_reads > 3:
                            break
                        time.sleep(min(.15, max(0, due-time.monotonic())))
                        continue
                    self.record(dict(event='command-status', label=label, value=state,
                                     recovery=self.failure is not None))
                    if state.get('known') is not True or any(state.get(k) != v for k, v in identity.items()):
                        raise ValueError('command identity mismatch; no replay')
                    if state.get('status') == 'exited':
                        if (state.get('exitCode') != 0 or state.get('stdoutTruncated') is not False
                                or state.get('stderrTruncated') is not False or state.get('signal')
                                or state.get('oomKilled') or not isinstance(state.get('stdout'), str)):
                            raise ValueError('command outcome refused; no replay')
                        if self.failure is not None:
                            self.record(dict(event='command-recovered', label=label, value=state,
                                             readOnly=True, inputTerminal=True))
                            raise CommandObservationError(self.failure, state)
                        self.check()
                        self.record(dict(event='command-complete', label=label, value=state))
                        return state['stdout']
                    if state.get('status') != 'running':
                        raise ValueError('command outcome UNKNOWN')
                    if self.failure is not None:
                        recovery_reads += 1
                        if recovery_reads > 3:
                            break
                    elif self.cancel.is_set():
                        raise InterruptedError('caller cancelled')
                    time.sleep(min(.15, max(0, due-time.monotonic())))
                raise TimeoutError('existing detached completion deadline/recovery bound')
            except CommandObservationError:
                raise
            except Exception as error:
                self._fail(error, 'GET' if 'poll' in locals() else 'POST',
                           poll if 'poll' in locals() else route)
                raise CommandObservationError(self.failure) from error

    def provision(self, root, pins, remote_root):
        """Compose with the existing production chunk assembler and final reread."""
        self.check()
        helper = Path(__file__).with_name('q3-provider-upload.py')
        try:
            runpy.run_path(str(helper))['provision_chunked_files'](
                root, pins, remote_root, self.url, self.remote, self.record,
                timeout=self.timeout, cancel=self.cancel)
        except Exception as error:
            self._fail(error, 'provision', 'chunked-files')
            raise


def _save(path, value):
    with Path(path).open('x') as stream:
        json.dump(value, stream, indent=2)


def _watchdog(run, due):
    """Independent finite deadline, armed before the caller creates its child."""
    _save(run/'watchdog-armed.json', dict(pid=os.getpid(), deadline=due))
    fired = False
    while not (run/'caller-complete.json').exists():
        if time.monotonic() >= due:
            fired = True
            try:
                pid = json.loads((run/'child.json').read_text())['pid']
                os.killpg(pid, signal.SIGKILL)
            except (FileNotFoundError, ProcessLookupError):
                pass
            break
        time.sleep(.01)
    _save(run/'watchdog-terminal.json', dict(fired=fired, deadline=due))


def supervise(argv, run, timeout, grace=1):
    """Actual lifecycle caller. Receipt never substitutes a guessed/orphan wait.

    TERM/INT request orderly child-group TERM, then bounded KILL. Separate
    nonblocking reads drain both streams even if one fills before the other.
    Escaped pipe holders at the absolute deadline are reported as missing EOF.
    """
    if not 0 < grace < timeout or not math.isfinite(timeout):
        raise ValueError('invalid custody bounds')
    run = Path(run)
    run.mkdir(parents=True, exist_ok=True)
    due = time.monotonic()+timeout
    _save(run/'deadline.json', dict(deadline=due, timeout=timeout))
    received = []
    handlers = {s: signal.signal(s, lambda sig, frame: received.append(sig))
                for s in (signal.SIGTERM, signal.SIGINT)}
    watchdog = subprocess.Popen([sys.executable, '-B', __file__, '_watchdog', str(run), str(due)],
                                stdin=subprocess.DEVNULL, stdout=subprocess.PIPE,
                                stderr=subprocess.PIPE, start_new_session=True)
    p = None
    eof = {'stdout': False, 'stderr': False}
    errors = []
    counts = dict.fromkeys(eof, 0)
    digests = {n: hashlib.sha256() for n in eof}
    outputs = {}
    sel = selectors.DefaultSelector()
    stop_at = None
    reason = None
    try:
        arm_due = min(due, time.monotonic()+5)
        while not (run/'watchdog-armed.json').exists():
            if watchdog.poll() is not None or time.monotonic() >= arm_due or received:
                raise RuntimeError('independent watchdog not armed')
            time.sleep(.01)
        arm = json.loads((run/'watchdog-armed.json').read_text())
        if arm != dict(pid=watchdog.pid, deadline=due) or watchdog.poll() is not None:
            raise ValueError('watchdog identity mismatch')
        _save(run/'watchdog-observed.json', dict(**arm, alive=True))
        if received or time.monotonic() >= due:
            raise InterruptedError('caller stopped before child creation')
        p = subprocess.Popen(argv, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE,
                             stderr=subprocess.PIPE, start_new_session=True)
        _save(run/'child.json', dict(pid=p.pid, argv=argv))
        for name in eof:
            stream = getattr(p, name)
            os.set_blocking(stream.fileno(), False)
            sel.register(stream, selectors.EVENT_READ, name)
            outputs[name] = (run/(name+'.log')).open('xb')
        while p.poll() is None or sel.get_map():
            now = time.monotonic()
            if reason is None and (received or now >= due-grace):
                reason = 'signal' if received else 'deadline'
                stop_at = min(due, now+grace)
                try:
                    os.killpg(p.pid, signal.SIGTERM)
                except ProcessLookupError:
                    pass
            if stop_at is not None and now >= stop_at:
                try:
                    os.killpg(p.pid, signal.SIGKILL)
                except ProcessLookupError:
                    pass
            if now >= due+.1:
                errors.append('absolute drain deadline; EOF incomplete')
                break
            for key, _ in sel.select(.01):
                name = key.data
                try:
                    block = os.read(key.fd, 65536)
                    if not block:
                        eof[name] = True
                        sel.unregister(key.fileobj)
                        key.fileobj.close()
                    else:
                        digests[name].update(block)
                        keep = max(0, 1048576-counts[name])
                        outputs[name].write(block[:keep])
                        counts[name] += len(block)
                except OSError as error:
                    errors.append(name+': '+repr(error))
                    sel.unregister(key.fileobj)
                    key.fileobj.close()
        status = p.wait(timeout=max(.1, due+.2-time.monotonic()))
        receipt = dict(pid=p.pid, status=status, actualWait=True, separateEOF=eof,
                       bytes=counts, sha256={n: h.hexdigest() for n, h in digests.items()},
                       truncated={n: counts[n] > 1048576 for n in eof}, errors=errors,
                       reason=reason, signals=received)
        _save(run/'manager-actual-wait.json', receipt)
        if received:
            return 128+received[0]
        return status if status > 0 else (128-status if status < 0 else
                                        (1 if errors or not all(eof.values()) or reason else 0))
    finally:
        # Even a local logging/setup failure cannot abandon an owned child.
        if p is not None:
            if p.poll() is None:
                try:
                    os.killpg(p.pid, signal.SIGKILL)
                except ProcessLookupError:
                    pass
            p.wait()
            for name in eof:
                getattr(p, name).close()
        sel.close()
        for stream in outputs.values():
            stream.close()
        _save(run/'caller-complete.json', dict(at=time.monotonic()))
        so, se = watchdog.communicate(timeout=2)
        _save(run/'watchdog-actual-wait.json', dict(status=watchdog.returncode,
              actualWait=True, stdoutEOF=True, stderrEOF=True,
              stdout=so.decode(), stderr=se.decode()))
        for sig, handler in handlers.items():
            signal.signal(sig, handler)
        if watchdog.returncode != 0:
            raise RuntimeError('independent watchdog failed; caller cannot succeed')


if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == '_watchdog':
        _watchdog(Path(sys.argv[2]), float(sys.argv[3]))
    else:
        parser = argparse.ArgumentParser(description=__doc__)
        parser.add_argument('--run', required=True)
        parser.add_argument('--timeout', type=float, required=True)
        parser.add_argument('--grace', type=float, default=1)
        parser.add_argument('command', nargs=argparse.REMAINDER)
        args = parser.parse_args()
        argv = args.command[1:] if args.command[:1] == ['--'] else args.command
        if not argv:
            parser.error('child argv required after --')
        sys.exit(supervise(argv, args.run, args.timeout, args.grace))
