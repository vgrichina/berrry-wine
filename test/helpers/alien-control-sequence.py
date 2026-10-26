"""Single-owner, durable fail-closed client for test/run.js POST /ctl.

The transport returns the *raw* response body. A transport ACK is never guest
acceptance. There is deliberately no retry, reconnect, or ledger reset API.
"""
import fcntl
import hashlib
import json
import os
from pathlib import Path

MAX_BODY = 8192
MAX_LEDGER = 256 * 1024
MAX_COMMANDS = 128


class ControlStopped(RuntimeError):
    pass


def encoded(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':'), allow_nan=False).encode()


def digest(data):
    return hashlib.sha256(data).hexdigest()


def read_json(path, limit):
    with Path(path).open('rb') as stream:
        data = stream.read(limit + 1)
    if len(data) > limit:
        raise ControlStopped('oversized retained JSON')
    return json.loads(data)


def strict_json(data):
    def pairs(items):
        result = {}
        for key, value in items:
            if key in result:
                raise ControlStopped('duplicate JSON field')
            result[key] = value
        return result
    def constant(value):
        raise ControlStopped('non-JSON constant ' + value)
    return json.loads(data, object_pairs_hook=pairs, parse_constant=constant)


class HttpTransport:
    """The actual ctl.py interface, without its shell/Boat continuation layer."""
    def __init__(self, endpoint, timeout=20):
        # No proxy discovery, redirects, retry, reconnect, or batched POSTs.
        from urllib.parse import urlsplit
        url = urlsplit(endpoint)
        if (url.scheme != 'http' or url.hostname != '127.0.0.1'
                or url.path != '/ctl' or url.query or url.fragment or url.username):
            raise ValueError('explicit loopback http://127.0.0.1:PORT/ctl required')
        self.endpoint = endpoint
        self.timeout = timeout

    def __call__(self, command):
        import urllib.request
        class NoRedirect(urllib.request.HTTPRedirectHandler):
            def redirect_request(self, *args, **kwargs):
                raise ControlStopped('redirect refused; dispatch uncertain')
        opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())
        request = urllib.request.Request(self.endpoint, data=encoded(command),
                                         headers={'Content-Type': 'application/json'})
        with opener.open(request, timeout=self.timeout) as response:
            if response.status != 200:
                raise ControlStopped('non-200 control response')
            data = response.read(MAX_BODY + 1)
            length = response.headers.get('Content-Length')
            if len(data) > MAX_BODY or (length is not None and int(length) != len(data)):
                raise ControlStopped('truncated/oversized control response')
            return data


