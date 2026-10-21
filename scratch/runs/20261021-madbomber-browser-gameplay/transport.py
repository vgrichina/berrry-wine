import subprocess,json,base64,gzip,pathlib,shutil
ROOT=pathlib.Path(__file__).parent
BOX='bx_j693sabt'
def guard(n=0):
    assert shutil.disk_usage(ROOT).free > 2915041280+n, 'local reserve'
def run(code,timeout=60):
    p=subprocess.run(['boat','exec',BOX,'--timeout',str(timeout),'--','python3','-c',code],capture_output=True,text=True)
    r=json.loads(p.stdout)
    assert r.get('success'),r
    return r['stdout']
def put_bytes(data,remote):
    b=base64.b64encode(gzip.compress(data)).decode()
    run('import pathlib; p=pathlib.Path('+repr(remote)+'); p.parent.mkdir(parents=True,exist_ok=True); pathlib.Path(str(p)+".b64").write_text("")')
    for i in range(0,len(b),96000):
        run('with open('+repr(remote+'.b64')+',"a") as f: f.write('+repr(b[i:i+96000])+')')
    run('import gzip,base64,pathlib; p=pathlib.Path('+repr(remote)+'); p.write_bytes(gzip.decompress(base64.b64decode(pathlib.Path(str(p)+".b64").read_text()))); pathlib.Path(str(p)+".b64").unlink()')
def put(local,remote): put_bytes(pathlib.Path(local).read_bytes(),remote)
def get(remote,local):
    size=int(run('import pathlib; print(pathlib.Path('+repr(remote)+').stat().st_size)'))
    assert size < 16*1024*1024
    guard(size)
    with open(local,'wb') as f:
        for offset in range(0,size,48000):
            b=run('import base64; f=open('+repr(remote)+',"rb"); f.seek('+str(offset)+'); print(base64.b64encode(f.read(48000)).decode())')
            guard(48000); f.write(base64.b64decode(b))
