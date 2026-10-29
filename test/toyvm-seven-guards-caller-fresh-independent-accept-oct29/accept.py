#!/usr/bin/python3
"""Independent source/local-wire oracle. Never call the returned adapter."""
import copy, errno, hashlib, importlib.util, json, marshal, os, pathlib, struct
import subprocess, sys, tempfile, types
from unittest.mock import patch

HERE=pathlib.Path(__file__).resolve().parent
REPO=HERE.parents[1]
TASK=REPO.parent
DISPATCH=pathlib.Path('/home/user/wine-assembly/scratch/usage-watch/toyvm-seven-guards-caller-fresh-independent-accept-oct29-dispatch.json')
C='test/toyvm-bounded24-caller-wiring-oct28/qualify_accounted.py'
A='test/toyvm-kernel-profile-accounting-backend-oct28/supervise_accounted.py'
F='test/toyvm-kernel-profile-accounting-backend-oct28/fuse_backend.py'
OLD='cc2dc7ab2f9b5d1b84b755c61e7a6ffc3e226d52ffe008edf7ace5310cbdc105'
NEW='b8201b2c4a1d0e1fd653bb02fda7870f626d3781bed014657fb974cc24e41c40'
checks=[]; child_attempts=[]
def pin(path):
    b=path.read_bytes(); return dict(bytes=len(b),sha256=hashlib.sha256(b).hexdigest())
def ok(name,condition=True):
    assert condition,name
    checks.append(name)
def module(source,path,name):
    spec=importlib.util.spec_from_file_location(name,path)
    m=importlib.util.module_from_spec(spec)
    exec(compile(source,str(path),'exec',dont_inherit=True),m.__dict__)
    return m

def forbidden(*args,**kwargs):
    child_attempts.append(repr(args)[:100])
    raise AssertionError('ALL actual children/mounts forbidden')

def identity(fn,root):
    # Independent identity oracle: exact code object, defaults and module provenance.
    expected=module((REPO/A).read_bytes(),root/A,'independent_expected_adapter').supervise_accounted
    assert isinstance(fn,types.FunctionType)
    assert marshal.dumps(fn.__code__)==marshal.dumps(expected.__code__)
    assert fn.__defaults__==expected.__defaults__ and fn.__kwdefaults__==expected.__kwdefaults__
    assert fn.__module__=='accepted_accounted_adapter'
    assert fn.__globals__['HERE']==(root/A).parent.resolve()
    return True