class Controller:
    def __init__(self, ledger, run_id, transport, terminal_file=None):
        self.path = Path(ledger)
        self.run_id = run_id
        self.transport = transport
        self.terminal_file = Path(terminal_file) if terminal_file else None

    def _store(self, state):
        data = encoded(state)
        if len(data) > MAX_LEDGER:
            raise ControlStopped('ledger capacity exhausted')
        tmp = self.path.with_name(self.path.name + '.new')
        with tmp.open('wb') as stream:
            stream.write(data)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(tmp, self.path)
        fd = os.open(self.path.parent, os.O_RDONLY | os.O_DIRECTORY)
        try:
            os.fsync(fd)
        finally:
            os.close(fd)

    def _terminal(self, state, reason, observed=None):
        state['status'] = 'terminal'
        state['reason'] = str(reason)[:256]
        if observed is not None:
            state['terminalObserved'] = observed
        self._store(state)

    def _check_guest(self, state):
        if self.terminal_file is not None and self.terminal_file.exists():
            terminal = read_json(self.terminal_file, MAX_BODY)
            # A supervisor terminal receipt means the invocation ended, even rc0.
            observed = {k: terminal[k] for k in ('reason', 'returncode', 'batch') if k in terminal}
            self._terminal(state, 'known guest terminal receipt', observed)
            raise ControlStopped(state['reason'])

    @staticmethod
    def _batch(value):
        return type(value) is int and value >= 0

    def _validate(self, command, raw, state):
        if not isinstance(raw, bytes) or len(raw) > MAX_BODY:
            raise ControlStopped('invalid/oversized response bytes')
        reply = strict_json(raw)
        if (not isinstance(reply, dict) or reply.get('ok') is not True
                or reply.get('timedOut', False) is not False or 'value' not in reply):
            raise ControlStopped('non-ok/invalid control envelope')
        value = reply['value']
        action = command.get('action')
        if isinstance(value, dict) and (value.get('quit') is True
                or value.get('quitting') is True or value.get('yieldReason') == 2
                or value.get('terminal') is True or value.get('stopped') is True):
            observed = {k: value[k] for k in ('batch', 'quit', 'quitting', 'yieldReason', 'terminal', 'stopped') if k in value}
            self._terminal(state, 'guest reported terminal', observed)
            # Explicit final quit ACK is recorded, but still latches all sends.
            if action == 'quit' and value.get('quitting') is True:
                return value
            raise ControlStopped(state['reason'])
        if action in ('step', 'snapshot', 'png') or 'cmd' in command:
            if not isinstance(value, dict) or not self._batch(value.get('batch')):
                raise ControlStopped('missing command completion/batch')
            if (action not in ('step', 'snapshot') and state['lastFrozenBatch'] is not None
                    and value['batch'] != state['lastFrozenBatch']):
                raise ControlStopped('command moved beyond confirmed frozen boundary')
        if 'cmd' in command and value.get('queued') is not True:
            raise ControlStopped('input was not acknowledged as queued')
        if action == 'step':
            n = command['n']
            if (type(value.get('ran')) is not int or value['ran'] != n
                    or type(value.get('steps')) is not int or value['steps'] != n
                    or value.get('frozen') is not True
                    or state['lastFrozenBatch'] is None
                    or value['batch'] != state['lastFrozenBatch'] + n):
                raise ControlStopped('lost/partial/inconsistent step ACK')
            state['lastAcknowledgedBatch'] = value['batch']
        elif action == 'snapshot':
            frozen = value.get('frozen')
            if (not isinstance(frozen, dict) or frozen.get('frozen') is not True
                    or type(frozen.get('credits')) is not int or frozen['credits'] != 0
                    or value.get('quit') is not False
                    or (state['lastAcknowledgedBatch'] is not None
                        and value['batch'] != state['lastAcknowledgedBatch'])):
                raise ControlStopped('snapshot not confirmed frozen/zero-credit/alive')
            state['lastFrozenBatch'] = value['batch']
            if state['lastAcknowledgedBatch'] is None:
                state['lastAcknowledgedBatch'] = value['batch']
        elif action == 'png':
            if (value.get('path') != command['path'] or type(value.get('bytes')) is not int
                    or not 0 < value['bytes'] <= 2 * 1024 * 1024 or value.get('frozen') is not True):
                raise ControlStopped('invalid PNG receipt')
        elif action == 'quit':
            raise ControlStopped('missing quit ACK')
        return value

    @staticmethod
    def validate_plan(commands):
        if not isinstance(commands, list) or not 1 <= len(commands) <= MAX_COMMANDS:
            raise ControlStopped('bounded nonempty command list required')
        for i, command in enumerate(commands):
            if not isinstance(command, dict) or len(encoded(command)) > MAX_BODY:
                raise ControlStopped('invalid command')
            action = command.get('action')
            if action not in ('snapshot', 'step', 'png', 'eval', 'quit') and set(command) != {'cmd'}:
                raise ControlStopped('unsupported command')
            if action and 'cmd' in command:
                raise ControlStopped('ambiguous action/cmd')
            if 'cmd' in command and (not isinstance(command['cmd'], str)
                    or not command['cmd'].startswith(('dlg-click:', 'keypress:', 'keydown:', 'keyup:', 'click:', 'mousemove:'))):
                raise ControlStopped('explicit input command required')
            if action == 'step':
                if type(command.get('n')) is not int or not 1 <= command['n'] <= 256:
                    raise ControlStopped('step must be 1..256')
                if (i == 0 or commands[i-1] != {'action': 'snapshot'}
                        or i+1 >= len(commands) or commands[i+1] != {'action': 'snapshot'}):
                    raise ControlStopped('step must be bracketed by frozen snapshots')
            if action == 'png' and not isinstance(command.get('path'), str):
                raise ControlStopped('PNG path required')
            if action == 'eval' and not isinstance(command.get('code'), str):
                raise ControlStopped('eval code required')
            if action == 'quit' and i != len(commands)-1:
                raise ControlStopped('quit must be last')

    def run(self, commands):
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self.path.with_name(self.path.name + '.lock').open('a') as lock:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            if self.path.exists():
                # Every invocation is one-shot, including a crash between ACKs.
                # No completed, running, corrupt, uncertain or terminal ledger restarts.
                read_json(self.path, MAX_LEDGER)
                raise ControlStopped('existing invocation ledger; no replay/reconnect')
            state = dict(version=1, runId=self.run_id, status='running',
                         planSHA256=digest(encoded(commands)), next=0, receipts=[],
                         lastAcknowledgedBatch=None, lastFrozenBatch=None,
                         terminalObserved=None, guestAcceptance='unqualified')
            self._store(state)
            try:
                self.validate_plan(commands)
                for i, command in enumerate(commands):
                    self._check_guest(state)
                    if state['status'] == 'terminal':
                        raise ControlStopped('terminal latch')
                    state['status'] = 'uncertain'
                    state['pending'] = dict(index=i, command=command)
                    # WAL precedes the potentially delivered command. If killed
                    # here or during transport, the next invocation cannot send.
                    self._store(state)
                    raw = self.transport(command)
                    value = self._validate(command, raw, state)
                    state['receipts'].append(dict(index=i, command=command,
                        responseSHA256=digest(raw), responseBytes=len(raw),
                        responseExcerpt=raw[:256].decode('utf8', errors='replace')))
                    state['next'] = i + 1
                    state.pop('pending', None)
                    if state['status'] != 'terminal':
                        state['status'] = 'running'
                    self._store(state)
                if state['status'] != 'terminal':
                    state['status'] = 'complete'
                self._store(state)
                return state
            except BaseException as error:
                if state['status'] != 'terminal':
                    observed = None
                    if self.terminal_file is not None and self.terminal_file.exists():
                        try:
                            terminal = read_json(self.terminal_file, MAX_BODY)
                            observed = {k: terminal[k] for k in ('reason', 'returncode', 'batch') if k in terminal}
                        except Exception:
                            observed = {'receipt': 'unreadable; not a confirmed progress ACK'}
                    self._terminal(state, type(error).__name__ + ': ' + str(error), observed)
                raise ControlStopped(state['reason']) from error


def collect_retained(paths):
    """Hash existing local evidence only. Never creates a transport or sends ctl."""
    rows = []
    if len(paths) > MAX_COMMANDS:
        raise ControlStopped('too many evidence files')
    for name in paths:
        path = Path(name)
        if not path.is_file() or path.stat().st_size > 24 * 1024 * 1024:
            raise ControlStopped('missing/oversized retained evidence')
        with path.open('rb') as stream:
            checksum = hashlib.file_digest(stream, 'sha256').hexdigest()
        rows.append(dict(path=str(path), bytes=path.stat().st_size, sha256=checksum))
    return rows
