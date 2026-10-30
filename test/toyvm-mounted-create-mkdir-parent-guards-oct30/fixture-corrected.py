import os, errno, json, time, stat
R="/tmp/tvmd/domain"
assert os.path.ismount(R), ("expected real mounted domain", R)
def tree():
    result=[]
    for base, dirs, files in os.walk(R):
        for name in sorted(dirs+files):
            path=os.path.join(base,name); s=os.stat(path)
            result.append([os.path.relpath(path,R),s.st_ino,s.st_mode,s.st_size])
    return sorted(result)
fd=os.open(R+"/parent-file",os.O_CREAT|os.O_EXCL|os.O_WRONLY,0o600);os.close(fd)
baseline=tree(); baselineAt=time.monotonic();time.sleep(0.6)
invalidStart=time.monotonic(); cases=[]
for kind in ("create","mkdir"):
    for parent,expected in (("missing",errno.ENOENT),("parent-file",errno.ENOTDIR)):
        path=R+"/"+parent+"/rejected-"+kind
        before=tree()
        try:
            if kind=="create":
                fd=os.open(path,os.O_CREAT|os.O_EXCL|os.O_WRONLY,0o600);os.close(fd)
            else: os.mkdir(path,0o700)
        except OSError as e: actual=e.errno
        else: actual=0
        after=tree()
        cases.append(dict(operation=kind,path=path,expectedErrno=expected,actualErrno=actual,namespaceUnchanged=before==after))
        assert actual==expected and before==after,(cases[-1],before,after)
invalidEnd=time.monotonic(); assert tree()==baseline;time.sleep(0.6)
validStart=time.monotonic();os.mkdir(R+"/valid-dir",0o700)
payload=b"mounted-parent-guard-roundtrip\n"
with open(R+"/valid-dir/content","wb",buffering=0) as f: assert f.write(payload)==len(payload)
with open(R+"/valid-dir/content","rb",buffering=0) as f: assert f.read()==payload
final=tree()
assert sorted(x[0] for x in final)==["parent-file","valid-dir","valid-dir/content"]
print(json.dumps(dict(PASS=True,cases=cases,baseline=baseline,final=final,baselineAt=baselineAt,invalidStart=invalidStart,invalidEnd=invalidEnd,validStart=validStart,payloadBytes=len(payload),roundtrip=True)),flush=True)
