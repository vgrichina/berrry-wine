#!/usr/bin/env python3
"""Test the enforcement boundary before implementing any storage fallback.

Landlock is the available unprivileged path domain. Its actual coverage must be
tested, including anonymous filesystem descriptors, not inferred from ABI.
This is a rejecting facility probe, not a production sandbox or accounting API.
"""
import ctypes
import errno
import json
import os
import pathlib
import resource
import sys
import tempfile


class Ruleset(ctypes.Structure):
    _fields_ = [('handled_access_fs', ctypes.c_uint64)]


class PathBeneath(ctypes.Structure):
    _pack_ = 1
    _fields_ = [('allowed_access', ctypes.c_uint64), ('parent_fd', ctypes.c_int)]


def run():
    resource.setrlimit(resource.RLIMIT_CPU, (90, 90))
    resource.setrlimit(resource.RLIMIT_FSIZE, (1048576, 1048576))
    c = ctypes.CDLL(None, use_errno=True)
    c.syscall.restype = ctypes.c_long
    abi = c.syscall(444, 0, 0, 1)
    if abi < 3:
        raise RuntimeError('Landlock truncate mediation unavailable')
    # All write/mutation rights through ABI 3 (including REFER/TRUNCATE).
    rights = sum(1 << b for b in [1, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14])
    with tempfile.TemporaryDirectory(prefix='toyvm-domain-probe-') as temp:
        root = pathlib.Path(temp)
        inside = root/'owned'; inside.mkdir(mode=0o700)
        outside = root/'outside'; outside.write_bytes(b'outside')
        rs = Ruleset(rights)
        ruleset = c.syscall(444, ctypes.byref(rs), ctypes.sizeof(rs), 0)
        if ruleset < 0:
            raise OSError(ctypes.get_errno(), 'create_ruleset')
        parent = os.open(inside, os.O_PATH | os.O_DIRECTORY | os.O_CLOEXEC)
        path = PathBeneath(rights, parent)
        if c.syscall(445, ruleset, 1, ctypes.byref(path), 0) < 0:
            raise OSError(ctypes.get_errno(), 'add_rule')
        # Restrict a fork, leaving this process able to clean its own fixtures.
        read, write = os.pipe()
        child = os.fork()
        if child == 0:
            os.close(read)
            try:
                if c.prctl(38, 1, 0, 0, 0) or c.syscall(446, ruleset, 0):
                    raise OSError(ctypes.get_errno(), 'restrict_self')
                (inside/'allowed').write_bytes(b'owned')
                denied = None
                try:
                    outside.write_bytes(b'escape')
                except OSError as e:
                    denied = e.errno
                # memfd is an anonymous, allocated tmpfs inode. No pathname
                # exists to mediate, and it survives unlink semantics by design.
                fd = os.memfd_create('toyvm-outside-domain', os.MFD_CLOEXEC)
                os.write(fd, b'x'*8192)
                st = os.fstat(fd)
                descriptor = os.readlink('/proc/self/fd/'+str(fd))
                os.close(fd)
                result = dict(landlockABI=abi,insideWrite=True,
                              outsideWriteErrno=denied,
                              outsideStillOriginal=outside.read_bytes()==b'outside',
                              memfdWriteBytes=8192,memfdSize=st.st_size,
                              memfdAllocated=st.st_blocks*512,
                              memfdDescriptor=descriptor,
                              currentRSS=int(pathlib.Path('/proc/self/statm').read_text().split()[1])*os.sysconf('SC_PAGE_SIZE'))
                os.write(write, json.dumps(result).encode())
                os._exit(0)
            except BaseException as e:
                os.write(write, json.dumps(dict(error=repr(e))).encode())
                os._exit(1)
        os.close(write)
        data = b''
        while True:
            chunk = os.read(read, 4096)
            if not chunk: break
            data += chunk
            if len(data) > 8192: raise RuntimeError('probe output bound')
        os.close(read)
        pid, status = os.waitpid(child, 0)
        os.close(parent); os.close(ruleset)
        result = json.loads(data)
        result.update(childExit=os.waitstatus_to_exitcode(status),reaped=pid==child)
        assert result['childExit']==0,result
        assert result['outsideWriteErrno']==errno.EACCES,result
        assert result['insideWrite'] and result['outsideStillOriginal'],result
        assert result['memfdAllocated']>=8192 and result['memfdSize']==8192,result
        result['conclusion']='PATH_DOMAIN_ALONE_REJECTED_ANONYMOUS_ALLOCATION_ESCAPE'
        print(json.dumps(result,sort_keys=True))


if __name__ == '__main__':
    run()
