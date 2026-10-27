#!/usr/bin/env python3
"""Launch ONE new frozen guest and delegate its serial controller in process.

Cooperative local orchestration, not a same-UID security boundary. No attach,
replacement child, serialized authority, reconnect, or renewed allowance exists.
The command may be the production Node test/run.js invocation; the transport is
unchanged. Resource observations are sampled, not atomic check-and-send proof.
"""
import argparse
import ctypes
import importlib.util
import ipaddress
import json
import math
import os
from pathlib import Path
import resource
import signal
import socket
import subprocess
import threading
import time
from types import MappingProxyType
from urllib.parse import urlsplit

_spec = importlib.util.spec_from_file_location('enigma_controller', Path(__file__).with_name('enigma-frozen-gameplay-controller.py'))
controller = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(controller)
require = controller.require
_launch_lock = threading.Lock()
_launch_used = False


def scan():
    rows = {}
    for p in Path('/proc').glob('[0-9]*'):
        try:
            raw = (p / 'stat').read_text()
            s = raw[raw.rfind(')') + 2:].split()
            rows[int(p.name)] = dict(start=s[19], ppid=int(s[1]), state=s[0],
                rss=int(s[21]) * os.sysconf('SC_PAGE_SIZE'),
                cpu=sum(int(s[i]) for i in (11, 12, 13, 14)) / os.sysconf('SC_CLK_TCK'))
        except (OSError, ValueError, IndexError):
            pass
    return rows


def mem_available():
    return int(Path('/proc/meminfo').read_text().split('MemAvailable:')[1].split()[0]) * 1024


def lower_limit(which, value):
    soft, hard = resource.getrlimit(which)
    resource.setrlimit(which, tuple(value if n == resource.RLIM_INFINITY else min(n, value) for n in (soft, hard)))


def save(path, value):
    tmp = path.with_name(path.name + '.tmp')
    with tmp.open('w') as f:
        json.dump(value, f, indent=2)
        f.write('\n')
        f.flush()
        os.fsync(f.fileno())
    tmp.replace(path)


def validate_launch(value):
    # Snapshot caller data once; mutable caller dictionaries cannot renew it.
    c = json.loads(json.dumps(value, allow_nan=False))
    require(set(c) == {'command', 'cwd', 'url', 'launch_dir', 'cutoff_at',
                       'duration_seconds', 'ready_seconds', 'controller', 'limits'}, 'invalid-launch-fields-no-attach')
    require(isinstance(c['command'], list) and c['command'] and c['command'][0] and
            all(isinstance(x, str) and '\0' not in x for x in c['command']), 'invalid-new-launch-command')
    require(Path(c['command'][0]).is_absolute() and Path(c['command'][0]).is_file(), 'absolute-executable-required')
    require(Path(c['cwd']).is_absolute() and Path(c['cwd']).is_dir(), 'invalid-launch-cwd')
    require(Path(c['launch_dir']).is_absolute() and not Path(c['launch_dir']).exists(), 'new-launch-directory-required')
    for k in ('cutoff_at', 'duration_seconds', 'ready_seconds'):
        require(type(c[k]) in (float, int) and math.isfinite(c[k]), 'invalid-finite-schedule')
    require(0 < c['ready_seconds'] <= 8 and 0 < c['duration_seconds'] <= 110 and
            time.time() + c['duration_seconds'] <= c['cutoff_at'], 'invalid-launch-schedule')
    u = urlsplit(c['url'])
    try:
        address = ipaddress.ip_address(u.hostname)
        require(u.scheme == 'http' and address.is_loopback and u.port and u.path == '/ctl'
                and not u.query and not u.fragment and u.username is None and u.password is None,
                'fixed-numeric-loopback-endpoint-required')
    except (ValueError, TypeError) as ex:
        raise controller.Refusal('fixed-numeric-loopback-endpoint-required') from ex
    limits = c['limits']
    maxima = dict(cpu=90, wall=120, physical=3221225472, file=25165824, output=2097152)
    require(set(limits) == set(maxima), 'invalid-supervisor-limits')
    for k, n in maxima.items():
        require(type(limits[k]) is int and 0 < limits[k] <= n, 'invalid-supervisor-limit-' + k)
    require(c['duration_seconds'] + 1 <= limits['wall'], 'cleanup-wall-reserve-required')
    schedule = c['controller']
    expected = {'max_batches', 'checkpoint_batches', 'after_action_batches', 'cleanup_batches',
                'max_captures', 'capture_bytes', 'width', 'height', 'checkpoint_seconds',
                'after_action_seconds', 'review_seconds', 'request_timeout', 'cleanup_seconds', 'decision_path'}
    require(set(schedule) == expected, 'invalid-controller-schedule-no-attach')
    # Validate ALL controller limits before starting any child. Synthetic self
    # identity is used only for validation, never passed to a running controller.
    probe = object.__new__(controller.Controller)
    now = time.time()
    probe.clock = time.time
    probe.c = dict(schedule, pid=os.getpid(), process_start_ticks=controller.process_identity(os.getpid()),
        started_at=now, deadline_at=now+c['duration_seconds'], supervisor_limits=limits,
        evidence_dir=str(Path(c['launch_dir'])/'controller'), terminal_path=str(Path(c['launch_dir'])/'terminal.json'))
    probe.validate()
    rt = schedule['request_timeout']
    require(c['duration_seconds'] >= c['ready_seconds'] + 9*rt + schedule['cleanup_seconds'],
            'initialization-action-cleanup-reserve-required')
    # Refuse an already occupied endpoint without probing it over HTTP. This
    # bind is not a race-free reservation; later child/listener checks remain.
    with socket.socket(socket.AF_INET6 if address.version == 6 else socket.AF_INET) as s:
        s.bind((str(address), u.port))
    return c


