#!/usr/bin/env python3
"""Serial frozen-runner controller, delegated only by its launching supervisor.

Standalone existing-guest attachment is retired. Start a NEW guest with
 enigma-supervised-gameplay.py --launch-config. Cooperative local orchestration,
not isolation against arbitrary same-UID code modifying Python internals.
"""
import argparse
import hashlib
import json
import math
import os
import ipaddress
import socket
from pathlib import Path
import stat
import time
import urllib.request
from urllib.parse import urlsplit, urlunsplit


class Refusal(RuntimeError):
    pass


def require(condition, reason):
    if not condition:
        raise Refusal(reason)


def process_identity(pid):
    try:
        text = Path(f'/proc/{pid}/stat').read_text()
    except OSError as ex:
        raise Refusal('terminal-process') from ex
    fields = text[text.rfind(')') + 2:].split()
    require(fields[0] not in ('Z', 'X'), 'terminal-process')
    return fields[19]


class ListenerIdentity:
    """Read-only Linux listener proof; never contact an endpoint to identify it.

    Exact loopback bindings only. Pin a numeric destination so DNS/proxy/redirect
    behavior cannot send a verified request elsewhere. This is a local procfs
    observation, not OS isolation or an atomic check-and-connect primitive.
    """
    def __init__(self, config):
        self.pid = config['pid']
        self.ticks = str(config['process_start_ticks'])
        try:
            u = urlsplit(config['url'])
            require(u.scheme == 'http' and u.hostname and u.port
                    and u.username is None and u.password is None
                    and u.path == '/ctl' and not u.fragment, 'loopback-control-required')
            host = u.hostname
            if host.lower() == 'localhost':
                addresses = {ipaddress.ip_address(x[4][0]) for x in
                             socket.getaddrinfo(host, u.port, type=socket.SOCK_STREAM)}
            else:
                addresses = {ipaddress.ip_address(host)}
            require(addresses and all(a.is_loopback for a in addresses), 'loopback-control-required')
            self.port = u.port
            self.process = self.process_proof()
            found = []
            for address in sorted(addresses, key=lambda a: (a.version, int(a))):
                inodes = self.listeners(address)
                if inodes:
                    require(inodes <= self.sockets(), 'control-listener-process-mismatch')
                    found.append((address, inodes))
            require(found, 'control-listener-unproven')
            self.address, self.inodes = found[0]
            host = str(self.address) if self.address.version == 4 else '[' + str(self.address) + ']'
            self.url = urlunsplit(('http', f'{host}:{self.port}', u.path, u.query, ''))
            self.verify()
        except (OSError, ValueError, IndexError) as ex:
            raise Refusal('control-listener-unproven') from ex

    def process_proof(self):
        require(process_identity(self.pid) == self.ticks, 'terminal-process-identity')
        proc = Path('/proc') / str(self.pid)
        pid_ns = os.stat(proc / 'ns/pid').st_ino
        net_ns = os.stat(proc / 'ns/net').st_ino
        require(pid_ns == os.stat('/proc/self/ns/pid').st_ino
                and net_ns == os.stat('/proc/self/ns/net').st_ino, 'control-process-namespace-mismatch')
        return (Path('/proc/sys/kernel/random/boot_id').read_text().strip(), pid_ns, net_ns, self.ticks)

    def sockets(self):
        result = set()
        for fd in (Path('/proc') / str(self.pid) / 'fd').iterdir():
            try:
                target = os.readlink(fd)
            except FileNotFoundError:
                continue
            if target.startswith('socket:['):
                result.add(target[8:-1])
        return result

    def listeners(self, address):
        table = '/proc/self/net/tcp' + ('6' if address.version == 6 else '')
        packed = address.packed
        # Linux procfs prints each native-endian 32-bit address word.
        import sys
        encoded = ''.join(int.from_bytes(packed[i:i+4], sys.byteorder).to_bytes(4, 'big').hex()
                          for i in range(0, len(packed), 4)).upper()
        local = f'{encoded}:{self.port:04X}'
        result = set()
        for line in Path(table).read_text().splitlines()[1:]:
            row = line.split()
            if row[1] == local and row[3] == '0A':
                result.add(row[9])
        return result

    def verify(self):
        try:
            require(self.process_proof() == self.process, 'control-process-identity-changed')
            require(self.listeners(self.address) == self.inodes and self.inodes <= self.sockets(),
                    'control-listener-identity-changed')
            require(self.process_proof() == self.process, 'control-process-identity-changed')
        except (OSError, ValueError, IndexError) as ex:
            raise Refusal('control-listener-unproven') from ex


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        raise Refusal('control-redirect-refused')


