"""Task-scoped Boat transport; never performs lifecycle operations."""
import base64, hashlib, io, json, pathlib, subprocess, tarfile
E=pathlib.Path(__file__).resolve().parent
W=E.parents[2]
BOX='bx_5mu9dnhg'
REMOTE='/home/user/shadow-man-original-oct22'
def save(name, value):
    (E/name).write_text(json.dumps(value,indent=2)+'\n')
def call(args, name=None):
    p=subprocess.run(['boat','--json',*args],capture_output=True,text=True)
    r=json.loads(p.stdout)
    if name: save(name,r)
    assert p.returncode==0, (p.returncode,p.stderr,r)
    return r
def run(code,name=None,timeout=30):
    r=call(['exec',BOX,'--timeout',str(timeout),'--','python3','-c',code],name)
    assert r.get('exitCode')==0,r
    return r
def transfer(data,rel):
    target=REMOTE+'/'+rel
    run('import pathlib;p=pathlib.Path(%r);p.parent.mkdir(parents=True,exist_ok=True);assert not p.exists();p.write_bytes(b"")'%target)
    for pos in range(0,len(data),60000):
        run('import os,base64;f=os.open(%r,os.O_WRONLY);b=base64.b64decode(%r);assert os.pwrite(f,b,%d)==len(b);os.close(f)'%(target,base64.b64encode(data[pos:pos+60000]).decode(),pos))
    r=run('import pathlib,hashlib;p=pathlib.Path(%r);assert p.stat().st_size==%d;assert hashlib.sha256(p.read_bytes()).hexdigest()==%r;print("PASS")'%(target,len(data),hashlib.sha256(data).hexdigest()))
    save(rel.replace('/','-')+'.transfer.json',dict(path=target,bytes=len(data),sha256=hashlib.sha256(data).hexdigest(),verification=r))
def retrieve(rel,name=None,maxbytes=4000000):
    r=run('import pathlib,base64;p=pathlib.Path(%r);assert p.stat().st_size<=%d;print(base64.b64encode(p.read_bytes()).decode())'%(REMOTE+'/'+rel,maxbytes))
    data=base64.b64decode(r['stdout']);p=E/(name or 'raw/'+rel);p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(data)
    return p
if __name__=='__main__':
    import sys
    if sys.argv[1]=='receipt':
        source=W/'scratch/runs/20261022-shadow-man-original-source'
        buf=io.BytesIO()
        with tarfile.open(fileobj=buf,mode='w:gz') as t:
            for p in sorted(source.rglob('*')):
                if p.is_file() and '__pycache__' not in p.parts:t.add(p,arcname=p.relative_to(source))
        transfer(buf.getvalue(),'source-receipt.tar.gz')
        print(run('import tarfile;tarfile.open(%r).extractall(%r,filter="data");print("receipt staged")'%(REMOTE+'/source-receipt.tar.gz',REMOTE+'/receipt'),'receipt-staging.json')['stdout'])
    elif sys.argv[1]=='run': print(run(sys.argv[2],sys.argv[3] if len(sys.argv)>3 else None)['stdout'])
    elif sys.argv[1]=='get': print(retrieve(sys.argv[2]))
