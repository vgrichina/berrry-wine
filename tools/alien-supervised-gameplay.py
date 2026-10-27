#!/usr/bin/env python3
"""Launch ONE new Alien child; supervise it and delegate menu control once.

Production successor to accepted-dispatch-menu-mission/ops/supervisor.py and
drive.py: explicit argv/cwd/schedule replace historical box paths and cutoff.
No attach, PID, inherited-listener, replacement, resume or reconnect interface.
Reviewers publish menu-frame.json and approval.json in the NEW invocation,
using command.json's runId, before the original startup/reserve deadline.
The child must itself bind the explicit numeric loopback endpoint. Callers
must allocate an unused port; an existing listener is rejected before launch.
"""
import argparse
import ctypes
import importlib.util
import json
import os
from pathlib import Path
import resource
import shutil
import signal
import socket
import subprocess
import threading
import time
from urllib.parse import urlsplit
import uuid
import hashlib

spec = importlib.util.spec_from_file_location('alien_menu', Path(__file__).with_name('alien-menu-gameplay-controller.py'))
menu = importlib.util.module_from_spec(spec)
spec.loader.exec_module(menu)


def scan():
    rows = {}
    for q in Path('/proc').glob('[0-9]*'):
        try:
            s = (q / 'stat').read_text().rsplit(') ', 1)[1].split()
            rows[int(q.name)] = dict(ppid=int(s[1]), state=s[0], start=s[19],
                cpu=sum(int(s[i]) for i in (11, 12, 13, 14)) / os.sysconf('SC_CLK_TCK'),
                rss=int(s[21]) * os.sysconf('SC_PAGE_SIZE'))
        except (OSError, ValueError, IndexError):
            pass
    return rows


def lower_limit(which, value):
    soft, hard = resource.getrlimit(which)
    resource.setrlimit(which, tuple(value if n == resource.RLIM_INFINITY else min(n, value)
                                    for n in (soft, hard)))


def capture_allocated(home):
    total = 0
    for path in [home, *home.rglob('*')]:
        try:
            total += path.lstat().st_blocks*512
        except FileNotFoundError:
            # Atomic WAL/response publication can rename .new between directory
            # enumeration and stat. Its replacement is counted on the next
            # sample; disappearance alone is not a monitor failure.
            pass
    return total


