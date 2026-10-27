from common import *
import io,tarfile,sys
group=int(sys.argv[1]);rows=json.loads((H/'transfer-manifest.json').read_text());batch=rows[group*40:(group+1)*40];assert batch
buf=io.BytesIO()
with tarfile.open(fileobj=buf,mode='w:gz') as t:
 for x in batch:
  b=pathlib.Path(x['source']).read_bytes();assert sha(b)==x['sha256'];i=tarfile.TarInfo(x['target']);i.size=len(b);t.addfile(i,io.BytesIO(b))
b=buf.getvalue();target=REMOTE+'/stage-'+str(group)+'.tgz'
for off in range(0,len(b),24000):
 code='import pathlib,base64;p=pathlib.Path('+repr(target)+');p.parent.mkdir(parents=True,exist_ok=True);f=p.open('+repr('wb' if off==0 else 'ab')+');f.write(base64.b64decode('+repr(base64.b64encode(b[off:off+24000]).decode())+'));f.close();print("stored")'
 py('stage-'+str(group)+'-'+str(off),code)
py('extract-'+str(group),'import pathlib,tarfile,hashlib;p=pathlib.Path('+repr(target)+');assert hashlib.sha256(p.read_bytes()).hexdigest()=='+repr(sha(b))+';t=tarfile.open(p);t.extractall('+repr(REMOTE)+',filter="data");t.close();p.unlink();print("extracted")')
print('staged',group,len(batch),'compressed',len(b))
