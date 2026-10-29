#!/usr/bin/env python3
"""Independent direct production callback acceptance; never mounts FUSE."""
import copy, errno, gzip, hashlib, importlib.util, json, pathlib, stat, struct, sys
HERE=pathlib.Path(__file__).resolve().parent
REPO=HERE.parents[1]
SOURCE=REPO/'test/toyvm-kernel-profile-accounting-backend-oct28/fuse_backend.py'
PIN='cc2dc7ab2f9b5d1b84b755c61e7a6ffc3e226d52ffe008edf7ace5310cbdc105'
def pack(fmt,*args): return struct.pack('<'+fmt,*args)
def snapshot(b):
    def normal(v):
        if isinstance(v,(bytes,bytearray)): return {'hex':bytes(v).hex()}
        if isinstance(v,pathlib.Path): return str(v)
        if isinstance(v,dict): return {str(k) if not isinstance(k,bytes) else 'hex:'+k.hex():normal(x) for k,x in v.items()}
        return v
    return normal(vars(b))
class Check:
    def __init__(self, backend): self.b=backend;self.rows=[]
    def call(self,label,op,ino,data=b'',error=None):
        before=snapshot(self.b);reply=None;exc=None
        try: reply=self.b.handle(op,ino,data)
        except Exception as e: exc=e
        after=snapshot(self.b)
        row=dict(label=label,op=op,ino=ino,input=data.hex(),expectedErrno=error,
                 actualErrno=getattr(exc,'errno',None),exception=repr(exc) if exc else None,
                 before=before,after=after,reply=reply.hex() if isinstance(reply,bytes) else reply)
        self.rows.append(row)
        if error is not None:
            expected=copy.deepcopy(before);expected['operations']+=1
            assert isinstance(exc,OSError) and exc.errno==error,(label,'errno',row)
            assert after==expected,(label,'rejection changed full state',row)
        else: assert exc is None,(label,'valid control failed',row)
        return reply
    def mkdir(self,p,n): return struct.unpack_from('<Q',self.call('mkdir '+n.decode(),9,p,pack('2I',0o700,0)+n+b'\0'))[0]
    def create(self,p,n): return struct.unpack_from('<Q',self.call('create '+n.decode(),35,p,pack('4I',0,0o600,0,0)+n+b'\0'))[0]
    def rename(self,op,p,n,q,m,error=None):
        return self.call('rename '+str(op)+' '+n.decode()+'->'+m.decode(),op,p,pack('Q',q)+(pack('2I',0,0) if op==45 else b'')+n+b'\0'+m+b'\0',error)
    def ls(self,ino,parent):
        raw=self.call('readdir parent invariant',28,ino,pack('2QI',ino,0,4096))
        entries=[];i=0
        while i<len(raw):
            child,off,n,kind=struct.unpack_from('<2Q2I',raw,i)
            entries.append((raw[i+24:i+24+n],child,off,kind));i+=(24+n+7)//8*8
        assert entries[:2]==[(b'.',ino,1,4),(b'..',parent,2,4)],entries
        return entries
def scenario(cls):
    c=Check(cls('/tmp/toyvm-independent-callback-unmounted',262144,65536,16384))
    try:
        init=c.call('production INIT earliest boundary',26,1,pack('2I',7,31))
        assert struct.unpack_from('<2I',init)==(7,31)
        a=c.mkdir(1,b'a'); b=c.mkdir(1,b'b'); moved=c.mkdir(a,b'moved')
        leaf=c.mkdir(moved,b'leaf'); f=c.create(a,b'f'); g=c.create(b,b'g')
        c.call('write valid',16,f,pack('2QI',f,0,3)+bytes(20)+b'abc')
        assert c.call('read valid',15,f,pack('2QI',f,0,3))==b'abc'
        assert bytes(c.b.nodes[f]['data'])==b'abc'
        for op in (12,45):
            c.rename(op,a,b'f',a,b'moved',errno.EISDIR)
            c.call('unlink dir type',10,a,b'moved\0',errno.EISDIR)
            c.rename(op,a,b'moved',b,b'g',errno.ENOTDIR)
            c.call('rmdir file type',11,b,b'g\0',errno.ENOTDIR)
            c.rename(op,a,b'moved',leaf,b'cycle',errno.EINVAL)
            c.rename(op,a,b'moved',moved,b'self',errno.EINVAL)
        c.call('rmdir nonempty',11,a,b'moved\0',errno.ENOTEMPTY)
        c.call('mkdir existing file collision',9,a,pack('2I',0o700,0)+b'f\0',errno.EEXIST)
        c.call('create existing dir collision',35,a,pack('4I',0,0o600,0,0)+b'moved\0',errno.EEXIST)
        c.call('create non-dir parent',35,f,pack('4I',0,0o600,0,0)+b'x\0',errno.ENOTDIR)
        c.call('mkdir absent parent',9,999999,pack('2I',0o700,0)+b'x\0',errno.ENOENT)
        c.ls(moved,a)
        c.rename(12,a,b'moved',b,b'arrived');c.ls(moved,b);c.ls(leaf,moved)
        empty=c.mkdir(a,b'empty');full=c.mkdir(a,b'full'); inside=c.create(full,b'inside')
        c.rename(45,b,b'arrived',a,b'full',errno.ENOTEMPTY)
        c.call('setattr rejected combined size flag',4,f,pack('2I2Q',2048|8,0,f,20),errno.EOPNOTSUPP)
        c.call('setattr valid growth',4,f,pack('2I2Q',8,0,f,8))
        assert len(c.b.nodes[f]['data'])==8 and c.b.written==8
        c.call('setattr valid shrink',4,f,pack('2I2Q',8,0,f,2))
        c.call('setattr supported metadata control',4,f,pack('2I2Q',1,0,f,0))
        for bit in (2048,4096,1<<31):
            c.call('setattr unsupported flag '+str(bit),4,f,pack('2I2Q',bit|8,0,f,12),errno.EOPNOTSUPP)
        c.rename(45,b,b'arrived',a,b'empty');c.ls(moved,a)
        assert empty not in c.b.nodes
        c.call('remove leaf',11,moved,b'leaf\0')
        c.call('open directory valid',27,moved)
        c.call('remove now empty open directory',11,a,b'empty\0')
        c.call('readdir orphan rejects ambiguous parent',28,moved,pack('2QI',moved,0,4096),errno.EIO)
        c.call('release directory collect',29,moved,pack('Q',moved))
        assert moved not in c.b.nodes
        replacement=c.mkdir(a,b'empty');c.ls(replacement,a)
        c.call('unlink open file retains inode',10,a,b'f\0')
        assert c.b.nodes[f]['links']==0 and c.b.nodes[f]['opens']==1
        c.call('release file collects',18,f,pack('Q',f));assert f not in c.b.nodes
        c.ls(1,1)
        return c.rows,None
    except Exception as e:
        return c.rows,str(e.args[0]) if e.args else repr(e)
