import os, sys, json, errno, hashlib, stat
root=sys.argv[1]
assert os.path.isabs(root)
def snapshot():
    rows=[]
    for base,dirs,files in os.walk(root):
        for name in ['']+sorted(files):
            p=os.path.join(base,name) if name else base
            s=os.stat(p)
            data=None
            if stat.S_ISREG(s.st_mode):
                with open(p,'rb') as f:data=f.read().hex()
            rows.append([os.path.relpath(p,root),s.st_ino,s.st_mode,s.st_nlink,s.st_size,data])
    return sorted(rows)
for d in ['dir','tree','tree/child']:
    os.mkdir(root+'/'+d)
for f,data in [('file',b'file-original'),('tree/child/leaf',b'leaf-original')]:
    with open(root+'/'+f,'wb') as out:out.write(data)
initial=snapshot()
print(json.dumps(dict(event='initial',tree=initial)),flush=True)
cases=[('file-to-dir','file','dir',errno.EISDIR),
       ('dir-to-file','dir','file',errno.ENOTDIR),
       ('absent-parent','file','missing/new',errno.ENOENT),
       ('nondirectory-parent','file','file/new',errno.ENOTDIR),
       ('descendant-cycle','tree','tree/child/new',errno.EINVAL),
       ('same-path','file','file',0)]
for label,src,dst,expected in cases:
    before=snapshot();actual=0
    try:os.rename(root+'/'+src,root+'/'+dst)
    except OSError as e:actual=e.errno
    after=snapshot()
    result=dict(event='case',name=label,source=src,destination=dst,expected=expected,actual=actual,
                unchanged=before==after,treeSHA256=hashlib.sha256(json.dumps(after).encode()).hexdigest())
    print(json.dumps(result),flush=True)
    if actual!=expected or before!=after:
        print(json.dumps(dict(event='FIRST_UNEXPECTED',before=before,after=after)),flush=True)
        raise SystemExit(1)
assert snapshot()==initial
print('MOUNTED_RENAME_GUARDS_COMPLETED',flush=True)
