import pathlib,struct,json,subprocess
r=pathlib.Path('/home/user/jedi-original-layout-install');b=pathlib.Path('/home/user/jedi-original/jedidemo.exe').read_bytes();code=(r/'seg2-unpacked.bin').read_bytes()
n=struct.unpack_from('<I',b,60)[0];rt=n+struct.unpack_from('<H',b,n+36)[0];shift=struct.unpack_from('<H',b,rt)[0];p=rt+2;resources=[]
while struct.unpack_from('<H',b,p)[0]:
 typ,count=struct.unpack_from('<HH',b,p);p+=8
 for i in range(count):
  off,size,flags,ident,handle,usage=struct.unpack_from('<HHHHHH',b,p);p+=12
  resources.append(dict(type=typ,id=ident,offset=off<<shift,bytes=size<<shift))
assert any(x['offset']==0xa450 for x in resources)
it=n+struct.unpack_from('<H',b,n+42)[0];mt=n+struct.unpack_from('<H',b,n+40)[0]
mods=[]
for i in range(struct.unpack_from('<H',b,n+30)[0]):
 q=it+struct.unpack_from('<H',b,mt+2*i)[0];mods.append(b[q+1:q+1+b[q]].decode('ascii'))
relocs=[];p=5464+31364
for i in range(struct.unpack_from('<H',b,p)[0]):
 a,t,s,m,o=struct.unpack_from('<BBHHH',b,p+2+8*i);chain=[];q=s
 while q!=65535 and q<len(code)-1 and q not in chain:
  chain.append(q);q=struct.unpack_from('<H',code,q)[0]
 if {0x1674,0x1681,0xa39,0xa66,0xaf2,0x18b6}.intersection(chain):relocs.append(dict(type=a,flags=t,module=mods[m-1],ordinal=o,sites=chain))
v=dict(resources=resources,modules=mods,relocations=relocs)
(r/'static-proof.json').write_text(json.dumps(v,indent=2))
parts=[]
for a,z in [(0xa2c,0xb42),(0xe4c,0xeab),(0x135c,0x149e),(0x1620,0x16b3),(0x186f,0x1948),(0x201a,0x2096),(0xca42,0xca66)]:
 parts.append(subprocess.run(['objdump','-D','-b','binary','-mi386','-M','addr16,data16,intel',f'--start-address={a}',f'--stop-address={z}',str(r/'seg2-unpacked.bin')],capture_output=True,text=True,check=True).stdout)
(r/'contract.dis').write_text('\n'.join(parts));print(json.dumps(v))
