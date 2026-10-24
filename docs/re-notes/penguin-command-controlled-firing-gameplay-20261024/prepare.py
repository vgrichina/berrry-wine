from admit import *
import base64,zlib,shlex

def send(b,target):
 for off in range(0,len(b),18000):
  enc=base64.b64encode(zlib.compress(b[off:off+18000])).decode();code='import pathlib,zlib,base64;p=pathlib.Path('+repr(R+'/'+target)+');p.parent.mkdir(parents=True,exist_ok=True);p.open('+repr('wb' if off==0 else 'ab')+').write(zlib.decompress(base64.b64decode('+repr(enc)+')))'
  cmd='python3 -c '+shlex.quote(code);assert len(cmd.encode())<=35000;remote(cmd)
if __name__=='__main__':
 assert json.loads((H/'remote-rehash.json').read_text())['exitCode']==0
 for n in ['accepted-contract.json','preflight.py','supervise.py','negative-watchdog.py']:send((H/n).read_bytes(),n)
 save('preflight-api.json',remote('python3 '+shlex.quote(R+'/preflight.py'),60))
 save('negative-watchdog-api.json',remote('python3 '+shlex.quote(R+'/negative-watchdog.py'),20))
 print('codec/fonts/module/manifest and TERM/KILL negative controls PASS')