def main():
    d=json.loads(DISPATCH.read_text()); rp=pathlib.Path(d['canonicalReceipt'])
    ok('canonical receipt hash',pin(rp)==d['canonicalReceiptPin'])
    receipt=json.loads(rp.read_text())
    for key in ('limitModule','taskSupervisor','pythonExecutable'):
        ok(key+' pin',pin(pathlib.Path(d[key]))==d[key+'Pin'])
    before={p:pin(REPO/p) for p in d['sourcePins']}
    ok('all five exact production pins',before==d['sourcePins'])
    artifact_pins={}
    for name in ('source-pins.json','accept.py','REPORT.md','results.json'):
        p=TASK/'inputs/migration-tests'/name
        expected=receipt['artifacts']['test/toyvm-accepted-seven-guards-caller-migration-oct29/'+name]
        ok('immutable migration artifact '+name,pin(p)==expected); artifact_pins[str(p)]=pin(p)
    ns=TASK/'inputs/namespace-acceptance.json'
    ok('namespace receipt hash',pin(ns)['sha256']==receipt['inputAcceptanceReceipt']['sha256'])
    namespace=json.loads(ns.read_text())
    ok('independently accepted namespace identity',namespace['afterSourcePins'][F]['sha256']==NEW)
    old=TASK/'inputs/caller-before.txt'
    ok('accepted byte-safe caller hash',pin(old)==receipt['beforeSourcePins'][C])
    source=(REPO/C).read_bytes()
    ok('caller ONLY backend SHA delta',old.read_bytes().count(OLD.encode())==1 and source==old.read_bytes().replace(OLD.encode(),NEW.encode()))
    caller=module(source,REPO/C,'independent_actual_caller')
    # Earliest behavioral boundary: actual pinned caller, actual untouched files.
    ok('actual production load_backend genuine identity',identity(caller.load_backend(),REPO))
    # Private filesystem copies retain exact paths/bytes; only function ROOT changes.
    with tempfile.TemporaryDirectory(prefix='private-',dir=HERE) as tmp:
        root=pathlib.Path(tmp)
        for rel in before:
            dst=root/rel; dst.parent.mkdir(parents=True,exist_ok=True); dst.write_bytes((REPO/rel).read_bytes())
        caller.ROOT=root
        for rel in caller.BACKEND_PINS:
            path=root/'test'/rel; original=path.read_bytes();path.write_bytes(original+b'\n# tamper\n')
            try:
                try: caller.load_backend()
                except RuntimeError as e: ok('failclosed tamper '+rel,'identity mismatch' in str(e))
                else: raise AssertionError('accepted tampered '+rel)
            finally:path.write_bytes(original)
        ok('external caller pin rejects tamper',hashlib.sha256(source+b'\n# tamper').hexdigest()!=before[C]['sha256'])
        adapter=root/A; original=adapter.read_bytes()
        evil=b'def supervise_accounted(*a, **k): return "SUBSTITUTED"\n'
        code=compile(evil,str(adapter),'exec')
        cache=pathlib.Path(importlib.util.cache_from_source(str(adapter)));cache.parent.mkdir(exist_ok=True)
        st=adapter.stat()
        pycs={
            'timestamp':importlib.util.MAGIC_NUMBER+struct.pack('<III',0,int(st.st_mtime),len(original))+marshal.dumps(code),
            'unchecked-hash':importlib.util.MAGIC_NUMBER+struct.pack('<I',1)+importlib.util.source_hash(original)+marshal.dumps(code),
        }
        for kind,data in pycs.items():
            cache.write_bytes(data)
            ok(kind+' pyc cannot substitute',identity(caller.load_backend(),root))
        poison=types.ModuleType('accepted_accounted_adapter');poison.supervise_accounted=lambda:None
        with patch.dict(sys.modules,{'accepted_accounted_adapter':poison}):
            ok('sys.modules poison cannot substitute',identity(caller.load_backend(),root))
        read=pathlib.Path.read_bytes
        def replace_after_read(path):
            data=read(path)
            if path==adapter:adapter.write_bytes(evil)
            return data
        try:
            with patch.object(pathlib.Path,'read_bytes',replace_after_read):
                fn=caller.load_backend()
            ok('replacement after checked read cannot substitute',identity(fn,root))
        finally:adapter.write_bytes(original)
        # Same identity oracle must reject an intentionally vulnerable private loader.
        def legacy():
            for rel,sha in caller.BACKEND_PINS.items():
                assert hashlib.sha256((root/'test'/rel).read_bytes()).hexdigest()==sha
            spec=importlib.util.spec_from_file_location('accepted_accounted_adapter',adapter)
            m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
            return m.supervise_accounted
        for kind,data in pycs.items():
            cache.write_bytes(data)
            try:identity(legacy(),root)
            except AssertionError:ok('same oracle rejects legacy '+kind+' cache loader')
            else:raise AssertionError('legacy negative control escaped')
        cache.unlink()
        try:
            with patch.object(pathlib.Path,'read_bytes',replace_after_read):fn=legacy()
            try:identity(fn,root)
            except AssertionError:ok('same oracle rejects legacy reread loader')
            else:raise AssertionError('legacy reread negative control escaped')
        finally:adapter.write_bytes(original)
        rel=F.removeprefix('test/'); saved=caller.BACKEND_PINS[rel];caller.BACKEND_PINS[rel]=OLD
        try:
            try:caller.load_backend()
            except RuntimeError:ok('stale backend pin rejected')
            else:raise AssertionError('stale pin escaped')
        finally:caller.BACKEND_PINS[rel]=saved
    # Exact accepted backend source, no adapter invocation or transitive import.
    backend=module((REPO/F).read_bytes(),REPO/F,'independent_actual_backend')
    b=backend.Backend(HERE/'never-mounted',live_limit=262144,write_limit=65536,file_limit=16384)
    pack=lambda fmt,*v:struct.pack('<'+fmt,*v)
    init=b.handle(26,1,pack('4I',7,31,0,0))
    ok('INIT first protocol',struct.unpack_from('<2I',init)==(7,31))
    def mkdir(parent,name):
        return struct.unpack_from('<Q',b.handle(9,parent,pack('2I',0o700,0)+name+b'\0'))[0]
    def create(parent,name):
        return struct.unpack_from('<Q',b.handle(35,parent,pack('4I',0,0o600,0,0)+name+b'\0'))[0]
    def reject(name,op,ino,data,expected):
        prior=copy.deepcopy(b.__dict__)
        try:b.handle(op,ino,data)
        except OSError as e:assert e.errno==expected,(name,e)
        else:raise AssertionError('accepted invalid '+name)
        after=copy.deepcopy(b.__dict__);assert after.pop('operations')==prior.pop('operations')+1
        ok(name+' full state invariant',after==prior)
    left=mkdir(1,b'left');right=mkdir(1,b'right');sub=mkdir(left,b'sub')
    f=create(left,b'item');other=create(right,b'item')
    reject('directory cycle',12,left,pack('Q',sub)+b'sub\0cycle\0',errno.EINVAL)
    reject('invalid dot destination',12,left,pack('Q',right)+b'item\0.\0',errno.EINVAL)
    reject('rename to file parent',12,left,pack('Q',other)+b'item\0new\0',errno.ENOTDIR)
    reject('file replaces directory',12,left,pack('Q',1)+b'item\0right\0',errno.EISDIR)
    reject('missing source',12,left,pack('Q',right)+b'missing\0new\0',errno.ENOENT)
    reject('nonzero rename flags',45,left,pack('Q2I',right,1,0)+b'item\0new\0',errno.EOPNOTSUPP)
    reject('wrong release handle',18,f,pack('Q',other),errno.EBADF)
    # Positive request proves selected parent namespace, preserving the other same-name entry.
    b.handle(12,left,pack('Q',right)+b'item\0moved\0')
    ok('positive cross-parent namespace selection',b.nodes[left]['names']=={b'sub':sub} and b.nodes[right]['names']=={b'item':other,b'moved':f})
    ok('positive lookup selected destination',struct.unpack_from('<Q',b.handle(1,right,b'moved\0'))[0]==f)
    b.handle(10,right,b'moved\0')
    ok('unlinked open inode retained',f in b.nodes and b.nodes[f]['links']==0 and b.nodes[f]['opens']==1)
    b.handle(18,f,pack('Q',f))
    ok('release collects unlinked inode',f not in b.nodes)
    ok('all production files unchanged after',before=={p:pin(REPO/p) for p in before})
    ok('no actual child or mount attempted',child_attempts==[])
    result=dict(outcome='PASS_SCOPED_INDEPENDENT_ACCEPTANCE',candidate=d['candidate'],checks=checks,beforeSourcePins=before,afterSourcePins={p:pin(REPO/p) for p in before},artifactPins=artifact_pins,actualChildAttempts=child_attempts,adapterInvocations=0,transitiveAcceptance=False,priorBroadChecks=dict(requests=133,replayed=False),scope='exact load_backend and INIT-first source/local-wire handles only')
    (HERE/'results.json').write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps(dict(outcome=result['outcome'],checks=len(checks),childAttempts=0,adapterInvocations=0)))

if __name__=='__main__':
    with patch.object(subprocess,'Popen',forbidden),patch.object(os,'system',forbidden),patch.object(os,'posix_spawn',forbidden),patch.object(os,'posix_spawnp',forbidden):
        main()
