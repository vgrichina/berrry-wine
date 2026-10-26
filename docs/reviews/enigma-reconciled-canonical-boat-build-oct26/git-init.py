from common import *
import zlib
C='facebcb2e6d04b84e80211a7814654e528566b0f';D=pathlib.Path('/tmp/enigma-reconciled-msg-independent-source-accept-oct26/repo')
clients=[]
for p in pathlib.Path('/proc').glob('[0-9]*'):
 try:
  a=p.joinpath('cmdline').read_bytes().decode().split('\0')
  if '/bin/codex' in a[0] and str(ROOT/'scratch/usage-watch'/H.name/'final.txt') in a:clients.append(dict(pid=int(p.name),argv=a))
 except (OSError,IndexError):pass
assert len(clients)==1 and 'gpt-6.1-sol' in clients[0]['argv'] and 'model_reasoning_effort="medium"' in clients[0]['argv'] and 'model_auto_compact_token_limit=200000' in clients[0]['argv'] and 'model_auto_compact_token_limit_scope="total"' in clients[0]['argv']
save('launch-configuration.json',dict(clients=clients,ssh=SSH,mountArgv=[],mount='N/A: no guest or filename-bearing mount invocation; selective archive paths separately enumerated and verified',thread=os.environ.get('CODEX_THREAD_ID'),rootRefReceipt=str(ROOT/'scratch/usage-watch'/H.name/'root-ref-digest.json')))
g('init','-q',str(R),cwd=H)
for k,v in [('core.sshCommand',SSH),('user.name','Wine Ops'),('user.email','wine-ops@local'),('core.sparseCheckout','true'),('core.sparseCheckoutCone','false')]:g('config',k,v)
g('remote','add','origin','git@github.com:vgrichina/wine-assembly.git')
def walk(oid):
 compressed=(D/'.git/objects'/oid[:2]/oid[2:]).read_bytes();raw=zlib.decompress(compressed);assert hashlib.sha1(raw).hexdigest()==oid;hdr,b=raw.split(b'\0',1)
 p=R/'.git/objects'/oid[:2]/oid[2:];p.parent.mkdir(exist_ok=True);p.write_bytes(compressed)
 if hdr.startswith(b'commit '):return walk(b.splitlines()[0].split()[1].decode())
 assert hdr.startswith(b'tree ');i=0
 while i<len(b):
  j=b.index(b'\0',i);mode,name=b[i:j].split(b' ',1);child=b[j+1:j+21].hex();i=j+21
  if mode==b'40000':walk(child)
walk(C)
(R/'.git/shallow').write_text(C+'\n');(R/'.git/info/sparse-checkout').write_text('/docs/reviews/'+H.name+'/\n')
g('update-ref','refs/heads/'+BR,C);g('symbolic-ref','HEAD','refs/heads/'+BR);g('read-tree','--reset','-i','HEAD')
print(json.dumps(dict(branch=BR,parent=C,gitBytes=alloc(R/'.git'),ssh=SSH)))
