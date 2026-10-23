#!/usr/bin/env python3
"""Binary-only inspection, no native Module/Memory/Instance/guest execution."""
import argparse,hashlib,json,pathlib,re,sys
H=pathlib.Path(__file__).resolve().parent;R=H.parents[2]
VT={0x7f:'i32',0x7e:'i64',0x7d:'f32',0x7c:'f64',0x7b:'v128',0x70:'funcref',0x6f:'externref'}
class Reader:
 def __init__(self,b):self.b=b;self.p=0
 def byte(self):v=self.b[self.p];self.p+=1;return v
 def leb(self):
  v=0
  for n in range(5):
   c=self.byte();v|=(c&127)<<(7*n)
   if not c&128:return v
  raise ValueError('invalid u32 LEB')
 def take(self,n):
  assert n<=len(self.b)-self.p;v=self.b[self.p:self.p+n];self.p+=n;return v
 def name(self):return self.take(self.leb()).decode('utf8')
 def vec(self,f):return [f() for _ in range(self.leb())]
 def end(self):assert self.p==len(self.b),(self.p,len(self.b))
def limits(r):
 flags=r.leb();assert flags in (0,1,3),flags
 return dict(flags=flags,min=r.leb(),max=r.leb() if flags&1 else None,shared=bool(flags&2))
def parse(path):
 b=path.read_bytes();assert len(b)<=8388608 and b[:8]==b'\0asm\1\0\0\0'
 r=Reader(b[8:]);sections={};custom=[]
 while r.p<len(r.b):
  kind=r.byte();body=r.take(r.leb());assert kind!=8,'start section forbidden'
  if kind==0:
   c=Reader(body);name=c.name();custom.append(dict(name=name,payloadHex=c.b[c.p:].hex(),bytes=len(c.b)-c.p))
  else:assert kind not in sections;sections[kind]=body
 t=Reader(sections[1]);types=[]
 for _ in range(t.leb()):
  assert t.byte()==0x60,'only function types expected'
  types.append(dict(params=t.vec(lambda:VT[t.byte()]),results=t.vec(lambda:VT[t.byte()])))
 t.end();imports=[];funcs=[];memories=[]
 t=Reader(sections[2])
 for _ in range(t.leb()):
  m=t.name();n=t.name();k=t.byte();row=dict(module=m,name=n,kind=k)
  if k==0:
   idx=t.leb();row['signature']=types[idx];funcs.append(types[idx])
  elif k==2:row['limits']=limits(t);memories.append(row['limits'])
  else:raise ValueError(('unexpected import kind',k))
  imports.append(row)
 t.end();t=Reader(sections[3]);funcs+=t.vec(lambda:types[t.leb()]);t.end()
 if 5 in sections:
  t=Reader(sections[5]);memories+=t.vec(lambda:limits(t));t.end()
 t=Reader(sections[7]);exports=[]
 for _ in range(t.leb()):
  n=t.name();k=t.byte();idx=t.leb();row=dict(name=n,kind=k,index=idx)
  if k==0:row['signature']=funcs[idx]
  elif k==2:row['limits']=memories[idx]
  else:raise ValueError(('unexpected export kind',k,n))
  assert n not in {e['name'] for e in exports},'duplicate export'
  exports.append(row)
 t.end()
 return dict(file=str(path),sha256=hashlib.sha256(b).hexdigest(),bytes=len(b),types=types,memories=memories,imports=imports,exports=exports,customSections=custom,noStart=True,native=False)
def source_abi(combined):
 # Parse only flat function declaration headers; strip WAT comments without
 # changing strings. Nested block comments are supported.
 s=combined.read_text()
 tokens=re.findall(r'"(?:\\.|[^"\\])*"|;;[^\n]*|\(;|;\)|[()]|[^\s()"]+',s)
 clean=[];depth=0
 for x in tokens:
  if x=='(;':depth+=1
  elif x==';)':assert depth;depth-=1
  elif not depth and not x.startswith(';;'):clean.append(x)
 assert depth==0
 tok=clean;named={};exp={};imports=[]
 def header(i):
  assert tok[i:i+2]==['(','func'];j=i+2;name=None
  if tok[j].startswith('$'):name=tok[j];j+=1
  sig=dict(params=[],results=[]);names=[]
  while tok[j]=='(' and tok[j+1] in ('param','result','export','local'):
   kind=tok[j+1];j+=2;args=[]
   while tok[j]!=')':args.append(tok[j]);j+=1
   j+=1
   if kind in ('param','result'):sig['params' if kind=='param' else 'results'] += [v for v in args if not v.startswith('$')]
   if kind=='export':assert len(args)==1;names.append(json.loads(args[0]))
  if name and (name not in named or sig['params'] or sig['results']):named[name]=sig
  for name in names:assert name not in exp;exp[name]=sig
  return sig
 for i in range(len(tok)-2):
  if tok[i:i+2]==['(','func']:header(i)
  if tok[i:i+2]==['(','import']:
   module=json.loads(tok[i+2]);name=json.loads(tok[i+3]);kind=tok[i+5]
   if kind=='func':imports.append(dict(module=module,name=name,kind=0,signature=header(i+4)))
   elif kind=='memory':
    assert tok[i+6:i+10]==['8192','32768','shared',')']
    imports.append(dict(module=module,name=name,kind=2,limits=dict(flags=3,min=8192,max=32768,shared=True)))
   else:raise ValueError(kind)
 for i in range(len(tok)-6):
  if tok[i:i+2]==['(','export'] and tok[i+3]=='(':
   name=json.loads(tok[i+2]);kind=tok[i+4];ref=tok[i+5]
   if kind=='func':assert name not in exp;exp[name]=named[ref]
   else:assert (name,kind,ref)==('memory','memory','0')
 return imports,exp
