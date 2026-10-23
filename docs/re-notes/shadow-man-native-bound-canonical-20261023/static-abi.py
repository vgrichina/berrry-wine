#!/usr/bin/env python3
"""Binary-only inspection, no native Module/Memory/Instance/guest execution."""
import hashlib,json,pathlib,re,sys
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
  exports.append(row)
 t.end()
 return dict(file=str(path),sha256=hashlib.sha256(b).hexdigest(),bytes=len(b),imports=imports,exports=exports,customSections=custom,noStart=True,native=False)
def source_abi():
 # Parse only flat function declaration headers; strip WAT comments without
 # changing strings. Nested block comments are supported.
 s=pathlib.Path('/home/user/wine-assembly-shadow-man-complete-gate-data-readiness-oct23/build/combined.wat').read_text()
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
def main():
 expectedImports,expectedExports=source_abi()
 # Pin the complete generated mirror as source identity in manifest; this
 # parser extracts all placements and independently reproduces layoutHash.
 mirror=(R/'lib/region-map.generated.js').read_text()
 rows=re.findall(r"^\s+\w+: \{ name: '([^']+)', base: (0x[\da-fA-F_]+), size: (0x[\da-fA-F_]+), end: (0x[\da-fA-F_]+), within:",mirror,re.M)
 assert len(rows)>150
 regions=[dict(name=n,base=int(b.replace('_',''),16),size=int(s.replace('_',''),16),end=int(e.replace('_',''),16)) for n,b,s,e in rows]
 assert all(x['base']+x['size']==x['end'] for x in regions)
 text='\n'.join(sorted(f"{x['name']}:{x['base']:08X}:{x['size']:08X}" for x in regions))+'\n'
 layout=hashlib.sha256(text.encode()).hexdigest()[:16]
 declared=re.search(r"const LAYOUT_HASH = ['\"]([a-f0-9]{16})['\"]",mirror).group(1);assert layout==declared,(layout,declared)
 outputs=[]
 for name in ['wine-assembly.wasm','wine-assembly.compat.wasm']:
  o=parse(R/'build'/name);assert o['imports']==expectedImports,'full source import/signature mismatch'
  actual={e['name']:e['signature'] for e in o['exports'] if e['kind']==0}
  assert actual==expectedExports,('complete source export/signature mismatch',set(actual)^set(expectedExports))
  assert [e for e in o['exports'] if e['kind']!=0]==[dict(name='memory',kind=2,index=0,limits=dict(flags=3,min=8192,max=32768,shared=True))]
  for name,params,results in [('set_null_diag',['i32'],[]),('null_diag_field',['i32'],['i32']),('null_diag_token',[],['i64']),('null_diag_root',[],['i64']),('guest_read8',['i32'],['i32']),('set_bp',['i32'],[]),('set_trace_eip_range',['i32']*3,[])]+[('get_'+n,[],['i32']) for n in ['eax','ebx','ecx','edx','esi','edi','ebp','esp','eip']]:
   assert actual[name]==dict(params=params,results=results),(name,actual[name])
  custom=[c for c in o['customSections'] if c['name']=='wine-region-layout'];assert len(custom)==1
  assert bytes.fromhex(custom[0]['payloadHex']).decode()==layout
  outputs.append(o)
 result=dict(state='STATIC_ABI_PASS',outputs=outputs,fullSourceImportsCompared=len(expectedImports),fullSourceFunctionExportsCompared=len(expectedExports),layout=dict(payload=layout,regions=regions,memoryImport=dict(min=8192,max=32768,shared=True),meaning='16 ASCII hex chars of SHA256 over all exact mirror placements, not embedded region records'),differences=[],Memory=False,Instance=False)
 (H/'static-abi.json').write_text(json.dumps(result,indent=2)+'\n')
 print(json.dumps(dict(state=result['state'],imports=len(expectedImports),exports=len(expectedExports),layout=layout,regions=len(regions))))
if __name__=='__main__':main()
