from common import *
import zlib,gzip,re
D=pathlib.Path('/tmp/enigma-accepted-msg-current-tree-reconcile-oct26/repo');DO=D.parent/'ops';A=pathlib.Path('/tmp/enigma-canonical-msg-independent-source-accept-oct26/repo/docs/reviews/enigma-canonical-msg-independent-source-accept-oct26');ORIG=pathlib.Path('/tmp/enigma-canonical-msg-completion-hook-repair-oct26/repo')
def readobj(oid):
 p=D/'.git/objects'/oid[:2]/oid[2:];raw=zlib.decompress(p.read_bytes());assert hashlib.sha1(raw).hexdigest()==oid;hdr,b=raw.split(b'\0',1);return hdr.split()[0],b
def entries(commit):
 kind,b=readobj(commit)
 if kind==b'commit':return entries(b.splitlines()[0].split()[1].decode())
 assert kind==b'tree';i=0;r={}
 while i<len(b):
  j=b.index(b'\0',i);mode,name=b[i:j].split(b' ',1);oid=b[j+1:j+21].hex();i=j+21;p=name.decode()
  if mode==b'40000':r.update({p+'/'+n:x for n,x in entries(oid).items()})
  else:r[p]=dict(mode=mode.decode(),oid=oid)
 return r
candidate=entries('425755ee5ee9be0734c7aca187521100f5487674');main=entries('ddaff339bd7e1b10b2579a7ab7aed71d86d8edcd')
tested=json.load(open(DO/'tested-tree.json'));review=json.load(open(A/'source-review-result.json'));original=[]
for p,expected in tested['files'].items():
 b=(D/p).read_bytes();assert sha(b)==expected
 if p!='test/run.js':assert b==(ORIG/p).read_bytes(),p;original.append(p)
assert len(original)==13
# Independently validate actual include closure/tooling bytes against candidate Git tree.
manifest=(D/'src/main.watx').read_text();includes=[]
for line in manifest.splitlines():
 line=line.strip()
 if not line or line.startswith(';;'):continue
 m=re.fullmatch(r'\(include\s+"([^"]+)"\)',line);assert m,line;includes.append('src/'+m[1])
closure={}
for p in includes+['src/main.watx','lib/wat-manifest.js','tools/gen-host-import-sigs.js']:
 b=(D/p).read_bytes();oid=hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest();assert candidate[p]['oid']==oid,p
 closure[p]=dict(sha256=sha(b),oid=oid,bytes=len(b))
# Reuse accepted delta recipes but independently reverse exact unique contexts.
state={};patches=[]
for patch in [ORIG/'docs/re-notes/enigma-canonical-msg-completion-hook-repair-oct26/completion.patch.gz',A/'partial-runner-prerequisite.patch.gz']:
 data=gzip.decompress(patch.read_bytes()).decode().splitlines(True);i=0;patches.append(dict(path=str(patch),sha256=sha(patch.read_bytes())))
 while i<len(data):
  assert data[i].startswith('--- ');p=data[i+1][4:].strip().removeprefix('b/');i+=2;hunks=[]
  while i<len(data) and data[i].startswith('@@ '):
   i+=1;before=[];after=[]
   while i<len(data) and not data[i].startswith(('@@ ','--- ')):
    line=data[i];assert line[0] in ' +-';
    if line[0] in ' -':before.append(line[1:])
    if line[0] in ' +':after.append(line[1:])
    i+=1
   hunks.append((''.join(before),''.join(after)))
  if p=='lib/host-import-sigs.generated.json':continue
  text=state.get(p,(D/p).read_text())
  for before,after in reversed(hunks):assert text.count(after)==1,(p,'unique reverse context');text=text.replace(after,before,1)
  state[p]=text
for p in ['test/message-boundary-trace.js','test/test-message-boundary-trace.js']:
 x=next(x for x in review['reconstructedFiles'] if x['path']==p);assert sha(state[p].encode())==x['baselineSHA256'];assert p not in main;state[p]=''
for p,text in state.items():
 b=text.encode()
 if p in main:assert hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()==main[p]['oid'],p
 else:assert b==b'',p
changed={p for p in candidate.keys()|main.keys() if candidate.get(p)!=main.get(p)}
allowed=set(tested['paths'])
assert {p for p in changed if not p.startswith('docs/reviews/')}==allowed
# Runner's accepted excerpts remain identical to the prior independent acceptance.
old=json.load(open(A/'production-boundary-result.json'));new=json.load(open(O/'production-boundary-result.json'))
for name,x in old['excerpts'].items():assert new['excerpts'][name]['sha256']==x['sha256'] and new['excerpts'][name]['bytes']==x['bytes']
save('source-review-result.json',dict(pass_=True,unchangedNonRunner=original,closure=closure,canonicalIncludes=includes,patches=patches,reversePaths=sorted(state),wholeRunnerReversesExactlyToMain=True,unrelatedTreeEntriesUnchanged=True,acceptedOriginalExcerptsUnchanged=True,partialPrerequisiteComplete=True,compiled=False))
j=json.load(open(O/'checkpoint.json'));j['completed'].append('independent prerequisite/main preservation/source pins');j['remaining'].remove('prerequisite and main preservation identity');save('checkpoint.json',j)
print('PASS13 nonrunner exact original; complete partial prerequisite+completion reverse uniquely to main; Alien/GL/Ricochet and all unrelated entries exact; closure source/tool Git identities')
