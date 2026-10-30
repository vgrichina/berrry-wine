"""Combined direct-handler interaction checks; no mount or runtime."""
import copy, errno, hashlib, importlib.util, json, pathlib, stat, struct
HERE=pathlib.Path(__file__).resolve().parent
SOURCE=HERE.parent/'toyvm-kernel-profile-accounting-backend-oct28/fuse_backend.py'
PIN='d129d1a4d42d9dd4077941927fa57220a32580667a1fef226de11dec2a411171'
assert hashlib.sha256(SOURCE.read_bytes()).hexdigest()==PIN
def load(name,path):
    spec=importlib.util.spec_from_file_location(name,path)
    m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m
actual=load('combined_backend',SOURCE)
type_suite=load('retained_type_suite',HERE/'rename-type-accept.py')
groups=type_suite.run_suite(actual.Backend)
assert sum(groups.values())==156
rows=[]
for op in (12,45):
    b=actual.Backend(str(HERE/'never-mounted'),live_limit=262144)
    a=b.create(1,b'a',stat.S_IFDIR|0o700)
    d=b.create(a,b'd',stat.S_IFDIR|0o700)
    f=b.create(a,b'f',stat.S_IFREG|0o600);b.resize(f,7);b.nodes[f]['data'][:]=b'payload'
    q=b.create(1,b'q',stat.S_IFDIR|0o700)
    def snap():return copy.deepcopy({k:v for k,v in vars(b).items() if k!='operations'})
    def wire(parent,old,new):
        return struct.pack('<Q',parent)+(struct.pack('<II',0,0) if op==45 else b'')+old+b'\0'+new+b'\0'
    def reject(label,opcode,parent,data,error):
        before=snap();count=b.operations
        identities={i:(id(n),id(n['data']),id(n['names'])) for i,n in b.nodes.items()}
        try:b.handle(opcode,parent,data)
        except OSError as exc:assert exc.errno==error,(label,exc.errno)
        else:raise AssertionError(label+' accepted')
        assert snap()==before and b.operations==count+1,label
        assert identities=={i:(id(n),id(n['data']),id(n['names'])) for i,n in b.nodes.items()}
        rows.append(dict(op=op,case=label,passed=True))
    reject('cycle-before-removal',op,1,wire(d,b'a',b'bad'),errno.EINVAL)
    reject('unlink-directory-after-cycle',10,1,b'a\0',errno.EISDIR)
    reject('rmdir-file-after-cycle',11,a,b'f\0',errno.ENOTDIR)
    reject('rename-file-over-directory',op,a,wire(1,b'f',b'a'),errno.EISDIR)
    reject('rename-directory-over-file',op,1,wire(a,b'a',b'f'),errno.ENOTDIR)
    b.handle(op,a,wire(q,b'f',b'moved'))
    assert b.nodes[q]['names'][b'moved']==f and bytes(b.nodes[f]['data'])==b'payload'
    rows.append(dict(op=op,case='rename-file-payload-preserved',passed=True))
    b.handle(10,q,b'moved\0')
    assert f not in b.nodes and not b.nodes[q]['names']
    rows.append(dict(op=op,case='unlink-renamed-file-collected',passed=True))
    b.handle(op,a,wire(1,b'd',b'out'))
    b.handle(11,1,b'out\0')
    assert d not in b.nodes and not b.nodes[a]['names']
    rows.append(dict(op=op,case='rename-and-rmdir-child-collected',passed=True))
    b.handle(11,1,b'a\0')
    assert a not in b.nodes and b.live==8192 and b.handles==0 and b.failure is None
    assert b.nodes[1]['names']=={b'q':q}
    rows.append(dict(op=op,case='rmdir-former-cycle-source-accounting',passed=True))
report=dict(sourceSha256=PIN,renameTypeBehavioralGroups=groups,renameTypeBehavioralCases=156,interactions=rows,passed=len(rows),scope='direct Backend.handle only')
(HERE/'interaction-report.json').write_text(json.dumps(report,indent=2)+'\n')
print('PASS 156 unchanged rename-type behavioral cases; %d interaction checks'%len(rows))
