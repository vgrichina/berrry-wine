import pathlib,zlib,hashlib,json,sys
sys.dont_write_bytecode=True
H=pathlib.Path('/tmp/enigma-native-corpus-independent-accept-oct27');G=H/'repo/.git'
D=pathlib.Path('/tmp/enigma-retained-canonical-native-msg-qualification-oct26/repo/.git')
REV='291e4b03f77c3957c0e14fe0077fe5d301882964'
count=0;total=0
def copy(oid):
 global count,total
 p=D/'objects'/oid[:2]/oid[2:];b=p.read_bytes();raw=zlib.decompress(b);assert hashlib.sha1(raw).hexdigest()==oid
 q=G/'objects'/oid[:2]/oid[2:];q.parent.mkdir(exist_ok=True);q.write_bytes(b);count+=1;total+=len(b)
 head,body=raw.split(b'\0',1)
 if head.startswith(b'commit '):copy(body.splitlines()[0].split()[1].decode())
 elif head.startswith(b'tree '):
  i=0
  while i<len(body):
   j=body.index(b'\0',i);mode,name=body[i:j].split(b' ',1);oid=body[j+1:j+21].hex();i=j+21
   if mode==b'40000':copy(oid)
copy(REV)
assert 'f00667622b73b2d52f7ae1f7bf5309514db0c111' in zlib.decompress((G/'objects'/REV[:2]/REV[2:]).read_bytes()).decode(errors='replace')
(G/'refs/heads/task').mkdir(exist_ok=True)
(G/'refs/heads/task/enigma-native-corpus-independent-accept-oct27').write_text(REV+'\n')
(G/'shallow').write_text(REV+'\n')
(G/'info/sparse-checkout').write_text('/test/enigma-native-corpus-check.py\n/test/test-enigma-native-corpus-check.py\n/docs/reviews/enigma-native-corpus-independent-accept-oct27/\n')
with (G/'config').open('a') as f:f.write('\n[core]\n\tsparseCheckout = true\n\tsparseCheckoutCone = false\n[user]\n\tname = Wine Ops\n\temail = wine-ops@local\n[remote "origin"]\n\turl = git@github.com:vgrichina/wine-assembly.git\n')
(H/'ops/setup-result.json').write_text(json.dumps(dict(commit=REV,tree='f00667622b73b2d52f7ae1f7bf5309514db0c111',treeAndCommitObjects=count,compressedBytes=total,copiedBlobs=0,alternates=False)))
print(count,total)
