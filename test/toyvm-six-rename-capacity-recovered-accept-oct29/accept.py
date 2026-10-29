"""Independent exact-source Backend.handle acceptance; no transport qualification."""
import copy, errno, gzip, hashlib, importlib.util, json, pathlib, resource, stat, struct, sys, types
HERE=pathlib.Path(__file__).resolve().parent
SOURCE=HERE.parent/"toyvm-kernel-profile-accounting-backend-oct28/fuse_backend.py"
PIN="b8201b2c4a1d0e1fd653bb02fda7870f626d3781bed014657fb974cc24e41c40"
P=lambda fmt,*v:struct.pack("<"+fmt,*v)
def clean(v):
    if isinstance(v,dict):return {str(clean(k)):clean(x) for k,x in v.items()}
    if isinstance(v,(bytes,bytearray)):return {"hex":bytes(v).hex()}
    if isinstance(v,(list,tuple)):return [clean(x) for x in v]
    if isinstance(v,pathlib.Path):return str(v)
    return v
def load():
    assert hashlib.sha256(SOURCE.read_bytes()).hexdigest()==PIN
    spec=importlib.util.spec_from_file_location("independent_production",SOURCE)
    m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m
class Oracle:
    def __init__(self,cls,label):
        self.b=cls(str(HERE),live_limit=1048576,write_limit=1048576,file_limit=16384)
        global ACTIVE
        ACTIVE=self
        self.label=label;self.trace=[];self.rejects=0
        self.call("INIT-first",26,1,P("2I",7,31))
    def call(self,label,op,ino,data=b"",error=None):
        before=copy.deepcopy(vars(self.b))
        req=dict(label=label,op=op,ino=ino,data=data.hex(),expected=error)
        try:
            result=self.b.handle(op,ino,data);actual=None
        except OSError as e:actual=e.errno;result=None
        except Exception as e:actual=type(e).__name__;result=None
        after=copy.deepcopy(vars(self.b))
        req.update(actual=actual,before=clean(before),after=clean(after));self.trace.append(req)
        assert actual==error,(label,"errno",error,actual)
        if error is not None:
            expected=copy.deepcopy(before);expected["operations"]+=1
            assert after==expected,(label,"rejection mutated instance",clean(before),clean(after))
            self.rejects+=1
        self.invariants()
        return result
    def invariants(self):
        b=self.b
        assert b.handles==sum(n["opens"] for n in b.nodes.values())
        assert b.live==sum(4096+((len(n["data"])+4095)//4096)*4096 for n in b.nodes.values())
        refs={ino:0 for ino in b.nodes};refs[1]=1
        for n in b.nodes.values():
            for child in n["names"].values():assert child in refs;refs[child]+=1
        assert all(n["links"]==refs[i] for i,n in b.nodes.items())
    def mk(self,parent,name,directory=False):
        op=9 if directory else 35
        data=(P("2I",0o700,0) if directory else P("4I",0,0o600,0,0))+name+b"\0"
        out=self.call("mkdir" if directory else "create",op,parent,data)
        return struct.unpack_from("<Q",out)[0]
    def rn(self,op,a,old,b,new,error=None,flags=0):
        data=P("Q",b)+(P("2I",flags,0) if op==45 else b"")+old+b"\0"+new+b"\0"
        return self.call("rename-"+str(op),op,a,data,error)
    def size(self,ino,size,flags=8,error=None):
        self.call("setattr",4,ino,P("2I2Q",flags,0,0,size),error)
    def rd(self,ino,error=None):
        out=self.call("readdir",28,ino,P("2QI",ino,0,4096),error)
        if error:return
        rows={};offset=0
        while offset<len(out):
            child,cookie,n,kind=struct.unpack_from("<2Q2I",out,offset)
            rows[out[offset+24:offset+24+n]]=child;offset+=(24+n+7)//8*8
        return rows
    def release(self,ino,directory=False):
        self.call("release",29 if directory else 18,ino,P("Q",ino))
def scenario(cls,label):
    o=Oracle(cls,label);b=o.b
    # Earliest relevant dispatch boundary: real INIT then missing RENAME source parent.
    o.rn(12,999,b"absent",1,b"x",errno.ENOENT)
    left=o.mk(1,b"left",True);right=o.mk(1,b"right",True)
    f=o.mk(left,b"file");g=o.mk(right,b"target")
    o.size(f,7);o.size(g,4097)
    for op in (12,45):
        for a,d,e in [(999,right,errno.ENOENT),(f,right,errno.ENOTDIR),
                      (left,999,errno.ENOENT),(left,f,errno.ENOTDIR),
                      (f,999,errno.ENOTDIR),(999,f,errno.ENOENT)]:
            o.rn(op,a,b"file",d,b"x",e)
        # Names precede parents; flags precede names, parents and source.
        o.rn(op,999,b"..",f,b"",errno.EINVAL)
        o.rn(op,left,b"absent",f,b"x",errno.ENOTDIR)
        o.rn(op,left,b"absent",right,b"x",errno.ENOENT)
        if op==45:o.rn(op,999,b"..",f,b"",errno.EOPNOTSUPP,flags=1)
        o.rn(op,left,b"file",left,b"file")
        for isdir in (False,True):
            for parent,e in [(999,errno.ENOENT),(f,errno.ENOTDIR)]:
                data=(P("2I",0o700,0) if isdir else P("4I",0,0o600,0,0))+b"good\0"
                o.call("create-parent",9 if isdir else 35,parent,data,e)
                o.call("create-name-before-parent",9 if isdir else 35,parent,data[:-5]+b"..\0",errno.EINVAL)
        o.size(f,123,8|2048,errno.EOPNOTSUPP)
        o.size(f,2**40,8|2048,errno.EOPNOTSUPP)
        o.call("unlink-dir",10,1,b"left\0",errno.EISDIR)
        o.call("rmdir-file",11,left,b"file\0",errno.ENOTDIR)
        o.rn(op,left,b"file",1,b"right",errno.EISDIR)
        o.rn(op,1,b"left",right,b"target",errno.ENOTDIR)
        o.rn(op,1,b"left",left,b"cycle",errno.EINVAL)
        # Valid operations immediately after all rejection groups.
        o.size(f,8);assert len(b.nodes[f]["data"])==8
        assert o.rd(left)[b".."]==1
        o.rn(op,left,b"file",left,b"temp")
        o.rn(op,left,b"temp",left,b"file")
    # Open overwritten destination retains payload, charge and handle until release.
    prior=b.live;o.rn(45,left,b"file",right,b"target")
    assert b.nodes[g]["links"]==0 and b.nodes[g]["opens"]==1 and b.live==prior
    assert b.nodes[right]["names"][b"target"]==f and b.nodes[g]["data"]==bytearray(4097)
    o.size(g,4098);assert b.nodes[f]["data"]==bytearray(8)
    o.release(g);assert g not in b.nodes
    o.release(f);o.call("unlink-live",10,right,b"target\0")
    # Independent directory sequence, parent relocation, nonempty replacement, orphan.
    child=o.mk(left,b"child",True);leaf=o.mk(child,b"leaf",True)
    dest=o.mk(right,b"dest",True);nested=o.mk(dest,b"nested",True)
    o.rn(12,left,b"child",right,b"dest",errno.ENOTEMPTY)
    o.rn(45,left,b"child",leaf,b"descendant",errno.EINVAL)
    o.rn(12,left,b"child",right,b"moved")
    assert o.rd(child)[b".."]==right and o.rd(leaf)[b".."]==child
    o.call("rmdir-nonempty",11,right,b"moved\0",errno.ENOTEMPTY)
    o.call("open-dir",27,nested,b"")
    o.call("rmdir-open",11,dest,b"nested\0")
    o.rd(nested,errno.EIO)
    o.release(nested,True);assert nested not in b.nodes
    o.call("rmdir-leaf",11,child,b"leaf\0")
    o.rn(45,right,b"moved",right,b"dest")
    assert dest not in b.nodes and o.rd(child)[b".."]==right
    assert o.rd(1)[b".."]==1
    return o
def mutants(src):
    changes={
      "rename-source-missing":("for parent in (ino,newdir):","for parent in (newdir,):"),
      "rename-destination-missing":("for parent in (ino,newdir):","for parent in (ino,):"),
      "rename-parent-type":("                if not stat.S_ISDIR(self.nodes[parent]['mode']):raise OSError(errno.ENOTDIR,'rename parent not directory')",""),
      "create-parent-type":("        if not stat.S_ISDIR(n['mode']):raise OSError(errno.ENOTDIR,'parent non-directory')",""),
      "create-parent-missing":("        if n is None:raise OSError(errno.ENOENT,'parent missing')",""),
      "setattr-early-flags":("            if valid&~(1|2|4|8|16|32|64|128|256|512|1024):raise OSError(errno.EOPNOTSUPP,'setattr flags')",""),
      "rename-cycle":("                    if child==newdir:raise OSError(errno.EINVAL,'rename directory cycle')",""),
      "rename-replacement-type":("                if not source_is_dir and dest_is_dir:raise OSError(errno.EISDIR,'replacement is directory')",""),
      "unlink-type":("            if op==10 and stat.S_ISDIR(self.nodes[child]['mode']):raise OSError(errno.EISDIR,'unlink directory')",""),
      "rmdir-type":("            if op==11 and not stat.S_ISDIR(self.nodes[child]['mode']):raise OSError(errno.ENOTDIR,'rmdir non-directory')",""),
      "readdir-parent":("                parent=parents[0]","                parent=1"),
    }
    for name,(old,new) in changes.items():
        assert src.count(old)==1,(name,src.count(old))
        m=types.ModuleType("mutant_"+name);exec(compile(src.replace(old,new),str(SOURCE)+":"+name,"exec"),m.__dict__)
        yield name,m.Backend
def main():
    module=load()
    try:o=scenario(module.Backend,"production")
    except Exception as e:
        # Save exact source and traceback, preserving first production failure.
        (HERE/"rejected-source.py.txt").write_bytes(SOURCE.read_bytes())
        (HERE/"first-defect.json").write_text(json.dumps(dict(error=str(e),reproducer=ACTIVE.trace),indent=2))
        raise
    with gzip.open(HERE/"production-trace.json.gz","wt") as f:json.dump(o.trace,f)
    results=[]
    for name,cls in mutants(SOURCE.read_text()):
        try:scenario(cls,name)
        except (AssertionError,OSError,KeyError) as e:results.append(dict(mutant=name,detected=True,reason=str(e)[:350]))
        else:raise AssertionError(("oracle survived guard removal",name))
    report=dict(outcome="PASS",sourceSHA256=PIN,requests=len(o.trace),rejections=o.rejects,
                snapshot="all instance fields; operations alone increments on errno rejection",
                mutants=results,limits={k:resource.getrlimit(v) for k,v in [("DATA",resource.RLIMIT_DATA),("CPU",resource.RLIMIT_CPU),("FSIZE",resource.RLIMIT_FSIZE)]},
                boundary="exact production Backend.handle; INIT first; no serve/transport/kernel/CLI/browser")
    (HERE/"results.json").write_text(json.dumps(report,indent=2));print(json.dumps(report))
if __name__=="__main__":main()