def tokens(s):
 depth=0
 for m in re.finditer(r'"(?:\\.|[^"\\])*"|;;[^\n]*|\(;|;\)|[()]|[^\s()"]+',s):
  x=m.group()
  if x=='(;':depth+=1
  elif x==';)':assert depth;depth-=1
  elif not depth and not x.startswith(';;'):yield x
 assert depth==0,'unterminated block comment'

def declarations(source):
 # Parse every declaration in the complete include closure, not a filename
 # guess. Non-declaration bodies are streamed rather than building a huge AST.
 it=iter(tokens(source));previous=None;out={}
 def form():
  a=[]
  for x in it:
   if x==')':return a
   a.append(form() if x=='(' else x)
  raise ValueError('incomplete declaration')
 for x in it:
  if previous=='(' and x.startswith('region.declare'):
   assert x in ('region.declare','region.declare-fixed','region.declare-derived','region.declare-span'),('unsupported declaration',x)
   a=form();assert a and re.fullmatch(r'\$[A-Za-z_][A-Za-z_0-9]*',a[0]),a
   name=a[0][1:];assert name not in out,('duplicate declaration',name)
   clauses={}
   for c in a[1:]:
    assert isinstance(c,list) and c and c[0] not in clauses,('duplicate/incomplete clause',c)
    assert c[0] in ('base','size','end','align','owner','within','stride','mask','size-is-power-of-2'),('unsupported clause',c)
    clauses[c[0]]=c[1:]
   if x=='region.declare-span':
    assert set(clauses)<=set(('base','size','end','owner')) and 'owner' in clauses
   if 'owner' in clauses:
    assert len(clauses['owner'])==1 and isinstance(json.loads(clauses['owner'][0]),str)
   assert ('size' in clauses)^('end' in clauses),('size/end required exclusively',name)
   if x in ('region.declare','region.declare-derived'):assert 'size' in clauses
   if x=='region.declare':assert 'base' not in clauses
   else:assert 'base' in clauses
   out[name]=(x,clauses)
  previous=x
 return out

def number(a):
 assert len(a)==1 and isinstance(a[0],str) and re.fullmatch(r'(?:0x[0-9a-fA-F_]+|[0-9][0-9_]*)',a[0]),('unsupported integer',a)
 x=int(a[0].replace('_',''),16 if a[0].startswith('0x') else 10)
 assert 0<=x<=0xffffffff,('u32 bounds',x)
 return x

def layout_lines(regions):
 names=set();lines=[]
 for r in regions:
  n=r['name'].removeprefix('$');assert n not in names,('duplicate inventory',n);names.add(n)
  assert 0<=r['base']<=0xffffffff and 0<r['size']<=0xffffffff
  assert r['base']+r['size']==r['end']<=0x20000000,('inventory bounds',r)
  lines.append(f"{n}:{r['base']:08X}:{r['size']:08X}")
 return '\n'.join(sorted(lines))+'\n'

