#!/usr/bin/env python3
"""Linux fixture supervisor. Subreaping retains detached/orphan descendants.

CPU is conservatively charged: observed per-identity own+waited CPU high-water
marks may double-charge waited work, but never subtract exited processes.
No process-group or executable-name ownership assumptions are used.

RSS retains both simultaneous /proc samples and Linux wait4 high water (which
also carries the maximum of descendants already waited by that child). Their
maximum is a lower bound, not an exact simultaneous aggregate peak: independent
maxima must not be summed as if they occurred together. Peaks below the cap can
still overlap between samples without being detected; a single reaped peak
above the cap always rejects, including after the command has exited.
"""
import argparse
import ctypes
import json
import os
import pathlib
import resource
import shutil
import signal
import subprocess
import sys
import time

MIB = 1024 * 1024


def snapshot():
    rows = {}
    for entry in pathlib.Path('/proc').iterdir():
        if not entry.name.isdigit():
            continue
        try:
            raw = (entry / 'stat').read_text()
            s = raw[raw.rindex(')') + 2:].split()
            pid = int(entry.name)
            rows[pid] = dict(pid=pid, start=s[19], ppid=int(s[1]), state=s[0],
                             rss=max(0, int(s[21])) * os.sysconf('SC_PAGE_SIZE'),
                             cpu=sum(int(s[i]) for i in (11, 12, 13, 14)) / os.sysconf('SC_CLK_TCK'))
        except (FileNotFoundError, ProcessLookupError):
            pass
    return rows


def key(row):
    return (row['pid'], row['start'])


def signal_owned(row, sig):
    # pidfd closes the check/kill PID reuse race; fail closed without support.
    try:
        fd = os.pidfd_open(row['pid'])
        try:
            current = snapshot().get(row['pid'])
            if current and key(current) == key(row):
                signal.pidfd_send_signal(fd, sig)
        finally:
            os.close(fd)
    except ProcessLookupError:
        pass


def lower_limit(which, value):
    soft, hard = resource.getrlimit(which)
    resource.setrlimit(which, (min(value, soft) if soft != resource.RLIM_INFINITY else value,
                              min(value, hard) if hard != resource.RLIM_INFINITY else value))


def supervise(argv, *, rss_limit=1792*MIB, cpu_limit=90, wall_limit=120,
              output_limit=2*MIB, check=None):
    if not hasattr(os, 'pidfd_open') or not hasattr(signal, 'pidfd_send_signal'):
        raise RuntimeError('Linux pidfd ownership required')
    if ctypes.CDLL(None, use_errno=True).prctl(36, 1, 0, 0, 0) != 0:
        raise OSError(ctypes.get_errno(), 'PR_SET_CHILD_SUBREAPER')
    def limits():
        lower_limit(resource.RLIMIT_CPU, 90)
        lower_limit(resource.RLIMIT_FSIZE, 24*MIB)
        # DATA/AS deliberately untouched. Git alone receives DATA in JS helper.
    env = dict(os.environ, PALETTE_BROWSER_SUPERVISED=str(os.getpid()))
    baseline = snapshot()
    existing = {key(r) for r in baseline.values() if r['ppid'] == os.getpid()}
    overhead_cpu = {key(r):r['cpu'] for r in baseline.values()
                    if r['pid'] in (os.getpid(), os.getppid())}
    bootstrap_identity = key(baseline[os.getppid()]) if (
        os.environ.get('PALETTE_BROWSER_BOOTSTRAP') == str(os.getppid())) else None
    start = time.monotonic()
    child = subprocess.Popen(argv, env=env, stdout=subprocess.PIPE,
                             stderr=subprocess.STDOUT, preexec_fn=limits)
    os.set_blocking(child.stdout.fileno(), False)
    owned = {}
    cpu = {}
    peak = 0
    reaped_peak = 0
    output = bytearray()
    reason = None
    interrupted = []
    previous_handlers = {}
    for sig in (signal.SIGTERM, signal.SIGINT, signal.SIGHUP):
        previous_handlers[sig] = signal.signal(sig, lambda number, frame: interrupted.append(number))
    exit_code = None
    stopping = None
    term_sent = set()
    while True:
        rows = snapshot()
        # Descendants that detach and immediately orphan become our direct
        # children even if their intermediate parent escaped a sampling tick.
        selected = {pid: r for pid, r in rows.items()
                    if (r['ppid'] == os.getpid() and key(r) not in existing) or key(r) in owned}
        changed = True
        while changed:
            changed = False
            for pid, row in rows.items():
                if pid not in selected and row['ppid'] in selected:
                    selected[pid] = row
                    changed = True
        owned.update({key(r): r for r in selected.values()})
        for row in selected.values():
            cpu[key(row)] = max(cpu.get(key(row), 0), row['cpu'])
        # Charge this supervisor too; the JS bootstrap parent is added below.
        overhead = rows.get(os.getpid(), {}).get('rss', 0)
        own = rows.get(os.getpid())
        if own:
            cpu[key(own)] = max(0, own['cpu'] - overhead_cpu.get(key(own), 0))
        bootstrap = rows.get(os.getppid())
        if os.environ.get('PALETTE_BROWSER_BOOTSTRAP') == str(os.getppid()) and bootstrap:
            overhead += bootstrap['rss']
            cpu[key(bootstrap)] = max(0, bootstrap['cpu'] - overhead_cpu.get(key(bootstrap), 0))
        rss = sum(r['rss'] for r in selected.values()) + overhead
        peak = max(peak, rss)
        try:
            data = os.read(child.stdout.fileno(), 65536)
        except BlockingIOError:
            data = b''
        output.extend(data[:max(0, output_limit + 1 - len(output))])
        elapsed = time.monotonic() - start
        if reason is None:
            if bootstrap_identity and (bootstrap is None or key(bootstrap) != bootstrap_identity):
                reason = 'bootstrap parent exited'
            elif interrupted:
                reason = 'supervisor interrupted'
            elif rss > rss_limit:
                reason = 'aggregate RSS limit'
            elif sum(cpu.values()) > cpu_limit:
                reason = 'aggregate CPU limit'
            elif elapsed > wall_limit:
                reason = 'wall deadline'
            elif len(output) > output_limit:
                reason = 'output limit'
            elif check:
                try:
                    reason = check()
                except Exception as error:
                    reason = 'accounting check failed: '+str(error)
        # Reap only owned direct/adopted children. Linux wait4 retains CPU and
        # max RSS even when a child (or its waited descendants) has completed
        # entirely between /proc samples. ru_maxrss is KiB on this Linux helper.
        for candidate in selected.values():
            if candidate['ppid'] != os.getpid():
                continue
            try:
                pid, status, usage = os.wait4(candidate['pid'], os.WNOHANG)
            except ChildProcessError:
                continue
            if not pid:
                continue
            row = selected.get(pid)
            identity = key(row) if row else (pid, 'reaped')
            cpu[identity] = max(cpu.get(identity, 0), usage.ru_utime + usage.ru_stime)
            reaped_peak = max(reaped_peak, usage.ru_maxrss * 1024)
            # Do this before successful-exit cleanup can finish. A reaped
            # process has zero current RSS and will disappear on the next tick.
            if reaped_peak > rss_limit:
                reason = reason or 'aggregate RSS limit'
            if pid == child.pid:
                exit_code = os.waitstatus_to_exitcode(status)
                child.returncode = exit_code
        if exit_code is not None or reason:
            if stopping is None:
                stopping = time.monotonic()
            for row in selected.values():
                if key(row) not in term_sent or time.monotonic() - stopping > .2:
                    signal_owned(row, signal.SIGKILL if time.monotonic()-stopping > .2 else signal.SIGTERM)
                    term_sent.add(key(row))
            if not selected and exit_code is not None:
                break
            if time.monotonic() - stopping > 3:
                reason = reason or 'cleanup deadline exceeded'
                break
        time.sleep(.01)
    # Drain bounded remaining output after every descendant has closed pipes.
    while len(output) <= output_limit:
        try:
            data = os.read(child.stdout.fileno(), min(65536, output_limit+1-len(output)))
        except BlockingIOError:
            break
        if not data:
            break
        output.extend(data)
    child.stdout.close()
    for sig, handler in previous_handlers.items():
        signal.signal(sig, handler)
    if len(output) > output_limit:
        reason = reason or 'output limit'
    if sum(cpu.values()) > cpu_limit:
        reason = reason or 'aggregate CPU limit'
    return dict(exit=exit_code, stopReason=reason, peakRSS=max(peak, reaped_peak),
                sampledPeakRSS=peak, reapedPeakRSS=reaped_peak, cpuSeconds=sum(cpu.values()),
                wallSeconds=time.monotonic()-start, owned=[list(k) for k in owned],
                output=bytes(output[:output_limit]), cleanupComplete=not selected)


