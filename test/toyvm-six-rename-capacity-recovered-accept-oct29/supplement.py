"""Second independent adversarial sequence; does not replay completed baseline."""
import errno, gzip, json, types
import accept as a
def sequence(cls):
    o=a.Oracle(cls,"detached-parent-sequence");b=o.b
    d=o.mk(1,b"d",True);f=o.mk(d,b"f");g=o.mk(d,b"g")
    payload=b"retained-destination"
    o.call("write-destination",16,g,a.P("2QI",g,0,len(payload))+bytes(20)+payload)
    for op in (45,12):
        # Invalid destination name wins over invalid parents and absent old name.
        for name in (b"",b"..",b"a/b",b"x"*256):
            o.rn(op,999,b"absent",f,name,errno.EINVAL)
            assert o.rd(d)[b"g"]==g
        if op==45:
            o.rn(op,999,b"",f,b"..",errno.EOPNOTSUPP,flags=0xffffffff)
            assert o.rd(d)[b"f"]==f
        # Both parent checks precede missing source lookup, source type precedes destination.
        o.rn(op,f,b"missing",999,b"new",errno.ENOTDIR)
        o.rn(op,d,b"missing",g,b"new",errno.ENOTDIR)
        o.rn(op,d,b"missing",999,b"new",errno.ENOENT)
        o.rn(op,d,b"f",d,b"ok")
        o.rn(op,d,b"ok",d,b"f")
    prior=b.live
    o.rn(12,d,b"f",d,b"g")
    assert b.live==prior and b.nodes[g]["links"]==0 and b.nodes[g]["data"]==payload
    # A detached but retained file still exists and must fail as a directory parent.
    o.rn(45,g,b"absent",999,b"n",errno.ENOTDIR)
    o.call("read-retained",15,g,a.P("2QI",g,0,4096))
    assert o.call("read-retained-content",15,g,a.P("2QI",g,0,4096))==payload
    o.release(g);assert g not in b.nodes
    o.rn(12,g,b"absent",d,b"n",errno.ENOENT)
    o.size(f,3);o.release(f);o.call("unlink-final",10,d,b"g\0")
    o.call("rmdir-final",11,1,b"d\0")
    assert list(b.nodes)==[1] and b.live==4096 and b.handles==0
    return o
def main():
    try:o=sequence(a.load().Backend)
    except Exception as e:
        (a.HERE/"rejected-source.py.txt").write_bytes(a.SOURCE.read_bytes())
        (a.HERE/"first-defect.json").write_text(json.dumps(dict(error=str(e),reproducer=a.ACTIVE.trace),indent=2))
        raise
    with gzip.open(a.HERE/"supplement-trace.json.gz","wt") as f:json.dump(o.trace,f)
    src=a.SOURCE.read_text()
    guard="                if not stat.S_ISDIR(self.nodes[parent]['mode']):raise OSError(errno.ENOTDIR,'rename parent not directory')"
    detected=[]
    for name,condition in [("source-type-only","parent!=ino"),("destination-type-only","parent!=newdir")]:
        assert src.count(guard)==1
        mutant=src.replace(guard,guard.replace("if not stat","if "+condition+" and not stat"))
        m=types.ModuleType(name);exec(compile(mutant,str(a.SOURCE)+":"+name,"exec"),m.__dict__)
        try:sequence(m.Backend)
        except AssertionError as e:detected.append(dict(mutant=name,detected=True,reason=str(e)[:250]))
        else:raise AssertionError(("survived",name))
    result=dict(outcome="PASS",requests=len(o.trace),rejections=o.rejects,mutants=detected)
    (a.HERE/"supplement-results.json").write_text(json.dumps(result,indent=2));print(json.dumps(result))
if __name__=="__main__":main()
