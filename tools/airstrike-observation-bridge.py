#!/usr/bin/env python3
"""Serial Airstrike observation adapter for the hash-pinned Controller.

This replaces the historical parent bridge, not the accepted controller CLI.
External inspection is an observation phase. Only after inspection completes
does the ten-second response/dispatch phase begin. Both consume the SAME
120-second run allowance; failure never retries input or claims ordinary Quit.

Use Bridge(argv, controller_path, evidence_dir).run() under the admitted runtime
supervisor after exact-configuration startup/mount validation. A reviewer reads
review-request.json and atomically publishes review-<token>.json containing the
request's session, token, sha256 and after, and an accepted-controller observation.
No image recognition, focus inference, guest state editing or replay is provided.
Only this bridge may own the runner's control channel during the run.
"""
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import resource
import selectors
import signal
import subprocess
import time
import uuid

CONTROLLER_SHA256 = 'c4fb61b1ad21e22d5fe744e8ce55461246e6c5c8cead2b63a979732b2b25aa6d'
RESPONSE_SECONDS = 10
GUEST_SECONDS = 120
WALL_SECONDS = 150
OUTPUT_BYTES = 2 * 1024 * 1024
FRAME_BYTES = 4 * 1024 * 1024


class Stop(RuntimeError):
    pass


def save(path, value):
    tmp = path.with_suffix(path.suffix + '.tmp')
    tmp.write_text(json.dumps(value, indent=2) + '\n')
    os.replace(tmp, path)


