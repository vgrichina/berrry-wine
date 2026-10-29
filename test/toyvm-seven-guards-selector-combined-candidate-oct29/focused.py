"""Combined candidate source/handle interaction checks; no mount or subprocess."""
import ast
import copy
import errno
import hashlib
import json
from pathlib import Path
import struct
import types

HERE=Path(__file__).resolve().parent
ROOT=HERE.parent.parent
SOURCE=HERE.parent/'toyvm-kernel-profile-accounting-backend-oct28/fuse_backend.py'
SHA='75842ffafd6ebd0c29fa2889a463bfd6f5245634096f4dfef9a3fd69f703e822'
def digest(b):return hashlib.sha256(b).hexdigest()
def span(s):
    n=next(n for n in ast.walk(ast.parse(s)) if isinstance(n,ast.FunctionDef) and n.name=='serve')
    lines=s.splitlines(True)
    return sum(map(len,lines[:n.lineno-1])),sum(map(len,lines[:n.end_lineno]))
def functions(s):
    result={};lines=s.splitlines(True)
    def visit(node,path=''):
        for n in ast.iter_child_nodes(node):
            name=path+'.'+n.name if isinstance(n,(ast.ClassDef,ast.FunctionDef,ast.AsyncFunctionDef)) else path
            if isinstance(n,(ast.FunctionDef,ast.AsyncFunctionDef)):
                result[name]=dict(bytes=digest(b''.join(lines[n.lineno-1:n.end_lineno])),ast=ast.dump(n,include_attributes=False))
            visit(n,name)
    visit(ast.parse(s));return result

def provenance():
    s=SOURCE.read_bytes();ns=(HERE/'namespace-donor.py.txt').read_bytes();sel=(HERE/'selector-donor.py.txt').read_bytes()
    assert digest(s)==SHA
    assert digest(ns)=='b8201b2c4a1d0e1fd653bb02fda7870f626d3781bed014657fb974cc24e41c40'
    assert digest(sel)=='e78b4f06715db96c3403aa821dc2008e7986fa9e9ec9fbacbc3744a8bb7eebc8'
    a,z=span(ns);c,d=span(sel);e,f=span(s)
    assert s==ns[:a]+sel[c:d]+ns[z:]
    assert s[:e]==ns[:a] and s[f:]==ns[z:] and s[e:f]==sel[c:d]
    nf,sf,cf=functions(ns),functions(sel),functions(s)
    assert set(nf)==set(cf)
    for name,v in cf.items():assert v==(sf[name] if name=='.Backend.serve' else nf[name]),name
    pins=json.loads((HERE/'source-pins-before.json').read_text())
    for name,pin in pins.items():
        if name.endswith('/fuse_backend.py'):continue
        b=(ROOT/name).read_bytes(); assert len(b)==pin['bytes'] and digest(b)==pin['sha256'],name
    return dict(sha256=SHA,namespace=digest(ns),selector=digest(sel),functions={k:v['bytes'] for k,v in cf.items()},outsideServeByteIdentical=True,allNonServeASTEqual=True,protectedPinsUnchanged=True)

def module(s):
    m=types.ModuleType('private_backend');exec(compile(s,str(SOURCE),'exec'),m.__dict__);return m

