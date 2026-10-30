import pathlib,zlib,hashlib,json
from packed_reader import PackedReader
ROOT=pathlib.Path(__file__).resolve().parent
REPO=ROOT/'repo'
stores=[REPO/'.git/objects',*[pathlib.Path(p) for p in json.loads((ROOT/'stores.json').read_text())['stores']]]
def load(oid):
    assert len(oid)==40 and all(c in '0123456789abcdef' for c in oid)
    for store in stores:
        p=store/oid[:2]/oid[2:]
        if p.is_file():raw=zlib.decompress(p.read_bytes());break
    else:raw=packed.lookup(oid)
    assert hashlib.sha1(raw).hexdigest()==oid
    head,body=raw.split(b'\0',1);kind,n=head.split()
    assert len(body)==int(n) and len(body)<=524288
    return kind.decode(),body
packed=PackedReader(stores,load)
def read(oid,kind):
    actual,b=load(oid);assert actual==kind;return b
def entries(oid):
    b=read(oid,'tree');i=0;out={}
    while i<len(b):
        end=b.index(b'\0',i);mode,name=b[i:end].split(b' ',1)
        out[name]=(mode,b[end+1:end+21].hex());i=end+21
    return out
def path(commit,rel):
    oid=read(commit,'commit').splitlines()[0].split()[1].decode()
    for name in rel.split('/'):
        mode,oid=entries(oid)[name.encode()]
    return oid,read(oid,'blob')
def pin(b):return dict(bytes=len(b),sha256=hashlib.sha256(b).hexdigest())
def write(kind,b):
    assert len(b)<=524288
    raw=kind.encode()+b' '+str(len(b)).encode()+b'\0'+b;oid=hashlib.sha1(raw).hexdigest()
    dst=REPO/'.git/objects'/oid[:2]/oid[2:];dst.parent.mkdir(exist_ok=True)
    if dst.exists():assert zlib.decompress(dst.read_bytes())==raw
    else:dst.write_bytes(zlib.compress(raw))
    return oid
# Rewrite only authorized path ancestors, preserving every other tree entry.
def commit_changes(base,changes,message):
    from supervisor import identity,admission
    identity(REPO,'before-objects-'+message.split()[0]);admission()
    blobs={rel:write('blob',b) for rel,b in changes.items()}
    def rewrite(oid,prefix=''):
        old=entries(oid) if oid else {};es=dict(old)
        for name in set(p[len(prefix):].split('/')[0] for p in changes if p.startswith(prefix)):
            rel=prefix+name;n=name.encode()
            if rel in blobs:es[n]=(b'100644',blobs[rel])
            else:
                mode,child=es.get(n,(b'40000',None));assert mode==b'40000';es[n]=(mode,rewrite(child,rel+'/'))
        for name,value in old.items():
            rel=prefix+name.decode();assert any(p==rel or p.startswith(rel+'/') for p in changes) or es[name]==value
        order=sorted(es,key=lambda n:n+(b'/' if es[n][0]==b'40000' else b''))
        return write('tree',b''.join(es[n][0]+b' '+n+b'\0'+bytes.fromhex(es[n][1]) for n in order))
    import time
    tree=rewrite(read(base,'commit').splitlines()[0].split()[1].decode());now=int(time.time())
    commit=write('commit',f'tree {tree}\nparent {base}\nauthor Codex <codex@users.noreply.github.com> {now} +0000\ncommitter Codex <codex@users.noreply.github.com> {now} +0000\n\n{message}\n'.encode())
    for rel,b in changes.items():assert path(commit,rel)[1]==b
    return commit,tree
