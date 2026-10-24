exec(open('/tmp/penguin-retained-codec-oct24/prepare.py').read().split('m=[]')[0])
import base64,zlib,io,tarfile,shlex
M=json.load(open(H/'admission.json'))['manifest'];ROOT='/tmp/penguin-retained-codec-oct24';BOAT='/home/user/.ascii/boat'
def remote(cmd):
 r=subprocess.run([BOAT,'--no-update','--json','exec','--timeout','60','bx_9nngcsvf',cmd],capture_output=True,text=True,timeout=70);j=json.loads(r.stdout);assert r.returncode==0 and j.get('exitCode')==0,(r.returncode,str(j)[:1000]);return j
receipts=[]
for i,x in enumerate(M):
 b=readgit(x['path']) if x['kind']=='git' else pathlib.Path(x['path']).read_bytes();assert sha(b)==x['sha256']
 for off in range(0,len(b),48000):
  piece=b[off:off+48000]; enc=base64.b64encode(zlib.compress(piece)).decode();dest=ROOT+'/'+x['target']
  code='import pathlib,base64,zlib;p=pathlib.Path('+repr(dest)+');p.parent.mkdir(parents=True,exist_ok=True);f=p.open('+repr('wb' if off==0 else 'ab')+');f.write(zlib.decompress(base64.b64decode('+repr(enc)+')));f.close()'
  j=remote('python3 -c '+shlex.quote(code))
 receipts.append({'target':x['target'],'bytes':len(b),'sha256':sha(b),'commandId':j['commandId']})
 if i%40==0: print('staged',i+1,'of',len(M),flush=True)
(H/'transfer-receipts.json').write_text(json.dumps(receipts,indent=2))
manifest=json.dumps(M,separators=(',',':')).encode();enc=base64.b64encode(zlib.compress(manifest)).decode()
code='import pathlib,base64,zlib;pathlib.Path('+repr(ROOT+'/manifest.json')+').write_bytes(zlib.decompress(base64.b64decode('+repr(enc)+')))'
remote('python3 -c '+shlex.quote(code));print('complete',len(M))
