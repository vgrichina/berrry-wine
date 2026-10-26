from common import *
import zlib
C='facebcb2e6d04b84e80211a7814654e528566b0f';N='docs/reviews/'+H.name
refs={line.split('\t')[1]:line.split('\t')[0] for line in g('ls-remote','origin','refs/heads/task/enigma-reconciled-msg-independent-source-accept-oct26','refs/heads/'+BR,'refs/heads/main').decode().splitlines()}
assert refs['refs/heads/task/enigma-reconciled-msg-independent-source-accept-oct26']==C and 'refs/heads/'+BR not in refs
save('remote-before.json',refs)
g('add','--sparse','-f','--',N);g('diff','--cached','--check')
paths=g('diff','--cached','--name-only').decode().splitlines();manifest=json.load(open(O/'evidence-manifest.json'));assert set(paths)==set(manifest)
for p,x in manifest.items():assert sha((R/p).read_bytes())==x['sha256']
tree=g('write-tree','--missing-ok').decode().strip()
def entries(oid):
 raw=zlib.decompress((R/'.git/objects'/oid[:2]/oid[2:]).read_bytes());assert hashlib.sha1(raw).hexdigest()==oid;hdr,b=raw.split(b'\0',1)
 if hdr.startswith(b'commit '):return entries(b.splitlines()[0].split()[1].decode())
 assert hdr.startswith(b'tree ');i=0;out={}
 while i<len(b):
  j=b.index(b'\0',i);mode,name=b[i:j].split(b' ',1);child=b[j+1:j+21].hex();i=j+21;p=name.decode()
  if mode==b'40000':out.update({p+'/'+k:v for k,v in entries(child).items()})
  else:out[p]=[mode.decode(),child]
 return out
before=entries(C);after=entries(tree);changed={p for p in before.keys()|after.keys() if before.get(p)!=after.get(p)};assert changed==set(manifest)
save('publication-scope.json',dict(parent=C,tree=tree,changed=sorted(changed),evidenceOnly=True,sourceUnchanged=True,mainPushed=False))
commit=g('commit-tree',tree,'-p',C,'-m','Qualify reconciled Enigma canonical WATX backends').decode().strip();g('update-ref','refs/heads/'+BR,commit,C)
save('publication.json',dict(commit=commit,branch=BR,parent=C,tree=tree,pushed=False,remoteVerified=False,mainPushed=False))
g('push','origin','refs/heads/'+BR+':refs/heads/'+BR)
after={line.split('\t')[1]:line.split('\t')[0] for line in g('ls-remote','origin','refs/heads/'+BR,'refs/heads/main').decode().splitlines()};assert after['refs/heads/'+BR]==commit
save('publication.json',dict(commit=commit,branch=BR,parent=C,tree=tree,pushed=True,remoteVerified=True,mainPushed=False,remoteBefore=refs,remoteAfter=after,sourceUnchanged=True,evidenceFiles=len(manifest)))
print(json.dumps(json.load(open(O/'publication.json'))))
