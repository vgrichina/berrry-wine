from common import *
import re,copy
D=pathlib.Path('/tmp/enigma-accepted-msg-current-tree-reconcile-oct26/repo')
canonical=json.load(open(O/'canonical-manifest.json'));review=json.load(open(O/'source-review-result.json'));assert canonical==review['canonicalIncludes']
# One bounded import form at a time: no full fragment/closure string, generator or compiler invocation.
def forms(p):
 collecting=False;buf=[];depth=0;quoted=False;escaped=False
 with open(p) as stream:
  for line in stream:
   i=0
   while i<len(line):
    if not collecting:
     start=line.find('(import',i)
     comment=line.find(';;',i)
     if start<0 or 0<=comment<start:break
     i=start;collecting=True
    c=line[i]
    if not quoted and line[i:i+2]==';;':break
    buf.append(c)
    if quoted:
     if escaped:escaped=False
     elif c=='\\':escaped=True
     elif c=='"':quoted=False
    elif c=='"':quoted=True
    elif c=='(':depth+=1
    elif c==')':
     depth-=1
     if depth==0:
      yield ''.join(buf);collecting=False;buf=[]
    assert len(buf)<32768,'bounded import form'
    i+=1
   if collecting:buf.append('\n')
 assert not collecting,'unclosed import'
def parse(form):
 # Independent s-expression tokenizer; no production generator/parser evaluated.
 tokens=re.findall(r'"(?:\\.|[^"\\])*"|[()]|[^\s()]+',form);stack=[];root=None
 for token in tokens:
  if token=='(':
   item=[]
   if stack:stack[-1].append(item)
   else:assert root is None;root=item
   stack.append(item)
  elif token==')':assert stack;stack.pop()
  else:assert stack;stack[-1].append(token)
 assert not stack and root[0]=='import'
 if root[1]!='"host"' or root[3][0]!='func':return None
 fn=root[3];params=[];results=[]
 for item in fn[1:]:
  if not isinstance(item,list):assert item.startswith('$');continue
  assert item[0] in ['param','result'],item
  types=[t for t in item[1:] if not t.startswith('$')]
  assert all(t in ['i32','i64','f32','f64','funcref','externref','v128'] for t in types)
  (params if item[0]=='param' else results).extend(types)
 return root[2][1:-1],dict(params=params,results=results)
sigs={};closure=[];declarations=[]
for p in canonical:
 h=hashlib.sha256();size=0
 with open(D/p,'rb') as f:
  while chunk:=f.read(65536):h.update(chunk);size+=len(chunk)
 assert h.hexdigest()==review['closure'][p]['sha256']
 n=0
 for text in forms(D/p):
  item=parse(text)
  if item is None:continue
  name,sig=item;assert name not in sigs; sigs[name]=sig;n+=1;declarations.append(dict(path=p,name=name,sha256=sha(text.encode())))
 closure.append(dict(path=p,sha256=h.hexdigest(),bytes=size,imports=n))
actual=json.load(open(D/'lib/host-import-sigs.generated.json'));baseline=json.load(open('/tmp/enigma-canonical-msg-completion-hook-repair-oct26/ops/baseline-import-sigs.json'))
new=['message_begin','message_park','message_bind','message_resume','message_complete']
assert len(sigs)==295==actual['count'];assert actual['sigs']==sigs
assert list(actual['sigs'])==list(sigs),'canonical final include/declaration order'
assert {n:v for n,v in sigs.items() if n not in new}==baseline['sigs'];assert len(baseline['sigs'])==290
for name,n,r in zip(new,[8,1,3,2,2],[1,0,0,1,0]):assert sigs[name]==dict(params=['i32']*n,results=['i32']*r)
# Different independent serialization preserving actual generator formatting.
serialized=json.dumps(dict(generated_from='src/main.watx include closure',count=len(sigs),sigs=sigs),indent=2)+'\n'
assert serialized.encode()==(D/'lib/host-import-sigs.generated.json').read_bytes()
indented=['src/'+re.fullmatch(r'\s*\(include\s+"([^"]+)"\)',l).group(1) for l in (D/'src/main.watx').read_text().splitlines() if re.match(r'^\s+\(include',l)]
assert len(indented)==4 and all(p in canonical for p in indented)
def validate(paths,mapping):
 assert paths==canonical,'closure must include indented zero-import GL fragments'
 assert mapping==sigs,'exact final import signatures'
rejected=[]
for name,paths,mapping in [('indented-GL-omission',[p for p in canonical if p!=indented[0]],sigs),('completion-omission',canonical,{k:v for k,v in sigs.items() if k!='message_complete'}),('completion-result-change',canonical,copy.deepcopy(sigs))]:
 if name=='completion-result-change':mapping['message_complete']['results']=['i32']
 try:validate(paths,mapping)
 except AssertionError:rejected.append(name)
 else:raise AssertionError('mutation not rejected: '+name)
# The duplicate declaration gate is independent of dict overwrite behavior.
names=[x['name'] for x in declarations]+['message_complete']
try:assert len(names)==len(set(names))
except AssertionError:rejected.append('duplicate-import')
else:raise AssertionError('duplicate not rejected')
save('independent-signatures-result.json',dict(pass_=True,method='Streaming import s-expression tokenizer; independent of production generator parser; exact serialized mapping and canonical production manifest',closure=closure,imports=295,priorUnchanged=290,completionImports=new,indentedGL=indented,rejectedControls=rejected,signatureSHA256=sha(serialized.encode()),declarations=declarations,wholeGeneratorNotRetried=True,compiled=False))
j=json.load(open(O/'checkpoint.json'));j['completed'].append('independent final signature mapping');j['remaining'].remove('independent final signature mapping');save('checkpoint.json',j)
print('PASS canonical final include closure including4indentedGL; streaming independent295signature mapping/290unchanged/5new;4rejectingcontrols; no whole-generator/compile')