def load_controller(path):
    if hashlib.sha256(Path(path).read_bytes()).hexdigest() != CONTROLLER_SHA256:
        raise Stop('controller pin mismatch')
    spec = importlib.util.spec_from_file_location('accepted_airstrike_controller', path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def child_limits():
    # Never raise inherited enforcement (offline fixtures inherit CPU90).
    for kind, ceiling in ((resource.RLIMIT_CPU, 140),
                          (resource.RLIMIT_FSIZE, FRAME_BYTES)):
        soft, hard = resource.getrlimit(kind)
        limit = min([ceiling] + [n for n in (soft, hard) if n != resource.RLIM_INFINITY])
        resource.setrlimit(kind, (limit, limit))


class Bridge:
    def __init__(self, argv, controller_path, evidence_dir, *, cwd=None, env=None,
                 guest_seconds=GUEST_SECONDS, wall_seconds=WALL_SECONDS):
        if not 0 < guest_seconds <= GUEST_SECONDS or not guest_seconds <= wall_seconds <= WALL_SECONDS:
            raise ValueError('allowances may only be shortened')
        self.module = load_controller(controller_path)
        self.controller = self.module.Controller(self.receive, self.send)
        self.argv, self.cwd, self.env = argv, cwd, env
        self.root = Path(evidence_dir)
        self.root.mkdir(parents=True, exist_ok=False)
        self.session = uuid.uuid4().hex
        self.guest_seconds, self.wall_seconds = guest_seconds, wall_seconds
        self.p = None
        self.sel = selectors.DefaultSelector()
        self.pending = bytearray()
        self.logs = {'stdout': bytearray(), 'stderr': bytearray()}
        self.acks = {}
        self.serial = 0
        self.command = None
        self.after = None
        self.activated = False
        self.signals = []
        self.events = []
        self.response_deadline = None
        self.expected_focus = None
        self.reviewed_capture = None
        self.terminal = None
        self.streams = {}

    def event(self, kind, **value):
        self.events.append(dict(kind=kind, elapsed=time.monotonic()-self.start, **value))
        if len(self.events) > 512:
            raise Stop('event bound')
        save(self.root/'events.json', self.events)

    def check(self):
        if time.monotonic() >= self.guest_deadline:
            raise Stop('overall guest deadline; no replay')
        if sum(map(len, self.logs.values())) > OUTPUT_BYTES:
            raise Stop('distinct stream aggregate output bound')
        if any(x in self.logs['stdout'] or x in self.logs['stderr']
               for x in (b'*** CRASH', b'Fatal error:', b'[eip-zero]', b'[max-seconds]')):
            raise Stop('runner fault/timeout')

    def pump(self, wait=.02, *, guards=True):
        if guards:
            self.check()
        for key, _ in self.sel.select(wait):
            data = os.read(key.fd, 8192)
            if not data:
                self.sel.unregister(key.fileobj)
                continue
            name = key.data
            remaining = OUTPUT_BYTES - sum(map(len, self.logs.values()))
            if len(data) > remaining:
                kept = data[:max(0, remaining)]
                self.streams[name].write(kept)
                self.streams[name].flush()
                self.logs[name].extend(kept)
                raise Stop('distinct stream aggregate output bound')
            self.streams[name].write(data)
            self.streams[name].flush()
            self.logs[name].extend(data)
            if name == 'stdout':
                self.pending.extend(data)
                if len(self.pending) > 65536:
                    raise Stop('runner line bound')
                while b'\n' in self.pending:
                    line, _, tail = self.pending.partition(b'\n')
                    self.pending = bytearray(tail)
                    if line.startswith(b'[ctl] '):
                        ack = json.loads(line[6:])
                        ident = ack.get('id')
                        if ident != self.waiting_id or ident in self.acks:
                            raise Stop('unmatched/duplicate ACK; no replay')
                        self.acks[ident] = ack
        if guards:
            self.check()

    def write(self, cmd):
        self.check()
        if self.p.poll() is not None:
            raise Stop('runner terminal before dispatch')
        self.waiting_id = cmd['id']
        self.event('dispatch', command=cmd)
        self.p.stdin.write((json.dumps(cmd)+'\n').encode())
        self.p.stdin.flush()

    def ack(self, cmd, deadline, *, terminal_ok=False):
        while cmd['id'] not in self.acks:
            self.pump()
            if self.p.poll() is not None:
                for _ in range(3):
                    self.pump(0)
                if cmd['id'] in self.acks:
                    break
                if terminal_ok:
                    return {'terminal': self.finish_terminal()}
                raise Stop('runner exited before ACK; no replay')
            if time.monotonic() >= deadline:
                raise Stop('missing ACK within ten-second response window; no replay')
        result = self.acks.pop(cmd['id'])
        self.waiting_id = None
        if time.monotonic() >= deadline:
            raise Stop('ACK arrived outside ten-second response window; no replay')
        if result.get('ok') is not True:
            raise Stop('runner rejected command; no replay')
        return {'ack': result}

    def request(self, action, deadline=None, **values):
        return self.request_ack(action, deadline, **values)['value']

    def request_ack(self, action, deadline=None, **values):
        if deadline is not None and time.monotonic() >= deadline:
            raise Stop('freshness exceeded ten-second response window')
        self.serial += 1
        cmd = dict(id='bridge-'+str(self.serial), action=action, **values)
        self.write(cmd)
        return self.ack(cmd, min(deadline or time.monotonic()+RESPONSE_SECONDS,
                                 self.guest_deadline))['ack']

    @staticmethod
    def focus(snapshot):
        hwnd = snapshot.get('focus')
        if (not hwnd or hwnd != snapshot.get('mainHwnd') or snapshot.get('quit')
                or not any(w.get('hwnd') == hwnd and w.get('visible') is True
                           and str(w.get('title', '')).startswith('Airstrike')
                           for w in snapshot.get('windows', []))):
            raise Stop('fresh Airstrike main-window focus absent')
        return {k: snapshot.get(k) for k in ('focus', 'mainHwnd', 'screen', 'windows')}

    def capture(self, token, deadline=None):
        path = self.root/('capture-'+token+'.png')
        before = self.request('snapshot', deadline)
        focus = self.focus(before)
        ack = self.request('png', deadline, path=str(path.resolve()))
        after = self.request('snapshot', deadline)
        if self.focus(after) != focus:
            raise Stop('focus/window changed across capture')
        if (not path.is_file() or not 0 < path.stat().st_size <= FRAME_BYTES
                or ack.get('path') != str(path.resolve())
                or ack.get('bytes') != path.stat().st_size):
            raise Stop('capture file/ACK mismatch')
        if sum(p.stat().st_size for p in self.root.glob('capture-*.png')) > 16*1024*1024:
            raise Stop('cumulative frame bound')
        return dict(path=str(path), sha256=hashlib.sha256(path.read_bytes()).hexdigest(),
                    snapshot=after, focus=focus)

    def observation(self):
        token = uuid.uuid4().hex
        captured = self.capture(token)
        request = dict(session=self.session, token=token, after=self.after,
                       **captured)
        save(self.root/'review-request.json', request)
        self.event('review-start', token=token, after=self.after)
        reply = self.root/('review-'+token+'.json')
        # Controller has not entered a timed response receive here. Review
        # remains monitored and charged against the original overall allowance.
        while not reply.exists():
            self.pump()
            if self.p.poll() is not None:
                raise Stop('runner exited during factual review')
        if reply.stat().st_size > 16384:
            raise Stop('review response bound')
        value = json.loads(reply.read_text())
        if (any(value.get(k) != request[k] for k in ('session', 'token', 'sha256', 'after'))
                or value.get('observation', {}).get('after') != self.after):
            raise Stop('stale/unmatched factual observation')
        # Start the ten-second budget AFTER the slow external phase.
        self.response_deadline = min(time.monotonic()+RESPONSE_SECONDS, self.guest_deadline)
        self.event('response-start', token=token, seconds=RESPONSE_SECONDS)
        self.reviewed_capture = (token, captured)
        self.expected_focus = captured['focus']
        return {'observation': value['observation']}

    def send(self, cmd):
        if self.command is not None:
            raise Stop('overlapping controller command')
        if self.response_deadline is None or time.monotonic() >= self.response_deadline:
            raise Stop('expired observation dispatch lease')
        # Revalidate pixels and focus AFTER controller validation, immediately
        # before its first input. No request intervenes between final snapshot
        # and dispatch. Key release instead checks focus: the keydown itself
        # may have changed the selected row, which needs a new factual review.
        if cmd['cmd'].startswith('keydown:'):
            token, captured = self.reviewed_capture
            fresh = self.capture(token+'-fresh', self.response_deadline)
            if fresh['sha256'] != captured['sha256'] or fresh['focus'] != captured['focus']:
                raise Stop('reviewed image/focus no longer current; no input')
            self.reviewed_capture = None
            before = fresh['snapshot']
        else:
            before = self.request('snapshot', self.response_deadline)
            if self.focus(before) != self.expected_focus:
                raise Stop('focus changed before input')
        if time.monotonic() >= self.response_deadline:
            raise Stop('expired observation dispatch lease')
        self.command = cmd
        self.dispatch_snapshot = before
        self.input_log_start = len(self.logs['stdout'])
        self.activated = self.activated or cmd['cmd'] == 'keydown:13'
        self.write(cmd)

    def receive(self):
        if self.command is not None:
            cmd, self.command = self.command, None
            value = self.ack(cmd, min(time.monotonic()+RESPONSE_SECONDS, self.guest_deadline),
                             terminal_ok=self.activated)
            if value.get('ack', {}).get('value', {}).get('queued') is True:
                value = self.complete_frozen(cmd, value)
            if 'ack' in value and cmd['cmd'].startswith('keyup:'):
                self.after = cmd['id']
            return value
        if self.activated:
            deadline = min(time.monotonic()+RESPONSE_SECONDS, self.guest_deadline)
            while self.p.poll() is None:
                self.pump()
                if time.monotonic() >= deadline:
                    raise Stop('terminal response deadline')
            return {'terminal': self.finish_terminal()}
        return self.observation()

    def complete_frozen(self, cmd, value):
        """One serial batch; retain original ACKs and actual stdout, never replay."""
        queued = value['ack']['value']
        before = self.dispatch_snapshot
        if (type(queued.get('batch')) is not int
                or queued['batch'] != before.get('batch')
                or before.get('frozen', {}).get('frozen') is not True
                or before['frozen'].get('credits') != 0):
            raise Stop('queued input lacks a frozen-zero dispatch boundary; no replay')
        deadline = min(self.response_deadline, self.guest_deadline)
        step = self.request_ack('step', deadline, n=1)
        done = step['value']
        if (done.get('ran') != 1 or done.get('steps') != 1
                or done.get('frozen') is not True
                or done.get('batch') != queued['batch'] + 1):
            raise Stop('partial/unmatched step completion; no replay')
        snapshot = self.request_ack('snapshot', deadline)
        state = snapshot['value']
        if (state.get('batch') != done['batch']
                or state.get('frozen', {}).get('frozen') is not True
                or state['frozen'].get('credits') != 0):
            raise Stop('step lacks matching frozen-zero snapshot; no replay')
        lines = bytes(self.logs['stdout'][self.input_log_start:]).decode(errors='replace').splitlines()
        action, vk = cmd['cmd'].split(':')
        expected = f'[input] {action} vk={vk} at batch {queued["batch"]}'
        if lines.count(expected) != 1:
            raise Stop('missing/ambiguous actual input execution log; no replay')
        completion = dict(inputId=cmd['id'], step=step, snapshot=snapshot,
                          logs=[line for line in lines if line.startswith('[input] ')])
        self.event('frozen-input-complete', inputAck=value['ack'], **completion)
        return dict(value, completion=completion)

    def group(self):
        result = []
        if self.p is None:
            return result
        for path in Path('/proc').glob('[0-9]*/stat'):
            try:
                fields = path.read_text().rsplit(')', 1)[1].split()
                if int(fields[2]) == self.p.pid:
                    result.append(int(path.parent.name))
            except (OSError, ValueError):
                pass
        return result

    def finish_terminal(self):
        self.p.wait(timeout=1)
        drain_deadline = min(time.monotonic()+1, self.start+self.wall_seconds)
        while self.sel.get_map():
            self.pump(.01, guards=False)
            if time.monotonic() >= drain_deadline:
                raise Stop('terminal drain wall bound')
        remaining = self.group()
        log = self.logs['stdout'].decode(errors='replace')
        combined = log+self.logs['stderr'].decode(errors='replace')
        fault = any(s in combined for s in ('*** CRASH', 'Fatal error:', '[eip-zero]'))
        timeout = '[max-seconds]' in combined
        normal = (self.p.returncode == 0 and '[Exit] code=0' in log.splitlines()
                  and not self.signals and not remaining
                  and not timeout and not fault)
        self.terminal = dict(reason='guest-exit' if normal else 'unproven-terminal',
                             guestExitCode=0 if normal else None, runnerExitCode=self.p.returncode,
                             signals=self.signals[:], cleanupComplete=not remaining,
                             evidence=str(self.root/'terminal.json'), runnerLog=log,
                             timeout=timeout, controlQuit=False, wmClose=False, fault=fault,
                             hostExitObserved=normal)
        save(self.root/'terminal.json', self.terminal)
        return self.terminal

    def run(self):
        self.start = time.monotonic()
        self.guest_deadline = self.start + self.guest_seconds
        self.waiting_id = None
        result = {'status': 'refused'}
        # Distinct bounded pipes AND owned files exist before Popen, including
        # failed setup/spawn. The runtime supervisor still owns RSS/CPU/wall.
        for name in self.logs:
            self.streams[name] = (self.root/('runner.'+name)).open('wb')
        (self.root/'controller.stderr').touch()
        status = self.root/'spawn-status.json'
        save(status, dict(state='attempting', argv=self.argv))
        try:
            self.p = subprocess.Popen(self.argv, cwd=self.cwd, env=self.env,
                                      stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                      stderr=subprocess.PIPE, start_new_session=True,
                                      preexec_fn=child_limits)
            save(status, dict(state='started', pid=self.p.pid, argv=self.argv))
            for stream, name in ((self.p.stdout, 'stdout'), (self.p.stderr, 'stderr')):
                os.set_blocking(stream.fileno(), False)
                self.sel.register(stream, selectors.EVENT_READ, name)
            result = self.controller.run()
            (self.root/'controller.stderr').write_text(json.dumps(result)+'\n')
        except Exception as error:
            result = dict(status='refused', reason=str(error))
            (self.root/'controller.stderr').write_text(json.dumps(result)+'\n')
            if self.p is None:
                save(status, dict(state='spawn-failed', error=str(error), argv=self.argv))
                self.streams['stderr'].write((str(error)+'\n').encode()[:8192])
        finally:
            if self.p is not None:
                if self.group():
                    try:
                        os.killpg(self.p.pid, signal.SIGTERM)
                        self.signals.append('SIGTERM')
                    except ProcessLookupError:
                        pass
                try:
                    self.p.wait(timeout=1)
                except subprocess.TimeoutExpired:
                    os.killpg(self.p.pid, signal.SIGKILL)
                    self.signals.append('SIGKILL')
                    self.p.wait(timeout=1)
                # The leader can exit on TERM while a child ignores it. Do not
                # confuse leader exit with process-group cleanup completion.
                if self.group():
                    try:
                        os.killpg(self.p.pid, signal.SIGKILL)
                        self.signals.append('SIGKILL descendants')
                    except ProcessLookupError:
                        pass
                    deadline = time.monotonic()+1
                    while self.group() and time.monotonic() < deadline:
                        time.sleep(.01)
                # Retain causal stderr/stdout after refusal, within the same cap.
                try:
                    for _ in range(5):
                        self.pump(0, guards=False)
                except Exception:
                    pass
                if self.terminal is None:
                    try:
                        self.finish_terminal()
                    except Exception as error:
                        result['terminalError'] = str(error)
                for stream in (self.p.stdin, self.p.stdout, self.p.stderr):
                    stream.close()
            self.sel.close()
            for stream in self.streams.values():
                stream.close()
            cleanup = dict(remaining=self.group(), signals=self.signals,
                           runnerExit=self.p.returncode if self.p else None)
            cleanup['complete'] = not cleanup['remaining']
            if not cleanup['complete']:
                result.update(status='refused', reason='owned process cleanup incomplete')
            save(self.root/'owned-cleanup.json', cleanup)
            result.update(elapsed=time.monotonic()-self.start, cleanup=cleanup,
                          controllerSHA256=CONTROLLER_SHA256,
                          responseSeconds=RESPONSE_SECONDS, guestSeconds=self.guest_seconds,
                          wallSeconds=self.wall_seconds)
            save(self.root/'result.json', result)
        return result
