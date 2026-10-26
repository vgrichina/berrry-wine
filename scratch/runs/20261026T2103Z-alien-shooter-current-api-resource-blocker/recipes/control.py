from work import *
def control(c):
 b=json.dumps(c).encode();j=py('import urllib.request,json;rq=urllib.request.Request("http://127.0.0.1:18129/ctl",data='+repr(b)+',headers={"Content-Type":"application/json"});r=urllib.request.urlopen(rq,timeout=10);b=r.read(8192);print(b.decode())',timeout=15)
 row=dict(at=time.time(),request=c,response=json.loads(j['stdout']))
 with (O/'control.jsonl').open('a') as f:f.write(json.dumps(row)+'\n')
 assert row['response']['ok'],row
 return row['response']['value']
def fetch_file(name):
 j=py('import pathlib,json,hashlib;p=pathlib.Path('+repr(R+'/'+name)+');print(json.dumps(dict(bytes=p.stat().st_size,sha256=hashlib.file_digest(p.open("rb"),"sha256").hexdigest())))');m=json.loads(j['stdout']);p=O/'retained'/name;p.parent.mkdir(parents=True,exist_ok=True)
 with p.open('wb') as f:
  for off in range(0,m['bytes'],5000):
   j=py('import pathlib,base64;f=pathlib.Path('+repr(R+'/'+name)+').open("rb");f.seek('+str(off)+');print(base64.b64encode(f.read(5000)).decode())');f.write(base64.b64decode(j['stdout']))
 assert hashlib.file_digest(p.open('rb'),'sha256').hexdigest()==m['sha256'];return p
if __name__=='__main__':
 if sys.argv[1]=='step':
  print(control(dict(action='step',n=int(sys.argv[2]))));print(control(dict(action='snapshot')))
 elif sys.argv[1]=='snapshot':print(control(dict(action='snapshot')))
 elif sys.argv[1]=='input':print(control(dict(cmd=sys.argv[2])))
 elif sys.argv[1]=='png':
  name='guest/'+sys.argv[2]+'.png';print(control(dict(action='png',path=R+'/'+name)));print(fetch_file(name))
 elif sys.argv[1]=='stop':print(py('import pathlib;pathlib.Path('+repr(R+'/guest/stop')+').touch()'))
