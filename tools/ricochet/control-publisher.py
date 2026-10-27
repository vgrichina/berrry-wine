"""Linux atomic single-outstanding Ricochet control writer.

All producers, including separate API commands, enter publish() before encoding.
An unnamed inode and directory flock keep the complete writer within the one
24MiB reservation. No retained pathname is ever opened for writing.
"""
import ctypes
import errno
import fcntl
import json
import os
import pathlib
import resource
import stat

LIMIT = 24 * 1048576


class PublicationUncertain(RuntimeError):
    """Atomic publication committed; caller must retain it and never replay."""


def writer_limit():
    soft, hard = resource.getrlimit(resource.RLIMIT_FSIZE)
    resource.setrlimit(resource.RLIMIT_FSIZE,
                       (min(soft, LIMIT) if soft != -1 else LIMIT,
                        min(hard, LIMIT) if hard != -1 else LIMIT))


def directory(path):
    p = pathlib.Path(path)
    if not p.is_absolute() or '..' in p.parts:
        raise ValueError('absolute normalized directory required')
    fd = os.open('/', os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    try:
        for part in p.parts[1:]:
            child = os.open(part, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=fd)
            os.close(fd)
            fd = child
        return fd
    except BaseException:
        os.close(fd)
        raise


def bounded(s):
    if not stat.S_ISREG(s.st_mode) or max(s.st_size, s.st_blocks * 512) > LIMIT:
        raise ValueError('control must be regular and logical/allocated <=24MiB')


def publish(control_directory, command):
    writer_limit()  # This writer's own process, before encoding or any write.
    parent = directory(control_directory)
    fd = None
    try:
        fcntl.flock(parent, fcntl.LOCK_EX | fcntl.LOCK_NB)
        # lstat semantics: every extant entry, including a dangling link, blocks.
        for name in ('continue.json', 'done.json'):
            try:
                os.stat(name, dir_fd=parent, follow_symlinks=False)
            except FileNotFoundError:
                pass
            else:
                raise FileExistsError(errno.EEXIST, 'outstanding/terminal control', name)
        fd = os.open('.', os.O_WRONLY | os.O_TMPFILE, 0o600, dir_fd=parent)
        total = 0
        for chunk in json.JSONEncoder().iterencode(command):
            data = chunk.encode('utf8')
            total += len(data)
            if total > LIMIT:
                raise ValueError('control exceeds24MiB')
            view = memoryview(data)
            while view:
                n = os.write(fd, view)
                if n <= 0:
                    raise OSError('short control write')
                view = view[n:]
            bounded(os.fstat(fd))
        os.fsync(fd)
        s = os.fstat(fd)
        bounded(s)
        if s.st_nlink != 0:
            raise ValueError('temporary control has links')
        # linkat through our own /proc descriptor publishes the fully written
        # unnamed inode in one no-replace operation. AT_SYMLINK_FOLLOW resolves
        # only that source descriptor, never the destination. No capability-
        # dependent AT_EMPTY_PATH operation or retry is used.
        libc = ctypes.CDLL(None, use_errno=True)
        link = libc.linkat
        link.argtypes = [ctypes.c_int, ctypes.c_char_p, ctypes.c_int, ctypes.c_char_p, ctypes.c_int]
        link.restype = ctypes.c_int
        if link(-100, ('/proc/self/fd/'+str(fd)).encode(), parent, b'continue.json', 0x400):
            e = ctypes.get_errno()
            raise OSError(e, os.strerror(e))
        try:
            os.fsync(parent)
        except OSError as error:
            raise PublicationUncertain('control published; directory sync failed; no replay') from error
        return dict(bytes=total, allocated=s.st_blocks*512,
                    writerFSIZE=resource.getrlimit(resource.RLIMIT_FSIZE))
    finally:
        if fd is not None:
            os.close(fd)  # Unpublished partial inode is reclaimed on any failure.
        os.close(parent)
