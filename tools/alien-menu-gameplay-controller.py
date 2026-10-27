#!/usr/bin/env python3
"""One admitted invocation: human-reviewed menu -> New Game -> evidence -> Quit.

Does not start a guest, settle a menu, infer a click from pixels, or renew a
supervisor allowance. See test/fixtures/alien-menu-controller/README.md for the
supervisor budget and review contracts. HTTP queue ACKs are not gameplay proof.
"""
import argparse
import contextlib
import fcntl
import importlib.util
import json
import math
import os
from pathlib import Path
import stat
import time

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('alien_sequence_entry', ROOT / 'test/alien-gameplay-sequence.py')
sequence = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sequence)
control = sequence.control


def finite(value):
    return type(value) in (int, float) and math.isfinite(value)


def atomic(path, value):
    tmp = path.with_name(path.name + '.new')
    with tmp.open('wb') as stream:
        stream.write(control.encoded(value))
        stream.flush()
        os.fsync(stream.fileno())
    os.replace(tmp, path)
    fd = os.open(path.parent, os.O_RDONLY | os.O_DIRECTORY)
    try:
        os.fsync(fd)
    finally:
        os.close(fd)


class Budget:
    def __init__(self, home):
        self.home = home
        self.path = home / 'budget.json'
        self.value = control.read_json(self.path, 8192)
        b = self.value
        for key in ('startedAt', 'deadline', 'startupMaximum', 'actionReserve', 'cleanupReserve'):
            if not finite(b.get(key)):
                raise control.ControlStopped('budget blocker: invalid ' + key)
        if (not isinstance(b.get('runId'), str) or not b['runId']
                or not 0 < b['deadline'] - b['startedAt'] <= 120
                or not 0 < b['startupMaximum'] <= 75
                or b['actionReserve'] < 30 or b['cleanupReserve'] < 10
                or b['actionReserve'] + b['cleanupReserve'] > b['deadline'] - b['startedAt']):
            raise control.ControlStopped('budget blocker: invalid invocation/reserve envelope')
        for key in ('captureLimit', 'capturesUsed'):
            if type(b.get(key)) is not int or b[key] < 0:
                raise control.ControlStopped('budget blocker: invalid ' + key)
        self.hash = control.digest(control.encoded(b))
        seal = home / 'admitted-budget.json'
        if seal.exists():
            if control.read_json(seal, 8192) != b:
                raise control.ControlStopped('budget blocker: existing invocation allowance changed')
        else:
            atomic(seal, b)
        self.wall = time.time()
        self.mono = time.monotonic()
        if self.wall < b['startedAt']:
            raise control.ControlStopped('budget blocker: invocation not started')
        self.captures = b['capturesUsed']

    def now(self):
        # Backward wall-clock corrections cannot renew the admitted window.
        return max(time.time(), self.wall + max(0, time.monotonic() - self.mono))

    def check(self, phase, required_captures):
        if control.digest(control.encoded(control.read_json(self.path, 8192))) != self.hash:
            raise control.ControlStopped('budget blocker: supervisor allowance changed during invocation')
        b = self.value
        now = self.now()
        remaining = b['deadline'] - now
        reserve = b['cleanupReserve'] + (b['actionReserve'] if phase == 'menu' else 0)
        if phase == 'menu' and now - b['startedAt'] > b['startupMaximum']:
            raise control.ControlStopped('budget blocker: startup elapsed %.6fs exceeds %.6fs' %
                                         (now - b['startedAt'], b['startupMaximum']))
        if remaining < reserve or remaining <= 0:
            raise control.ControlStopped('budget blocker: remaining %.6fs < required %.6fs (%s)' %
                                         (remaining, reserve, phase))
        credits = b['captureLimit'] - self.captures
        if credits < required_captures:
            raise control.ControlStopped('budget blocker: capture credits %d < required %d (%s)' %
                                         (credits, required_captures, phase))
        return remaining


def review(home, budget):
    approval = control.read_json(home / 'approval.json', 8192)
    frame = control.read_json(home / 'menu-frame.json', 8192)
    if (approval.get('humanReviewed') is not True or approval.get('action') != 'New Game'
            or approval.get('runId') != budget.value['runId'] or frame.get('runId') != approval['runId']
            or type(frame.get('batch')) is not int or frame['batch'] < 0
            or approval.get('batch') != frame['batch']
            or not isinstance(approval.get('reviewId'), str) or not approval['reviewId']
            or approval.get('frameSHA256') != frame.get('sha256')
            or approval.get('command') != 'click:98:296'
            or not isinstance(frame.get('path'), str)):
        raise control.ControlStopped('review blocker: explicit matching human-reviewed New Game approval required')
    image = Path(frame['path'])
    if not image.is_file() or not 0 < image.stat().st_size <= 2097152:
        raise control.ControlStopped('review blocker: missing/oversized reviewed menu frame')
    import hashlib
    with image.open('rb') as stream:
        actual = hashlib.file_digest(stream, 'sha256').hexdigest()
    if actual != frame['sha256']:
        raise control.ControlStopped('review blocker: reviewed frame identity changed')
    return approval, frame


