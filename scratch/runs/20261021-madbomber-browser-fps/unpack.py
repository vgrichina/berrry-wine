# Read-only analysis copy: transcribe original UPX stub 416600..416706.
import struct,pathlib,json,hashlib
ROOT=pathlib.Path(__file__).parent
p=pathlib.Path('/home/user/wine-assembly/scratch/runs/20261018-madbomber-source/original/madbomber-0.2.5/madbomber.exe')
b=p.read_bytes();assert hashlib.sha256(b).hexdigest()=='72ad26d11ddabf72c668b69eda0c7c1daa634f5cade631303ba4e05eb5f5cc09'
pe=struct.unpack_from('<I',b,60)[0];n=struct.unpack_from('<H',b,pe+6)[0];op=struct.unpack_from('<H',b,pe+20)[0];mem=bytearray(0x18000)
for i in range(n):
 s=pe+24+op+i*40;size,va,raw,off=struct.unpack_from('<IIII',b,s+8);mem[va:va+raw]=b[off:off+raw]
src=0x12015;dst=0x1000;bits=0;offset=-1
# ADD EBX,EBX; if zero load LE32 and ADC with carry=1.
def bit():
 global bits,src
 carry=bits>>31;bits=(bits<<1)&0xffffffff
 if not bits:
  v=struct.unpack_from('<I',mem,src)[0];src+=4;carry=v>>31;bits=((v<<1)|1)&0xffffffff
 return carry
while True:
 if bit():mem[dst]=mem[src];dst+=1;src+=1;continue
 a=1
 while True:
  a=(a<<1)|bit()
  if bit():break
 a-=3
 if a>=0:
  a=((a<<8)|mem[src])&0xffffffff;src+=1
  if a==0xffffffff:break
  offset=-(a+1)
 length=bit()*2+bit()
 if not length:
  length=1
  while True:
   length=(length<<1)|bit()
   if bit():break
  length+=2
 length+=1+(offset < -0xd00)
 for i in range(length):mem[dst]=mem[dst+offset];dst+=1
# Original E8/E9 filter: 747 entries, stored 05 + big endian 24-bit target.
i=0x1000;count=0
while count<0x2eb:
 if mem[i] in [0xe8,0xe9] and mem[i+1]==5:
  v=int.from_bytes(mem[i+2:i+5],'big')-(i+1)+0x1000
  struct.pack_into('<I',mem,i+1,v&0xffffffff);i+=5;count+=1
 else:i+=1
(ROOT/'unpacked-analysis.bin').write_bytes(mem)
print(json.dumps({'sourceSha256':hashlib.sha256(b).hexdigest(),'unpackedEnd':hex(dst),'consumedTo':hex(src),'filterEntries':count,'analysisSha256':hashlib.sha256(mem).hexdigest()}))
# imports original UPX descriptor target-offset/name runs
pos=0x15000;imports=[]
while True:
 name,iat=struct.unpack_from('<II',mem,pos);pos+=8
 if not name:break
 dll=bytes(mem[0x17000+name:]).split(b'\0')[0].decode()
 while mem[pos]:
  pos+=1;end=mem.index(0,pos);nm=bytes(mem[pos:end]).decode();pos=end+1;imports.append({'dll':dll,'iat':hex(0x401000+iat),'name':nm});iat+=4
 pos+=1
(ROOT/'unpacked-imports.json').write_text(json.dumps(imports,indent=2))
