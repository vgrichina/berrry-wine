import os, errno, json, time, stat, hashlib
R='/tmp/tvmd/domain'
assert os.path.ismount(R)
def tree():
    result=[]
    for base, dirs, files in os.walk(R):
        for name in sorted(dirs+files):
            p=os.path.join(base,name);s=os.stat(p)
            content=None
            if stat.S_ISREG(s.st_mode):
                with open(p,'rb',buffering=0) as f:content=hashlib.sha256(f.read()).hexdigest()
            result.append([os.path.relpath(p,R),s.st_ino,s.st_mode,s.st_size,content])
    return sorted(result)
def window():
    t=time.monotonic();time.sleep(.6);return [t,time.monotonic()]
os.mkdir(R+'/nonempty',0o700)
with open(R+'/nonempty/child','wb',buffering=0) as f:assert f.write(b'kept')==4
os.mkdir(R+'/empty',0o700)
with open(R+'/file','wb',buffering=0) as f:assert f.write(b'file')==4
baseline=tree();baselineWindow=window();cases=[]
for operation,name,expected in [('unlink','empty',errno.EISDIR),('rmdir','file',errno.ENOTDIR),('rmdir','nonempty',errno.ENOTEMPTY)]:
    before=tree();beforeWindow=window();start=time.monotonic()
    try:getattr(os,operation)(R+'/'+name)
    except OSError as e:actual=e.errno
    else:actual=0
    end=time.monotonic();after=tree();afterWindow=window()
    case=dict(operation=operation,name=name,expectedErrno=expected,actualErrno=actual,namespaceContentUnchanged=before==after,beforeWindow=beforeWindow,afterWindow=afterWindow,syscallWindow=[start,end])
    cases.append(case)
    assert actual==expected and before==after==baseline,case
os.unlink(R+'/nonempty/child');os.rmdir(R+'/nonempty');os.rmdir(R+'/empty');os.unlink(R+'/file')
assert tree()==[]
reclaimedWindow=window()
os.mkdir(R+'/reuse',0o700)
payload=b'unlink-rmdir-reuse\n'
with open(R+'/reuse/content','wb',buffering=0) as f:assert f.write(payload)==len(payload)
with open(R+'/reuse/content','rb',buffering=0) as f:assert f.read()==payload
finalWindow=window()
assert [x[0] for x in tree()]==['reuse','reuse/content']
print(json.dumps(dict(PASS=True,roundtrip=True,payloadBytes=len(payload),baseline=baseline,cases=cases,baselineWindow=baselineWindow,reclaimedWindow=reclaimedWindow,finalWindow=finalWindow,final=tree())))
