"""Read-only identification of the original post-EULA dialog template."""
import json,pathlib,struct,hashlib
R=pathlib.Path('/home/user/aoe3-original-oct22');p=R/'installed/Age of Empires III/age3.exe';b=p.read_bytes()
u16=lambda o:struct.unpack_from('<H',b,o)[0]
u32=lambda o:struct.unpack_from('<I',b,o)[0]
pe=u32(0x3c);opt=pe+24;sections=opt+u16(pe+20)
def fileoff(rva):
 for i in range(u16(pe+6)):
  o=sections+i*40;vsize,va,size,raw=struct.unpack_from('<IIII',b,o+8)
  if va<=rva<va+max(size,vsize):return raw+rva-va
 raise ValueError(hex(rva))
base=fileoff(u32(opt+112));found=[]
def walk(off,keys):
 assert len(keys)<4
 count=u16(base+off+12)+u16(base+off+14)
 for i in range(count):
  name,value=struct.unpack_from('<II',b,base+off+16+i*8)
  key=name
  if name&0x80000000:
   q=base+(name&0x7fffffff);key=b[q+2:q+2+u16(q)*2].decode('utf-16le')
  path=keys+[key]
  if value&0x80000000:walk(value&0x7fffffff,path)
  else:
   rva,size=struct.unpack_from('<II',b,base+value);pos=fileoff(rva);data=b[pos:pos+size]
   marker='<unsupported>'.encode('utf-16le')
   if path[0]==5 and marker in data:
    found.append(dict(resourcePath=path,fileOffset=pos,size=size,sha256=hashlib.sha256(data).hexdigest(),markerOffset=data.index(marker),headerHex=data[:64].hex()))
walk(0,[])
out=dict(exeSha256=hashlib.sha256(b).hexdigest(),dialogs=found,note='RT_DIALOG=5; marker exists in original age3.exe bytes. This identifies the template, not why its runtime labels are empty.')
(R/'installed-audit/dialog-resource.json').write_text(json.dumps(out,indent=2)+'\n');print(json.dumps(out))
