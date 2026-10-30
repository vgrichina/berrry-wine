"""Render-only targeting: decode ordinary harness PNGs; never inspect guest state."""
import struct,zlib,pathlib,json

def pixels(path):
 b=pathlib.Path(path).read_bytes(); assert b[:8]==b'\x89PNG\r\n\x1a\n'
 pos=8; chunks=[]
 while pos<len(b):
  n=struct.unpack('>I',b[pos:pos+4])[0];kind=b[pos+4:pos+8];data=b[pos+8:pos+8+n];pos+=12+n
  if kind==b'IHDR':w,h,depth,color,_,_,interlace=struct.unpack('>IIBBBBB',data)
  if kind==b'IDAT':chunks.append(data)
 assert (w,h)==(640,480) and depth==8 and color in (2,6) and interlace==0
 c=3 if color==2 else 4;stride=w*c;raw=zlib.decompress(b''.join(chunks));rows=[];prior=bytearray(stride)
 for y in range(h):
  off=y*(stride+1);f=raw[off];row=bytearray(raw[off+1:off+1+stride])
  for x in range(stride):
   a=row[x-c] if x>=c else 0;u=prior[x];ul=prior[x-c] if x>=c else 0
   if f==1:v=a
   elif f==2:v=u
   elif f==3:v=(a+u)//2
   elif f==4:
    p=a+u-ul;pa=abs(p-a);pb=abs(p-u);pc=abs(p-ul);v=a if pa<=pb and pa<=pc else u if pb<=pc else ul
   else:assert f==0;v=0
   row[x]=(row[x]+v)&255
  rows.append(row);prior=row
 return rows,c

def observe(path):
 rows,c=pixels(path);points=set()
 # The brick playfield is red/brown; bomb outlines are near-neutral black.
 # Exclude scenery/bomber above y155, buckets below y350 and black side borders.
 for y in range(155,350):
  row=rows[y]
  for x in range(40,600):
   r,g,b=row[x*c:x*c+3]
   if max(r,g,b)<72 and max(r,g,b)-min(r,g,b)<22:points.add((x,y))
 bombs=[]
 while points:
  p=points.pop();stack=[p];component=[p]
  while stack:
   x,y=stack.pop()
   for n in ((x-1,y),(x+1,y),(x,y-1),(x,y+1)):
    if n in points:points.remove(n);stack.append(n);component.append(n)
  xs=[p[0] for p in component];ys=[p[1] for p in component]
  w=max(xs)-min(xs)+1;h=max(ys)-min(ys)+1
  if 9<=w<=30 and 9<=h<=35 and len(component)>=45:
   bombs.append({'x':(min(xs)+max(xs))//2,'y':(min(ys)+max(ys))//2,'area':len(component)})
 # Bucket blue water forms distinct horizontal bands; counts are visual only.
 bucketBands=[]
 for y in range(352,430):
  n=sum(1 for x in range(35,605) if rows[y][x*c+2]>110 and rows[y][x*c]<70 and rows[y][x*c+1]<120)
  if n>=12 and (not bucketBands or y>bucketBands[-1][-1]+1):bucketBands.append([y])
  elif n>=12:bucketBands[-1].append(y)
 # Preserve score-band fingerprint. Final numeric score is visually reviewed.
 score=bytes(v for row in rows[:39] for v in row[540*c:610*c])
 import hashlib
 return {'bombs':sorted(bombs,key=lambda b:-b['y']), 'buckets':len(bucketBands), 'scorePixelsSHA256':hashlib.sha256(score).hexdigest()}

if __name__=='__main__':
 import sys
 for p in sys.argv[1:]:print(json.dumps({'path':p,'observation':observe(p)}))
