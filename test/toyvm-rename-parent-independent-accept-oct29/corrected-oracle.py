#!/usr/bin/python3
"""Independent corrected RENAME-parent oracle; historical reproduce.py is immutable.

Wire contract: op12 uint64 destination; op45 adds uint32 flags/padding.
Names are two NUL-terminated byte strings. A missing parent means ENOENT;
a regular parent means ENOTDIR. Source parent is checked before destination;
unsupported op45 flags precede both parent checks. No kernel claim.
"""
import copy, errno, hashlib, importlib.util, json, pathlib, stat, struct
import reproduce as history
HERE = pathlib.Path(__file__).resolve().parent
REPO = HERE.parent.parent
OUT = HERE / 'corrected-results.json'
PIN = json.loads((HERE / 'source-pins.json').read_text())
records = []
def ident(p):
    b=p.read_bytes()
    return dict(bytes=len(b),sha256=hashlib.sha256(b).hexdigest())
def emit(status, **extra):
    result=dict(status=status,candidate=PIN['candidate'],cases=records,
        sourcePins=history.verify(PIN['sourcePins']),
        historicalOracle=ident(HERE/'reproduce.py'),
        provenance='Separately corrected oracle: isinstance(exc,OSError), errno and every instance variable except operations. Historical results unchanged.',
        scope='Exact repaired four-namespace backend plus RENAME parent checks; direct callbacks only',
        **extra)
    OUT.write_text(json.dumps(result,indent=2)+'\n')
def fail(detail):
    emit('COUNTEREXAMPLE', decisive=detail)
    raise SystemExit(1)
def wire(op,dst,old=b'file',new=b'moved',flags=0):
    assert op in (12,45)
    return (struct.pack('<Q',dst) if op==12 else struct.pack('<QII',dst,flags,0))+old+b'\0'+new+b'\0'
def rejection(b,op,src,dst,expected,*,flags=0,new=b'moved',mutant=False):
    before=history.snapshot(b); operations=b.operations
    data=wire(op,dst,new=new,flags=flags)
    try:
        reply=b.handle(op,src,data)
    except Exception as exc:
        actual=dict(type=type(exc).__name__,errno=getattr(exc,'errno',None),isOSError=isinstance(exc,OSError))
        ok=isinstance(exc,OSError) and exc.errno==expected
    else:
        actual=dict(type='success',replyHex=reply.hex());ok=False
    after=history.snapshot(b)
    ok=ok and before==after
    detail=dict(op=op,sourceParent=src,destinationParent=dst,flags=flags,
        expectedErrno=expected,actual=actual,snapshotPreserved=before==after,
        snapshotKeys=sorted(before),operationsDelta=b.operations-operations,requestHex=data.hex())
    if not ok and not mutant:
        detail.update(before=history.serial(before),after=history.serial(after))
        fail(detail)
    return ok,detail
def fresh(cls, directory=False,root=False):
    b=cls(HERE/'never-mounted-independent',live_limit=131072)
    src=1 if root else history.create(b,1,b'origin',True)
    dst=history.create(b,1,b'target',True)
    node=history.create(b,src,b'file',directory)
    if directory: history.create(b,node,b'child')
    else: history.payload(b,node)
    regular=history.create(b,1,b'regular-parent')
    # A live open file with payload exercises handle, data and accounting state.
    held=history.create(b,dst,b'held')
    history.payload(b,held)
    return b,src,dst,node,regular
