from control import *
import struct
rows=json.loads((O/'pe-inventory.json').read_text())
for row in rows:
 b=pathlib.Path(row['path']).read_bytes();pe=struct.unpack_from('<I',b,60)[0];base=int(row['imageBase'],16)
 def off(rva):
  for s in row['sections']:
   if s['rva']<=rva<s['rva']+s['rawSize']:return s['raw']+rva-s['rva']
  raise ValueError(hex(rva))
 er=struct.unpack_from('<I',b,pe+24+96)[0]
 if not er:continue
 ep=off(er);ordinal,nf,nn,ft,nt,ot=struct.unpack_from('<IIIIII',b,ep+16);exports=[]
 for i in range(nn):
  nr=struct.unpack_from('<I',b,off(nt)+i*4)[0];p=off(nr);name=b[p:b.index(b'\0',p)].decode();idx=struct.unpack_from('<H',b,off(ot)+i*2)[0];rva=struct.unpack_from('<I',b,off(ft)+idx*4)[0];exports.append(dict(name=name,ordinal=ordinal+idx,va=hex(base+rva),offset=hex(off(rva))))
 row['exports']=exports;print(pathlib.Path(row['path']).name,json.dumps([e for e in exports if any(x in e['name'] for x in ['SetMode','SetDevice','Init','CheckMode'])]))
save('pe-exports.json',rows)
