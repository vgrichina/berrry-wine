"""Independent read-only PE32 import/export review. Python stdlib only."""
import struct,json,hashlib,re,zipfile,copy
from pathlib import Path
OUT=Path(__file__).resolve().parent
DONOR=Path('/home/user/wine-assembly-penguin-command-retained-closure-oct23/docs/re-notes/penguin-command-retained-closure-20261023')
ROOT=DONOR/'original/penguin-command-1.6.11'
CRT=Path('/home/user/wine-assembly/test/binaries/dlls/msvcrt.dll')
HOST=Path('/home/user/wine-assembly')
def pe(path):
 b=path.read_bytes()
 def u16(o):return struct.unpack_from('<H',b,o)[0]
 def u32(o):return struct.unpack_from('<I',b,o)[0]
 assert b[:2]==b'MZ'
 h=u32(60);assert b[h:h+4]==b'PE\0\0' and u16(h+4)==0x14c
 op=h+24;assert u16(op)==0x10b
 sections=[]
 for i in range(u16(h+6)):
  s=op+u16(h+20)+40*i
  sections.append({'name':b[s:s+8].rstrip(b'\0').decode(),'va':u32(s+12),'virtual_size':u32(s+8),'raw':u32(s+20),'raw_size':u32(s+16)})
 def offset(r):
  if r<u32(op+60):return r
  for s in sections:
   if s['va']<=r<s['va']+s['raw_size']:return r-s['va']+s['raw']
  raise ValueError(('unbacked RVA',path.name,hex(r)))
 def z(o):return b[o:b.index(0,o)].decode('ascii')
 imports=[];ir=u32(op+104)
 if ir:
  d=offset(ir)
  while any(b[d:d+20]):
   oft,_,_,name,iat=struct.unpack_from('<IIIII',b,d);dll=z(offset(name)).lower();t=offset(oft or iat)
   while u32(t):
    v=u32(t);imports.append({'dll':dll,**({'ordinal':v&65535} if v&0x80000000 else {'name':z(offset(v)+2)})});t+=4
   d+=20
 exports={};export_dll=None;er=u32(op+96);esz=u32(op+100)
 if er:
  e=offset(er);export_dll=z(offset(u32(e+12)));base=u32(e+16);nf=u32(e+20);nn=u32(e+24);ft=offset(u32(e+28));nt=offset(u32(e+32));ot=offset(u32(e+36))
  for i in range(nn):
   name=z(offset(u32(nt+4*i)));idx=u16(ot+2*i);assert idx<nf
   r=u32(ft+4*idx)
   exports[name]={'ordinal':base+idx,'rva':r,'forwarder':z(offset(r)) if er<=r<er+esz else None}
 return {'path':str(path),'sha256':hashlib.sha256(b).hexdigest(),'bytes':len(b),'pe_offset':h,'image_base':u32(op+28),'entry_rva':u32(op+16),'import_rva':ir,'export_rva':er,'export_dll':export_dll,'sections':sections,'imports':imports,'exports':exports}
images={p.name.lower():pe(p) for p in sorted(ROOT.iterdir()) if p.suffix.lower() in ('.exe','.dll')}
assert len(images)==8
images['msvcrt.dll']=pe(CRT)
assert images['msvcrt.dll']['sha256']=='887eb5ce93edb7192ca3e9220f07f9ca0f94db02af5862ebcbdfcb852db99fd1'
system={'kernel32.dll','user32.dll','gdi32.dll','advapi32.dll','winmm.dll'}
api={r['name'] for r in json.loads((HOST/'src/api_table.json').read_text())}
def closure(img):
 edges=[];gaps=[]
 for m in re.finditer(rb'(?:jpeg|png)_[A-Za-z0-9_]+\x00',(ROOT/'SDL_image.dll').read_bytes()):
  symbol=m.group()[:-1].decode();dll='jpeg.dll' if symbol.startswith('jpeg_') else 'libpng12-0.dll'
  assert dll in img and symbol in img[dll]['exports'] and img[dll]['exports'][symbol]['rva'],('dynamic candidate unavailable',dll,symbol)
 for name,p in img.items():
  for row in p['imports']:
   assert 'ordinal' not in row
   dll=row['dll'];symbol=row['name']
   if dll in system:
    if symbol not in api:gaps.append((dll,symbol))
    provider='system inventory'
   else:
    assert dll in img,('missing provider',dll)
    ex=img[dll]['exports'];assert symbol in ex and ex[symbol]['rva'],('missing export',dll,symbol)
    assert not ex[symbol]['forwarder'],('forwarder',dll,symbol)
    provider=dll
   edges.append({'consumer':name,**row,'provider':provider})
 return edges,sorted(set(gaps))
