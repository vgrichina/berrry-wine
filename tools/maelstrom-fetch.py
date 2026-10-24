#!/usr/bin/env python3
"""Bounded HTTPS retrieval: reject metadata before streaming; cap actual bytes."""
import argparse,hashlib,json,pathlib,sys,urllib.request,urllib.error,importlib.util
spec=importlib.util.spec_from_file_location('maelstrom_byte_guard',pathlib.Path(__file__).parent/'maelstrom-byte-guard.py')
byte_guard=importlib.util.module_from_spec(spec);spec.loader.exec_module(byte_guard)
p=argparse.ArgumentParser();p.add_argument('url');p.add_argument('output');p.add_argument('--limit',type=int,required=True);a=p.parse_args()
assert a.url.startswith('https://') and 0<a.limit<=6291456
out=pathlib.Path(a.output);assert not out.exists()
receipt={'url':a.url,'limit':a.limit};code=0
try:
    req=urllib.request.Request(a.url,headers={'User-Agent':'WineOps-Maelstrom-historical-acquisition/1.0'})
    with urllib.request.urlopen(req,timeout=25) as r:
        receipt.update(final_url=r.url,status=r.status,headers=dict(r.headers))
        n=r.headers.get('Content-Length')
        if n is not None: byte_guard.guard(int(n),a.limit)
        size=0;digest=hashlib.sha256()
        with out.open('xb') as f:
            while True:
                b=r.read(min(65536,a.limit-size+1))
                if not b:break
                byte_guard.guard(size+len(b),a.limit)
                f.write(b);digest.update(b);size+=len(b)
        receipt.update(bytes=size,sha256=digest.hexdigest())
except Exception as e:
    receipt['error']=str(e);code=1
receipt['exit']=code
pathlib.Path(str(out)+'.receipt.json').write_text(json.dumps(receipt,indent=2)+'\n')
print(json.dumps({k:receipt[k] for k in ['url','bytes','sha256','error','exit'] if k in receipt}))
sys.exit(code)
