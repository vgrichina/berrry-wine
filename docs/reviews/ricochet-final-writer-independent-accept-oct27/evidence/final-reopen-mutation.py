"""Strict unchanged candidate counterexample: mutate during final reopen.

The timing hook changes only an owned fixture file, never candidate code. It
runs after final enumeration's version comparison and before its second open.
The sample must reject a version change observed within its own validation.
"""
import importlib.util,pathlib,os,json,tempfile,hashlib
from unittest import mock
O=pathlib.Path(os.environ['RICOCHET_ACCEPT_OPS']);R=O.parent/'repo'
P=R/'tools/ricochet/runtime-accounting.py';expected='580a0fa000c2784f3bbfdb91ad100a6c91c1b1a558729b27756727d183f558de'
assert hashlib.sha256(P.read_bytes()).hexdigest()==expected
s=importlib.util.spec_from_file_location('exact_candidate',P);m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
def version(s):return dict(dev=s.st_dev,ino=s.st_ino,size=s.st_size,blocks=s.st_blocks,mtime_ns=s.st_mtime_ns,ctime_ns=s.st_ctime_ns,nlink=s.st_nlink)
with tempfile.TemporaryDirectory() as temp:
    root=pathlib.Path(temp);serial=root/'serial';serial.mkdir();c=serial/'continue.json';c.write_bytes(b'{}')
    ledger=m.RuntimeAccounting([root],ephemeral_files={c:24*1048576},ceiling=256*1048576)
    original=os.open;events=[];hits=[];before=version(c.stat())
    def reopen(name,flags,*args,**kwargs):
        if name=='continue.json' and kwargs.get('dir_fd') is not None:
            hits.append(1)
            events.append(dict(event='control_read_open',ordinal=len(hits),before=version(c.stat())))
            if len(hits)==2:
                c.write_bytes(b'{"changedDuringFinalReopen":true}')
                events.append(dict(event='same_inode_mutation_before_final_open',after=version(c.stat())))
        return original(name,flags,*args,**kwargs)
    accepted=None;failure=None
    with mock.patch.object(os,'open',reopen):
        try:accepted=ledger.sample()
        except (m.AccountingError,OSError) as e:failure=dict(type=type(e).__name__,message=str(e))
    after=version(c.stat())
    assert len(hits)==2 and before['ino']==after['ino'] and before!=after
    result=dict(candidate='93fce294621b5f40a1a23f6711c555dc5159e554',source=str(P),sourceSHA256=expected,events=events,before=before,after=after,error=failure,accepted=None if accepted is None else dict(bytes=accepted['bytes'],sizes={str(k):v for k,v in accepted['sizes'].items()}),receipt=ledger.receipt,controlReserve=24*1048576,totalCeiling=256*1048576,mutation='synchronous owned-file write before second real control os.open; inside final _file validation and before sample return',fixtureCleanup='TemporaryDirectory exit')
    (O/'counterexample.json').write_text(json.dumps(result,indent=2))
    print(json.dumps(dict(rejected=failure is not None,acceptedBytes=ledger.receipt['lastBytes'],sameInode=True,versionChanged=True,controlOpenCount=len(hits))))
    assert failure is not None and accepted is None and ledger.receipt['lastBytes'] is None,'REJECT CANDIDATE: final reopen observed changed control version yet returned accepted inventory'
