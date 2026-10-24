import subprocess,json,shlex,pathlib,base64,zlib,hashlib
H=pathlib.Path('/tmp/penguin-retained-codec-oct24');ROOT=str(H);BOX='bx_9nngcsvf'
def remote(cmd,timeout=60):
 r=subprocess.run(['/home/user/.ascii/boat','--no-update','--json','exec','--timeout',str(timeout),BOX,cmd],capture_output=True,text=True,timeout=timeout+15)
 j=json.loads(r.stdout);assert r.returncode==0 and j.get('exitCode')==0,(r.returncode,str(j)[:1500]);return j

def send(data,target):
 for off in range(0,len(data),48000):
  enc=base64.b64encode(zlib.compress(data[off:off+48000])).decode();code='import pathlib,base64,zlib;p=pathlib.Path('+repr(target)+');p.parent.mkdir(parents=True,exist_ok=True);f=p.open('+repr('wb' if off==0 else 'ab')+');f.write(zlib.decompress(base64.b64decode('+repr(enc)+')));f.close()'
  remote('python3 -c '+shlex.quote(code))

def fetch(target,dest):
 j=remote('python3 -c '+shlex.quote('import pathlib,base64;print(base64.b64encode(pathlib.Path('+repr(target)+').read_bytes()).decode())'))
 b=base64.b64decode(j['stdout']);pathlib.Path(dest).write_bytes(b);return len(b)
if __name__=='__main__':
 import sys
 if sys.argv[1]=='send':send(pathlib.Path(sys.argv[2]).read_bytes(),sys.argv[3])
 elif sys.argv[1]=='exec':
  j=remote(sys.argv[2]);print(j['stdout'][:7000]);print(j['stderr'][:1000])
 elif sys.argv[1]=='fetch':print(fetch(sys.argv[2],sys.argv[3]))