def main():
    history.verify(PIN['sourcePins'])
    spec=importlib.util.spec_from_file_location('exact_pinned_backend',REPO/history.BACKEND)
    module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
    cls=module.Backend
    # Exact original invalid-parent setup and wire; no replay of passed valid control.
    b=cls(HERE/'never-mounted-counterexample',live_limit=65536)
    src=history.create(b,1,b'source',True);node=history.create(b,src,b'file')
    history.payload(b,node);dst=history.create(b,1,b'non-directory')
    assert wire(12,dst)==history.request(12,dst)
    ok,detail=rejection(b,12,src,dst,errno.ENOTDIR)
    records.append(dict(case='original-regular-destination-corrected-oracle',**detail))
    # Independent challenge: rich unrelated state, both invalid parents together,
    # valid root and cross-directory moves, and precedence against missing names.
    for op in (12,45):
      for directory in (False,True):
       for root in (False,True):
        for side in ('source','destination'):
         for kind in ('missing','regular'):
          b,src,dst,node,regular=fresh(cls,directory,root)
          bad=b.next+100 if kind=='missing' else regular
          s,d=(bad,dst) if side=='source' else (src,bad)
          ok,detail=rejection(b,op,s,d,errno.ENOENT if kind=='missing' else errno.ENOTDIR)
          records.append(dict(case='parent-with-unrelated-open-state',side=side,kind=kind,
                              directory=directory,root=root,**detail))
        # Valid moves preserve every variable other than the two name maps.
        b,src,dst,node,regular=fresh(cls,directory,root)
        before=history.snapshot(b); expected=copy.deepcopy(before)
        expected['nodes'][dst]['names'][b'moved']=expected['nodes'][src]['names'].pop(b'file')
        reply=b.handle(op,src,wire(op,dst))
        if reply!=b'' or history.snapshot(b)!=expected:
            fail(dict(case='valid-move',op=op,directory=directory,root=root))
        records.append(dict(case='valid-move',op=op,directory=directory,root=root,passed=True))
      for source_kind in ('missing','regular'):
       for dest_kind in ('missing','regular'):
        b,src,dst,node,regular=fresh(cls)
        src=b.next+100 if source_kind=='missing' else regular
        dst=b.next+200 if dest_kind=='missing' else regular
        ok,detail=rejection(b,op,src,dst,errno.ENOENT if source_kind=='missing' else errno.ENOTDIR)
        records.append(dict(case='simultaneous-invalid-parents',**detail))
      # A valid parent but absent source name remains ENOENT.
      b,src,dst,node,regular=fresh(cls)
      delname=wire(op,dst,old=b'absent')
      before=history.snapshot(b)
      try: b.handle(op,src,delname)
      except OSError as exc: assert exc.errno==errno.ENOENT
      else: fail(dict(case='absent-source-name',op=op))
      assert history.snapshot(b)==before
      records.append(dict(case='absent-source-name',op=op,passed=True))
    for flags in (1,2,4,0xffffffff):
        b,src,dst,node,regular=fresh(cls)
        ok,detail=rejection(b,45,b.next+100,regular,errno.EOPNOTSUPP,flags=flags)
        records.append(dict(case='unsupported-flags-before-invalid-parents',**detail))
    # Private in-memory mutants only. Removing one parent check must be caught
    # by the oracle for that position, independently for each opcode.
    source=(REPO/history.BACKEND).read_text()
    marker='for parent in (ino,newdir):'
    assert source.count(marker)==1
    mutants=[]
    for side,replacement in (('source','for parent in (newdir,):'),('destination','for parent in (ino,):')):
        private={ '__name__':'private_guard_mutant' }
        exec(compile(source.replace(marker,replacement),'<private-'+side+'-guard-removal>','exec'),private)
        for op in (12,45):
            b,src,dst,node,regular=fresh(private['Backend'])
            s,d=(regular,dst) if side=='source' else (src,regular)
            ok,detail=rejection(b,op,s,d,errno.ENOTDIR,mutant=True)
            assert not ok, ('mutant escaped',side,op)
            mutants.append(dict(removedGuard=side,caught=True,**detail))
    predecessor=json.loads((HERE/'predecessor-provenance.json').read_text())
    assert ident(HERE/'predecessor-results.json')==predecessor['repaired-results.json']
    receipt=HERE/'predecessor-completion-receipt.json'
    assert ident(receipt)==dict(bytes=639,sha256='d7ca3f0a307dc0acc40312e5b0eb34516c47aff44734ae77b172627a3152f5c3')
    old=json.loads((HERE/'predecessor-results.json').read_text())
    emit('PASS',mutants=mutants,predecessorReceipt=ident(receipt),
         reusedPredecessorResults=ident(HERE/'predecessor-results.json'),
         predecessorResultKeys=list(old),
         productionReadOnly=True,acceptanceClaim=True,
         remainingGates=['six-guard combined-source application','caller integration','mounted/runtime qualification'])
    print(json.dumps(dict(status='PASS',independentCases=len(records),mutantsCaught=len(mutants),productionUnchanged=True)))
if __name__=='__main__':main()
