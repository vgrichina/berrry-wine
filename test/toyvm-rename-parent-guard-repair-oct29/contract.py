#!/usr/bin/env python3
"""Direct callback contract; no kernel/mount acceptance claim."""
import copy, errno, hashlib, json, pathlib, stat, struct, types
from reproduce import create, payload, request, snapshot, BACKEND, serial
HERE=pathlib.Path(__file__).resolve().parent
REPO=HERE.parent.parent
SOURCE=(REPO/BACKEND).read_text()
RESULT=dict(scope='direct callbacks may exceed kernel-reachable requests',
            normalization='deepcopy every Backend instance variable except operations',
            productionSha256=hashlib.sha256(SOURCE.encode()).hexdigest(),
            cases=[],controls=[],acceptanceClaim=False)
def load(source):
    module=types.ModuleType('private_backend')
    exec(compile(source,BACKEND,'exec'),module.__dict__)
    return module.Backend
CLS=load(SOURCE)
def fresh(cls=CLS):
    return cls(HERE/'never-mounted',live_limit=131072)
def reject(b,op,parent,wire,code):
    before=snapshot(b); calls=b.operations
    try: b.handle(op,parent,wire)
    except OSError as e: assert e.errno==code, (e.errno,code)
    else: raise AssertionError('unexpected rename success')
    assert snapshot(b)==before, 'rejection mutated Backend'
    assert b.operations==calls+1

def parent_case(op,directory,root,side,kind,cls=CLS):
    b=fresh(cls)
    source=1 if root else create(b,1,b'source',True)
    destination=create(b,1,b'destination',True)
    moved=create(b,source,b'file',directory)
    if directory: create(b,moved,b'child')
    else: payload(b,moved)
    bad=create(b,1,b'regular') if kind=='regular' else 99999
    if side=='source': source=bad
    else: destination=bad
    reject(b,op,source,request(op,destination),errno.ENOTDIR if kind=='regular' else errno.ENOENT)

def run():
    for op in (12,45):
        for directory in (False,True):
            for root in (False,True):
                for side in ('source','destination'):
                    for kind in ('regular','missing'):
                        parent_case(op,directory,root,side,kind)
                        RESULT['cases'].append(dict(op=op,sourceDirectory=directory,rootSource=root,parent=side,kind=kind,passed=True))
        for directory in (False,True):
            b=fresh(); src=create(b,1,b'source',True); dst=create(b,1,b'destination',True)
            moved=create(b,src,b'file',directory)
            if directory: create(b,moved,b'child')
            else: payload(b,moved)
            before=snapshot(b); expected=copy.deepcopy(before)
            expected['nodes'][dst]['names'][b'moved']=expected['nodes'][src]['names'].pop(b'file')
            assert b.handle(op,src,request(op,dst))==b''
            assert snapshot(b)==expected
            RESULT['cases'].append(dict(op=op,case='valid-crossdirectory-directory' if directory else 'valid-crossdirectory-file',passed=True))
            # Successful overwrite preserves the open replaced file until release.
            b=fresh(); moved=create(b,1,b'file',directory); replaced=create(b,1,b'moved',directory)
            if not directory: payload(b,moved); payload(b,replaced)
            assert b.handle(op,1,request(op,1))==b''
            assert b.nodes[1]['names']=={b'moved':moved}
            if directory: assert replaced not in b.nodes
            else:
                assert b.nodes[replaced]['links']==0 and b.nodes[replaced]['opens']==1
                assert bytes(b.nodes[replaced]['data'])==b'preserved payload'
                b.handle(18,replaced,struct.pack('<Q',replaced))
                assert replaced not in b.nodes
            RESULT['cases'].append(dict(op=op,case='overwrite-directory' if directory else 'overwrite-open-file',passed=True))
        # Existing type, nonempty and cycle guards, each with a full snapshot.
        for source_dir,dest_dir,nonempty,code in ((False,True,False,errno.EISDIR),(True,False,False,errno.ENOTDIR),(True,True,True,errno.ENOTEMPTY)):
            b=fresh(); create(b,1,b'file',source_dir); target=create(b,1,b'moved',dest_dir)
            if nonempty: create(b,target,b'child')
            reject(b,op,1,request(op,1),code)
            RESULT['cases'].append(dict(op=op,case='replacement-guard',errno=code,passed=True))
        b=fresh(); moved=create(b,1,b'file',True); child=create(b,moved,b'child',True)
        reject(b,op,1,request(op,child),errno.EINVAL)
        reject(b,op,1,request(op,moved),errno.EINVAL)
        RESULT['cases'].append(dict(op=op,case='cycle-self-and-descendant',passed=True))
        b=fresh(); create(b,1,b'file'); before=snapshot(b)
        assert b.handle(op,1,request(op,1,b'file',b'file'))==b'' and snapshot(b)==before
        reject(b,op,1,request(op,1,b'absent'),errno.ENOENT)
        reject(b,op,99999,request(op,99999,b'.'),errno.EINVAL)
        RESULT['cases'].append(dict(op=op,case='noop-missing-name-and-name-precedence',passed=True))
    # Unknown flags must still precede invalid parents and names.
    b=fresh(); wire=struct.pack('<QII',99999,1,0)+b'.\0bad\0'
    reject(b,45,99999,wire,errno.EOPNOTSUPP)
    RESULT['cases'].append(dict(op=45,case='unknown-flags-precedence',passed=True))
    # Private source-copy controls remove one parent check at a time. No production mutation.
    needle='for parent in (ino,newdir):'
    assert SOURCE.count(needle)==1
    for side,replacement in (('source','for parent in (newdir,):'),('destination','for parent in (ino,):')):
        mutant=load(SOURCE.replace(needle,replacement))
        for kind in ('regular','missing'):
            detected=False
            try: parent_case(12,False,False,side,kind,mutant)
            except (AssertionError,KeyError): detected=True
            assert detected, ('undetected removed parent guard',side,kind)
            RESULT['controls'].append(dict(removed=side,kind=kind,detected=True))
    assert (REPO/BACKEND).read_text()==SOURCE
    RESULT['status']='PASS'
if __name__=='__main__':
    try: run()
    except Exception as exc:
        RESULT['status']='FIRST_UNEXPECTED_COUNTEREXAMPLE'; RESULT['error']=repr(exc)
        (HERE/'repaired-results.json').write_text(json.dumps(RESULT,indent=2)+'\n')
        raise
    (HERE/'repaired-results.json').write_text(json.dumps(RESULT,indent=2)+'\n')
    print(json.dumps(dict(status=RESULT['status'],cases=len(RESULT['cases']),privateControls=len(RESULT['controls']))))
