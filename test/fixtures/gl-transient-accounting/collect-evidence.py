#!/usr/bin/env python3
"""Read the explicit production output contract, never immutable ops inputs.

Transport adapters should transfer these exact relative names with the returned
lengths/hashes, and use receipt ownership records for identity-aware cleanup.
Historical flat-ops collectors remain historical and must not be replayed.
"""
import hashlib
import json
import pathlib
import sys

import contextlib
import os
import pathlib
import stat


class OutputFiles:
    def __init__(self, root):
        self.root = pathlib.Path(root)
        self.identities = None
        with self.directory():
            pass

    @staticmethod
    def identity(st):
        return st.st_dev, st.st_ino

    @staticmethod
    def regular(st):
        if not stat.S_ISREG(st.st_mode) or st.st_nlink != 1:
            raise RuntimeError('output must be a single-link regular file')
        return st

    @staticmethod
    def name(name):
        if not name or name in ('.', '..') or '/' in name or '\x00' in name:
            raise ValueError('output name must be a basename')
        return name

    @contextlib.contextmanager
    def directory(self):
        fds = []
        try:
            for name in (self.root, 'ops', 'output'):
                fd = os.open(name, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW,
                             dir_fd=fds[-1] if fds else None)
                fds.append(fd)
            identities = tuple(self.identity(os.fstat(fd)) for fd in fds)
            if self.identities is None:
                self.identities = identities
            if identities != self.identities:
                raise RuntimeError('output directory identity changed')
            yield fds[-1]
        finally:
            for fd in reversed(fds):
                os.close(fd)

    def verify(self, fd):
        with self.directory() as current:
            if self.identity(os.fstat(current)) != self.identity(os.fstat(fd)):
                raise RuntimeError('output directory replaced')
        names = sorted(os.listdir(fd))
        for name in names:
            self.regular(os.stat(name, dir_fd=fd, follow_symlinks=False))
        return names

    def bound(self, directory, name, fd):
        st = self.regular(os.fstat(fd))
        leaf = self.regular(os.stat(name, dir_fd=directory, follow_symlinks=False))
        if self.identity(st) != self.identity(leaf):
            raise RuntimeError('output file identity changed')
        self.verify(directory)
        return st

    def check(self):
        with self.directory() as directory:
            self.verify(directory)

    @contextlib.contextmanager
    def create(self, name):
        """Exclusive descriptor for a child output; caller closes after cleanup.

        A child receives /proc/PARENT/fd/N, never a mutable pathname. The inode
        stays named and accounted in output; replacement makes the run unknown.
        """
        name = self.name(name)
        with self.directory() as directory:
            self.verify(directory)
            fd = os.open(name, os.O_RDWR | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW,
                         0o600, dir_fd=directory)
            try:
                self.bound(directory, name, fd)
                yield fd
                self.bound(directory, name, fd)
            finally:
                os.close(fd)

    def write(self, name, data):
        name = self.name(name)
        temporary = name + '.new'
        with self.directory() as directory:
            self.verify(directory)
            fd = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW,
                         0o600, dir_fd=directory)
            try:
                self.bound(directory, temporary, fd)
                remaining = memoryview(data)
                while remaining:
                    count = os.write(fd, remaining)
                    if count <= 0:
                        raise RuntimeError('short output write')
                    remaining = remaining[count:]
                self.bound(directory, temporary, fd)
                # procfs paths preserve the existing replace-observation contract
                # while anchoring BOTH parents to the verified open directory.
                anchor = pathlib.Path('/proc/self/fd') / str(directory)
                os.replace(anchor / temporary, anchor / name)
                self.bound(directory, name, fd)
            finally:
                os.close(fd)

    def read(self, name):
        name = self.name(name)
        with self.directory() as directory:
            self.verify(directory)
            fd = os.open(name, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK,
                         dir_fd=directory)
            try:
                before = self.bound(directory, name, fd)
                chunks = []
                remaining = before.st_size
                while remaining:
                    chunk = os.read(fd, min(65536, remaining))
                    if not chunk:
                        raise RuntimeError('output shortened during collection')
                    chunks.append(chunk)
                    remaining -= len(chunk)
                if os.read(fd, 1):
                    raise RuntimeError('output grew during collection')
                after = self.bound(directory, name, fd)
                signature = lambda s: (s.st_dev, s.st_ino, s.st_mode, s.st_nlink,
                                       s.st_size, s.st_mtime_ns, s.st_ctime_ns)
                if signature(before) != signature(after):
                    raise RuntimeError('output changed during collection')
                # Some filesystems coalesce metadata timestamps. Verify the
                # bytes again through the SAME descriptor before returning.
                payload = b''.join(chunks)
                os.lseek(fd, 0, os.SEEK_SET)
                offset = 0
                while offset < len(payload):
                    chunk = os.read(fd, min(65536, len(payload)-offset))
                    if not chunk or chunk != payload[offset:offset+len(chunk)]:
                        raise RuntimeError('output bytes changed during collection')
                    offset += len(chunk)
                if os.read(fd, 1):
                    raise RuntimeError('output grew during collection')
                if signature(before) != signature(self.bound(directory, name, fd)):
                    raise RuntimeError('output changed during collection')
                return payload
            finally:
                os.close(fd)

    def names(self):
        with self.directory() as directory:
            return self.verify(directory)

def collect(task_root):
    output=OutputFiles(task_root)
    def snapshot():
        with output.directory() as directory:
            result={}
            for name in output.verify(directory):
                st=output.regular(os.stat(name,dir_fd=directory,follow_symlinks=False))
                result[name]=(st.st_dev,st.st_ino,st.st_mode,st.st_nlink,st.st_size,
                              st.st_mtime_ns,st.st_ctime_ns)
            output.verify(directory)
            return result
    before=snapshot();names=sorted(before)
    files={};receipts=[]
    for name in names:
        data=output.read(name)
        files[name]=dict(bytes=len(data),sha256=hashlib.sha256(data).hexdigest())
        if name.endswith('-receipt.json'):receipts.append(json.loads(data))
    if snapshot()!=before:raise RuntimeError('output inventory changed during collection')
    return dict(outputRelative='ops/output',files=files,receiptCount=len(receipts),
                cleanupComplete=bool(receipts) and all(r['cleanupComplete'] for r in receipts),
                owned=[identity for r in receipts for identity in r['owned']],
                testInvoked='invocation-start.json' in files)

if __name__=='__main__':print(json.dumps(collect(sys.argv[1]),indent=2))
