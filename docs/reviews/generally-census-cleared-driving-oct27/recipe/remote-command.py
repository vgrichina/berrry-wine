from common import *
import sys
mode=sys.argv[1]
if mode=='exec':
 label=sys.argv[2];command=sys.argv[3];x=api(label,command,timeout=60);save(label+'.result.json',x);print(x['stdout'][:3500],x['stderr'][:2000])
elif mode=='upload':
 name=sys.argv[2];p=H/name;b=p.read_bytes();assert len(b)<23000
 x=py('upload-'+name,'import pathlib,base64,hashlib;p=pathlib.Path('+repr(O+'/'+name)+');p.parent.mkdir(parents=True,exist_ok=True);b=base64.b64decode('+repr(base64.b64encode(b).decode())+');assert hashlib.sha256(b).hexdigest()=='+repr(sha(b))+';p.write_bytes(b);print("stored")');print(x['stdout'])
elif mode=='detach':
 label=sys.argv[2];command=sys.argv[3];admission(label+'-admission');x=api(label,command,detach=True);save(label+'.result.json',x);print(x)
elif mode=='collect':
 names=sys.argv[2:]
 for n in names:
  x=py('collect-'+n.replace('/','-'),'import pathlib,json,hashlib,base64;p=pathlib.Path('+repr(O+'/'+n)+');b=p.read_bytes() if p.exists() else b"";print(json.dumps(dict(exists=p.exists(),bytes=len(b),sha256=hashlib.sha256(b).hexdigest(),data=base64.b64encode(b).decode() if len(b)<=4500 else None)))')
  q=json.loads(x['stdout']);save('collect-'+n.replace('/','-')+'.json',q)
  if q['data'] is not None:(H/('retained-'+n.replace('/','-'))).write_bytes(base64.b64decode(q['data']))
  print(n,q['bytes'],q['sha256'])