class Controller:
    def __init__(self, *args, **kwargs):
        raise Refusal('existing-guest-attachment-retired: use enigma-supervised-gameplay.py --launch-config for a NEW guest')

    def _initialize(self, owner, *, clock=time.time, sleep=time.sleep):
        # Private in-process handoff from the supervisor which just launched its
        # child. JSON, PID, paths and inherited FDs never enter this path.
        self.owner = owner
        self.c = owner.config
        self.clock, self.sleep = clock, sleep
        self.validate()
        owner.live()
        self.listener = owner.listener
        self.ownership = owner
        self.http = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())
        self.out = Path(self.c['evidence_dir'])
        self.out.mkdir(parents=False, exist_ok=False)
        self.trace = (self.out / 'requests.jsonl').open('x')
        self.batch = None
        self.pending = False
        self.failed = False
        self.captures = 0
        self.capture_bytes = 0
        self.api_bytes = 0
        self.review_used = 0
        self.clicked = False
        self.save('config.json', dict(self.c))

    def validate(self):
        c = self.c
        for key in ('max_batches', 'checkpoint_batches', 'after_action_batches',
                    'cleanup_batches', 'max_captures', 'capture_bytes', 'width', 'height', 'pid'):
            require(type(c[key]) is int and c[key] > 0, f'invalid-{key}')
        for key in ('started_at', 'deadline_at', 'checkpoint_seconds', 'after_action_seconds',
                    'review_seconds', 'request_timeout', 'cleanup_seconds'):
            require(type(c[key]) in (int, float) and math.isfinite(c[key]), f'invalid-{key}')
        require(0 < c['request_timeout'] <= 3, 'invalid-request-timeout')
        require(c['checkpoint_seconds'] > 0 and c['after_action_seconds'] > 0
                and c['review_seconds'] >= 0 and c['cleanup_seconds'] > 0, 'invalid-time-budget')
        require(c['started_at'] <= self.clock() < c['deadline_at'], 'exhausted-budget: aggregate-time')
        require(c['deadline_at'] - c['started_at'] <= 110, 'invalid-aggregate-wall')
        require(c['max_captures'] <= 8 and c['capture_bytes'] <= 2097152, 'invalid-capture-allowance')
        require(c['max_captures'] >= 2, 'exhausted-budget: before-after-captures')
        # Match the actual supervisor contract, not a new allowance here.
        limits = c['supervisor_limits']
        require(0 < limits['cpu'] <= 90 and 0 < limits['wall'] <= 120
                and 0 < limits['file'] <= 25165824 and 0 < limits['output'] <= 2097152
                and 0 < limits['physical'] <= 3221225472, 'invalid-supervisor-limits')
        require(Path(c['terminal_path']).is_absolute() and Path(c['evidence_dir']).is_absolute(), 'absolute-evidence-path-required')
        require(str(c['process_start_ticks']) == process_identity(c['pid']), 'terminal-process-identity')
        # Optional tuning stays inside the original, nonrenewable allowance.
        # A loading review consumes a checkpoint, never input authorization.
        p = c.get('progress', {})
        require(isinstance(p, dict) and not (set(p) - {
            'max_checkpoints', 'total_seconds', 'cpu_reserve', 'api_bytes', 'capture_total_bytes'}),
            'invalid-progress-fields')
        self.progress = dict(max_checkpoints=c['max_captures']-1,
            total_seconds=c['deadline_at']-c['started_at'],
            cpu_reserve=min(15, limits['cpu']/3), api_bytes=1048576,
            capture_total_bytes=c['max_captures']*c['capture_bytes'])
        self.progress.update(p)
        p = self.progress
        require(type(p['max_checkpoints']) is int and 1 <= p['max_checkpoints'] < c['max_captures'],
                'invalid-progress-checkpoints')
        for key in ('total_seconds', 'cpu_reserve'):
            require(type(p[key]) in (int, float) and math.isfinite(p[key]) and p[key] > 0,
                    'invalid-progress-' + key)
        require(p['total_seconds'] <= c['deadline_at']-c['started_at']
                and p['cpu_reserve'] < limits['cpu'], 'invalid-progress-reserve')
        require(type(p['api_bytes']) is int and 131072 <= p['api_bytes'] <= 1048576,
                'invalid-progress-api-bytes')
        require(type(p['capture_total_bytes']) is int
                and 2*c['capture_bytes'] <= p['capture_total_bytes'] <= c['max_captures']*c['capture_bytes'],
                'invalid-progress-capture-bytes')
        # Optional caller admission, never an extension of an existing run.
        # Each full-frame transport AND human review fits its own slot, while
        # their sum still debits the original cumulative review allowance.
        self.review_plan = c.get('review_plan')
        self.planned_seconds = None
        if self.review_plan is not None:
            plan = self.review_plan
            require(isinstance(plan, dict) and set(plan) == {'checkpoint_seconds', 'progress_seconds'},
                    'invalid-review-plan-fields')
            slots = plan['checkpoint_seconds']
            require(isinstance(slots, list) and len(slots) == p['max_checkpoints']
                    and all(type(n) in (int, float) and math.isfinite(n) and n > 0 for n in slots),
                    'invalid-review-plan-checkpoints')
            seconds = plan['progress_seconds']
            require(type(seconds) in (int, float) and math.isfinite(seconds) and seconds > 0,
                    'invalid-review-plan-progress')
            require(sum(slots) <= c['review_seconds'], 'insufficient-cumulative-review-allowance')
            require((len(slots)+1)*c['capture_bytes'] <= p['capture_total_bytes'],
                    'insufficient-planned-review-after-action-capture-bytes')
            # Initial snapshot + n1/ACK/frozenzero (3), N captures and N-1
            # refreshes, then snapshot/input/step/snapshot/capture/quit (6).
            # Also reserve a final step+snapshot (2) overrun for each advance
            # window: advance checks its deadline before starting a full step.
            self.planned_seconds = (seconds + sum(slots) + c['cleanup_seconds']
                                    + (4*len(slots)+8)*c['request_timeout'])
            require(self.planned_seconds <= min(p['total_seconds'], self.time_left()),
                    'insufficient-review-progress-action-wall-allowance')

    def save(self, name, value):
        tmp = self.out / (name + '.tmp')
        with tmp.open('w') as f:
            json.dump(value, f, indent=2)
            f.write('\n')
            f.flush()
            os.fsync(f.fileno())
        tmp.replace(self.out / name)

    def live(self):
        require(not self.failed, 'latched-failure-no-replay')
        self.owner.live()
        require(not Path(self.c['terminal_path']).exists(), 'terminal-supervisor')
        try:
            require(process_identity(self.c['pid']) == str(self.c['process_start_ticks']), 'terminal-process-identity')
        except OSError as ex:
            raise Refusal('terminal-process') from ex
        require(self.clock() < self.c['deadline_at'], 'exhausted-budget: aggregate-time')
        self.listener.verify()

    def time_left(self):
        return self.c['deadline_at'] - self.clock()

    def request(self, command):
        self.live()
        require(not self.pending, 'pending-request-no-replay')
        timeout = min(self.c['request_timeout'], self.time_left())
        require(timeout > 0, 'exhausted-budget: request-time')
        data = json.dumps(command).encode()
        # Reserve a whole bounded response before sending. Keep one quit API
        # operation even when progress stops at its byte ceiling.
        reserve = 0 if command.get('action') == 'quit' else 16384
        require(self.api_bytes + len(data) + 8192 + reserve <= self.progress['api_bytes'],
                'exhausted-budget: api-reserve')
        row = dict(at=self.clock(), request=command, startingBatch=self.batch)
        # Persist intent BEFORE the socket. A disconnect or validation failure
        # poisons this controller; process ownership poisons every CLI restart.
        self.pending = True
        self.ownership.record(dict(event='request-intent', **row,
                                   captures=self.captures, clicked=self.clicked))
        self.save('request-intent.json', row)
        try:
            req = urllib.request.Request(self.listener.url, data=data,
                                         headers={'Content-Type': 'application/json'})
            # Evidence/intent I/O may take time. Recheck at the send boundary;
            # failure leaves the intent latched and cannot buy another claim.
            self.live()
            with self.http.open(req, timeout=timeout) as response:
                raw = response.read(8193)
            self.api_bytes += len(data) + len(raw)
            require(len(raw) <= 8192, 'oversize-response')
            row['originalResponse'] = raw.decode()
            if command.get('action') != 'quit':
                self.live()
            value = json.loads(raw)
            require(value.get('ok') is True and isinstance(value.get('value'), dict), 'rejected-control')
            self.pending = False
            return value['value']
        except Exception as ex:
            self.failed = True
            row['error'] = repr(ex)
            raise
        finally:
            row['ended'] = self.clock()
            self.ownership.record(dict(event='response', **row))
            self.trace.write(json.dumps(row) + '\n')
            self.trace.flush()
            os.fsync(self.trace.fileno())

    def snapshot(self, expected=None):
        s = self.request({'action': 'snapshot'})
        f = s.get('frozen', {})
        require(s.get('quit') is False and s.get('yieldReason') not in (2,), 'terminal-snapshot')
        require(f.get('frozen') is True and type(f.get('credits')) is int and f['credits'] == 0
                and f.get('recording') is False, 'snapshot-not-frozen-zero')
        require(type(s.get('batch')) is int and s['batch'] >= 0, 'invalid-snapshot-batch')
        require(expected is None or s['batch'] == expected, 'snapshot-batch-mismatch')
        self.batch = s['batch']
        return s

    def step(self, n, reserve_batches, reserve_seconds):
        require(type(n) is int and 1 <= n <= 256, 'invalid-step')
        # Strictly below terminal ceiling; frozen capture needs a live runner.
        require(self.batch + n + reserve_batches < self.c['max_batches'], 'exhausted-budget: batch-reserve')
        require(self.time_left() >= 2 * self.c['request_timeout'] + reserve_seconds,
                'exhausted-budget: step-time-reserve')
        expected = self.batch + n
        ack = self.request({'action': 'step', 'n': n})
        require(type(ack.get('ran')) is int and ack['ran'] == n
                and type(ack.get('steps')) is int and ack['steps'] == n
                and ack.get('frozen') is True and type(ack.get('batch')) is int
                and ack['batch'] == expected, 'step-ack-mismatch')
        # No input or next step before a separate following matching snapshot.
        return self.snapshot(expected)

    def capture(self, name, reserve_captures, reserve_seconds):
        require(self.captures + 1 + reserve_captures <= self.c['max_captures'], 'exhausted-budget: capture-reserve')
        require(self.batch < self.c['max_batches'], 'exhausted-budget: capture-batch')
        require(self.time_left() >= self.c['request_timeout'] + reserve_seconds, 'exhausted-budget: capture-time')
        require(self.capture_bytes + (1+reserve_captures)*self.c['capture_bytes']
                <= self.progress['capture_total_bytes'], 'exhausted-budget: capture-byte-reserve')
        path = self.out / name
        ack = self.request({'action': 'png', 'path': str(path)})
        require(ack.get('batch') == self.batch and ack.get('frozen') is True
                and ack.get('path') == str(path), 'capture-ack-mismatch')
        with path.open('rb') as f:
            raw = f.read(self.c['capture_bytes'] + 1)
        require(24 <= len(raw) <= self.c['capture_bytes'] and raw[:8] == b'\x89PNG\r\n\x1a\n'
                and raw[12:16] == b'IHDR' and int.from_bytes(raw[16:20], 'big') == self.c['width']
                and int.from_bytes(raw[20:24], 'big') == self.c['height']
                and ack.get('bytes') == len(raw), 'invalid-capture')
        self.captures += 1
        self.capture_bytes += len(raw)
        frame = dict(path=str(path), batch=self.batch, sha256=hashlib.sha256(raw).hexdigest(), bytes=len(raw))
        self.save(name + '.json', frame)
        return frame

    def resources(self, reserve_cpu):
        # Only the original supervisor can measure cumulative tree CPU. Never
        # infer remaining CPU from elapsed wall time or reset it at a checkpoint.
        remaining = self.owner.budget()
        require(remaining['cpu_left'] >= reserve_cpu, 'exhausted-budget: cpu-reserve')
        return remaining

    def api_room(self, operations):
        # 8 KiB response plus up to 8 KiB command/path per operation. Actual
        # bytes, not this conservative projection, debit the cumulative cap.
        return self.api_bytes + operations*16384 <= self.progress['api_bytes']

    def advance(self, target, until, reserve_batches, reserve_seconds, reserve_cpu=0):
        while self.batch < target and self.clock() < until:
            self.live()
            remaining = self.resources(0)
            if remaining['cpu_left'] < reserve_cpu + 2*self.c['request_timeout']:
                break
            if not self.api_room(9 if not self.clicked else 5):
                break
            available = self.c['max_batches'] - self.batch - reserve_batches - 1
            n = min(256, target - self.batch, available)
            if n <= 0:
                break
            if self.time_left() < 2 * self.c['request_timeout'] + reserve_seconds:
                break
            self.step(n, reserve_batches, reserve_seconds)

    def review(self, frame, action_time):
        c = self.c
        self.save('phase.json', dict(phase='AWAIT_IMAGE_REVIEW', frame=frame,
            checkpoint=self.captures, remainingCheckpoints=self.progress['max_checkpoints']-self.captures,
            reviewSecondsLeft=max(0, c['review_seconds']-self.review_used),
            decisions='safeStartGame OR continueLoading; reviewed, frameSHA256 and batch required'))
        decision_path = Path(c['decision_path']) if c.get('decision_path') else None
        start = self.clock()
        until = min(start + max(0, c['review_seconds']-self.review_used), c['deadline_at']-action_time)
        if self.review_plan is not None:
            until = min(until, start + self.review_plan['checkpoint_seconds'][self.captures-1])
        try:
            while decision_path is not None:
                self.live()
                # Do not consume a decision that arrives after its admitted
                # interval, including time spent reading the decision file.
                if c['review_seconds'] > 0 and self.clock() > until:
                    break
                if decision_path.exists():
                    with decision_path.open('rb') as f:
                        raw = f.read(8193)
                    if c['review_seconds'] > 0 and self.clock() > until:
                        break
                    require(len(raw) <= 8192, 'oversize-review-decision')
                    decision = json.loads(raw)
                    # A reviewer replaces one file atomically for each frame.
                    # Ignore only the previously consumed exact decision. A new
                    # stale/contradictory authorization is a hard rejection.
                    if decision != getattr(self, 'last_decision', None):
                        require(decision.get('reviewed') is True
                            and decision.get('frameSHA256') == frame['sha256']
                            and type(decision.get('batch')) is int and decision['batch'] == self.batch,
                            'unreviewed-or-stale-frame')
                        require(not (decision.get('safeStartGame') is True
                                     and decision.get('continueLoading') is True), 'conflicting-frame-decision')
                        self.last_decision = decision
                        self.save(f'review-{self.captures:03}.json', decision)
                        return decision
                if self.clock() >= until:
                    break
                self.sleep(min(.05, until-self.clock()))
        finally:
            self.last_review_elapsed = max(0, self.clock()-start)
            self.review_used += self.last_review_elapsed
        return None

    def drive(self):
        c = self.c
        # The reserves are worst-case socket budgets, not measured batch rates.
        rt = c['request_timeout']
        cleanup_time = c['cleanup_seconds'] + rt
        after_time = 3 * rt + cleanup_time  # step + snapshot + capture
        action_time = 2 * rt + after_time  # refresh snapshot + input ACK
        menu_time = rt + action_time         # menu capture + action/evidence
        menu_batches = c['after_action_batches'] + c['cleanup_batches']
        self.live()
        if self.planned_seconds is not None:
            require(self.time_left() >= self.planned_seconds,
                    'insufficient-review-progress-action-wall-allowance')
        self.snapshot()
        require(self.batch + menu_batches + 1 < c['max_batches'], 'exhausted-budget: action-reserve')
        require(self.time_left() >= menu_time, 'exhausted-budget: action-time-reserve')
        self.resources(self.progress['cpu_reserve'])
        self.step(1, menu_batches, menu_time)
        self.save('first-n1-completion-gate.json', dict(batch=self.batch, acknowledged=True, noOutstandingCredits=True))
        decision = None
        progress_until = min(c['started_at'] + self.progress['total_seconds'],
                             c['deadline_at'] - menu_time - 2*rt)
        window = min(c['checkpoint_seconds'], max(0, progress_until-c['started_at'])
                     / self.progress['max_checkpoints'])
        if self.review_plan is not None:
            window = min(c['checkpoint_seconds'], self.review_plan['progress_seconds']
                         / self.progress['max_checkpoints'])
        self.save('budget-plan.json', dict(startedAt=c['started_at'], deadlineAt=c['deadline_at'],
            supervisorLimits=c['supervisor_limits'], progress=self.progress,
            progressUntil=progress_until, checkpointWindowSeconds=window,
            reviewTotalSeconds=c['review_seconds'], actionReserveSeconds=action_time,
            cleanupReserveSeconds=cleanup_time, actionCleanupReserveBatches=menu_batches,
            captureCountTotal=c['max_captures'], afterActionCaptureReserve=1,
            apiActionReserveOperations=6, apiOperationCeilingBytes=16384,
            resources=self.owner.budget()))
        if self.review_plan is not None:
            self.save('review-admission.json', dict(plan=self.review_plan,
                controllerRequiredSeconds=self.planned_seconds,
                reviewCumulativeAllowance=c['review_seconds'],
                originalStartedAt=c['started_at'], originalDeadlineAt=c['deadline_at']))
        stop = 'NO_REVIEWED_ACTION_NO_INPUT'
        for checkpoint in range(1, self.progress['max_checkpoints']+1):
            # Subsequent windows may use remaining original time, never renew
            # the launch deadline, total progress limit or review allowance.
            target = min(self.batch + c['checkpoint_batches'], c['max_batches'] - menu_batches - 1)
            until = min((c['started_at'] if checkpoint == 1 else self.clock()) + window,
                        progress_until)
            stage_time, future_time = menu_time, action_time
            if self.review_plan is not None:
                slots = self.review_plan['checkpoint_seconds'][checkpoint-1:]
                future_time = action_time + sum(slots[1:]) + 2*rt*(len(slots)-1)
                stage_time = rt + slots[0] + future_time
                until = min(until, c['deadline_at']-stage_time-2*rt)
            self.advance(target, until, menu_batches, stage_time, self.progress['cpu_reserve'])
            name = 'menu-candidate.png' if checkpoint == 1 else f'menu-candidate-{checkpoint:03}.png'
            frame = self.capture(name, 1, stage_time-rt)
            decision = self.review(frame, future_time)
            if self.review_plan is not None and decision:
                # Include decision validation and durable review evidence I/O,
                # not just polling/transport, in the same nonrenewable guards.
                require(self.last_review_elapsed <= self.review_plan['checkpoint_seconds'][checkpoint-1]
                        and self.review_used <= c['review_seconds'],
                        'exhausted-budget: review-reservation')
            if not decision or decision.get('continueLoading') is not True:
                break
            stop = 'LOADING_REVIEWED_RESERVE_STOP_NO_INPUT'
            self.live()
            # Loading is not a menu. Another serial window requires all
            # reserves, including one after-action capture and orderly quit.
            if (checkpoint >= self.progress['max_checkpoints']
                    or self.batch + menu_batches + 1 >= c['max_batches']
                    or self.clock() >= progress_until
                    or self.time_left() < menu_time + 2*rt
                    or self.captures + 2 > c['max_captures']
                    or self.capture_bytes + 2*c['capture_bytes'] > self.progress['capture_total_bytes']
                    or not self.api_room(10)
                    or self.owner.budget()['cpu_left'] < self.progress['cpu_reserve'] + 2*rt):
                break
            if self.review_plan is not None:
                remaining_reviews = sum(self.review_plan['checkpoint_seconds'][checkpoint:])
                if (self.time_left() < future_time + 2*rt
                        or c['review_seconds']-self.review_used < remaining_reviews):
                    break
            self.snapshot(self.batch)
        if decision and decision.get('safeStartGame') is True:
            require(decision.get('reviewed') is True and decision.get('frameSHA256') == frame['sha256']
                    and type(decision.get('batch')) is int and decision['batch'] == self.batch,
                    'unreviewed-or-stale-frame')
            x, y = decision.get('x'), decision.get('y')
            require(type(x) is int and type(y) is int and 0 <= x < c['width'] and 0 <= y < c['height'], 'unsafe-click-coordinates')
            require(self.batch + menu_batches < c['max_batches'] and self.time_left() >= action_time,
                    'exhausted-budget: click-action-reserve')
            require(self.captures + 1 <= c['max_captures'], 'exhausted-budget: after-action-capture')
            require(self.api_room(6), 'exhausted-budget: action-api-reserve')
            require(self.capture_bytes + c['capture_bytes'] <= self.progress['capture_total_bytes'],
                    'exhausted-budget: after-action-bytes')
            # Refresh the completion gate immediately before input, including
            # any time spent waiting for human review.
            require(self.time_left() >= action_time, 'exhausted-budget: review-refresh')
            self.resources(self.progress['cpu_reserve'])
            self.snapshot(self.batch)
            ack = self.request({'cmd': f'click:{x}:{y}'})
            require(ack.get('queued') is True and ack.get('batch') == self.batch, 'input-ack-mismatch')
            self.clicked = True
            self.save('start-game-action-ACK.json', ack)
            target = self.batch + c['after_action_batches']
            self.step(1, c['cleanup_batches'], rt + cleanup_time)
            until = min(self.clock() + c['after_action_seconds'], c['deadline_at'] - cleanup_time - 3 * rt)
            self.advance(target, until, c['cleanup_batches'], rt + cleanup_time,
                         self.progress['cpu_reserve']/3)
            self.capture('after-action.png', 0, cleanup_time)
            status = 'ACTION_ACKNOWLEDGED_REQUIRES_REVIEW'
        else:
            status = stop
        require(self.time_left() >= cleanup_time, 'exhausted-budget: cleanup-time')
        ack = self.request({'action': 'quit'})
        require(ack.get('quitting') is True, 'cleanup-ack-mismatch')
        return status

    def run(self):
        try:
            status = self.drive()
        except BaseException as ex:
            self.failed = True
            status = str(ex) if isinstance(ex, Refusal) else 'uncertain-request-or-evidence-failure: ' + repr(ex)
        finally:
            outcome = dict(status=locals().get('status', 'controller-failure'),
                      batch=self.batch, captures=self.captures, clicked=self.clicked,
                      pending=self.pending, failed=self.failed, at=self.clock())
            outcome.update(apiBytes=self.api_bytes, captureBytes=self.capture_bytes,
                           reviewSecondsUsed=self.review_used, progress=self.progress)
            try:
                self.ownership.record(dict(event='closed', **outcome))
                self.save('outcome.json', outcome)
            finally:
                self.trace.close()
                self.ownership.close()
        return status


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--config', required=True, type=Path)
    args = parser.parse_args()
    try:
        controller = Controller()
    except Refusal as ex:
        print(str(ex))
        return 1
    status = controller.run()
    print(status)
    return 1 if controller.failed else 0


if __name__ == '__main__':
    raise SystemExit(main())
