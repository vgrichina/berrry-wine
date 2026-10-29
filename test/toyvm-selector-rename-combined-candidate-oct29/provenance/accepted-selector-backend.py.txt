#!/usr/bin/env python3
"""Experimental synchronous FUSE storage domain; never a pathname sampler.

Protocol layouts follow Linux fuse.h 7.31. This helper is NOT a safe process
confinement boundary on its own: callers must separately qualify confinement.
No browser invocation is authorized by the presence of this implementation.
"""
import array
import errno
import json
import os
import pathlib
import selectors
import socket
import stat
import struct
import subprocess
import sys

BLOCK=4096
def pack(fmt,*args): return struct.pack('<'+fmt,*args)
def unpack(fmt,data,offset=0): return struct.unpack_from('<'+fmt,data,offset)


class Backend:
    def __init__(self, root, live_limit=32768, write_limit=65536, file_limit=16384):
        self.root=pathlib.Path(root)
        if not self.root.is_absolute() or self.root.is_symlink():
            raise ValueError('absolute non-symlink mountpoint required')
        if not 8192<=live_limit<=1048576 or not 1<=write_limit<=1048576 or not 1<=file_limit<=1048576:
            raise ValueError('tiny fixture backend limits required')
        self.live_limit=live_limit; self.write_limit=write_limit;self.file_limit=file_limit
        self.nodes={1:dict(mode=stat.S_IFDIR|0o700,data=bytearray(),names={},links=1,opens=0)}
        self.next=2;self.written=0;self.peak=4096;self.live=4096;self.failure=None
        self.operations=0;self.handles=0

    def state(self):
        return dict(live=self.live,peak=self.peak,written=self.written,
                    failure=self.failure,inodes=len(self.nodes),openHandles=self.handles,
                    operations=self.operations,liveLimit=self.live_limit,
                    writeLimit=self.write_limit,fileLimit=self.file_limit,
                    accounting='synchronous FUSE, direct_io, no writeback cache; 4096 metadata charge per inode plus rounded dense payload')

    def reject(self,reason):
        self.failure=self.failure or reason
        raise OSError(errno.ENOSPC,reason)

    def charge(self,delta):
        if self.live+delta>self.live_limit:self.reject('filesystem allocation limit')
        self.live+=delta;self.peak=max(self.peak,self.live)

    def collect(self,ino):
        n=self.nodes[ino]
        if not n['links'] and not n['opens']:
            self.live-=4096+((len(n['data'])+4095)//4096)*4096
            del self.nodes[ino]

    def attr(self,ino):
        n=self.nodes[ino];s=len(n['data'])
        return pack('6Q10I',ino,s,(s+4095)//4096*8,0,0,0,0,0,0,n['mode'],n['links'],os.getuid(),os.getgid(),0,4096,0)

    def entry(self,ino):return pack('4Q2I',ino,1,0,0,0,0)+self.attr(ino)

    def create(self,parent,name,mode):
        self.valid_name(name)
        n=self.nodes[parent]
        if name in n['names']:raise OSError(errno.EEXIST,'exists')
        self.charge(4096);ino=self.next;self.next+=1
        self.nodes[ino]=dict(mode=mode,data=bytearray(),names={},links=1,opens=0)
        n['names'][name]=ino
        return ino

    @staticmethod
    def valid_name(name):
        if not name or name in (b'.',b'..') or b'/' in name or len(name)>255:
            raise OSError(errno.EINVAL,'unsafe name')

    def resize(self,ino,size):
        n=self.nodes[ino];old=len(n['data'])
        if size>self.file_limit:self.reject('filesystem per-file limit')
        self.charge(((size+4095)//4096-(old+4095)//4096)*4096)
        if size>old:n['data'].extend(b'\0'*(size-old))
        else:del n['data'][size:]

    def handle(self,op,ino,data):
        self.operations+=1
        if op==26: # INIT: no WRITEBACK_CACHE, ASYNC_DIO, POSIX locks or export.
            major,minor=unpack('2I',data)
            if major!=7 or minor<31:raise OSError(errno.EPROTO,'unsupported protocol')
            return pack('4I2H2I2H8I',7,31,0,0,1,1,65536,1,0,0,*([0]*8))
        if op in (2,42):return None # FORGET/BATCH_FORGET: node storage kept to last handle/link.
        if op==1:
            name=data.split(b'\0',1)[0]
            child=self.nodes[ino]['names'].get(name)
            if child is None:raise OSError(errno.ENOENT,'not found')
            return self.entry(child)
        if op==3:return pack('2Q',0,0)+self.attr(ino)
        if op==4:
            valid=unpack('I',data)[0]
            if valid&~(1|2|4|8|16|32|64|128|256|512|1024):raise OSError(errno.EOPNOTSUPP,'setattr flags')
            if valid&8:
                size=unpack('Q',data,16)[0];growth=max(0,size-len(self.nodes[ino]['data']))
                if self.written+growth>self.write_limit:self.reject('filesystem cumulative write limit')
                self.resize(ino,size);self.written+=growth
            # chmod/chown and timestamps do not change the allocation domain.
            return pack('2Q',0,0)+self.attr(ino)
        if op==9:
            mode=unpack('I',data)[0]
            child=self.create(ino,data[8:].split(b'\0',1)[0],stat.S_IFDIR|(mode&0o777))
            return self.entry(child)
        if op==35:
            flags,mode=unpack('2I',data)
            child=self.create(ino,data[16:].split(b'\0',1)[0],stat.S_IFREG|(mode&0o777))
            self.nodes[child]['opens']+=1;self.handles+=1
            return self.entry(child)+pack('Q2I',child,1,0) # FOPEN_DIRECT_IO
        if op in (14,27):
            self.nodes[ino]['opens']+=1;self.handles+=1
            return pack('Q2I',ino,1 if op==14 else 0,0)
        if op==15:
            fh,off,size=unpack('2QI',data)
            if fh!=ino:raise OSError(errno.EBADF,'handle')
            return bytes(self.nodes[ino]['data'][off:off+size])
        if op==16:
            fh,off,size=unpack('2QI',data);payload=data[40:]
            if fh!=ino or len(payload)!=size:raise OSError(errno.EIO,'write identity/length')
            if self.failure:raise OSError(errno.ENOSPC,self.failure)
            if self.written+size>self.write_limit:self.reject('filesystem cumulative write limit')
            if off+size>self.file_limit:self.reject('filesystem per-file limit')
            self.resize(ino,max(off+size,len(self.nodes[ino]['data'])))
            self.nodes[ino]['data'][off:off+size]=payload
            self.written+=size
            return pack('2I',size,0)
        if op in (18,29):
            fh=unpack('Q',data)[0]
            if fh!=ino or self.nodes[ino]['opens']<1:raise OSError(errno.EBADF,'release identity')
            self.nodes[ino]['opens']-=1;self.handles-=1;self.collect(ino)
            return b''
        if op in (10,11):
            name=data.split(b'\0',1)[0];n=self.nodes[ino];child=n['names'].get(name)
            if child is None:raise OSError(errno.ENOENT,'unlink missing')
            if op==11 and self.nodes[child]['names']:raise OSError(errno.ENOTEMPTY,'directory not empty')
            del n['names'][name];self.nodes[child]['links']-=1;self.collect(child)
            return b''
        if op in (12,45):
            newdir=unpack('Q',data)[0];offset=8 if op==12 else 16
            if op==45 and unpack('I',data,8)[0]:raise OSError(errno.EOPNOTSUPP,'rename flags')
            old,new=data[offset:].split(b'\0')[:2];self.valid_name(old);self.valid_name(new)
            source=self.nodes[ino]['names'];dest=self.nodes[newdir]['names']
            if old not in source:raise OSError(errno.ENOENT,'rename source')
            if ino==newdir and old==new:return b''
            if new in dest:
                previous=dest[new]
                source_is_dir=stat.S_ISDIR(self.nodes[source[old]]['mode'])
                dest_is_dir=stat.S_ISDIR(self.nodes[previous]['mode'])
                if not source_is_dir and dest_is_dir:raise OSError(errno.EISDIR,'replacement is directory')
                if source_is_dir and not dest_is_dir:raise OSError(errno.ENOTDIR,'replacement is not directory')
                if self.nodes[previous]['names']:raise OSError(errno.ENOTEMPTY,'replacement directory')
                self.nodes[previous]['links']-=1;self.collect(previous)
            dest[new]=source.pop(old)
            return b''
        if op==28:
            fh,offset,size=unpack('2QI',data)
            parent=1
            if ino!=1:
                parents=[p for p,n in self.nodes.items()
                         if stat.S_ISDIR(n['mode']) and ino in n['names'].values()]
                if len(parents)!=1:
                    raise OSError(errno.EIO,'directory parent is not unique')
                parent=parents[0]
            names=[(b'.',ino),(b'..',parent)]+list(self.nodes[ino]['names'].items());out=b''
            for i,(name,child) in enumerate(names):
                if i<offset:continue
                kind=4 if stat.S_ISDIR(self.nodes[child]['mode']) else 8
                part=pack('2Q2I',child,i+1,len(name),kind)+name;part+=b'\0'*((-len(part))%8)
                if len(out)+len(part)>size:break
                out+=part
            return out
        if op in (20,25,30,34):return b'' # fsync, flush, fsyncdir, access
        if op==17:return pack('5Q10I',self.live_limit//4096,(self.live_limit-self.live)//4096,(self.live_limit-self.live)//4096,256,256-len(self.nodes),4096,255,4096,*([0]*7))
        if op==38:return b''
        # Including symlink, link, mknod, fallocate, ioctl, copy_file_range,
        # lseek and xattrs: no fallback outside this storage server.
        raise OSError(errno.EOPNOTSUPP,'unsupported filesystem operation '+str(op))

    def mount(self):
        self.root.mkdir(mode=0o700)
        a,b=socket.socketpair();b.set_inheritable(True)
        p=subprocess.Popen(['/usr/bin/fusermount3','-o','rw,nosuid,nodev,fsname=toyvm-accounting,subtype=toyvm-accounting','--',str(self.root)],pass_fds=(b.fileno(),),env=dict(os.environ,_FUSE_COMMFD=str(b.fileno())),stdout=subprocess.PIPE,stderr=subprocess.PIPE)
        b.close();a.settimeout(5)
        data,anc,flags,addr=a.recvmsg(1,socket.CMSG_SPACE(4));a.close()
        out,err=p.communicate(timeout=10)
        if p.returncode:raise RuntimeError('FUSE mount denied: '+err.decode())
        fds=array.array('i')
        for level,kind,data in anc:
            if level==socket.SOL_SOCKET and kind==socket.SCM_RIGHTS:fds.frombytes(data[:len(data)//4*4])
        if len(fds)!=1:raise RuntimeError('FUSE mount descriptor unavailable')
        self.fd=fds[0]

    def serve(self,status_path):
        control=None;sel=None
        try:
            control=socket.socket(socket.AF_UNIX);control.bind(str(status_path));control.listen(1)
            sel=selectors.DefaultSelector();sel.register(control,selectors.EVENT_READ);sel.register(self.fd,selectors.EVENT_READ)
            while True:
                for key,mask in sel.select(1):
                    if key.fileobj is control:
                        conn,_=control.accept()
                        with conn:conn.sendall(json.dumps(self.state()).encode())
                    else:
                        raw=os.read(self.fd,131072)
                        if not raw:return
                        length,op,unique,ino,uid,gid,pid,padding=unpack('2I2Q4I',raw)
                        if length!=len(raw):raise RuntimeError('FUSE request truncated')
                        try:answer=self.handle(op,ino,raw[40:]);error=0
                        except OSError as e:answer=b'';error=-e.errno
                        except BaseException as e:
                            self.failure='filesystem protocol failure: '+repr(e);answer=b'';error=-errno.EIO
                        if answer is not None:os.write(self.fd,pack('IiQ',16+len(answer),error,unique)+answer)
        finally:
            try:
                if sel is not None:
                    sel.close()
            finally:
                try:
                    if control is not None:control.close()
                finally:
                    os.close(self.fd)


if __name__=='__main__':
    backend=Backend(sys.argv[1],*map(int,sys.argv[3:]))
    backend.mount();backend.serve(sys.argv[2])
