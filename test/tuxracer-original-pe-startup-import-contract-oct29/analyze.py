"""Static PE32 import/export contract. Never executes or copies guest media."""
import struct,json,pathlib,hashlib,sys
BASE=pathlib.Path(__file__).resolve().parents[2]
OUT=pathlib.Path(__file__).resolve().parent
MEDIA=pathlib.Path('/tmp/tuxracer-registration-independent-accept-oct29/repo/test/binaries/candidates/tuxracer-original-061a/game')
MAIN='3239df2388ec1599deb229b22ea1fb1e2b8f03fa'
class PE:
 def __init__(self,b):
  self.b=b
  if b[:2]!=b'MZ':raise ValueError('MZ')
  self.p=self.u32(60)
  if b[self.p:self.p+4]!=b'PE\0\0':raise ValueError('PE')
  self.o=self.p+24
  if self.u16(self.o)!=0x10b:raise ValueError('PE32 required')
  self.sections=[]
  for i in range(self.u16(self.p+6)):
   s=self.o+self.u16(self.p+20)+40*i
   self.sections.append((self.u32(s+12),self.u32(s+16),self.u32(s+20)))
 def u16(self,o):return struct.unpack_from('<H',self.b,o)[0]
 def u32(self,o):return struct.unpack_from('<I',self.b,o)[0]
 def off(self,r,n=1):
  if r<self.u32(self.o+60) and r+n<=len(self.b):return r
  for va,size,raw in self.sections:
   if va<=r and r+n<=va+size and raw+r-va+n<=len(self.b):return raw+r-va
  raise ValueError('unbacked RVA '+hex(r))
 def string(self,r):
  o=self.off(r);e=self.b.find(b'\0',o,min(o+4096,len(self.b)))
  if e<0:raise ValueError('unterminated string')
  self.off(r,e-o+1)
  return self.b[o:e].decode('ascii')
 def directory(self,i):return self.u32(self.o+96+8*i),self.u32(self.o+100+8*i)
 def imports(self):
  r,size=self.directory(1);result=[]
  if not r:return result
  for i in range(512):
   o=self.off(r+20*i,20);ilt=self.u32(o);iat=self.u32(o+16)
   if not iat:return result
   dll=self.string(self.u32(o+12));syms=[]
   for j in range(8192):
    v=self.u32(self.off((ilt or iat)+4*j,4))
    if not v:break
    syms.append({'ordinal':v&65535} if v&0x80000000 else {'name':self.string(v+2),'hint':self.u16(self.off(v,2))})
   else:raise ValueError('thunk bound')
   result.append({'dll':dll,'iltRva':ilt,'iatRva':iat,'symbols':syms})
  raise ValueError('descriptor bound')
 def exports(self):
  r,size=self.directory(0)
  if not r:return []
  o=self.off(r,40);base=self.u32(o+16);nf=self.u32(o+20);nn=self.u32(o+24)
  if max(nf,nn)>8192:raise ValueError('export bound')
  names={}
  for i in range(nn):
   idx=self.u16(self.off(self.u32(o+36)+2*i,2));name=self.string(self.u32(self.off(self.u32(o+32)+4*i,4)))
   if idx>=nf:raise ValueError('bad export ordinal')
   names.setdefault(idx,[]).append(name)
  result=[]
  for i in range(nf):
   v=self.u32(self.off(self.u32(o+28)+4*i,4))
   if v:result.append({'ordinal':base+i,'names':names.get(i,[]),'rva':v,'forward':self.string(v) if r<=v<r+size else None})
  return result

def collect():
 inventory=json.loads((BASE/'test/candidate-corpus/tuxracer-original-files.json').read_text())['files'];modules={}
 for pin in inventory:
  if pathlib.Path(pin['path']).suffix.lower() not in ('.dll','.exe'):continue
  b=(MEDIA/pin['path']).read_bytes();assert len(b)==pin['bytes'] and hashlib.sha256(b).hexdigest()==pin['sha256']
  pe=PE(b);modules[pathlib.Path(pin['path']).name.lower()]={**pin,'imports':pe.imports(),'exports':pe.exports(),'entryRva':pe.u32(pe.o+16),'tlsDirectory':pe.directory(9),'delayImportDirectory':pe.directory(13)}
 return modules
if __name__=='__main__':
 modules=collect();(OUT/'pe-contract.json').write_text(json.dumps({'main':MAIN,'modules':modules},indent=2)+'\n')
 for n,m in modules.items():
  print(n,m['sha256'],'exports',len(m['exports']))
  for d in m['imports']:print(' ',d['dll'],len(d['symbols']), ','.join(s.get('name','#'+str(s.get('ordinal'))) for s in d['symbols']))
