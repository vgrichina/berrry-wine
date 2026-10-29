#!/usr/bin/python3
"""Remaining independent valid/error regressions; does not rerun corrected group."""
import copy, errno, importlib.util, json
import reproduce as h
import pathlib
HERE=pathlib.Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('corrected',HERE/'corrected-oracle.py')
c=importlib.util.module_from_spec(spec);spec.loader.exec_module(c)
h.verify(c.PIN['sourcePins'])
spec=importlib.util.spec_from_file_location('pinned_regression',c.REPO/h.BACKEND)
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
rows=[]
for op in (12,45):
    # Open replacement inode remains live with links=0; existing handles/data intact.
    b,src,dst,node,regular=c.fresh(m.Backend)
    previous=h.create(b,dst,b'moved');h.payload(b,previous)
    before=h.snapshot(b); expected=copy.deepcopy(before)
    expected['nodes'][previous]['links']-=1
    expected['nodes'][dst]['names'][b'moved']=expected['nodes'][src]['names'].pop(b'file')
    assert b.handle(op,src,c.wire(op,dst))==b''
    assert h.snapshot(b)==expected
    assert b.nodes[previous]['opens']>0 and b.nodes[previous]['links']==0
    rows.append(dict(case='overwrite-open-file-preserves-handles-and-payload',op=op,passed=True))
    for directory,destination_directory,expected_errno in ((False,True,errno.EISDIR),(True,False,errno.ENOTDIR),(True,True,errno.ENOTEMPTY)):
        b,src,dst,node,regular=c.fresh(m.Backend,directory)
        target=h.create(b,dst,b'moved',destination_directory)
        if directory and destination_directory:h.create(b,target,b'occupant')
        _,detail=c.rejection(b,op,src,dst,expected_errno)
        rows.append(dict(case='replacement-type-or-nonempty',**detail))
    b,src,dst,node,regular=c.fresh(m.Backend,True)
    _,detail=c.rejection(b,op,src,node,errno.EINVAL)
    rows.append(dict(case='directory-cycle',**detail))
    b,src,dst,node,regular=c.fresh(m.Backend)
    before=h.snapshot(b)
    assert b.handle(op,src,c.wire(op,src,new=b'file'))==b''
    assert h.snapshot(b)==before
    rows.append(dict(case='same-name-noop',op=op,passed=True))
    # A real prior allocation failure must remain sticky across a rejected rename.
    b,src,dst,node,regular=c.fresh(m.Backend)
    try:b.charge(b.live_limit)
    except OSError as exc:assert exc.errno==errno.ENOSPC
    else:raise AssertionError('failure fixture')
    assert b.failure
    _,detail=c.rejection(b,op,src,regular,errno.ENOTDIR)
    rows.append(dict(case='sticky-existing-failure-preserved',**detail))
h.verify(c.PIN['sourcePins'])
(HERE/'regression-results.json').write_text(json.dumps(dict(status='PASS',cases=rows,productionUnchanged=True),indent=2)+'\n')
print(json.dumps(dict(status='PASS',regressionCases=len(rows),productionUnchanged=True)))