def launch(args):
    """The only producer: owns the actual Popen and private one-use continuation."""
    home = args.invocation.absolute()
    url = urlsplit(args.endpoint)
    if (url.scheme != 'http' or url.hostname != '127.0.0.1' or url.path != '/ctl'
            or url.query or url.fragment or url.username or not url.port
            or args.endpoint != 'http://127.0.0.1:%d/ctl' % url.port):
        raise ValueError('immutable numeric http://127.0.0.1:PORT/ctl required')
    command = args.command[1:] if args.command[:1] == ['--'] else args.command
    if not command or not Path(args.cwd).is_dir():
        raise ValueError('explicit NEW child command and cwd required')
    started = time.time()
    mono = time.monotonic()
    if (not all(menu.finite(v) for v in (args.deadline, args.startup_maximum,
            args.action_reserve, args.cleanup_reserve)) or not 40 <= args.deadline - started <= 120
            or not 0 < args.startup_maximum <= 75 or args.action_reserve < 30
            or args.cleanup_reserve < 10 or args.action_reserve + args.cleanup_reserve > args.deadline - started
            or not 1 <= args.after_batches <= 1024 or not 0 <= args.captures_used <= args.capture_limit
            or not 0 < args.rss_limit <= 3 * 1024**3
            or not 0 < args.capture_bytes <= 256*1024**2
            or (args.startup_batches is not None and not 0 <= args.startup_batches <= 8192)):
        raise ValueError('finite original <=120s schedule, reserves and limits required')
    # A pre-existing server cannot become this launcher's guest. Binding an
    # unused port is a cooperative preflight, not an atomic network trust claim.
    with socket.socket() as probe:
        probe.bind(('127.0.0.1', url.port))
    home.mkdir(parents=True, exist_ok=False)
    budget = dict(runId=str(uuid.uuid4()), startedAt=started, deadline=args.deadline,
        startupMaximum=args.startup_maximum, actionReserve=args.action_reserve,
        cleanupReserve=args.cleanup_reserve, captureLimit=args.capture_limit,
        capturesUsed=args.captures_used)
    menu.atomic(home / 'budget.json', budget)
    endpoint = args.endpoint
    deadline = mono + args.deadline - started
    terminal = home / 'terminal.json'
    stopped = threading.Event()
    finish = threading.Event()
    lock = threading.Lock()
    reason = [None]
    receipt_errors = []
    delegated = False
    known = {}
    own_cpu_start = scan()[os.getpid()]['cpu']
    peaks = dict(rss=0, cpu=0, output=0)
    env = dict(os.environ)
    for k in ('WINE_RUN_EXTRA_ARGS', 'WINE_REGION_MAP', 'NODE_OPTIONS', 'NODE_PATH'):
        env.pop(k, None)
    # No DATA/AS limit here: Node virtual reservation is not physical memory.
    def limits():
        lower_limit(resource.RLIMIT_CPU, 90)
        lower_limit(resource.RLIMIT_FSIZE, 24 * 1024**2)
    if ctypes.CDLL(None, use_errno=True).prctl(36, 1, 0, 0, 0) != 0:
        raise OSError('PR_SET_CHILD_SUBREAPER failed')

    def latch(why):
        with lock:
            if not stopped.is_set():
                reason[0] = why
                stopped.set()
                if not terminal.exists():
                    try:
                        menu.atomic(terminal, dict(reason=why, guestAcceptance='unqualified'))
                    except OSError as error:
                        # Failure to persist a receipt must never bypass owned
                        # process cleanup. The in-memory latch is already set.
                        receipt_errors.append(str(error)[:256])

    # This handle is never supplied by a caller or reconstructed from a PID.
    p = subprocess.Popen(command, cwd=args.cwd, env=env, preexec_fn=limits,
        start_new_session=True, close_fds=True, stdin=subprocess.DEVNULL,
        stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    # Open before poll/wait can reap it; this descriptor is only for safe
    # lifecycle signals, never a transferable controller authority token.
    original_pidfd = os.pidfd_open(p.pid)
    original_start = scan()[p.pid]['start']
    os.set_blocking(p.stdout.fileno(), False)
    try:
        menu.atomic(home / 'command.json', dict(argv=command, cwd=str(args.cwd),
            endpoint=endpoint, runId=budget['runId'], pid=p.pid, startedAt=started,
            deadline=args.deadline, budget=budget, limits=dict(cpuTree=90, wall=120,
            file=24*1024**2, output=2*1024**2, rssTree=args.rss_limit)))
    except BaseException:
        # A receipt/fsync failure after Popen must not leak the just-owned child.
        signal.pidfd_send_signal(original_pidfd, signal.SIGKILL)
        p.wait(timeout=1)
        p.stdout.close()
        os.close(original_pidfd)
        raise

    def guard():
        if stopped.is_set() or terminal.exists() or p.poll() is not None:
            latch('original child ended or terminal latch')
            raise menu.control.ControlStopped('original child ended or terminal latch; no replay/reconnect')
        if time.monotonic() >= deadline or time.time() >= budget['deadline']:
            latch('original deadline')
            raise menu.control.ControlStopped('original deadline; no replay/reconnect')

    def observe():
        rows = scan()
        owners = {os.getpid()}
        if p.pid in rows and rows[p.pid]['start'] == original_start:
            owners.add(p.pid)
        owners.update(pid for pid, s in known.items() if pid in rows and rows[pid]['start'] == s['start'])
        while True:
            added = {pid for pid, s in rows.items() if s['ppid'] in owners} - owners
            if not added:
                break
            owners.update(added)
        # Per-identity CPU high water survives disappearance and includes waited
        # work conservatively; instantaneous RSS samples remain a lower bound.
        owners.discard(os.getpid())
        for pid in owners:
            if pid in rows:
                row = rows[pid]
                if pid in known and known[pid]['start'] == row['start']:
                    row['cpu'] = max(row['cpu'], known[pid]['cpu'])
                known[pid] = row
        live = {pid:s for pid,s in rows.items() if pid in known
                and s['start'] == known[pid]['start'] and s['state'] != 'Z'}
        peaks['rss'] = max(peaks['rss'], rows[os.getpid()]['rss'] + sum(s['rss'] for s in live.values()))
        peaks['cpu'] = max(peaks['cpu'], rows[os.getpid()]['cpu']-own_cpu_start + sum(s['cpu'] for s in known.values()))
        return live

    def monitor():
        try:
            with (home / 'output.log').open('wb') as output:
                while not finish.is_set():
                    observe()
                    try:
                        data = os.read(p.stdout.fileno(), 8192)
                    except BlockingIOError:
                        data = b''
                    if data:
                        keep = data[:max(0, 2*1024**2-peaks['output'])]
                        output.write(keep)
                        output.flush()
                        peaks['output'] += len(data)
                    if peaks['rss'] > args.rss_limit:
                        latch('rss-tree-limit')
                    if peaks['cpu'] >= 90:
                        latch('cpu-tree-limit')
                    if peaks['output'] > 2*1024**2:
                        latch('output-limit')
                    if (shutil.disk_usage(home).free < 2982150144
                            or int(Path('/proc/meminfo').read_text().split('MemAvailable:')[1].split()[0])*1024 < 1610612736):
                        latch('host-floor')
                    if capture_allocated(home) > args.capture_bytes:
                        latch('capture-allocation')
                    try:
                        guard()
                    except menu.control.ControlStopped:
                        pass
                    if stopped.is_set():
                        # Abort pending HTTP by ending the owned guest; never
                        # issue a second command as an implicit recovery.
                        try:
                            signal.pidfd_send_signal(original_pidfd, signal.SIGTERM)
                        except ProcessLookupError:
                            pass
                        break
                    finish.wait(.04)
        except BaseException as error:
            latch('monitor failure: ' + str(error)[:128])
            try:
                signal.pidfd_send_signal(original_pidfd, signal.SIGTERM)
            except ProcessLookupError:
                pass

    thread = threading.Thread(target=monitor, name='original-child-monitor')
    thread.start()
    result = None
    try:
        captures_charged = budget['capturesUsed']
        if args.startup_batches is not None:
            # Original drive.py's serial snapshot/step/frame schedule, now
            # inside the same actual Popen lifetime and aggregate allowance.
            startup_budget = menu.Budget(home, budget)
            startup_budget.check('menu', 4)  # before frame + three after frames
            # Readiness probes send no HTTP/control bytes and consume only the
            # original startup window. Never retry an actual ctl command.
            while True:
                guard()
                startup_budget.check('menu',4)
                with socket.socket() as probe:
                    probe.settimeout(.1)
                    if probe.connect_ex(('127.0.0.1',url.port)) == 0:
                        break
                finish.wait(.02)
            class StartupTransport(menu.control.HttpTransport):
                def send(self, command, before_send):
                    remaining = startup_budget.check('menu',4)
                    self.timeout = min(20, remaining-budget['cleanupReserve'])
                    if command.get('action') == 'png':
                        startup_budget.captures += 1
                        menu.atomic(home / 'startup-usage.json', dict(capturesCharged=startup_budget.captures,
                            capturesReserved=3, pending=command))
                    def guarded():
                        before_send()
                        guard()
                        startup_budget.check('menu',3 if command.get('action')=='png' else 4)
                    return super().send(command,guarded)
            startup_plan = [dict(action='snapshot')]
            left = args.startup_batches
            while left:
                n = min(left,256)
                startup_plan.extend([dict(action='step',n=n),dict(action='snapshot')])
                left -= n
            image = home/'menu-before.png'
            startup_plan.append(dict(action='png',path=str(image)))
            startup = menu.control.Controller(home/'startup-ledger.json',budget['runId'],
                StartupTransport(endpoint),terminal)
            state = startup.run(startup_plan)
            if not image.is_file() or not 0 < image.stat().st_size <= 2*1024**2:
                raise menu.control.ControlStopped('missing/oversized original before frame')
            menu.atomic(home/'menu-frame.json',dict(runId=budget['runId'],batch=state['lastFrozenBatch'],
                path=str(image),sha256=hashlib.sha256(image.read_bytes()).hexdigest()))
            captures_charged = startup_budget.captures
        # Review publication is local and does not grant attach authority. It
        # can only approve this already-owned child inside its original window.
        while not (home / 'approval.json').exists():
            guard()
            now = max(time.time(), started + time.monotonic() - mono)
            if (now - started > budget['startupMaximum']
                    or budget['deadline'] - now < budget['actionReserve'] + budget['cleanupReserve']):
                raise menu.control.ControlStopped('review wait exhausted original startup/action reserve')
            finish.wait(.02)
        if delegated:
            raise menu.control.ControlStopped('original delegation already consumed')
        delegated = True  # Consumed even if validation or dispatch fails.
        menu.atomic(home / 'delegation.json', dict(consumed=True, runId=budget['runId']))
        result = menu._run_owned(home, endpoint, terminal, budget, guard, args.after_batches,captures_charged)
        return result
    finally:
        latch('controller complete' if result else 'controller failure; no replay/reconnect')
        finish.set()
        thread.join()
        observe()
        for sig in (signal.SIGTERM, signal.SIGKILL):
            for pid in list(observe()):
                try:
                    fd = os.pidfd_open(pid)
                    try:
                        row = scan().get(pid)
                        if row and row['start'] == known[pid]['start']:
                            signal.pidfd_send_signal(fd, sig)
                    finally:
                        os.close(fd)
                except ProcessLookupError:
                    pass
            try:
                signal.pidfd_send_signal(original_pidfd, sig)
            except ProcessLookupError:
                pass
            try:
                p.wait(timeout=.5)
            except subprocess.TimeoutExpired:
                pass
        p.wait(timeout=1)
        os.close(original_pidfd)
        # Preserve the final bounded output as in the original production
        # supervisor, even when the controller finishes between monitor polls.
        with (home / 'output.log').open('ab') as output:
            try:
                while True:
                    data = os.read(p.stdout.fileno(),8192)
                    if not data:
                        break
                    output.write(data[:max(0,2*1024**2-peaks['output'])])
                    peaks['output'] += len(data)
            except BlockingIOError:
                pass
        p.stdout.close()
        for pid in known:
            try:
                os.waitpid(pid, os.WNOHANG)
            except ChildProcessError:
                pass
        remaining = list(observe())
        if peaks['output'] > 2*1024**2:
            reason[0] = 'output-limit'
        menu.atomic(home / 'cleanup.json', dict(reason=reason[0], returncode=p.returncode,
            elapsed=time.monotonic()-mono, peaks=peaks, identities=known,
            remainingOwnedLive=remaining, delegationConsumed=delegated,receiptErrors=receipt_errors,
            guestAcceptance='unqualified'))
        if remaining:
            raise RuntimeError('owned descendants remain live')
        if peaks['output'] > 2*1024**2:
            raise RuntimeError('output-limit')
        if receipt_errors:
            raise RuntimeError('terminal receipt persistence failed; child cleaned; no replay/reconnect')


def main(argv=None):
    q = argparse.ArgumentParser(description=__doc__)
    q.add_argument('--invocation', type=Path, required=True)
    q.add_argument('--endpoint', required=True)
    q.add_argument('--cwd', type=Path, required=True)
    q.add_argument('--deadline', type=float, required=True)
    q.add_argument('--startup-maximum', type=float, default=75)
    q.add_argument('--action-reserve', type=float, default=30)
    q.add_argument('--cleanup-reserve', type=float, default=10)
    q.add_argument('--capture-limit', type=int, required=True)
    q.add_argument('--captures-used', type=int, required=True)
    q.add_argument('--capture-bytes', type=int, required=True)
    q.add_argument('--rss-limit', type=int, required=True)
    q.add_argument('--after-batches', type=int, required=True)
    q.add_argument('--startup-batches', type=int,
                   help='optional original startup steps (0..8192) and before-menu capture; consumes original credits')
    q.add_argument('command', nargs=argparse.REMAINDER)
    args = q.parse_args(argv)
    def interrupted(signum, frame):
        raise KeyboardInterrupt('original supervisor signal %d' % signum)
    signal.signal(signal.SIGTERM, interrupted)
    try:
        print(json.dumps(launch(args)))
        return 0
    except (Exception, KeyboardInterrupt) as error:
        print(json.dumps(dict(error=str(error)[:512], guestAcceptance='unqualified')))
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
