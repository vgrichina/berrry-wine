from common import *
import zlib
D=pathlib.Path('/tmp/enigma-accepted-msg-current-tree-reconcile-oct26/repo')
def readobj(oid):
 raw=zlib.decompress((D/'.git/objects'/oid[:2]/oid[2:]).read_bytes());assert hashlib.sha1(raw).hexdigest()==oid;hdr,b=raw.split(b'\0',1);return hdr.split()[0],b
def entries(oid):
 kind,b=readobj(oid)
 if kind==b'commit':return entries(b.splitlines()[0].split()[1].decode())
 assert kind==b'tree';i=0;r={}
 while i<len(b):
  j=b.index(b'\0',i);mode,name=b[i:j].split(b' ',1);o=b[j+1:j+21].hex();i=j+21;p=name.decode()
  if mode==b'40000':r.update({p+'/'+n:x for n,x in entries(o).items()})
  else:r[p]=dict(mode=mode.decode(),oid=o)
 return r
if __name__=='__main__':
 es=entries('425755ee5ee9be0734c7aca187521100f5487674');name='lib/region-map.generated.js';oid=es[name]['oid']
 b=None
 for root in [D,ROOT,pathlib.Path('/tmp/civ2-win16-ordinary-gameplay-oct26/source')]:
  p=root/name
  if p.is_file():
   raw=p.read_bytes()
   if hashlib.sha1(b'blob '+str(len(raw)).encode()+b'\0'+raw).hexdigest()==oid:b=raw;break
 assert b is not None,'exact candidate static mirror unavailable'
 (O/'region-map.generated.js').write_bytes(b);save('supplemental-static-input.json',dict(path=name,oid=oid,sha256=sha(b),bytes=len(b),candidate='425755ee5ee9be0734c7aca187521100f5487674',purpose='read-only canonical layout expectation, not compiler input',algorithm='source-review.py readobj/entries identical tree walk'))
 print(json.dumps(json.load(open(O/'supplemental-static-input.json'))));print(b[-2500:].decode())