edges,gaps=closure(images)
assert len(edges)==682 and gaps==[('winmm.dll','midiStreamStop'),('winmm.dll','waveOutGetErrorTextA')]
producer=json.loads((DONOR/'dependency-closure.json').read_text())
assert sorted((Path(r['consumer']).name.lower(),r['dll'].lower(),r['name']) for r in producer['imports'])==sorted((r['consumer'],r['dll'],r['name']) for r in edges)
controls=[]
for dll in ('sdl.dll','sdl_image.dll','sdl_mixer.dll','jpeg.dll','libpng12-0.dll','zlib1.dll','msvcrt.dll'):
 altered=copy.deepcopy(images);del altered[dll]
 try:closure(altered)
 except AssertionError:controls.append('reject omitted '+dll)
 else:raise AssertionError(('omission accepted',dll))
altered=copy.deepcopy(images);del altered['zlib1.dll']['exports']['inflate']
try:closure(altered)
except AssertionError:controls.append('reject missing zlib inflate export')
else:raise AssertionError('export control failed')
altered=copy.deepcopy(images);altered['jpeg.dll']['exports']=images['zlib1.dll']['exports']
try:closure(altered)
except AssertionError:controls.append('reject wrong JPEG provider export table')
else:raise AssertionError('provider control failed')
codec=[];ib=(ROOT/'SDL_image.dll').read_bytes()
for m in re.finditer(rb'(?:jpeg|png)_[A-Za-z0-9_]+\x00',ib):
 name=m.group()[:-1].decode();dll='jpeg.dll' if name.startswith('jpeg_') else 'libpng12-0.dll'
 if name in {x['symbol'] for x in codec}:continue
 assert name in images[dll]['exports'] and images[dll]['exports'][name]['rva']
 codec.append({'symbol':name,'file_offset':m.start(),'provider':dll,'export':images[dll]['exports'][name]})
assert len(codec)==25
strings={}
for f in ('penguin-command.exe','penguin-command-windowed.exe','SDL_image.dll'):
 b=(ROOT/f).read_bytes();strings[f]=[{'offset':m.start(),'text':m.group().decode()} for m in re.finditer(rb'[\x20-\x7e]{4,}',b) if any(t in m.group().lower() for t in (b'--window',b'--nosound',b'penguin-command.dat',b'data/gfx',b'data\\gfx',b'jpeg.dll',b'libpng',b'normal game',b'arcade game'))]
assert any(x['text']=='penguin-command --windowed' for x in strings['penguin-command-windowed.exe'])
assert any(r['name']=='CreateProcessA' for r in images['penguin-command-windowed.exe']['imports'])
assert not any(r['name']=='CreateProcessA' for r in images['penguin-command.exe']['imports'])
archive=Path('/home/user/wine-assembly-penguin-command-original-oct23/docs/re-notes/penguin-command-original-20261023/archive.zip')
with zipfile.ZipFile(archive) as z:
 assert z.read('penguin-command-1.6.11/penguin-command.exe')==(ROOT/'penguin-command.exe').read_bytes()
gfx=sorted(p.relative_to(ROOT).as_posix() for p in (ROOT/'data/gfx').iterdir() if p.suffix.lower() in ('.png','.jpg'))
sound=sorted(p.relative_to(ROOT).as_posix() for p in (ROOT/'data/sound').iterdir() if p.suffix.lower() in ('.wav','.s3m'))
assert len(gfx)==83 and len(sound)==8 and not (ROOT/'penguin-command.dat').exists()
(OUT/'independent-pe.json').write_text(json.dumps(images,indent=2)+'\n')
(OUT/'results.json').write_text(json.dumps({'verdict':'ACCEPT scoped static closure','PE32_original':8,'with_CRT':9,'edges':edges,'gaps':gaps,'ordinal_imports':0,'controls':controls,'codec_candidates':codec,'selected_original_strings':strings,'graphics':gfx,'optional_sound':sound},indent=2)+'\n')
print(json.dumps({'result':'PASS','original_PE32':8,'edges':len(edges),'codec_candidates':len(codec),'rejecting_controls':controls,'system_gaps':gaps,'graphics':len(gfx),'sound':len(sound)}))
