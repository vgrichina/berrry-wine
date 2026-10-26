import pathlib,json,zlib,subprocess,hashlib
from common import *
R=H/'repo';D=pathlib.Path('/tmp/maelstrom-terminal-closure-accepted-integrate-oct26/repo/.git/objects')
j=json.load(open(O/'flat-leaf-recovery-plan.json'));assert not j['unresolved'] and len(j['selectedLeaves'])==11
leaves=[pathlib.Path('/home/user/wine-assembly/.git/objects')]+[pathlib.Path(x['path']) for x in j['selectedLeaves']]
assert all(not (p/'info/alternates').exists() for p in leaves)
copies=[]
for oid in j['donorOwnCopies']:
 p=D/oid[:2]/oid[2:];b=p.read_bytes();assert hashlib.sha1(zlib.decompress(b)).hexdigest()==oid;copies.append((oid,b))
a=account('parent-recovery-planned');delta=sum((len(b)+4095)//4096*4096 for _,b in copies);assert a['peak']+delta<=67108864
(R/'.git/objects/info/alternates').write_text('\n'.join(str(p) for p in leaves)+'\n')
for oid,b in copies:
 p=R/'.git/objects'/oid[:2]/oid[2:];p.parent.mkdir(exist_ok=True);p.write_bytes(b)
receipt=dict(flatLeaves=[str(p) for p in leaves],noRecursiveAlternates=True,newObjectCount=len(copies),newObjectBytes=sum(len(b) for _,b in copies),roundedIncrement=delta,standingBlobsNotCopied=2593-len(copies),noFetch=True,noRepack=True,noLinks=True)
save('parent-object-recovery.json',receipt)
c=json.load(open(O/'checkout.json'));c['publicationParentRecovery']=receipt;save('checkout.json',c)
print(json.dumps({k:v for k,v in receipt.items() if k!='flatLeaves'}))
