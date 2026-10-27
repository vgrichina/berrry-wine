from control import *
import struct
G=ROOT/'test/binaries/candidates/gta2-demo/installed/Program_Executable_Files'
rows=[]
for n in ['gta2.exe','Dmavideo.dll','d3ddll.dll','D3DPoly.dll']:
 p=G/n;b=p.read_bytes();pe=struct.unpack_from('<I',b,0x3c)[0];ns=struct.unpack_from('<H',b,pe+6)[0];opt=pe+24;size=struct.unpack_from('<H',b,pe+20)[0];base=struct.unpack_from('<I',b,opt+28)[0];sects=[]
 for i in range(ns):
  s=opt+size+i*40;name=b[s:s+8].rstrip(b'\0').decode();vs,rva,rawsize,raw=struct.unpack_from('<IIII',b,s+8);sects.append(dict(name=name,rva=rva,virtualSize=vs,raw=raw,rawSize=rawsize))
 def va(off):
  for s in sects:
   if s['raw']<=off<s['raw']+s['rawSize']:return base+s['rva']+off-s['raw']
 def off(rva):
  for s in sects:
   if s['rva']<=rva<s['rva']+s['rawSize']:return s['raw']+rva-s['rva']
  raise ValueError(hex(rva))
 def cstr(o):return b[o:b.index(b'\0',o)].decode('ascii',errors='replace')
 imports=[];irva=struct.unpack_from('<I',b,opt+104)[0]
 if irva:
  ip=off(irva)
  while any(b[ip:ip+20]):
   orig,_,_,nam,iat=struct.unpack_from('<IIIII',b,ip);dll=cstr(off(nam));tp=off(orig or iat);k=0
   while (v:=struct.unpack_from('<I',b,tp+k*4)[0]):
    sym=('#'+str(v&65535)) if v&0x80000000 else cstr(off(v)+2);imports.append(dict(dll=dll,name=sym,iatVA=hex(base+iat+k*4)));k+=1
   ip+=20
 strings=[]
 for needle in [b'Failed to set fullscreen',b'SetMode',b'Vid_Set',b'ChangeDisplaySettings',b'SetDisplayMode',b'EnumDisplayModes']:
  cur=0
  while (idx:=b.find(needle,cur))>=0:
   addr=va(idx);refs=[]
   if addr:
    packed=struct.pack('<I',addr);k=0
    while (k:=b.find(packed,k))>=0:refs.append(dict(offset=hex(k),va=hex(va(k)) if va(k) else None));k+=4
   strings.append(dict(text=cstr(idx),offset=hex(idx),va=hex(addr) if addr else None,refs=refs));cur=idx+len(needle)
 row=dict(path=str(p),bytes=len(b),sha256=sha(b),imageBase=hex(base),sections=sects,strings=strings,imports=imports);rows.append(row)
 print(n,hex(base),'strings',json.dumps(strings));print('graphics imports',json.dumps([x for x in imports if x['dll'].lower() in ['ddraw.dll','user32.dll']]))
save('pe-inventory.json',rows)
