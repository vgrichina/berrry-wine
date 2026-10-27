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


def integer(value):
    return type(value) is int and value >= 0


class Mailbox:
    """Compatible with retained remote-v7.py request/reply files, unchanged."""
    def __init__(self, root):
        self.root = Path(root)
        self.consumed = {}
        (self.root / 'requests').mkdir(exist_ok=True)

    def check(self):
        if (self.root / 'terminal.json').exists():
            raise Refusal('guest exited/bridge terminal; no later request')
        # Consumed ACKs are immutable; a changed/duplicate reply poisons the lane.
        for path, digest in self.consumed.items():
            if not path.exists() or hashlib.sha256(path.read_bytes()).hexdigest() != digest:
                raise Refusal('consumed ACK changed or removed')

    def exchange(self, request, deadline):
        self.check()
        name = f"{request['id']:04}.json"
        dest = self.root / 'requests' / name
        reply = self.root / 'replies' / name
        if dest.exists() or reply.exists():
            raise Refusal('existing request/reply: no replay')
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

    def exchange(self, request, deadline):
        self.check()
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

    def request(self, command):
        if self.cursor.get('pending') or self.cursor.get('failed'):
            raise Refusal('uncertain/failed cursor; no replay or later input')
        if time.monotonic() >= self.deadline:
            raise Refusal('global deadline; no later request')
        request = dict(command, id=self.cursor['next'])
        self.cursor = dict(next=request['id'] + 1, pending=True, request=request)
        atomic(self.path, self.cursor)  # durable BEFORE dispatch; never cleared on uncertainty
        try:
            reply = self.transport.exchange(request, min(self.deadline, time.monotonic() + self.timeout))
            if time.monotonic() >= self.deadline:
                raise Refusal('global deadline during ACK')
            if (type(reply) is not dict or type(reply.get('id')) is not int
                    or reply['id'] != request['id'] or reply.get('ok') is not True):
                raise Refusal('negative/wrong-ID/invalid ACK: ' + repr(reply)[:512])
            self.cursor = dict(next=request['id'] + 1, pending=False, last=request, reply=reply)
            atomic(self.path, self.cursor)
            self.events.append(dict(request=request, reply=reply))
            return reply['value']
        except Exception:
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
    try:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        controller = LoadingController(Mailbox(args.mailbox) if args.mailbox else Stdio(),
                                       args.state, deadline=deadline, timeout=args.timeout_seconds)
        result = controller.run(args.total, args.chunk, args.after)
        atomic(args.receipt, dict(ok=True, **result))
        return 0
    except Exception as error:
        atomic(args.receipt, dict(ok=False, error=str(error),
                                 events=controller.events if controller else [],
                                 gameplay='unknown; protocol-only controller'))
        print(str(error), file=sys.stderr)
        return 1
    finally:
        lock.close()


if __name__ == '__main__':
    sys.exit(main())
