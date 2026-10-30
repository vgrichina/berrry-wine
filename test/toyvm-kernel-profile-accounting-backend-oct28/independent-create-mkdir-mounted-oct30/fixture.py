import os,errno,json,time,hashlib
R='/tmp/tvmd/domain'
def snapshot():
    rows=[]
    for base,dirs,files in os.walk(R):
        for n in sorted(dirs+files):
            p=base+'/'+n;s=os.stat(p)
            content=hashlib.sha256(open(p,'rb').read()).hexdigest() if n in files else None
            rows.append([os.path.relpath(p,R),s.st_ino,s.st_mode,s.st_size,content])
    return hashlib.sha256(json.dumps(sorted(rows)).encode()).hexdigest()
def create(p):
    fd=os.open(p,os.O_CREAT|os.O_EXCL|os.O_WRONLY,0o600);os.close(fd)
create(R+'/parent-file');os.mkdir(R+'/parent');os.mkdir(R+'/parent/empty')
os.mkdir(R+'/parent/nonempty');create(R+'/parent/nonempty/child,comma')
with open(R+'/parent-file','wb',buffering=0) as f:assert f.write(b'Q7z!')==4
with open(R+'/parent-file','rb',buffering=0) as f:assert f.read()==b'Q7z!'
identity=os.stat(R+'/parent/nonempty/..').st_ino==os.stat(R+'/parent').st_ino
assert identity
cases=[]
for op,path,expected in [
 ('create','missing/new',errno.ENOENT),('create','parent-file/new',errno.ENOTDIR),
 ('mkdir','missing/new',errno.ENOENT),('mkdir','parent-file/new',errno.ENOTDIR),
 ('create','parent-file',errno.EEXIST),('mkdir','parent',errno.EEXIST),
 ('unlink','parent/empty',errno.EISDIR),('rmdir','parent-file',errno.ENOTDIR),
 ('rmdir','parent/nonempty',errno.ENOTEMPTY),('unlink','parent/absent',errno.ENOENT),
 ('rmdir','parent/absent',errno.ENOENT)]:
    before=snapshot();begin=time.monotonic();time.sleep(.15);attempt=time.monotonic()
    try:
        {'create':create,'mkdir':os.mkdir,'unlink':os.unlink,'rmdir':os.rmdir}[op](R+'/'+path)
    except OSError as e:actual=e.errno
    else:actual=0
    after=snapshot();finish=time.monotonic();time.sleep(.15);end=time.monotonic()
    cases.append(dict(op=op,expected=expected,actual=actual,unchanged=before==after,snapshot=before,begin=begin,attempt=attempt,finish=finish,end=end))
    assert actual==expected and before==after,dict(firstFailingCase=len(cases),observation=cases[-1])
for op,path in [('unlink','parent/nonempty/child,comma'),('rmdir','parent/nonempty'),('rmdir','parent/empty'),('unlink','parent-file'),('rmdir','parent')]:
    {'unlink':os.unlink,'rmdir':os.rmdir}[op](R+'/'+path)
assert os.listdir(R)==[]
print(json.dumps(dict(PASS=True,cases=cases,roundtrip=True,payloadBytes=4,nestedParentIdentity=identity,finalEmpty=True)),flush=True)