def accounting_check(config):
    """Explicit task ledger; do not infer untracked external wrapper writes."""
    roots = [pathlib.Path(p).resolve() for p in config['roots']]
    if any(a == b or a in b.parents or b in a.parents
           for i, a in enumerate(roots) for b in roots[i+1:]):
        raise ValueError('accounting roots must not overlap')
    if config['reserve'] < 8*MIB or config['future'] < 0:
        raise ValueError('invalid reserve/future charge')
    receipt = dict(peakBytes=0, minProjectedFree=None, minMemAvailable=None, samples=0)
    def allocated(p):
        try:
            entries = [p, *p.rglob('*')] if p.is_dir() and not p.is_symlink() else [p]
            return sum(q.lstat().st_blocks*512 for q in entries if not q.is_symlink())
        except FileNotFoundError:
            return 0
    def check():
        used = sum(allocated(p) for p in roots) + config['reserve'] + config['future']
        used += sum(max(0, allocated(pathlib.Path(p))-n) for p,n in config['walBaseline'].items())
        projected = shutil.disk_usage(roots[0]).free - config['reserve'] - config['future']
        mem = int(pathlib.Path('/proc/meminfo').read_text().split('MemAvailable:')[1].split()[0])*1024
        receipt['peakBytes'] = max(receipt['peakBytes'], used)
        receipt['minProjectedFree'] = min(receipt['minProjectedFree'] or projected, projected)
        receipt['minMemAvailable'] = min(receipt['minMemAvailable'] or mem, mem)
        receipt['samples'] += 1
        if used > 64*MIB:
            return 'aggregate disk limit'
        if projected < 2982150144:
            return 'projected host disk floor'
        if mem < 768*MIB:
            return 'host memory remainder'
        return None
    check.receipt = receipt
    return check


if __name__ == '__main__':
    config = json.loads(os.environ['PALETTE_BROWSER_RESOURCE_CONFIG'])
    check = accounting_check(config)
    failure = check()
    if failure:
        raise RuntimeError(failure)
    result = supervise(sys.argv[1:], check=check)
    result['accounting'] = check.receipt
    sys.stdout.buffer.write(result.pop('output'))
    print('\nPALETTE_SUPERVISOR '+json.dumps(result), file=sys.stderr)
    sys.exit(1 if result['stopReason'] else result['exit'] or 0)