def mutant(text,kind):
    if kind=='rename-type':
        old="                if not source_is_dir and dest_is_dir:raise OSError(errno.EISDIR,'replacement is directory')\n                if source_is_dir and not dest_is_dir:raise OSError(errno.ENOTDIR,'replacement is not directory')"
        new='                pass # private mutant removes rename type guards'
    elif kind=='rename-cycle':
        old="                    if child==newdir:raise OSError(errno.EINVAL,'rename directory cycle')";new='                    pass # private mutant removes cycle guard'
    elif kind=='remove-type':
        old="            if op==10 and stat.S_ISDIR(self.nodes[child]['mode']):raise OSError(errno.EISDIR,'unlink directory')\n            if op==11 and not stat.S_ISDIR(self.nodes[child]['mode']):raise OSError(errno.ENOTDIR,'rmdir non-directory')";new='            pass # private mutant removes removal type guards'
    elif kind=='readdir-parent':
        old="                parent=parents[0]";new='                parent=1 # private mutant removes resolved parent'
    elif kind=='create-parent':
        old="        if n is None:raise OSError(errno.ENOENT,'parent missing')\n        if not stat.S_ISDIR(n['mode']):raise OSError(errno.ENOTDIR,'parent non-directory')";new='        pass # private mutant removes create parent guards'
    elif kind=='setattr-flags':
        old="            if valid&~(1|2|4|8|16|32|64|128|256|512|1024):raise OSError(errno.EOPNOTSUPP,'setattr flags')";new='            pass # private mutant removes setattr rejection'
    else: raise ValueError(kind)
    assert text.count(old)==1,kind
    return text.replace(old,new)
def main():
    kind=sys.argv[1];output=pathlib.Path(sys.argv[2])
    raw=SOURCE.read_bytes();assert hashlib.sha256(raw).hexdigest()==PIN
    if kind=='baseline':
        spec=importlib.util.spec_from_file_location('production_backend',SOURCE)
        mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
    else:
        private=output.parent/('private-'+kind+'.py')
        private.write_text(mutant(raw.decode(),kind))
        spec=importlib.util.spec_from_file_location('private_mutant',private)
        mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
    rows,failure=scenario(mod.Backend)
    # Each mutant must fail its intended focused control, not setup.
    focus={'rename-type':'rename 12 f->moved','rename-cycle':'rename 12 moved->cycle',
           'remove-type':'unlink dir type','readdir-parent':'readdir parent invariant',
           'create-parent':'create non-dir parent','setattr-flags':'setattr rejected combined size flag'}
    passed=failure is None if kind=='baseline' else failure is not None and rows[-1]['label']==focus[kind]
    result=dict(kind=kind,PASS=passed,sourceSHA256=PIN,interface='unchanged production Backend.handle; direct wire-payload callback; no mount, no serve transport',requests=len(rows),failure=failure,rows=rows)
    output.write_bytes(gzip.compress((json.dumps(result,indent=2)+'\n').encode(),mtime=0))
    assert SOURCE.read_bytes()==raw
    print(json.dumps({k:v for k,v in result.items() if k!='rows'}))
    assert passed,'acceptance or focused mutant detection failed'
if __name__=='__main__':main()
