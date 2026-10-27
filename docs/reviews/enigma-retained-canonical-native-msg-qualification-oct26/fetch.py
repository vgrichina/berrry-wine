from transport import *
def fetch(remote,local,label):
 j=api('import pathlib,hashlib,json; p=pathlib.Path('+repr(remote)+'); b=p.read_bytes(); print(json.dumps(dict(bytes=len(b),sha256=hashlib.sha256(b).hexdigest())))',label+'-meta');meta=json.loads(j['stdout']);assert meta['bytes']<=16*1048576
 def part(ix):
  j=api('import pathlib,base64; p=pathlib.Path('+repr(remote)+'); f=p.open("rb"); f.seek('+str(ix)+'); print(base64.b64encode(f.read(4500)).decode())',label+'-read-'+str(ix));return base64.b64decode(j['stdout'])
 with concurrent.futures.ThreadPoolExecutor(max_workers=4) as ex:data=b''.join(ex.map(part,range(0,meta['bytes'],4500)))
 assert len(data)==meta['bytes'] and sha(data)==meta['sha256'];local.parent.mkdir(parents=True,exist_ok=True);local.write_bytes(data);return meta
if __name__=='__main__':
 for name in sys.argv[1:]:
  print(name,fetch(REMOTE+'/ops/'+name,O/('remote-'+name),'fetch-'+name))
