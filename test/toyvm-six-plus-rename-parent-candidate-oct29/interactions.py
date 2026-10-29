#!/usr/bin/python3
"""Candidate interaction evidence only; no mount, caller migration, or independent acceptance.
Run from the owned repository through the prescribed ops.py supervisor.
Snapshots include every Backend instance field; only operations += 1 is allowed
on a rejected handle request. Mutants remain in private module dictionaries.
"""
import copy
import errno
import gzip
import hashlib
import json
from pathlib import Path
import stat
import struct
import sys
import types

HERE=Path(__file__).resolve().parent
SOURCE=HERE.parent/'toyvm-kernel-profile-accounting-backend-oct28/fuse_backend.py'
def sha(b):return hashlib.sha256(b).hexdigest()
def encode(x):
    if isinstance(x,(bytes,bytearray)):return {'hex':bytes(x).hex()}
    if isinstance(x,Path):return str(x)
    if isinstance(x,dict):return [[encode(k),encode(v)] for k,v in sorted(x.items(),key=lambda t:repr(t[0]))]
    if isinstance(x,(list,tuple)):return [encode(v) for v in x]
    return x

def exercise(source,trace):
    mod=types.ModuleType('private_backend');mod.__file__=str(SOURCE)
    exec(compile(source,str(SOURCE),'exec'),mod.__dict__)
    b=mod.Backend(HERE/'unmounted-fixture',live_limit=1048576,write_limit=1048576,file_limit=16384)
    pack=mod.pack
    def call(label,op,ino=1,data=b'',error=None):
        before=copy.deepcopy(vars(b)); result=None; actual=None
        try:result=b.handle(op,ino,data)
        except Exception as exc:
            actual=dict(type=type(exc).__name__,isOSError=isinstance(exc,OSError),errno=getattr(exc,'errno',None),text=str(exc))
        after=copy.deepcopy(vars(b))
        row=dict(label=label,op=op,ino=ino,payload=data.hex(),expectedErrno=error,actual=actual,before=encode(before),after=encode(after),result=encode(result))
        trace.append(row)
        if error is None:assert actual is None,(label,actual)
        else:
            assert actual is not None and actual['isOSError'] and actual['errno']==error,(label,error,actual)
            expected=copy.deepcopy(before);expected['operations']+=1
            assert after==expected,(label,'rejection changed complete state')
        return result
    def mkdir(name,parent=1):return struct.unpack_from('<Q',call('mkdir '+repr(name),9,parent,pack('2I',0o700,0)+name+b'\0'))[0]
    def create(name,parent=1):return struct.unpack_from('<Q',call('create '+repr(name),35,parent,pack('4I',0,0o600,0,0)+name+b'\0'))[0]
    def rename(label,op,src,dst,old,new,error=None,flags=0):
        return call(label,op,src,(pack('Q',dst) if op==12 else pack('Q2I',dst,flags,0))+old+b'\0'+new+b'\0',error)
    def write(ino,data):call('write '+str(ino),16,ino,pack('2Q6I',ino,0,len(data),0,0,0,0,0)+data)
    def read(ino):return call('read '+str(ino),15,ino,pack('2QI',ino,0,16384))
    def release(ino):call('release '+str(ino),18,ino,pack('Q',ino))
    def readdir(ino):
        data=call('readdir '+str(ino),28,ino,pack('2QI',ino,0,4096)); entries={};offset=0
        while offset<len(data):
            child,nxt,n,kind=struct.unpack_from('<2Q2I',data,offset)
            name=data[offset+24:offset+24+n];entries[name]=(child,kind);offset+=(24+n+7)//8*8
        return entries
    # Production initializer and exact handle dispatch, no hand-built Backend object.
    call('INIT first',26,1,pack('2I',7,31))
    directory=mkdir(b'd');sub=mkdir(b'sub',directory)
    file=create(b'f');write(file,b'original payload')
    target=create(b'target');write(target,b'overwritten open payload')
    marker=create(b'marker-a');current=b'marker-a'
    missing=999999
    for op in (35,9):
        for parent,code in ((missing,errno.ENOENT),(file,errno.ENOTDIR)):
            payload=(pack('4I',0,0o600,0,0) if op==35 else pack('2I',0o700,0))+b'invalid-child\0'
            call('invalid create/mkdir parent',op,parent,payload,code)
            call('unlink dir stays EISDIR',10,1,b'd\0',errno.EISDIR)
    size=bytearray(88);struct.pack_into('<I',size,0,8|2048);struct.pack_into('<Q',size,16,8193)
    call('SETATTR size and unsupported bit rejects before growth',4,file,bytes(size),errno.EOPNOTSUPP)
    assert read(file)==b'original payload'
    call('rmdir file stays ENOTDIR',11,1,b'f\0',errno.ENOTDIR)
    # Interleave each new-parent rejection with a valid rename, old guard and READDIR.
    for op in (12,45):
        for role,src,dst,code in (
            ('source missing',missing,1,errno.ENOENT),('source file',file,1,errno.ENOTDIR),
            ('destination missing',1,missing,errno.ENOENT),('destination file',1,file,errno.ENOTDIR)):
            rename(role,op,src,dst,current,b'next',code)
            new=b'marker-b' if current==b'marker-a' else b'marker-a'
            rename('valid rename after parent rejection',op,1,1,current,new);current=new
            assert readdir(sub)[b'..']==(directory,4)
            call('rmdir nonempty stays ENOTEMPTY',11,1,b'd\0',errno.ENOTEMPTY)
        rename('source parent validated before destination',op,file,missing,b'x',b'y',errno.ENOTDIR)
        rename('destination parent before missing source',op,1,file,b'absent',b'y',errno.ENOTDIR)
        rename('missing source with valid parents',op,1,directory,b'absent',b'y',errno.ENOENT)
        rename('old name precedes parent',op,missing,file,b'.',b'y',errno.EINVAL)
        rename('new name precedes parent',op,missing,file,b'x',b'..',errno.EINVAL)
        rename('invalid parents before same-name no-op',op,file,file,b'x',b'x',errno.ENOTDIR)
        rename('file over directory',op,1,1,b'f',b'd',errno.EISDIR)
        rename('directory over file',op,1,1,b'd',b'f',errno.ENOTDIR)
        rename('cycle remains rejected',op,1,sub,b'd',b'cycle',errno.EINVAL)
        rename('valid same-name no-op',op,1,1,current,current)
    rename('RENAME2 flags precede parents and names',45,missing,file,b'.',b'..',errno.EOPNOTSUPP,1)
    rename('RENAME2 flags precede valid names bad parents',45,file,missing,b'x',b'y',errno.EOPNOTSUPP,2)
    # Overwrite an open file after all rejections: payload/charges retained until release.
    old_live=b.live; old_handles=b.handles; old_written=b.written
    rename('valid overwrite after mixed rejections',45,1,1,b'f',b'target')
    assert b.nodes[1]['names'][b'target']==file and target in b.nodes
    assert b.nodes[target]['links']==0 and b.nodes[target]['opens']==1
    assert (b.live,b.handles,b.written)==(old_live,old_handles,old_written)
    assert read(target)==b'overwritten open payload' and read(file)==b'original payload'
    release(target)
    assert target not in b.nodes and b.live==old_live-8192 and b.handles==old_handles-1
    rename('valid directory move',12,directory,1,b'sub',b'moved')
    assert readdir(sub)[b'..']==(1,4)
    call('valid unlink open file',10,1,b'target\0')
    assert file in b.nodes and read(file)==b'original payload'
    release(file);assert file not in b.nodes
    call('valid rmdir moved directory',11,1,b'moved\0');assert sub not in b.nodes
    call('valid rmdir emptied directory',11,1,b'd\0');assert directory not in b.nodes
    assert b.failure is None
    return dict(requests=len(trace),rejections=sum(t['expectedErrno'] is not None for t in trace),finalState=encode(vars(b)))