def interaction(m):
    b=m.Backend(str(HERE),live_limit=262144,write_limit=262144,file_limit=65536)
    rows=[]
    def call(label,op,ino,data):
        result=b.handle(op,ino,data); rows.append(dict(label=label,op=op,result='success'));return result
    def reject(label,op,ino,data,code):
        before=copy.deepcopy(b.__dict__); count=before.pop('operations')
        try:b.handle(op,ino,data)
        except OSError as ex:assert ex.errno==code,(label,ex.errno,code)
        else:raise AssertionError((label,'accepted rejection'))
        after=copy.deepcopy(b.__dict__);assert after.pop('operations')==count+1
        assert after==before,(label,'observable instance state changed')
        rows.append(dict(label=label,op=op,result='rejected',errno=code,fullInstanceUnchangedExceptOperations=True))
    def create(parent,name,directory=False):
        data=(struct.pack('<II',0o700,0) if directory else struct.pack('<IIII',0,0o600,0,0))+name+b'\0'
        answer=call('mkdir' if directory else 'create',9 if directory else 35,parent,data)
        return struct.unpack_from('<Q',answer)[0]
    def ren(op,dest,old,new):return struct.pack('<Q',dest)+(b'\0'*8 if op==45 else b'')+old+b'\0'+new+b'\0'
    call('INIT first',26,1,struct.pack('<II',7,31))
    a=create(1,b'a',True); dest=create(1,b'b',True); child=create(a,b'child',True); f=create(a,b'f'); g=create(dest,b'g'); empty=create(dest,b'empty',True)
    payload=b'preserve-payload'
    call('write before rejected mutations',16,f,struct.pack('<QQI',f,0,len(payload))+b'\0'*20+payload)
    for op in (35,9):
        data=(struct.pack('<IIII',0,0o600,0,0) if op==35 else struct.pack('<II',0o700,0))+b'bad\0'
        reject('parent missing '+str(op),op,999999,data,errno.ENOENT)
        reject('parent file '+str(op),op,f,data,errno.ENOTDIR)
    reject('setattr unsupported with shrink',4,f,struct.pack('<IIQQ',8|2048,0,0,1),errno.EOPNOTSUPP)
    reject('setattr unsupported with growth',4,f,struct.pack('<IIQQ',8|2048,0,0,4097),errno.EOPNOTSUPP)
    reject('unlink directory',10,a,b'child\0',errno.EISDIR)
    reject('rmdir file',11,a,b'f\0',errno.ENOTDIR)
    reject('rmdir nonempty',11,1,b'a\0',errno.ENOTEMPTY)
    for op in (12,45):
        reject('file replaces directory '+str(op),op,a,ren(op,dest,b'f',b'empty'),errno.EISDIR)
        reject('directory replaces file '+str(op),op,a,ren(op,dest,b'child',b'g'),errno.ENOTDIR)
        reject('directory into self '+str(op),op,1,ren(op,a,b'a',b'self'),errno.EINVAL)
        reject('directory into descendant '+str(op),op,1,ren(op,child,b'a',b'cycle'),errno.EINVAL)
        for parent,code in ((999999,errno.ENOENT),(f,errno.ENOTDIR)):
            reject('rename source parent '+str(op)+' '+str(parent),op,parent,ren(op,dest,b'f',b'new'),code)
            reject('rename destination parent '+str(op)+' '+str(parent),op,a,ren(op,parent,b'f',b'new'),code)
    call('valid rename directory',12,a,ren(12,dest,b'child',b'moved'))
    read=struct.pack('<QQI',child,0,4096)
    answer=call('READDIR moved parent',28,child,read)
    entries={};off=0
    while off<len(answer):
        ino,cookie,n,kind=struct.unpack_from('<QQII',answer,off);entries[answer[off+24:off+24+n]]=ino;off+=(24+n+7)//8*8
    assert entries[b'..']==dest and entries[b'.']==child
    call('open directory before unlink',27,child,b'')
    call('rmdir open empty directory',11,dest,b'moved\0')
    reject('READDIR orphan parent',28,child,read,errno.EIO)
    # An intentionally ambiguous fixture tests fail-closed parent discovery.
    b.nodes[dest]['names'][b'alias']=a
    reject('READDIR ambiguous parent',28,a,struct.pack('<QQI',a,0,4096),errno.EIO)
    del b.nodes[dest]['names'][b'alias']
    call('release orphan directory',29,child,struct.pack('<Q',child))
    call('valid file replacement with open old inode',45,a,ren(45,dest,b'f',b'g'))
    assert b.nodes[dest]['names'][b'g']==f and b.nodes[g]['links']==0 and b.nodes[g]['opens']==1
    assert bytes(b.nodes[f]['data'])==payload
    call('release replaced file',18,g,struct.pack('<Q',g));assert g not in b.nodes
    return dict(requests=len(rows),rejections=sum(r['result']=='rejected' for r in rows),rows=rows)

MUTATIONS={
 'create-parent': ["        if n is None:raise OSError(errno.ENOENT,'parent missing')\n", "        if not stat.S_ISDIR(n['mode']):raise OSError(errno.ENOTDIR,'parent non-directory')\n"],
 'setattr-atomicity': ["            if valid&~(1|2|4|8|16|32|64|128|256|512|1024):raise OSError(errno.EOPNOTSUPP,'setattr flags')\n"],
 'unlink-rmdir-types': ["            if op==10 and stat.S_ISDIR(self.nodes[child]['mode']):raise OSError(errno.EISDIR,'unlink directory')\n", "            if op==11 and not stat.S_ISDIR(self.nodes[child]['mode']):raise OSError(errno.ENOTDIR,'rmdir non-directory')\n"],
 'rename-types': ["                if not source_is_dir and dest_is_dir:raise OSError(errno.EISDIR,'replacement is directory')\n", "                if source_is_dir and not dest_is_dir:raise OSError(errno.ENOTDIR,'replacement is not directory')\n"],
 'rename-cycle': ["                    if child==newdir:raise OSError(errno.EINVAL,'rename directory cycle')\n"],
 'rename-parents': ["            for parent in (ino,newdir):\n                if parent not in self.nodes:raise OSError(errno.ENOENT,'rename parent missing')\n                if not stat.S_ISDIR(self.nodes[parent]['mode']):raise OSError(errno.ENOTDIR,'rename parent not directory')\n"],
 'readdir-parent': ["                if len(parents)!=1:\n                    raise OSError(errno.EIO,'directory parent is not unique')\n"]}

def main():
    result=dict(provenance=provenance())
    source=SOURCE.read_text();result['interactions']=interaction(module(source));result['privateGuardRemovalControls']={}
    for name,chunks in MUTATIONS.items():
        mutant=source
        for chunk in chunks:assert mutant.count(chunk)==1;mutant=mutant.replace(chunk,'')
        ast.parse(mutant)
        try:interaction(module(mutant))
        except (AssertionError,KeyError,IndexError,TypeError,OSError) as ex:
            result['privateGuardRemovalControls'][name]=dict(rejected=True,errorType=type(ex).__name__,error=str(ex),sha256=digest(mutant.encode()))
        else:raise AssertionError(('guard removal survived',name))
    (HERE/'focused-results.json').write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps(dict(sha256=SHA,requests=result['interactions']['requests'],rejections=result['interactions']['rejections'],controls=len(result['privateGuardRemovalControls']),provenance='PASS')))
if __name__=='__main__':main()
