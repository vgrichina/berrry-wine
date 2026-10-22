from pathlib import Path
import struct,json,hashlib,subprocess,copy
E=Path(__file__).resolve().parent
P=Path('/home/user/wine-assembly/test/binaries/candidates/pirates-2004/dx9/dxdiagn.dll')
b=P.read_bytes();assert len(b)==1720320 and hashlib.sha256(b).hexdigest()=='50e31067ca6872ae0b7b35a65bf2a9d07c1de539b2d603a9472a48f5375c8307'
u16=lambda o:struct.unpack_from('<H',b,o)[0]
u32=lambda o:struct.unpack_from('<I',b,o)[0]
pe=u32(0x3c);assert b[pe:pe+4]==b'PE\0\0' and u16(pe+4)==0x14c and u16(pe+24)==0x10b
sections=[(u32(o+12),u32(o+16),u32(o+20)) for o in range(pe+24+u16(pe+20),pe+24+u16(pe+20)+40*u16(pe+6),40)]
def off(rva):
 for va,n,raw in sections:
  if va<=rva<va+n:return raw+rva-va
 raise ValueError(hex(rva))
def cstr(o):return b[o:b.index(0,o)].decode('ascii')
rows=[];o=off(u32(pe+128))
while u32(o+12):
 dll=cstr(off(u32(o+12)));ilt=u32(o) or u32(o+16);iat=u32(o+16);i=0
 while u32(off(ilt)+4*i):
  t=u32(off(ilt)+4*i);r=dict(dll=dll,iatRVA=hex(iat+4*i),iatVA=hex(u32(pe+52)+iat+4*i))
  if t&0x80000000:r['ordinal']=t&0xffff
  else:r.update(name=cstr(off(t)+2),hint=u16(off(t)))
  rows.append(r);i+=1
 o+=20
assert len(rows)==207 and sum('ordinal' in r for r in rows)==7
result=dict(path=str(P),bytes=len(b),sha256=hashlib.sha256(b).hexdigest(),machine='i386 PE32',securityDirectoryBytes=u32(pe+156),imports=rows,
 provenance='Retained Pirates fixture, exact user-authorized SHA256 and size; same SHA256 documented in retained BGE note. No download. PE security directory zero: no Authenticode signature verification claimed.')
(E/'provider.json').write_text(json.dumps(result,indent=2)+'\n')
print('PASS authentic retained asset identity; imports',len(rows))
