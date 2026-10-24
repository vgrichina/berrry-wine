from admit import *
import base64,zlib,shlex
E=H/'repo/docs/re-notes/penguin-command-controlled-firing-gameplay-20261024';E.mkdir(parents=True,exist_ok=True)
def get(target,dest):
 q='import pathlib,zlib,json,hashlib;b=pathlib.Path('+repr(target)+').read_bytes();print(json.dumps(dict(zbytes=len(zlib.compress(b)),bytes=len(b),sha256=hashlib.sha256(b).hexdigest())))'
 meta=json.loads(remote('python3 -c '+shlex.quote(q))['stdout']);out=bytearray()
 if dest.exists() and len(dest.read_bytes())==meta['bytes'] and sha(dest.read_bytes())==meta['sha256']:return dict(path=str(dest.relative_to(E)),**meta)
 for off in range(0,meta['zbytes'],18000):
  q='import pathlib,zlib,base64;b=zlib.compress(pathlib.Path('+repr(target)+').read_bytes());print(base64.b64encode(b['+str(off)+':'+str(off+18000)+']).decode())'
  out.extend(base64.b64decode(remote('python3 -c '+shlex.quote(q))['stdout']))
 b=zlib.decompress(out);assert len(b)==meta['bytes'] and sha(b)==meta['sha256'];dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(b);return dict(path=str(dest.relative_to(E)),**meta)
if __name__=='__main__':
 import sys
 mode=sys.argv[1];assert mode in ['control','firing','metadata']
 if mode=='metadata':files=['preflight.json','negative-watchdog.json']
 else:
  q='import pathlib,json;h=pathlib.Path('+repr(R)+');print(json.dumps([str(p.relative_to(h)) for p in (h/'+repr(mode)+').rglob("*") if p.is_file()]))'
  files=json.loads(remote('python3 -c '+shlex.quote(q))['stdout'])
 seals=[get(R+'/'+n,E/n) for n in files]
 (E/(mode+'-collection-seals.json')).write_text(json.dumps(seals,indent=2))
 print(json.dumps({'files':len(seals),'bytes':sum(x['bytes'] for x in seals)}))