def inventory(source,mirror):
 decl=declarations(source);assert decl,'empty declarations'
 blocks=re.findall(r'const REGIONS = \{\n(.*?)^  \};',mirror,re.S|re.M);assert len(blocks)==1,'missing/duplicate REGIONS block'
 rows={}
 pattern=r"\s*(\w+): \{ name: '(\w+)', base: (0x[\da-fA-F_]+), size: (0x[\da-fA-F_]+), end: (0x[\da-fA-F_]+), within: (null|'\w+') \},\s*"
 for line in blocks[0].splitlines():
  m=re.fullmatch(pattern,line);assert m,('incomplete/unsupported placement',line)
  key,n,b,s,e,w=m.groups();assert key==n and n not in rows,('duplicate/mismatched placement',n)
  rows[n]=dict(name=n,base=number([b]),size=number([s]),end=number([e]),within=None if w=='null' else w[1:-1],kind='storage')
 storage={n for n,(head,c) in decl.items() if head!='region.declare-span'}
 assert set(rows)==storage,('incomplete storage inventory',set(rows)^storage)
 for n,(head,c) in decl.items():
  if head=='region.declare-span':
   base=number(c['base']);size=number(c['size']) if 'size' in c else number(c['end'])-base
   rows[n]=dict(name=n,base=base,size=size,end=base+size,kind='span',within=None)
  r=rows[n]
  if 'size' in c:assert r['size']==number(c['size']),('source size mismatch',n)
  if 'end' in c:assert r['end']==number(c['end']),('source end mismatch',n)
  if head in ('region.declare-fixed','region.declare-span'):assert r['base']==number(c['base']),('source base mismatch',n)
  if head=='region.declare-derived':
   a=c['base'];assert len(a)==1 and isinstance(a[0],list) and a[0][0]=='g2w' and len(a[0])==2,('unsupported derived base',a)
   assert r['base']==rows['GUEST_BASE']['base']+number(a[0][1:])-0x400000,('derived placement mismatch',n)
  alignment=number(c['align']) if 'align' in c else (1 if head=='region.declare-span' else 4)
  assert alignment>0 and alignment&(alignment-1)==0 and r['base']%alignment==0,('alignment',n)
  within=c.get('within');assert within is None or len(within)==1
  expected=None if within is None else within[0].removeprefix('$')
  assert r['within']==expected,('within mismatch',n)
  if expected:
   parent=rows[expected];assert parent['base']<=r['base'] and r['end']<=parent['end'],('within bounds',n)
 regions=list(rows.values());text=layout_lines(regions)
 layout=hashlib.sha256(text.encode()).hexdigest()[:16]
 declared=re.findall(r"const LAYOUT_HASH = ['\"]([a-f0-9]{16})['\"]",mirror);assert len(declared)==1
 assert layout==declared[0],('full layout fingerprint mismatch',layout,declared)
 return regions,text,layout

def compare(o,expectedImports,expectedExports,layout):
 assert o['imports']==expectedImports,'full source import/signature mismatch'
 assert o['memories']==[dict(flags=3,min=8192,max=32768,shared=True)],'exactly one shared ABI memory required'
 actual={e['name']:e['signature'] for e in o['exports'] if e['kind']==0}
 assert actual==expectedExports,('complete source export/signature mismatch',set(actual)^set(expectedExports))
 assert [e for e in o['exports'] if e['kind']!=0]==[dict(name='memory',kind=2,index=0,limits=dict(flags=3,min=8192,max=32768,shared=True))]
 custom=[c for c in o['customSections'] if c['name']=='wine-region-layout'];assert len(custom)==1
 assert bytes.fromhex(custom[0]['payloadHex']).decode()==layout,'layout payload mismatch'
 return actual

def main():
 p=argparse.ArgumentParser();p.add_argument('--input-root',type=pathlib.Path,required=True);p.add_argument('--combined',type=pathlib.Path,required=True);p.add_argument('--output-dir',type=pathlib.Path,required=True);a=p.parse_args()
 root=a.input_root.resolve();combined=a.combined.resolve()
 assert hashlib.sha256(combined.read_bytes()).hexdigest()=='68cdd92ea9f1702b1bf6c6f216fe2b725d4de11fe57a154bc035e5a81e07467b'
 expectedImports,expectedExports=source_abi(combined)
 regions,text,layout=inventory(combined.read_text(),(root/'lib/region-map.generated.js').read_text())
 outputs=[]
 for name in ['wine-assembly.wasm','wine-assembly.compat.wasm']:
  o=parse(root/'build'/name);actual=compare(o,expectedImports,expectedExports,layout)
  for name,params,results in [('set_null_diag',['i32'],[]),('null_diag_field',['i32'],['i32']),('null_diag_token',[],['i64']),('null_diag_root',[],['i64']),('guest_read8',['i32'],['i32']),('set_bp',['i32'],[]),('set_trace_eip_range',['i32']*3,[])]+[('get_'+n,[],['i32']) for n in ['eax','ebx','ecx','edx','esi','edi','ebp','esp','eip']]:
   assert actual[name]==dict(params=params,results=results),(name,actual[name])
  outputs.append(o)
 result=dict(state='STATIC_ABI_PASS',outputs=outputs,fullSourceImportsCompared=len(expectedImports),fullSourceFunctionExportsCompared=len(expectedExports),layout=dict(payload=layout,regions=regions,memoryImport=dict(min=8192,max=32768,shared=True),meaning='16 ASCII hex chars of SHA256 over all exact mirror placements, not embedded region records'),differences=[],Memory=False,Instance=False)
 result['layout'].update(spans=sum(r['kind']=='span' for r in regions),serialization=text,meaning='Compiler layoutLines serialization of every storage placement plus source span base and extent; source/mirror identities admitted separately')
 (a.output_dir/'static-abi.json').write_text(json.dumps(result,indent=2)+'\n')
 print(json.dumps(dict(state=result['state'],imports=len(expectedImports),exports=len(expectedExports),layout=layout,regions=len(regions))))
if __name__=='__main__':main()