def verified_process_identity(process, endpoint):
    """Bind the endpoint to a live original process without sending HTTP."""
    from urllib.parse import urlsplit
    pid = process.get('pid')
    if type(pid) is not int or pid <= 0 or process.get('endpoint') != endpoint:
        raise control.ControlStopped('ownership blocker: explicit matching control process required')
    proc = Path('/proc') / str(pid)
    def live_start():
        fields = proc.joinpath('stat').read_text().rsplit(') ', 1)[1].split()
        if fields[0] in ('Z', 'X') or process.get('startTicks') != fields[19]:
            raise control.ControlStopped('ownership blocker: control process identity changed')
        return fields[19]
    start = live_start()
    namespace = os.readlink(proc / 'ns/pid')
    boot = Path('/proc/sys/kernel/random/boot_id').read_text().strip()
    port = urlsplit(endpoint).port
    listening = set()
    for line in proc.joinpath('net/tcp').read_text().splitlines()[1:]:
        row = line.split()
        if row[1] == '0100007F:%04X' % port and row[3] == '0A':
            listening.add('socket:[' + row[9] + ']')
    found = False
    for fd in proc.joinpath('fd').iterdir():
        try:
            found |= os.readlink(fd) in listening
        except FileNotFoundError:
            pass
    if not found:
        raise control.ControlStopped('ownership blocker: endpoint listener not owned by control process')
    # Recheck after socket enumeration; never identify a replacement PID as the
    # original. Listener/URL spelling is evidence, never an authority key.
    live_start()
    if os.readlink(proc / 'ns/pid') != namespace:
        raise control.ControlStopped('ownership blocker: control process namespace changed')
    return dict(bootId=boot, pidNamespace=namespace, pid=pid, startTicks=start)


@contextlib.contextmanager
def process_owner(home, endpoint, budget):
    """Durable exclusive authority for one original process across all listeners.

    Claims survive refusal, controller exit, uncertain sends and terminal state.
    No alternate endpoint/configuration may renew that process's original budget.
    """
    process = control.read_json(home / 'process.json', 8192)
    identity = verified_process_identity(process, endpoint)
    key = control.digest(control.encoded(identity))
    directory = Path('/tmp') / ('wine-ops-alien-menu-owners-' + str(os.getuid()))
    directory.mkdir(mode=0o700, exist_ok=True)
    info = directory.lstat()
    if (not stat.S_ISDIR(info.st_mode) or info.st_uid != os.getuid()
            or stat.S_IMODE(info.st_mode) != 0o700):
        raise control.ControlStopped('ownership blocker: unsafe persistent owner directory')
    path = directory / (key + '.json')
    fd = os.open(directory / (key + '.lock'), os.O_RDWR | os.O_CREAT | os.O_NOFOLLOW, 0o600)
    with os.fdopen(fd, 'a') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError as error:
            raise control.ControlStopped('existing control process owner; no replay/reconnect') from error
        if path.exists():
            raise control.ControlStopped('existing control process owner; no replay/reconnect')
        # Prior published controllers used a listener-specific key. Retain their
        # consumed authority too: upgrading the key must not renew a live guest.
        for previous in directory.glob('*.json'):
            prior = control.read_json(previous, 8192).get('identity', {})
            if (all(prior.get(k) == identity[k] for k in ('bootId', 'pid', 'startTicks'))
                    and prior.get('pidNamespace', identity['pidNamespace']) == identity['pidNamespace']):
                raise control.ControlStopped('existing control process owner; no replay/reconnect')
        # Pin even a refused time/capture allowance before any control. A
        # second directory cannot change the deadline and try this guest again.
        atomic(path, dict(identity=identity, invocation=str(home), budget=budget.value,
                          budgetSHA256=budget.hash, verifiedEndpoint=endpoint, guestAcceptance='unqualified'))
        yield path, dict(process, verifiedIdentity=identity)


