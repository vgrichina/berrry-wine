from work import *
import struct
seals=json.load(open(H/'remote-capture-seals.json'))
def png(p):
 b=p.read_bytes();assert b[:8]==b'\x89PNG\r\n\x1a\n';i=8;idat=[];kinds=[];width=height=None
 while i<len(b):
  n=struct.unpack('>I',b[i:i+4])[0];kind=b[i+4:i+8];data=b[i+8:i+8+n];crc=struct.unpack('>I',b[i+8+n:i+12+n])[0];assert zlib.crc32(kind+data)&0xffffffff==crc
  if kind==b'IHDR':width,height,depth,color,compression,filtration,interlace=struct.unpack('>IIBBBBB',data);assert (width,height,depth,color,interlace)==(840,660,8,6,0)
  if kind==b'IDAT':idat.append(data)
  kinds.append(kind);i+=n+12
 assert i==len(b) and kinds[-1]==b'IEND'
 raw=zlib.decompress(b''.join(idat));stride=width*4;assert len(raw)==height*(stride+1)
 out=bytearray(width*height*4)
 for y in range(height):
  mode=raw[y*(stride+1)];row=raw[y*(stride+1)+1:(y+1)*(stride+1)];assert mode in range(5)
  for x,v in enumerate(row):
   left=out[y*stride+x-4] if x>=4 else 0;above=out[(y-1)*stride+x] if y else 0;ul=out[(y-1)*stride+x-4] if y and x>=4 else 0
   if mode==1:v+=left
   elif mode==2:v+=above
   elif mode==3:v+=(left+above)//2
   elif mode==4:
    a=left+above-ul;pa=abs(a-left);pb=abs(a-above);pc=abs(a-ul);v+=left if pa<=pb and pa<=pc else above if pb<=pc else ul
   out[y*stride+x]=v&255
 return out
pixels=[]
for n in ['b39999.png','b40060.png']:
 p=H/'decision'/n;b=p.read_bytes();assert len(b)==seals[n]['bytes'] and sha(b)==seals[n]['sha256'] and len(b)<=4194304;pixels.append(png(p))
diff=[(i//4%840,i//4//840) for i in range(0,len(pixels[0]),4) if pixels[0][i:i+4]!=pixels[1][i:i+4]]
assert diff
startup=json.load(open(H/'startup/command.json'));guest=json.load(open(H/'decision/command.json'));terminal=json.load(open(H/'decision/terminal.json'))
sameEnvironment=startup['environmentSha256']==guest['environmentSha256'];assert startup['argv'][:2]==guest['argv'][:2];assert startup['limits']['fileBytes']==guest['limits']['fileBytes']==4194304
assert terminal['returncode']==0 and terminal['reason']=='natural' and not terminal['remainingGroup']
log=(H/'decision/output.log').read_text();assert len(log.encode())<=524288 and 'EFBIG' not in log
assert 'wParam=0x41 lParam=0x1e0001 batch=40033' in log and 'wParam=0x41 lParam=0xc01e0001 batch=40295' in log
eips=[x for x in log.splitlines() if x.startswith('[EIP]')];assert len(eips)==6 and not any(x.startswith('[EIP] 0x00406eb0') for x in eips)
assert 'mem[0x004130a0:8]=00 00 00 00 00 00 00 00' in eips[0]
assert 'mem[0x004130a0:8]=00 00 00 00 01 00 00 00' in eips[2] and 'mem[0x00410110:12]=09 00 00 00' in eips[2]
tools=[]
for name in [B,shutil.which('python3'),shutil.which('git')]:
 p=pathlib.Path(name).resolve();tools.append(dict(path=str(p),bytes=p.stat().st_size,sha256=sha(p.read_bytes())))
save('verification.json',dict(passEvidenceIntegrity=True,dimensions=[840,660],fullPNGCRCAndInflation=True,pixelChanges=len(diff),pixelChangeBounds=[min(x for x,y in diff),min(y for x,y in diff),max(x for x,y in diff),max(y for x,y in diff)],exactStartupConfig=sameEnvironment,startupEnvironmentSha256=startup['environmentSha256'],guestEnvironmentSha256=guest['environmentSha256'],qualification='REJECT_ENVIRONMENT_IDENTITY_MISMATCH' if not sameEnvironment else 'startup-qualified',actualAKeydownDispatchBatch=40033,actualAKeyupDispatchBatch=40295,count=[0,1],ammo=[10,9],finiteEIPLines=6,toolsStanding=tools,visualReviewSeparate=True))
print(json.dumps(json.load(open(H/'verification.json'))))