def main():
    source=SOURCE.read_text(); gate=json.loads((HERE/'source-gate.json').read_text())
    assert sha(source.encode())==gate['candidateSHA256']
    trace=[]
    try:baseline=exercise(source,trace)
    finally:
        with gzip.open(HERE/'interactions.json.gz','wt') as f:json.dump(trace,f,separators=(',',':'))
    mutants={}
    for role,var in [('source','ino'),('destination','newdir')]:
        for predicate,line in [('missing',"if parent not in self.nodes:"),('type',"if not stat.S_ISDIR(self.nodes[parent]['mode']):")]:
            replacement='if parent != '+var+' and '+line[3:]
            assert source.count(line)==1
            mutants[role+'-'+predicate]=source.replace(line,replacement,1)
    line="        if n is None:raise OSError(errno.ENOENT,'parent missing')\n"
    assert source.count(line)==1;mutants['old-create-missing']=source.replace(line,'',1)
    line="        if not stat.S_ISDIR(n['mode']):raise OSError(errno.ENOTDIR,'parent non-directory')\n"
    assert source.count(line)==1;mutants['old-create-type']=source.replace(line,'',1)
    line="            if valid&~(1|2|4|8|16|32|64|128|256|512|1024):raise OSError(errno.EOPNOTSUPP,'setattr flags')\n"
    assert source.count(line)==1;mutants['old-setattr-early-flags']=source.replace(line,'',1)
    results={}
    for name,mutant in mutants.items():
        trace=[];detected=None
        try:exercise(mutant,trace)
        except AssertionError as exc:detected=str(exc)
        with gzip.open(HERE/('mutant-'+name+'.json.gz'),'wt') as f:json.dump(dict(sourceSHA256=sha(mutant.encode()),detected=detected,trace=trace),f,separators=(',',':'))
        assert detected is not None,('mutant escaped',name)
        results[name]=dict(detected=detected,requests=len(trace),lastLabel=trace[-1]['label'],sourceSHA256=sha(mutant.encode()))
    assert SOURCE.read_text()==source,'private mutants changed production'
    result=dict(status='PASS_CANDIDATE_INTERACTIONS',baseline=baseline,mutants=results,independentCombinedAcceptance=False,callerMigration=False,mountedExecution=False,oldSuitesReplayed=False,snapshotPolicy='all Backend instance fields; only operations increment by one on rejection')
    (HERE/'interaction-summary.json').write_text(json.dumps(result,indent=2))
    print(json.dumps(dict(status=result['status'],requests=baseline['requests'],rejections=baseline['rejections'],mutantsDetected=len(results))))
if __name__=='__main__':main()