class BudgetTransport(control.HttpTransport):
    """Add scheduling checks; retain accepted HTTP dispatch and no-retry code."""
    def __init__(self, endpoint, budget, approval, frame):
        super().__init__(endpoint)
        self.budget = budget
        self.approval = approval
        self.frame = frame
        self.input_issued = False
        self.captures_left = 3  # response, later observation, before Quit
        self.process = None

    def send(self, command, before_send):
        b = self.budget
        is_quit = command.get('action') == 'quit'
        phase = 'cleanup' if is_quit else ('after' if self.input_issued else 'menu')
        remaining = b.check(phase, self.captures_left)
        # A slow HTTP response must leave the cleanup reserve. No retries.
        available = remaining if is_quit else remaining - b.value['cleanupReserve']
        if available <= 0:
            raise control.ControlStopped('budget blocker: no request time outside cleanup reserve')
        self.timeout = min(20, available)
        if 'cmd' in command:
            if self.input_issued or command != {'cmd': self.approval['command']}:
                raise control.ControlStopped('review blocker: duplicate/unapproved input')
            # Consume before potentially delivered bytes; never refund uncertainty.
            self.input_issued = True
        if command.get('action') == 'png':
            b.captures += 1
            self.captures_left -= 1
        atomic(b.home / 'usage.json', dict(runId=b.value['runId'], budgetSHA256=b.hash,
               inputIssued=self.input_issued, capturesCharged=b.captures, capturesReserved=self.captures_left,
               pending=command, guestAcceptance='unqualified'))

        def guarded():
            before_send()  # accepted durable-terminal check at socket send
            if verified_process_identity(self.process, self.endpoint) != self.process['verifiedIdentity']:
                raise control.ControlStopped('ownership blocker: control process ended/changed')
            # Input was charged above, but still needs the full menu reserve
            # at the actual header/body boundary, including connection latency.
            b.check('menu' if 'cmd' in command else phase, self.captures_left)
        return super().send(command, guarded)


class ReviewedController(control.Controller):
    def __init__(self, *args, reviewed_batch, **kwargs):
        super().__init__(*args, **kwargs)
        self.reviewed_batch = reviewed_batch

    def _validate(self, command, raw, state):
        value = super()._validate(command, raw, state)
        if state['next'] == 0 and value.get('batch') != self.reviewed_batch:
            raise control.ControlStopped('review blocker: frozen boundary differs from reviewed menu frame')
        return value


def plan(home, command, after_batches):
    commands = [dict(action='snapshot'), dict(cmd=command)]
    # No settling, movement or duplicate menu capture precedes the reviewed input.
    for name in ('new-game-response', 'mission-observation'):
        commands.append(dict(action='snapshot'))
        left = after_batches
        while left:
            n = min(left, 256)
            commands.extend([dict(action='step', n=n), dict(action='snapshot')])
            left -= n
        commands.append(dict(action='png', path=str(home / (name + '.png'))))
    commands.extend([dict(action='png', path=str(home / 'before-quit.png')), dict(action='quit')])
    return commands


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--invocation', required=True, type=Path,
                        help='supervisor-owned directory; fixed budget/review/ledger paths')
    parser.add_argument('--endpoint', required=True)
    parser.add_argument('--terminal-file', required=True)
    parser.add_argument('--approve-new-game', action='store_true')
    parser.add_argument('--after-batches', required=True, type=int)
    args = parser.parse_args(argv)
    try:
        if not args.approve_new_game:
            raise control.ControlStopped('review blocker: no explicit approval; no control sent')
        if not 1 <= args.after_batches <= 1024:
            raise control.ControlStopped('bounded after-action batches 1..1024 required')
        home = args.invocation.resolve(strict=True)
        # The directory is the invocation identity, not an arbitrary phase ledger.
        # Supervisor must supply one directory per guest and protect it from reset.
        with (home / 'owner.lock').open('a') as owner:
            fcntl.flock(owner, fcntl.LOCK_EX | fcntl.LOCK_NB)
            if (home / 'owner.json').exists():
                raise control.ControlStopped('existing invocation owner; no replay/reconnect')
            budget = Budget(home)
            approval, frame = review(home, budget)
            commands = plan(home, approval['command'], args.after_batches)
            control.Controller.validate_plan(commands)
            transport = BudgetTransport(args.endpoint, budget, approval, frame)
            with process_owner(home, args.endpoint, budget) as (process_path, process):
                transport.process = process
                budget.check('menu', 3)
                atomic(home / 'owner.json', dict(runId=budget.value['runId'], budgetSHA256=budget.hash,
                       processOwner=str(process_path), approval=approval, frame=frame,
                       plan=commands, guestAcceptance='unqualified'))
                controller = ReviewedController(home / 'sequence-ledger.json', budget.value['runId'],
                             transport, args.terminal_file, reviewed_batch=frame['batch'])
                result = controller.run(commands)
            print(json.dumps(dict(status=result['status'], next=result['next'],
                                  guestAcceptance='unqualified', capturesCharged=budget.captures)))
            return 0
    except (Exception, KeyboardInterrupt) as error:
        print(json.dumps(dict(error=str(error)[:512], guestAcceptance='unqualified')))
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
