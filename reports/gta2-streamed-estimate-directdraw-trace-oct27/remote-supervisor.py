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
import stat
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
        lower_limit(resource.RLIMIT_CPU, 180)
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


class AccountingUnknown(RuntimeError):
    """No consistent bounded allocated-byte sample could be established."""


class _TransientMutation(Exception):
    pass


class AllocatedDisk:
    """Bounded, fd-relative, non-following allocated-byte observations.

    Roots are mandatory and identity-pinned. Only explicitly named transient
    subtrees may invalidate/retry a sample. A retry discards the ENTIRE sample,
    never a required subtree's charge. This is a bounded consistency check, not
    a filesystem snapshot or a quota: mutations after validation remain subject
    to the next sample and the independent free-space gate.
    """
    def __init__(self, roots, *, transient_roots=(), max_entries=100000,
                 max_depth=64, max_seconds=1.0, attempts=3, ceiling=None,
                 mutable_file_roots=()):
        def absolute(p):
            p = pathlib.Path(p)
            if not p.is_absolute() or '..' in p.parts:
                raise ValueError('accounting paths must be absolute without ..')
            return p
        self.roots = tuple(absolute(p) for p in roots)
        self.transient = tuple(absolute(p) for p in transient_roots)
        # External WAL files may change size/version, but remain identity-pinned.
        # This exception cannot cover a directory or an unenumerated subtree.
        self.mutable_files = frozenset(absolute(p) for p in mutable_file_roots)
        if not self.mutable_files.issubset(self.roots):
            raise ValueError('mutable files must be explicit accounting roots')
        if not self.roots or any(a == b or a in b.parents or b in a.parents
                                for i, a in enumerate(self.roots) for b in self.roots[i+1:]):
            raise ValueError('accounting roots must not overlap')
        if any(not any(r in p.parents for r in self.roots) for p in self.transient):
            raise ValueError('transient roots must be strict descendants')
        if not (1 <= attempts <= 3 and 1 <= max_entries <= 100000 and
                1 <= max_depth <= 64 and 0 < max_seconds <= 1):
            raise ValueError('unbounded accounting traversal')
        self.max_entries, self.max_depth = max_entries, max_depth
        self.max_seconds, self.attempts, self.ceiling = max_seconds, attempts, ceiling
        if len(self.roots) + len(self.transient) > max_entries:
            raise ValueError('accounting root inventory bound')
        self.identities = {}
        self.required_seen = {}
        self.required_names = {}
        self.receipt = dict(samples=0, retries=0, unknown=0, lastBytes=None)
        for p in self.roots + self.transient:
            fd = self._open_path(p)
            try:
                s = os.fstat(fd)
                if p in self.transient and not stat.S_ISDIR(s.st_mode):
                    raise AccountingUnknown('transient root is not a directory')
                if p in self.mutable_files and not stat.S_ISREG(s.st_mode):
                    raise AccountingUnknown('mutable accounting root is not a regular file')
                self.identities[p] = self._identity(s)
            finally:
                os.close(fd)

    @staticmethod
    def _identity(s):
        return s.st_dev, s.st_ino, stat.S_IFMT(s.st_mode)

    @classmethod
    def _version(cls, s):
        return cls._identity(s) + (s.st_size, s.st_blocks, s.st_mtime_ns, s.st_ctime_ns,
                                   s.st_mode, s.st_uid, s.st_gid, s.st_nlink)

    @staticmethod
    def _open_path(p):
        # Reject symlinks in EVERY path component, including mandatory roots.
        fd = os.open('/', os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
        try:
            for i, part in enumerate(p.parts[1:]):
                flags = os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK
                if i < len(p.parts)-2:
                    flags |= os.O_DIRECTORY
                child = os.open(part, flags, dir_fd=fd)
                os.close(fd)
                fd = child
            return fd
        except BaseException:
            os.close(fd)
            raise

    def _validate_roots(self):
        for p, identity in self.identities.items():
            if time.monotonic() > self.deadline:
                raise AccountingUnknown('accounting root validation time bound')
            fd = self._open_path(p)
            try:
                if self._identity(os.fstat(fd)) != identity:
                    raise AccountingUnknown('mandatory accounting root changed: '+str(p))
            finally:
                os.close(fd)

    def _churn(self, p):
        if any(p == r or r in p.parents for r in self.transient):
            raise _TransientMutation(str(p))
        raise AccountingUnknown('required accounting data changed: '+str(p))

    def _charge(self, s, depth, p):
        self.entries += 1
        if (self.entries > self.max_entries or depth > self.max_depth or
                time.monotonic() > self.deadline):
            raise AccountingUnknown('accounting traversal bound')
        self.total += s.st_blocks * 512
        if self.ceiling is not None and self.total > self.ceiling:
            raise AccountingUnknown('allocated-byte ceiling')
        if not any(p == r or r in p.parents for r in self.transient):
            # Directory timestamps/blocks reflect namespace activity, including
            # explicitly transient descendants. Pin identity here and compare
            # the mandatory child namespace separately. Required file versions
            # survive both successful samples and discarded partial retries.
            version = (self._identity(s) if stat.S_ISDIR(s.st_mode) or
                       p in self.mutable_files else self._version(s))
            prior = self.required_seen.get(p, version)
            if prior[:3] != version[:3]:
                raise AccountingUnknown('required accounting entry replaced: '+str(p))
            if prior != version:
                raise AccountingUnknown('required accounting file version changed: '+str(p))
            self.required_seen[p] = version
            self.present.add(p)
            if len(self.required_seen) > self.max_entries:
                raise AccountingUnknown('required accounting inventory bound')

    def _walk(self, fd, p, before, depth):
        self._charge(before, depth, p)
        if stat.S_ISDIR(before.st_mode):
            # Store only bounded mandatory names. A transient root's name is
            # validated by _validate_roots, while its contents may churn freely.
            mandatory = set()
            with os.scandir(fd) as entries:
                for entry in entries:
                    if time.monotonic() > self.deadline:
                        raise AccountingUnknown('accounting traversal time bound')
                    q = p / entry.name
                    if not any(q == r or r in q.parents for r in self.transient):
                        mandatory.add(entry.name)
                        if len(mandatory) > self.max_entries:
                            raise AccountingUnknown('required namespace inventory bound')
                    try:
                        s = os.stat(entry.name, dir_fd=fd, follow_symlinks=False)
                    except FileNotFoundError:
                        self._disappeared(fd, before, q)
                    if s.st_dev != before.st_dev:
                        raise AccountingUnknown('accounting traversal crossed filesystem: '+str(q))
                    if stat.S_ISDIR(s.st_mode):
                        try:
                            child = os.open(entry.name, os.O_RDONLY | os.O_DIRECTORY |
                                            os.O_NOFOLLOW, dir_fd=fd)
                        except FileNotFoundError:
                            self._disappeared(fd, before, q)
                        try:
                            if self._identity(os.fstat(child)) != self._identity(s):
                                raise AccountingUnknown('directory replaced: '+str(q))
                            self._walk(child, q, s, depth+1)
                        finally:
                            os.close(child)
                    else:
                        # Symlink blocks count, but the target is never opened.
                        self._charge(s, depth+1, q)
                    try:
                        after = os.stat(entry.name, dir_fd=fd, follow_symlinks=False)
                    except FileNotFoundError:
                        self._disappeared(fd, before, q)
                    if self._version(s) != self._version(after):
                        self._churn(q)
            if not any(p == r or r in p.parents for r in self.transient):
                if self.required_names.get(p, mandatory) != mandatory:
                    raise AccountingUnknown('required directory namespace changed between samples: '+str(p))
                self.required_names[p] = mandatory
        if self._version(before) != self._version(os.fstat(fd)):
            self._churn(p)

    def _disappeared(self, fd, before, p):
        now = os.fstat(fd)
        if self._identity(now) != self._identity(before):
            raise AccountingUnknown('unverified disappearance: '+str(p))
        # Timestamps may be coarser than a create/unlink pair. Verify the
        # previously discovered name is actually gone from the same pinned
        # directory; ENOENT alone is insufficient. Bound this second traversal.
        verification = os.open('.', os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=fd)
        try:
            with os.scandir(verification) as entries:
                for entry in entries:
                    self.entries += 1
                    if self.entries > self.max_entries or time.monotonic() > self.deadline:
                        raise AccountingUnknown('disappearance verification bound')
                    if entry.name == p.name:
                        raise AccountingUnknown('unverified disappearance: '+str(p))
        finally:
            os.close(verification)
        self._churn(p)

    def allocated(self):
        self.deadline = time.monotonic() + self.max_seconds
        try:
            for attempt in range(self.attempts):
                self.total = self.entries = 0
                self.present = set()
                self._validate_roots()
                try:
                    for p in self.roots:
                        fd = self._open_path(p)
                        try:
                            s = os.fstat(fd)
                            if self._identity(s) != self.identities[p]:
                                raise AccountingUnknown('mandatory root changed')
                            self._walk(fd, p, s, 0)
                        finally:
                            os.close(fd)
                    self._validate_roots()
                    if self.required_seen.keys() - self.present:
                        raise AccountingUnknown('required accounting entry disappeared between samples')
                    if time.monotonic() > self.deadline:
                        raise AccountingUnknown('accounting final validation time bound')
                except _TransientMutation:
                    self._validate_roots()
                    self.receipt['retries'] += 1
                    if attempt+1 == self.attempts:
                        raise AccountingUnknown('transient accounting consistency unknown')
                    continue
                self.receipt.update(samples=self.receipt['samples']+1, lastBytes=self.total)
                return self.total
        except BaseException:
            self.receipt['unknown'] += 1
            self.receipt['lastBytes'] = None
            raise


def accounting_check(config):
    """Explicit task ledger; do not infer untracked external wrapper writes."""
    roots = [pathlib.Path(p) for p in config['roots']]
    if any(a == b or a in b.parents or b in a.parents
           for i, a in enumerate(roots) for b in roots[i+1:]):
        raise ValueError('accounting roots must not overlap')
    if config['reserve'] < 8*MIB or config['future'] < 0:
        raise ValueError('invalid reserve/future charge')
    receipt = dict(peakBytes=0, minProjectedFree=None, minMemAvailable=None, samples=0)
    ledger = AllocatedDisk(roots, transient_roots=config.get('transientRoots', ()), ceiling=64*MIB)
    wal = {p: AllocatedDisk([p], ceiling=64*MIB, mutable_file_roots=[p])
           for p in config['walBaseline']}
    if any(pathlib.Path(p) == r or r in pathlib.Path(p).parents
           for p in wal for r in roots):
        raise ValueError('WAL must be charged once outside roots')
    def check():
        used = ledger.allocated() + config['reserve'] + config['future']
        used += sum(max(0, wal[p].allocated()-n) for p,n in config['walBaseline'].items())
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
