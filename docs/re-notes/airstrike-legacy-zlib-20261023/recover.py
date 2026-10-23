#!/usr/bin/env python3
"""Recover one authentic unmodified DLL into an EMPTY destination. Wall: timeout 60s."""
import hashlib, io, json, pathlib, sys, urllib.request, zipfile
H = pathlib.Path(__file__).resolve().parent
class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,*args,**kwargs):
        raise ValueError('redirect refused')
def bounded(src,dst,cap):
    total=0
    while True:
        chunk=src.read(min(8192,cap-total+1))
        if not chunk:return total
        if total+len(chunk)>cap:raise ValueError('stream limit')
        dst.write(chunk);total+=len(chunk)
def guard_test():
    downstream=False
    try:
        bounded(io.BytesIO(b'12345'),io.BytesIO(),4)
        downstream=True
    except ValueError:pass
    assert not downstream
    return {'overflow_rejected':True,'downstream_sentinel':downstream}
def main(dest):
    assert guard_test()['overflow_rejected']
    dest.mkdir(exist_ok=False)
    url='https://www.libsdl.org/projects/SDL_image/release/SDL_image-1.2.3-win32.zip'
    p=dest/'sdl123.zip'
    with urllib.request.build_opener(NoRedirect).open(url,timeout=20) as r:
        assert r.status==200 and int(r.headers['Content-Length'])==160219
        with p.open('xb') as f:bounded(r,f,262144)
    assert p.stat().st_size==160219
    assert hashlib.sha256(p.read_bytes()).hexdigest()=='e7f817604519192ee1be33f66190864898baf81fc87c36ff60e05f71e1901e14'
    with zipfile.ZipFile(p) as z:
        ms=z.infolist()
        assert len(ms)==5 and sum(m.file_size for m in ms)==355046
        assert all(m.file_size<=1048576 for m in ms)
        m=z.getinfo('zlib.dll');assert m.file_size==53760
        b=z.read(m)
        assert hashlib.sha256(b).hexdigest()=='0df0c22bf411ad670d7b8fe5a533e4831313d5a3118cf9216389c642c90ec2f9'
        (dest/'zlib.dll').write_bytes(b)
    print('Recovered authentic zlib.dll; hash PASS. No guest executed.')
if __name__=='__main__':
    if sys.argv[1:] == ['--self-test']:
        print(json.dumps(guard_test()))
    else:main(pathlib.Path(sys.argv[1]))
