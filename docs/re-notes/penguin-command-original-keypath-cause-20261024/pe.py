import struct,hashlib
from pathlib import Path
ROOT=Path('/home/user/wine-assembly-penguin-command-retained-closure-oct23/docs/re-notes/penguin-command-retained-closure-20261023/original/penguin-command-1.6.11')
class PE:
 def __init__(self,name):
  self.path=ROOT/name; self.d=self.path.read_bytes();d=self.d;p=self.u32(0x3c);n=self.u16(p+6);o=p+24;self.base=self.u32(o+28); self.dirs=[(self.u32(o+96+i*8),self.u32(o+100+i*8)) for i in range(16)];s=o+self.u16(p+20);self.sections=[]
  for i in range(n):
   q=s+i*40;self.sections.append((d[q:q+8].rstrip(b'\0').decode(),self.u32(q+12),self.u32(q+16),self.u32(q+20)))
 def u16(self,o):return struct.unpack_from('<H',self.d,o)[0]
 def u32(self,o):return struct.unpack_from('<I',self.d,o)[0]
 def off(self,va):
  for _,r,n,o in self.sections:
   if r<=va-self.base<r+n:return o+va-self.base-r
  raise ValueError(hex(va))
 def va(self,o):
  for _,r,n,f in self.sections:
   if f<=o<f+n:return self.base+r+o-f
 def z(self,o):return self.d[o:self.d.index(0,o)].decode(errors='replace')
 def imports(self):
  q=self.off(self.base+self.dirs[1][0]); out={}
  while self.u32(q+12):
   dll=self.z(self.off(self.base+self.u32(q+12)));a=self.u32(q) or self.u32(q+16);t=self.u32(q+16);i=0
   while (v:=self.u32(self.off(self.base+a+i*4))):
    name='#'+str(v&65535) if v&0x80000000 else self.z(self.off(self.base+v)+2);out[name]=(self.base+t+i*4,dll);i+=1
   q+=20
  return out
 def exports(self):
  q=self.off(self.base+self.dirs[0][0]);out={};a=self.off(self.base+self.u32(q+28));n=self.off(self.base+self.u32(q+32));t=self.off(self.base+self.u32(q+36))
  for i in range(self.u32(q+24)):
   name=self.z(self.off(self.base+self.u32(n+4*i)));out[name]=self.base+self.u32(a+4*self.u16(t+2*i))
  return out
if __name__=='__main__':
 for name in ['penguin-command.exe','SDL.dll']:
  p=PE(name);print(name,len(p.d),hashlib.sha256(p.d).hexdigest(),hex(p.base),p.sections)
  for k,v in p.imports().items():
   if any(x in k.lower() for x in ['key','message','event','scan','focus']):print('IMPORT',k,hex(v[0]),v[1])
  if name=='SDL.dll':
   for k,v in p.exports().items():
    if any(x in k for x in ['PollEvent','GetKeyState','PumpEvents','PeepEvents','GetModState']):print('EXPORT',k,hex(v),'offset',hex(p.off(v)))
  else:
   for k,(v,dll) in p.imports().items():
    if any(x in k for x in ['Event','KeyState']):
     needle=struct.pack('<I',v);pos=0
     while (pos:=p.d.find(needle,pos))>=0:
      print('XREF',k,hex(p.va(pos) or 0),'offset',hex(pos));pos+=4
