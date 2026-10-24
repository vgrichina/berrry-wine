from admit import *
import base64,zlib,shlex
E=H/'repo/docs/re-notes/penguin-command-integrated-clock-firing-20261024';E.mkdir(parents=True,exist_ok=True)
def get(target,dest):
 q='import pathlib,zlib,json,hashlib;b=pathlib.Path('+repr(target)+').read_bytes();print(json.dumps(dict(zbytes=len(zlib.compress(b)),bytes=len(b),sha256=hashlib.sha256(b).hexdigest())))'
 meta=json.loads(remote('python3 -c '+shlex.quote(q))['stdout']);out=bytearray()
 for off in range(0,meta['zbytes'],4096):
  q='import pathlib,zlib,base64;b=zlib.compress(pathlib.Path('+repr(target)+').read_bytes());print(base64.b64encode(b['+str(off)+':'+str(off+4096)+']).decode())'
  out.extend(base64.b64decode(remote('python3 -c '+shlex.quote(q))['stdout']))
 b=zlib.decompress(out);assert len(b)==meta['bytes'] and sha(b)==meta['sha256'];dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(b);return dict(path=str(dest.relative_to(E)),**meta)