def supervise_new(value):
    global _launch_used
    c = validate_launch(value)
    with _launch_lock:
        require(not _launch_used, 'supervisor-process-already-used-no-replacement')
        _launch_used = True
    lower_limit(resource.RLIMIT_CPU, c['limits']['cpu'])
    lower_limit(resource.RLIMIT_FSIZE, c['limits']['file'])
    root = Path(c['launch_dir'])
    root.mkdir(mode=0o700)
    journal = (root/'authority.jsonl').open('x')
    terminal = root/'terminal.json'
    started = time.time()
    mono = time.monotonic()
    deadline = min(started+c['duration_seconds'], c['cutoff_at'])
    limits = c['limits']
    lock = threading.RLock()
    stop = threading.Event()
    reason = None
    known = {}
    cpu = {}
    peak = 0
    output_bytes = 0
    startup_output = None
    delegated = False
    listener = None
    p = None
    baseline = scan()
    existing = {(pid, r['start']) for pid, r in baseline.items() if r['ppid'] == os.getpid()}
    self_cpu = baseline[os.getpid()]['cpu']

    def record(row):
        with lock:
            journal.write(json.dumps(row, sort_keys=True)+'\n')
            journal.flush()
            os.fsync(journal.fileno())

    def latch(why):
        nonlocal reason
        with lock:
            if reason is None:
                reason = why
                save(terminal, dict(reason=why, at=time.time()))
                record(dict(event='terminal', reason=why))

    def account():
        nonlocal peak, output_bytes
        rows = scan()
        owned = {p.pid} if p else set()
        # Subreaping retains detached children; exclude any preexisting child.
        owned.update(pid for pid, r in rows.items() if r['ppid'] == os.getpid()
                     and (pid, r['start']) not in existing)
        owned.update(pid for pid, r in rows.items() if (pid, r['start']) in known)
        while True:
            added = {pid for pid, r in rows.items() if r['ppid'] in owned} - owned
            if not added:
                break
            owned.update(added)
        for pid in owned:
            if pid in rows:
                r = rows[pid]
                key = (pid, r['start'])
                known[key] = r
                cpu[key] = max(cpu.get(key, 0), r['cpu'])
        live = [r for pid, r in rows.items() if (pid, r['start']) in known and r['state'] not in ('Z','X')]
        rss = sum(r['rss'] for r in live) + rows.get(os.getpid(), {}).get('rss', 0)
        used_cpu = sum(cpu.values()) + max(0, rows.get(os.getpid(), {}).get('cpu', self_cpu)-self_cpu)
        peak = max(peak, rss)
        if p and p.stdout and not p.stdout.closed:
            try:
                data = os.read(p.stdout.fileno(), 8192)
            except BlockingIOError:
                data = b''
            if data:
                output.write(data[:max(0, limits['output']-output_bytes)])
                output.flush()
                output_bytes += len(data)
                if startup_output is not None and len(startup_output) < limits['output']:
                    startup_output.extend(data[:limits['output']-len(startup_output)])
        if rss > limits['physical'] or used_cpu >= limits['cpu'] or output_bytes > limits['output']:
            latch('aggregate-resource-limit')
        if time.time() >= deadline or time.monotonic()-mono >= c['duration_seconds']:
            latch('aggregate-deadline')
        if mem_available() < 805306368:
            latch('host-memory-reserve')
        return rows

    def live():
        with lock:
            account()
            require(reason is None and not terminal.exists(), 'terminal-supervisor')
            require(p is not None and p.poll() is None, 'terminal-owned-child')
            require(controller.process_identity(p.pid) == ticks, 'terminal-owned-child-identity')
            if listener is not None:
                listener.verify()

    def monitor():
        try:
            while not stop.wait(.025):
                live()
        except BaseException as ex:
            latch(str(ex))

    def signal_owned(sig):
        rows = account()
        for (pid, start), row in list(known.items()):
            if pid not in rows or rows[pid]['start'] != start or rows[pid]['state'] in ('Z', 'X'):
                continue
            try:
                fd = os.pidfd_open(pid)
                try:
                    if controller.process_identity(pid) == start:
                        signal.pidfd_send_signal(fd, sig)
                finally:
                    os.close(fd)
            except ProcessLookupError:
                pass
            except controller.Refusal:
                pass

    def child_limits():
        lower_limit(resource.RLIMIT_CPU, limits['cpu'])
        lower_limit(resource.RLIMIT_FSIZE, limits['file'])
        # Never impose Git DATA/AS limits on Python or Node/V8.

    thread = None
    output = (root/'output.log').open('xb')
    status = 'launch-failure'
    failed = True
    try:
        require(hasattr(os, 'pidfd_open') and hasattr(signal, 'pidfd_send_signal'), 'pidfd-required')
        require(ctypes.CDLL(None, use_errno=True).prctl(36, 1, 0, 0, 0) == 0, 'subreaper-required')
        env = dict(os.environ)
        for k in ('WINE_RUN_EXTRA_ARGS', 'WINE_REGION_MAP'):
            env.pop(k, None)
        record(dict(event='new-launch', command=c['command'], cwd=c['cwd'], url=c['url'],
                    started_at=started, deadline_at=deadline, schedule=c['controller'], limits=limits))
        account()
        require(reason is None, 'terminal-before-child-startup')
        if Path(c['command'][0]).resolve().name in ('node', 'nodejs'):
            # Same executable, heap flags, environment and child limits as the
            # subsequent production command. No guest/script in this preflight.
            prefix = [c['command'][0]]
            for arg in c['command'][1:]:
                if not arg.startswith('-'):
                    break
                require(arg.startswith('--') and '=' in arg, 'node-startup-requires-explicit-equals-flags')
                prefix.append(arg)
            code = 'console.log(JSON.stringify({version:process.version,execArgv:process.execArgv,limits:require("fs").readFileSync("/proc/self/limits","utf8")}))'
            startup_args = prefix + ['-e', code]
            startup_output = bytearray()
            p = subprocess.Popen(startup_args, cwd=c['cwd'], env=env, close_fds=True,
                stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                start_new_session=True, preexec_fn=child_limits)
            os.set_blocking(p.stdout.fileno(), False)
            until = min(time.monotonic()+5, mono+c['duration_seconds'])
            while p.poll() is None:
                account()
                require(reason is None and time.monotonic() < until, 'node-startup-budget-or-timeout')
                time.sleep(.02)
            account()
            save(root/'node-startup.json', dict(argv=startup_args, exit=p.returncode,
                  output=startup_output.decode(errors='replace'), sameEnvironment=True, limits=limits))
            require(p.returncode == 0, 'node-startup-failed')
            actual = json.loads(startup_output)
            for name in ('Max data size', 'Max address space'):
                require('unlimited' in next(x for x in actual['limits'].splitlines() if x.startswith(name)),
                        'node-inherited-data-or-address-limit-conflict')
            p.stdout.close()
            p = None
            startup_output = None
            account()
            require(reason is None, 'terminal-after-node-startup')
        p = subprocess.Popen(c['command'], cwd=c['cwd'], env=env, close_fds=True,
            stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
            start_new_session=True, preexec_fn=child_limits)
        ticks = controller.process_identity(p.pid)
        os.set_blocking(p.stdout.fileno(), False)
        record(dict(event='owned-child', pid=p.pid, process_start_ticks=ticks))
        thread = threading.Thread(target=monitor, daemon=True)
        thread.start()
        config = dict(c['controller'], url=c['url'], pid=p.pid, process_start_ticks=ticks,
                      started_at=started, deadline_at=deadline, supervisor_limits=dict(limits),
                      terminal_path=str(terminal), evidence_dir=str(root/'controller'))
        until = min(deadline, started+c['ready_seconds'])
        while True:
            live()
            try:
                listener = controller.ListenerIdentity(config)
                break
            except controller.Refusal:
                require(time.time() < until, 'owned-listener-readiness-timeout')
                time.sleep(.02)

        class OwnedHandoff:
            # Defined only inside the original supervisor lifetime. No public
            # constructor accepts PIDs/configs as authority. Not serializable.
            def __init__(self):
                nonlocal delegated
                live()
                require(not delegated, 'delegation-consumed-no-reconnect')
                delegated = True
                record(dict(event='delegation-consumed', pid=p.pid, start_ticks=ticks))
                self.config = MappingProxyType(config)
                self.listener = listener

            def live(self):
                live()

            def record(self, row):
                record(row)

            def close(self):
                latch('controller-delegation-closed-no-reconnect')

        driver = object.__new__(controller.Controller)
        driver._initialize(OwnedHandoff())
        status = driver.run()
        failed = driver.failed
    except BaseException as ex:
        status = str(ex)
        latch('supervisor-or-controller-failure: '+status)
    finally:
        latch(reason or 'supervisor-complete-no-reconnect')
        stop.set()
        if thread:
            thread.join(timeout=.5)
        # Identity-checked pidfds only, never unrelated groups or supplied PIDs.
        if p:
            for sig in (signal.SIGTERM, signal.SIGKILL):
                signal_owned(sig)
                try:
                    p.wait(timeout=.25)
                except subprocess.TimeoutExpired:
                    pass
            p.stdout.close()
        rows = scan()
        remaining = [pid for (pid, ticks_) in known if pid in rows and rows[pid]['start'] == ticks_
                     and rows[pid]['state'] not in ('Z', 'X')]
        # Reap adopted, task-owned descendants without touching existing children.
        for pid, _ in known:
            try:
                os.waitpid(pid, os.WNOHANG)
            except ChildProcessError:
                pass
        output.close()
        save(root/'supervisor-outcome.json', dict(status=status, failed=failed, reason=reason,
             peakTreeRSS=peak, cpuSeconds=sum(cpu.values()), outputBytes=output_bytes,
             remainingOwnedLive=remaining, childReturncode=p.returncode if p else None,
             owned=[list(k) for k in known], delegated=delegated))
        journal.close()
    return 1 if failed or remaining else 0


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--launch-config', required=True, type=Path)
    args = parser.parse_args()
    try:
        return supervise_new(json.loads(args.launch_config.read_text()))
    except (controller.Refusal, OSError, ValueError, KeyError, TypeError) as ex:
        print(str(ex))
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
