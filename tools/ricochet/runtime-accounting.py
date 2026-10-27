"""Fail-closed, fd-relative runtime storage samples with exact control reserves.

This is a bounded observation, not an OS quota or atomic filesystem snapshot.
Only explicitly declared ephemeral regular files may disappear. Their entire
writer-enforced maximum charge remains reserved, even when absent or unlinked.
All other discovered identities are required for the lifetime of this ledger.
Live files can grow; immutable input files additionally require SHA-256 pins.
"""
import hashlib
import os
import pathlib
import stat
import time


class AccountingError(RuntimeError):
    pass


def _path(value):
    p = pathlib.Path(value)
    if not p.is_absolute() or '..' in p.parts:
        raise ValueError('absolute normalized accounting path required')
    return p


def _identity(s):
    return s.st_dev, s.st_ino, stat.S_IFMT(s.st_mode)


def _version(s):
    return (_identity(s), s.st_size, s.st_blocks, s.st_mtime_ns,
            s.st_ctime_ns, s.st_mode, s.st_nlink)


def _open_path(p):
    fd = os.open('/', os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    try:
        for part in p.parts[1:]:
            child = os.open(part, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW,
                            dir_fd=fd)
            os.close(fd)
            fd = child
        return fd
    except BaseException:
        os.close(fd)
        raise


class RuntimeAccounting:
    def __init__(self, roots, *, ephemeral_files, immutable_files=None,
                 ceiling, max_entries=100000, max_depth=64, max_seconds=1):
        self.roots = tuple(_path(p) for p in roots)
        if not self.roots or any(a == b or a in b.parents or b in a.parents
                                for i, a in enumerate(self.roots)
                                for b in self.roots[i+1:]):
            raise ValueError('nonoverlapping mandatory directory roots required')
        self.ephemeral = {_path(p): n for p, n in ephemeral_files.items()}
        self.immutable = {_path(p): h for p, h in (immutable_files or {}).items()}
        for p in self.ephemeral.keys() | self.immutable.keys():
            if not any(r in p.parents for r in self.roots):
                raise ValueError('file outside accounting roots')
        if self.ephemeral.keys() & self.immutable.keys():
            raise ValueError('immutable input cannot be ephemeral')
        if (not isinstance(ceiling, int) or ceiling <= 0 or
            any(not isinstance(n, int) or n <= 0 for n in self.ephemeral.values()) or
            sum(self.ephemeral.values()) > ceiling):
            raise ValueError('invalid ceiling/control reservation')
        if not (1 <= max_entries <= 100000 and 1 <= max_depth <= 64 and
                0 < max_seconds <= 1):
            raise ValueError('unbounded accounting scan')
        for h in self.immutable.values():
            if len(h) != 64 or any(c not in '0123456789abcdef' for c in h):
                raise ValueError('invalid immutable SHA-256')
        self.ceiling = ceiling
        self.max_entries, self.max_depth, self.max_seconds = max_entries, max_depth, max_seconds
        self.identities = {}
        self.versions = {}
        self.root_ids = {}
        for p in self.roots:
            fd = _open_path(p)
            try:
                self.root_ids[p] = _identity(os.fstat(fd))
            finally:
                os.close(fd)
        self.receipt = dict(samples=0, failures=0, peakBytes=0, lastBytes=None)

    def _bound(self, depth=0):
        self.entries += 1
        if (self.entries > self.max_entries or depth > self.max_depth or
                time.monotonic() > self.deadline):
            raise AccountingError('accounting traversal bound')

    def _charge(self, n):
        self.total += n
        self.receipt['peakBytes'] = max(self.receipt['peakBytes'], self.total)
        if self.total > self.ceiling:
            raise AccountingError('runtime storage ceiling')

    def _remember(self, p, s):
        if p not in self.ephemeral:
            identity = _identity(s)
            if self.identities.get(p, identity) != identity:
                raise AccountingError('required entry replaced: '+str(p))
            self.identities[p] = identity
            self.present.add(p)
            if len(self.identities) > self.max_entries:
                raise AccountingError('required inventory bound')

    def _stat(self, fd, name, p):
        try:
            return os.stat(name, dir_fd=fd, follow_symlinks=False)
        except FileNotFoundError:
            if p not in self.ephemeral:
                raise AccountingError('required entry disappeared: '+str(p)) from None
            # Confirm absence in the SAME pinned parent; no subtree exception.
            try:
                os.stat(name, dir_fd=fd, follow_symlinks=False)
            except FileNotFoundError:
                return None
            raise AccountingError('control replaced during disappearance: '+str(p))

    def _file(self, parent, name, p, before):
        if not stat.S_ISREG(before.st_mode) or before.st_nlink != 1:
            raise AccountingError('regular single-link file required: '+str(p))
        fd = None
        try:
            try:
                fd = os.open(name, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK, dir_fd=parent)
            except FileNotFoundError:
                if self._stat(parent, name, p) is None:
                    return  # Exact control reserve was charged before enumeration.
                raise AccountingError('entry changed during open: '+str(p)) from None
            opened = os.fstat(fd)
            if (_identity(opened) != _identity(before) or
                    opened.st_nlink not in ((0, 1) if p in self.ephemeral else (1,))):
                raise AccountingError('entry replaced/linked during open: '+str(p))
            self._remember(p, opened)
            if p in self.ephemeral:
                previous = self.control_ids.setdefault(p, _identity(opened))
                if previous != _identity(opened):
                    raise AccountingError('control replaced at final boundary: '+str(p))
                if p not in self.control_fds:
                    # Pin the observed inode through final enumeration, so an
                    # unlinked inode cannot be recycled into a same-number swap.
                    self.control_fds[p] = os.dup(fd)
                    self.control_versions[p] = _version(opened)
            if p in self.immutable:
                h = hashlib.sha256()
                while True:
                    self._bound()
                    b = os.read(fd, 65536)
                    if not b:
                        break
                    h.update(b)
                if h.hexdigest() != self.immutable[p]:
                    raise AccountingError('immutable input hash changed: '+str(p))
            named = self._stat(parent, name, p)
            after = os.fstat(fd)
            if p in self.ephemeral and named is not None and after.st_nlink == 0:
                named = self._stat(parent, name, p)
            if named is not None:
                if (_identity(named) != _identity(opened) or named.st_nlink != 1 or
                        after.st_nlink != 1):
                    raise AccountingError('entry replaced/linked during scan: '+str(p))
            elif p not in self.ephemeral or after.st_nlink != 0:
                raise AccountingError('unverified control consumption: '+str(p))
            observations = [before, opened, after] + ([] if named is None else [named])
            if p in self.ephemeral:
                versions = [self.control_versions[p]] + [_version(s) for s in observations]
                if named is None:
                    # Verified consumption permits the single link-count and
                    # ctime transition caused by unlink. Content/allocation,
                    # mtime and mode must still agree, as must every observation
                    # on each side of that transition (including the first open).
                    stable = lambda v: v[:4] + v[5:6]
                    consistent = all(stable(v) == stable(versions[0]) for v in versions)
                    for links in (0, 1):
                        side = [v for v in versions if v[-1] == links]
                        consistent = consistent and all(v == side[0] for v in side)
                else:
                    consistent = all(v == versions[0] for v in versions)
                if not consistent:
                    raise AccountingError('control version changed during scan: '+str(p))
            charge = max(max(s.st_size, s.st_blocks*512) for s in observations)
            if p in self.ephemeral:
                if charge > self.ephemeral[p]:
                    raise AccountingError('control exceeds reservation: '+str(p))
            else:
                self._charge(charge)
            self.sizes[p] = max(s.st_size for s in observations)
            if p in self.immutable:
                version = _version(opened)
                if (any(_version(s) != version for s in observations) or
                        self.versions.get(p, version) != version):
                    raise AccountingError('immutable input version changed: '+str(p))
                self.versions[p] = version
        finally:
            if fd is not None:
                os.close(fd)

    def _walk(self, fd, p, depth):
        self._bound(depth)
        before = os.fstat(fd)
        self._remember(p, before)
        self._charge(before.st_blocks*512)
        # Read only a bounded inventory, including transient names.
        names = set()
        with os.scandir(fd) as entries:
            for entry in entries:
                self._bound(depth+1)
                names.add(entry.name)
        for name in sorted(names):
            self._bound(depth+1)
            q = p/name
            s = self._stat(fd, name, q)
            if s is None:
                continue
            if s.st_dev != before.st_dev:
                raise AccountingError('cross-filesystem entry: '+str(q))
            if stat.S_ISDIR(s.st_mode):
                if q in self.ephemeral or q in self.immutable:
                    raise AccountingError('declared file became directory: '+str(q))
                child = os.open(name, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=fd)
                try:
                    if _identity(os.fstat(child)) != _identity(s):
                        raise AccountingError('directory replaced during open: '+str(q))
                    self._walk(child, q, depth+1)
                    named = self._stat(fd, name, q)
                    if _identity(named) != _identity(s):
                        raise AccountingError('directory replaced during scan: '+str(q))
                finally:
                    os.close(child)
            else:
                self._file(fd, name, q, s)
        final_names = set()
        verification = os.open('.', os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=fd)
        try:
            with os.scandir(verification) as entries:
                for entry in entries:
                    self._bound(depth+1)
                    if p/entry.name not in self.ephemeral:
                        final_names.add(entry.name)
                    else:
                        q = p/entry.name
                        s = self._stat(fd, entry.name, q)
                        if s is not None:
                            if self.control_ids.get(q) != _identity(s):
                                raise AccountingError('control replaced at final boundary: '+str(q))
                            if self.control_versions[q] != _version(s):
                                raise AccountingError('control changed at final boundary: '+str(q))
                            self._file(fd, entry.name, q, s)
        finally:
            os.close(verification)
        required = {name for name in names if p/name not in self.ephemeral}
        if final_names != required:
            raise AccountingError('required namespace changed during scan: '+str(p))
        # Namespace activity may allocate directory blocks during this sample.
        self._charge(max(0, os.fstat(fd).st_blocks-before.st_blocks)*512)

    def sample(self):
        self.deadline = time.monotonic()+self.max_seconds
        self.total, self.entries = 0, 0
        self.present, self.sizes = set(), {}
        self.control_ids = {}
        self.control_fds, self.control_versions = {}, {}
        try:
            self._charge(sum(self.ephemeral.values()))
            for p in self.roots:
                fd = _open_path(p)
                try:
                    if _identity(os.fstat(fd)) != self.root_ids[p]:
                        raise AccountingError('mandatory root replaced: '+str(p))
                    self._walk(fd, p, 0)
                    fresh = _open_path(p)
                    try:
                        if _identity(os.fstat(fresh)) != self.root_ids[p]:
                            raise AccountingError('mandatory root replaced during scan: '+str(p))
                    finally:
                        os.close(fresh)
                finally:
                    os.close(fd)
            if (self.identities.keys()-self.present or
                    self.immutable.keys()-self.present):
                raise AccountingError('required input/artifact disappeared between scans')
            # A consumed name may skip _file entirely, or disappear before
            # its final open. Validate every pinned inode before accepting any
            # inventory, including those no longer reachable by a pathname.
            for p, fd in self.control_fds.items():
                self._bound()
                initial = self.control_versions[p]
                final = _version(os.fstat(fd))
                if initial[-1] == 1 and final[-1] == 0:
                    # Unlink changes ctime and nlink; it cannot change identity,
                    # content size/allocation, mtime or mode.
                    consistent = final[:4] + final[5:6] == initial[:4] + initial[5:6]
                else:
                    consistent = final == initial
                if not consistent:
                    raise AccountingError('control version changed during scan: '+str(p))
            self._bound()
            self.receipt.update(samples=self.receipt['samples']+1, lastBytes=self.total)
            return dict(bytes=self.total, sizes=dict(self.sizes))
        except BaseException:
            self.receipt['failures'] += 1
            self.receipt['lastBytes'] = None
            raise
        finally:
            for fd in self.control_fds.values():
                os.close(fd)
