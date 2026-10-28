#!/usr/bin/env python3
"""Fail-closed, Linux x86-64 tiny-fixture launcher; not browser-qualified."""
import ctypes, errno, fcntl, os, pathlib, platform, resource, stat, sys


def restrict(root):
    if platform.machine()!='x86_64':raise RuntimeError('unqualified syscall architecture')
    for name in os.listdir('/proc/self/fd'):
        fd=int(name)
        try:st=os.fstat(fd)
        except OSError as e:
            if e.errno==errno.EBADF:continue
            raise
        if fd>2:raise RuntimeError('unexpected inherited descriptor')
        if stat.S_ISSOCK(st.st_mode):raise RuntimeError('inherited IPC socket rejected')
        if stat.S_ISREG(st.st_mode) and fcntl.fcntl(fd,fcntl.F_GETFL)&os.O_ACCMODE!=os.O_RDONLY:
            raise RuntimeError('inherited writable regular file rejected')
    c=ctypes.CDLL(None,use_errno=True);c.syscall.restype=ctypes.c_long
    class Ruleset(ctypes.Structure):_fields_=[('fs',ctypes.c_uint64)]
    class Beneath(ctypes.Structure):
        _pack_=1
        _fields_=[('rights',ctypes.c_uint64),('fd',ctypes.c_int)]
    def check(value,name):
        if value<0:raise OSError(ctypes.get_errno(),name)
        return value
    abi=check(c.syscall(444,0,0,1),'Landlock ABI')
    if abi<3:raise RuntimeError('Landlock truncate mediation unavailable')
    rights=sum(1<<b for b in [1,4,5,6,7,8,9,10,11,12,13,14])
    rs=Ruleset(rights);fd=check(c.syscall(444,ctypes.byref(rs),ctypes.sizeof(rs),0),'Landlock create')
    parent=os.open(root,os.O_PATH|os.O_DIRECTORY|os.O_CLOEXEC)
    rule=Beneath(rights,parent)
    check(c.syscall(445,fd,1,ctypes.byref(rule),0),'Landlock rule')
    check(c.prctl(38,1,0,0,0),'no_new_privs')
    check(c.syscall(446,fd,0),'Landlock restrict')
    os.close(parent);os.close(fd)
    # A fixture-only default-deny syscall policy: no sockets/IPC brokers,
    # anonymous filesystem creation, descriptor import, ioctl, metadata writes
    # outside Landlock coverage, mounts, process-memory access, or new syscalls.
    # Browser compatibility is deliberately unqualified, requiring independent
    # review before this policy may be extended or used for browser acceptance.
    allowed=[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,17,18,19,20,21,22,23,24,
             25,28,32,33,35,39,40,56,57,58,59,60,61,63,72,74,75,76,77,78,79,
             80,81,82,83,84,85,86,87,88,89,96,97,98,99,100,102,104,107,108,
             110,111,115,118,120,127,128,130,131,158,186,201,202,204,213,217,
             218,219,221,228,229,230,231,232,233,247,257,258,262,263,264,265,266,
             267,269,270,271,273,275,276,278,281,285,291,292,293,302,316,
             318,322,326,332,334,435,439,441,449]
    class Filter(ctypes.Structure):_fields_=[('code',ctypes.c_ushort),('jt',ctypes.c_ubyte),('jf',ctypes.c_ubyte),('k',ctypes.c_uint)]
    class Program(ctypes.Structure):_fields_=[('len',ctypes.c_ushort),('filter',ctypes.POINTER(Filter))]
    ins=[(0x20,0,0,4),(0x15,1,0,0xc000003e),(0x06,0,0,0x80000000),
         (0x20,0,0,0),(0x45,0,1,0x40000000),(0x06,0,0,0x80000000)]
    for syscall in allowed:ins.extend([(0x15,0,1,syscall),(0x06,0,0,0x7fff0000)])
    ins.append((0x06,0,0,0x00050000|1))
    filters=(Filter*len(ins))(*(Filter(*i) for i in ins));program=Program(len(ins),filters)
    check(c.prctl(22,2,ctypes.byref(program),0,0),'seccomp install')
    resource.setrlimit(resource.RLIMIT_CORE,(0,0))


if __name__=='__main__':
    restrict(sys.argv[1]);os.execvp(sys.argv[2],sys.argv[2:])
