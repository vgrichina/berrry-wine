#!/usr/bin/env python3
"""Serial, fail-closed loading steps for the test/run.js frozen protocol.

No runner is launched here. Use the existing mailbox bridge, or --stdio with
an independently supervised runner. A pending cursor is never resumed/replayed.
"""
import argparse
import fcntl
import hashlib
import json
import os
from pathlib import Path
import select
import sys
import time

CALLER_TIMEOUT = 38.0  # retained ctl.py limit; remote-v7.py remains 40 seconds
MAX_LINE = 1024 * 1024


class Refusal(RuntimeError):
    pass


def atomic(path, value):
    path = Path(path)
    tmp = path.with_suffix(path.suffix + '.tmp')
    with tmp.open('w') as stream:
        json.dump(value, stream, sort_keys=True)
        stream.flush()
        os.fsync(stream.fileno())
    os.replace(tmp, path)
    directory = os.open(path.parent, os.O_RDONLY | os.O_DIRECTORY)
    try:
        os.fsync(directory)
    finally:
        os.close(directory)


def integer(value):
    return type(value) is int and value >= 0


class Mailbox:
    """Compatible with retained remote-v7.py request/reply files, unchanged."""
    def __init__(self, root):
        self.root = Path(root).resolve(strict=True)
        self.consumed = {}
        self.journal = None
        self.started = False
        (self.root / 'requests').mkdir(exist_ok=True)
        (self.root / 'replies').mkdir(exist_ok=True)
        # The actual requests directory owns the lock, even when two mailbox
        # roots (or their requests directories) are symlink aliases.
        self.requests = (self.root / 'requests').resolve(strict=True)
        self.replies = (self.root / 'replies').resolve(strict=True)
        self.lock = os.open(self.requests, os.O_RDONLY | os.O_DIRECTORY)
        try:
            fcntl.flock(self.lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except Exception:
            os.close(self.lock)
            raise
        stat = self.requests.stat()
        self.journal_path = self.requests.parent / f'.generally-loading-{stat.st_dev}-{stat.st_ino}.journal'

    def close(self):
        os.close(self.lock)

    def save(self):
        atomic(self.journal_path, self.journal)

    def inventory(self, directory):
        names = set()
        for count, path in enumerate(directory.iterdir(), 1):
            if count > 8192:
                raise Refusal('mailbox inventory bound; no dispatch')
            if path.suffix == '.json':
                names.add(path.name)
        return names

    def begin(self, cursor):
        identity = {name: [path.stat().st_dev, path.stat().st_ino]
                    for name, path in (('requests', self.requests), ('replies', self.replies),
                                       ('terminalRoot', self.root))}
        if self.journal_path.exists():
            if self.journal_path.stat().st_size > MAX_LINE:
                raise Refusal('oversized mailbox journal; no handoff')
            self.journal = json.loads(self.journal_path.read_bytes())
            if (self.journal.get('version') != 1 or self.journal.get('identity') != identity
                    or self.journal.get('status') != 'clean'):
                raise Refusal('uncertain/poisoned mailbox ownership; no replay or handoff')
            if self.journal.get('next') != cursor['next']:
                raise Refusal('clean handoff requires exact mailbox next ID')
            history = self.journal.get('history')
            if type(history) is not dict or len(history) > 4096:
                raise Refusal('invalid/bounded mailbox history')
            for name, entry in history.items():
                if (not name.endswith('.json') or not name[:-5].isdigit()
                        or name != f"{int(name[:-5]):04}.json" or type(entry) is not dict):
                    raise Refusal('invalid mailbox history entry')
                for directory, key in ((self.requests, 'request'), (self.replies, 'reply')):
                    path = directory / name
                    if hashlib.sha256(path.read_bytes()).hexdigest() != entry.get(key):
                        raise Refusal('acknowledged mailbox history changed; no handoff')
                self.consumed[self.replies / name] = entry['reply']
        else:
            # No inference from old files, ACKs or dead processes. Only a fresh,
            # empty transport may adopt an explicit initial cursor.
            if self.inventory(self.requests) or self.inventory(self.replies):
                raise Refusal('unjournaled mailbox history; no adoption or replay')
            self.journal = dict(version=1, identity=identity, status='clean',
                                next=cursor['next'], history={})
        expected = set(self.journal['history'])
        if self.inventory(self.requests) != expected or self.inventory(self.replies) != expected:
            raise Refusal('unexpected mailbox request/reply; no handoff')
        self.journal['status'] = 'active'
        self.save()  # active before any cursor mutation; death is never clean
        self.started = True

    def accepted(self, cursor):
        name = f"{cursor['last']['id']:04}.json"
        self.journal['history'][name] = dict(
            request=hashlib.sha256((self.requests / name).read_bytes()).hexdigest(),
            reply=self.consumed[self.replies / name])
        self.journal.update(status='active', next=cursor['next'])
        self.journal.pop('pending', None)
        self.save()  # still active until ALL semantic/frozen-zero checks pass

    def finish(self, cursor):
        self.check()
        if cursor.get('pending') is not False or cursor.get('failed'):
            raise Refusal('uncertain cursor cannot release mailbox')
        self.journal.update(status='clean', next=cursor['next'])
        self.save()

    def poison(self):
        if self.started:
            self.journal['status'] = 'poisoned'
            self.save()

    def check(self):
        if (self.root / 'terminal.json').exists():
            raise Refusal('guest exited/bridge terminal; no later request')
        if self.started:
            expected = set(self.journal['history'])
            pending = self.journal.get('pending')
            allowed = expected | ({f"{pending['id']:04}.json"} if pending else set())
            if (not self.inventory(self.requests).issubset(allowed)
                    or not self.inventory(self.replies).issubset(allowed)):
                raise Refusal('unexpected mailbox request/reply')
            for name, entry in self.journal['history'].items():
                if hashlib.sha256((self.requests / name).read_bytes()).hexdigest() != entry['request']:
                    raise Refusal('acknowledged request changed or removed')
        # Consumed ACKs are immutable; a changed/duplicate reply poisons the lane.
        for path, digest in self.consumed.items():
            if not path.exists() or hashlib.sha256(path.read_bytes()).hexdigest() != digest:
                raise Refusal('consumed ACK changed or removed')

    def exchange(self, request, deadline, reserve, dispatched):
        self.check()
        name = f"{request['id']:04}.json"
        if not self.started or self.journal['status'] != 'active':
            raise Refusal('mailbox ownership not active')
        if request['id'] != self.journal['next'] or len(self.journal['history']) >= 4096:
            raise Refusal('mailbox next ID/history bound; no dispatch')
        dest = self.requests / name
        reply = self.replies / name
        if dest.exists() or reply.exists():
            raise Refusal('existing request/reply: no replay')
        # Bind validation, cursor reservation and dispatch to this exchange.
        # External writers do not honor our owner lock: revalidate after each
        # durable write. A pre-dispatch refusal lets the controller abandon the
        # tentative reservation; an attempted dispatch must retain it forever.
        reserve()
        self.check()
        self.journal.update(status='pending', pending=request)
        self.save()  # durable transport uncertainty BEFORE dispatch
        try:
            self.check()
        except Exception:
            self.journal.update(status='active')
            self.journal.pop('pending', None)
            self.save()
            raise
        dispatched()  # before publish: a failed/partial publish is uncertain too
        atomic(dest, request)
        while not reply.exists():
            if time.monotonic() >= deadline:
                raise Refusal('uncertain ACK timeout; no replay')
            terminal = self.root / 'terminal.json'
            if terminal.exists():
                raise Refusal('guest exited/bridge terminal while awaiting ACK')
            time.sleep(min(.01, max(0, deadline - time.monotonic())))
        if time.monotonic() >= deadline:
            raise Refusal('late ACK; no replay')
        data = reply.read_bytes()
        if len(data) > MAX_LINE:
            raise Refusal('oversized ACK')
        envelope = json.loads(data)
        if envelope.get('request') != request:
            raise Refusal('ACK request binding mismatch')
        self.consumed[reply] = hashlib.sha256(data).hexdigest()
        return envelope['reply']


class Stdio:
    """JSON requests out, production [ctl] envelopes in; no read-ahead."""
    def check(self):
        if select.select([sys.stdin.fileno()], [], [], 0)[0]:
            raise Refusal('unsolicited/duplicate ACK or guest EOF')

    def exchange(self, request, deadline, reserve, dispatched):
        self.check()
        reserve()
        self.check()
        dispatched()  # a partial write is already uncertain
        print(json.dumps(request), flush=True)
        line = bytearray()
        while True:
            left = deadline - time.monotonic()
            if left <= 0 or not select.select([sys.stdin.fileno()], [], [], left)[0]:
                raise Refusal('uncertain ACK timeout; no replay')
            char = os.read(sys.stdin.fileno(), 1)
            if not char:
                raise Refusal('guest EOF while awaiting ACK')
            line.extend(char)
            if len(line) > MAX_LINE:
                raise Refusal('oversized ACK')
            if char == b'\n':
                if time.monotonic() >= deadline:
                    raise Refusal('late ACK; no replay')
                # Bridge should route only control lines. Do not consume logs as ACKs.
                if not line.startswith(b'[ctl] '):
                    raise Refusal('expected production [ctl] ACK')
                return json.loads(line[6:])


class LoadingController:
    def __init__(self, transport, state, *, deadline, timeout=CALLER_TIMEOUT):
        if not 0 < timeout <= CALLER_TIMEOUT:
            raise Refusal('response allowance must not exceed original 38 seconds')
        self.transport, self.path = transport, Path(state)
        self.deadline, self.timeout = deadline, timeout
        self.cursor = json.loads(self.path.read_text()) if self.path.exists() else {'next': 1, 'pending': False}
        if self.cursor.get('pending') is not False or self.cursor.get('failed'):
            raise Refusal('uncertain/failed cursor; no replay or later input')
        if not integer(self.cursor.get('next')) or self.cursor['next'] < 1:
            raise Refusal('invalid next request ID')
        self.events = []
        if isinstance(self.transport, Mailbox):
            self.transport.begin(self.cursor)

    def request(self, command):
        if self.cursor.get('pending') or self.cursor.get('failed'):
            raise Refusal('uncertain/failed cursor; no replay or later input')
        if time.monotonic() >= self.deadline:
            raise Refusal('global deadline; no later request')
        request = dict(command, id=self.cursor['next'])
        previous = self.cursor
        dispatch_started = False

        def reserve():
            self.cursor = dict(next=request['id'] + 1, pending=True, request=request)
            atomic(self.path, self.cursor)  # durable BEFORE any dispatch attempt

        def dispatched():
            nonlocal dispatch_started
            dispatch_started = True

        try:
            reply = self.transport.exchange(
                request, min(self.deadline, time.monotonic() + self.timeout), reserve, dispatched)
            if time.monotonic() >= self.deadline:
                raise Refusal('global deadline during ACK')
            if (type(reply) is not dict or type(reply.get('id')) is not int
                    or reply['id'] != request['id'] or reply.get('ok') is not True):
                raise Refusal('negative/wrong-ID/invalid ACK: ' + repr(reply)[:512])
            self.cursor = dict(next=request['id'] + 1, pending=False, last=request, reply=reply)
            atomic(self.path, self.cursor)
            if isinstance(self.transport, Mailbox):
                self.transport.accepted(self.cursor)
            self.events.append(dict(request=request, reply=reply))
            return reply['value']
        except Exception:
            if not dispatch_started:
                # No new ID escaped this transaction. Keep the last ACK/next
                # identity, but retain terminal uncertainty: never resume it.
                self.cursor = dict(previous, pending=True)
            self.cursor['failed'] = True
            atomic(self.path, self.cursor)
            raise

    def frozen(self, batch=None):
        value = self.request({'action': 'snapshot'})
        if (type(value) is not dict or not integer(value.get('batch'))
                or value.get('quit') is not False or value.get('yieldReason') == 2
                or type(value.get('frozen')) is not dict
                or value['frozen'].get('frozen') is not True
                or type(value['frozen'].get('credits')) is not int
                or value['frozen']['credits'] != 0
                or (batch is not None and value['batch'] != batch)):
            raise Refusal('snapshot is not live, matching frozen-zero')
        return value['batch']

    def run(self, total, chunk=1000, after=()):
        if not integer(total) or total < 1 or not integer(chunk) or not 1 <= chunk <= 1000:
            raise Refusal('positive total and bounded chunk (1..1000) required')
        for command in after:
            if (type(command) is not dict or 'id' in command
                    or command.get('action') not in ('png', 'input-message')):
                raise Refusal('after allows only explicit png/input-message commands')
        completed = 0
        try:
            batch = self.frozen()
            while completed < total:
                n = min(chunk, total - completed)
                value = self.request({'action': 'step', 'n': n})
                if (type(value) is not dict or type(value.get('ran')) is not int
                        or type(value.get('steps')) is not int
                        or value['ran'] != n or value['steps'] != n
                        or value.get('frozen') is not True
                        or not integer(value.get('batch')) or value['batch'] != batch + n):
                    raise Refusal('inexact step completion ACK')
                batch = self.frozen(value['batch'])
                completed += n
                # Emit only after matching completion AND frozen-zero confirmation.
                print(json.dumps(dict(completed=completed, total=total, batch=batch,
                                      stepID=self.events[-2]['request']['id'],
                                      snapshotID=self.events[-1]['request']['id'])), file=sys.stderr, flush=True)
            for command in after:
                batch = self.frozen(batch)
                value = self.request(command)
                if (type(value) is not dict or value.get('batch') != batch
                        or (command['action'] == 'png' and value.get('frozen') is not True)
                        or (command['action'] == 'input-message' and value.get('queued') is not True)):
                    raise Refusal('post-loading observation/input batch mismatch')
            self.transport.check()
            return dict(completed=completed, total=total, batch=batch, events=self.events)
        except Exception:
            self.cursor['failed'] = True
            atomic(self.path, self.cursor)
            raise


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    transport = parser.add_mutually_exclusive_group(required=True)
    transport.add_argument('--mailbox')
    transport.add_argument('--stdio', action='store_true')
    parser.add_argument('--state', required=True)
    parser.add_argument('--receipt', required=True)
    parser.add_argument('--total', type=int, required=True)
    parser.add_argument('--chunk', type=int, default=1000)
    parser.add_argument('--deadline-seconds', type=float, required=True,
                        help='single remaining wall allowance, never renewed per chunk')
    parser.add_argument('--timeout-seconds', type=float, default=CALLER_TIMEOUT)
    parser.add_argument('--after', type=json.loads, default=[])
    args = parser.parse_args()
    deadline = time.monotonic() + args.deadline_seconds
    lock = Path(args.state + '.lock').open('a')
    controller = None
    channel = None
    try:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        channel = Mailbox(args.mailbox) if args.mailbox else Stdio()
        controller = LoadingController(channel,
                                       args.state, deadline=deadline, timeout=args.timeout_seconds)
        result = controller.run(args.total, args.chunk, args.after)
        if isinstance(channel, Mailbox):
            channel.finish(controller.cursor)
        atomic(args.receipt, dict(ok=True, **result))
        return 0
    except Exception as error:
        if isinstance(channel, Mailbox):
            channel.poison()
        atomic(args.receipt, dict(ok=False, error=str(error),
                                 events=controller.events if controller else [],
                                 gameplay='unknown; protocol-only controller'))
        print(str(error), file=sys.stderr)
        return 1
    finally:
        if isinstance(channel, Mailbox):
            channel.close()
        lock.close()


if __name__ == '__main__':
    sys.exit(main())
