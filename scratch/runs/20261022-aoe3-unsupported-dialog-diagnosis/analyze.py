"""Bounded original-byte acquisition and offline PE/resource analysis; no guest execution."""
import base64, concurrent.futures, hashlib, json, pathlib, struct, subprocess, sys
E = pathlib.Path(__file__).resolve().parent
EXPECTED = {'age3.exe': (8826880, '5d7fb9a8ae28e3e3758cee1346b2960f20ba7b4feaa511fa7f52ceffeeeca256'), 'stringtable.xml': (2404654, '62fa66202af9e6ea6b98a7bb4b429a6fc724f51b57831c2b3062253ddb249f17')}
def sha(b): return hashlib.sha256(b).hexdigest()
def save(n,x): (E/n).write_text(json.dumps(x,indent=2)+'\n')
def fetch():
 receipts=[]
 for name,(size,digest) in EXPECTED.items():
  p=E/'original'/name
  remote='/home/user/aoe3-original-oct22/installed/Age of Empires III/'+('data/' if name.endswith('.xml') else '')+name
  def chunk(off):
   code='import base64; f=open(%r,"rb"); f.seek(%d); print(base64.b64encode(f.read(36000)).decode())'%(remote,off)
   r=subprocess.run(['boat','exec','--json','bx_5mu9dnhg','--','python3','-c',code],capture_output=True,text=True)
   j=json.loads(r.stdout); assert r.returncode==0 and j['exitCode']==0 and not j['stdoutTruncated'],j
   b=base64.b64decode(j.pop('stdout').strip(),validate=True); j.update(offset=off,bytes=len(b),sha256=sha(b),path=remote)
   return b,j
  with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
   out=list(pool.map(chunk,range(0,size,36000)))
  b=b''.join(x[0] for x in out); assert len(b)==size and sha(b)==digest,(name,len(b),sha(b))
  p.write_bytes(b);receipts.extend(x[1] for x in out)
 save('acquisition.json',receipts)
def analyze():
 b=(E/'original/age3.exe').read_bytes(); assert (len(b),sha(b))==EXPECTED['age3.exe']
 u16=lambda o:struct.unpack_from('<H',b,o)[0]
 u32=lambda o:struct.unpack_from('<I',b,o)[0]
 pe=u32(0x3c);opt=pe+24;image=u32(opt+28);s=opt+u16(pe+20)
 sections=[]
 for i in range(u16(pe+6)):
  o=s+i*40;vsize,va,size,raw=struct.unpack_from('<IIII',b,o+8)
  sections.append(dict(name=b[o:o+8].rstrip(b'\0').decode(),rva=va,vsize=vsize,size=size,raw=raw))
 def off(rva):
  for x in sections:
   if x['rva']<=rva<x['rva']+max(x['size'],x['vsize']):return x['raw']+rva-x['rva']
  raise ValueError(hex(rva))
 def va(o):
  for x in sections:
   if x['raw']<=o<x['raw']+x['size']:return image+x['rva']+o-x['raw']
 def refs(value):
  needle=struct.pack('<I',value);out=[];start=0
  while (o:=b.find(needle,start))>=0:
   out.append(dict(offset=o,va=hex(va(o))));start=o+1
  return out
 root=off(u32(opt+112));resources=[]
 def walk(at,keys):
  for i in range(u16(root+at+12)+u16(root+at+14)):
   n,v=struct.unpack_from('<II',b,root+at+16+i*8); path=keys+[n]
   if v&0x80000000:walk(v&0x7fffffff,path)
   else:
    rva,size=struct.unpack_from('<II',b,root+v);pos=off(rva);resources.append(dict(path=path,offset=pos,va=hex(image+rva),bytes=size,sha256=sha(b[pos:pos+size])))
 walk(0,[])
 imports=[];at=off(u32(opt+104))
 while u32(at+12):
  dll=b[off(u32(at+12)):].split(b'\0',1)[0].decode();lookup=off(u32(at) or u32(at+16));iat=image+u32(at+16);i=0
  while (v:=u32(lookup+4*i)):
   name=('ordinal:'+str(v&65535)) if v&0x80000000 else b[off(v)+2:].split(b'\0',1)[0].decode()
   imports.append(dict(dll=dll,name=name,iat=hex(iat+4*i)));i+=1
  at+=20
 save('iat.json',imports)
 targets={0x488e50,0x486e30,0x8e4bc0,0x918790,0x489eaa,0x918670,0x8e7380}
 callrefs=[]
 for x in sections:
  if x['name']!='.text':continue
  for o in range(x['raw'],x['raw']+x['size']-5):
   if b[o]==0xe8:
    target=(va(o)+5+struct.unpack_from('<i',b,o+1)[0])&0xffffffff
    if target in targets:callrefs.append(dict(va=hex(va(o)),target=hex(target),offset=o))
 save('call-refs.json',callrefs)
 dialogs=[]
 for r in resources:
  if r['path'][0]!=5:continue
  if r['path'][1] not in [177,176,175]:continue
  p=r['offset']; ext=u16(p+2)==65535
  if not ext:continue
  count=u16(p+16);q=p+26
  def field():
   nonlocal q
   if u16(q)==65535:
    v={'ordinal':u16(q+2)};q+=4;return v
   start=q
   while u16(q):q+=2
   v=b[start:q].decode('utf-16le');q+=2;return v
  menu,cls,title=field(),field(),field()
  if u32(p+12)&0x40:
   q+=6;font=field()
  controls=[]
  for i in range(count):
   q=(q+3)&~3;start=q;style=u32(q+8);cid=u32(q+20);q+=24
   c,t=field(),field();extra=u16(q);q+=2+extra
   controls.append(dict(id=cid,cls=c,title=t,style=hex(style),offset=start))
  dialogs.append(dict(resource=r,title=title,controls=controls))
 save('dialogs.json',dialogs)
 import xml.etree.ElementTree as ET
 xb=(E/'original/stringtable.xml').read_bytes();assert (len(xb),sha(xb))==EXPECTED['stringtable.xml']
 tree=ET.fromstring(xb);wanted={19884,19887,19888,19889,19890,19891};rows=[]
 for x in tree.iter('String'):
  if int(x.get('_locID','0')) in wanted:rows.append(dict(x.attrib,text=x.text))
 assert {int(x['_locID']) for x in rows}==wanted
 save('localized-labels.json',rows)
 import uuid
 save('xml-guids.json',[dict(va=hex(v),offset=off(v-image),bytes=b[off(v-image):off(v-image)+16].hex(),guid=str(uuid.UUID(bytes_le=b[off(v-image):off(v-image)+16]))) for v in [0xbcc9d8,0xbcc9e8]])
 names=[]
 for v in [0xb535b0,0xb53588,0xbcc9f8]:
  p=off(v-image);q=p
  while u16(q):q+=2
  names.append(dict(va=hex(v),offset=p,text=b[p:q].decode('utf-16le')))
 save('xml-names.json',names)
 hits=[]
 for needle in [b'\x68\xb1\0\0\0', b'\x68\x08\x04\0\0', b'\x68\x0a\x04\0\0', b'\x68\x0b\x04\0\0', b'\x68\x0c\x04\0\0']:
  start=0
  while (p:=b.find(needle,start))>=0:
   hits.append(dict(hex=needle.hex(),offset=p,va=hex(va(p))));start=p+1
 save('pe-analysis.json',dict(exe=EXPECTED['age3.exe'],imageBase=hex(image),sections=sections,resources=resources,immediateHits=hits))
 # Static strings containing diagnostic/localization terms, with exact VA and xrefs.
 import re
 terms=re.compile('unsupported|requirement|StringTable|syscheck|system.*check|failed.*xml',re.I)
 strings=[]
 for pat,enc in [(rb'[\x20-\x7e]{5,}', 'ascii'),(rb'(?:[\x20-\x7e]\x00){5,}','utf-16le')]:
  for m in re.finditer(pat,b):
   text=m.group().decode(enc)
   if terms.search(text):strings.append(dict(text=text,offset=m.start(),va=hex(va(m.start())),refs=refs(va(m.start()))))
 save('strings.json',strings)
 # Negative controls: changed full-file hash, absent resource/string IDs, and truncated XML.
 dlg=[x for x in resources if x['path']==[5,177,1033]];assert len(dlg)==1
 assert dlg[0]['offset']==8631880 and dlg[0]['bytes']==432 and dlg[0]['sha256']=='9c2480eae1444b90eff519a7451235f21a4ee79ea175b86605fc240f5a659fb6'
 assert sha(b[:-1]+bytes([b[-1]^1]))!=EXPECTED['age3.exe'][1]
 assert not any(x['path']==[5,65535,1033] for x in resources)
 assert all(c['title'] for c in dialogs[0]['controls'] if c['id']!=1030)
 assert all(x['text'] for x in rows)
 assert not any(x.get('_locID')=='65535' for x in tree.iter('String'))
 try:ET.fromstring(xb[:-50])
 except ET.ParseError:pass
 else:raise AssertionError('truncated XML accepted')
 save('controls.json',{'identityPositive':True,'changedByteRejected':True,'falseDialogIdRejected':True,'templateLabelsNotEmpty':True,'sixOriginalLocalizedStringsNotEmpty':True,'missingStringIdRejected':True,'truncatedXmlRejected':True,'dialog177Exact':dlg[0]})
 # Preserve exact focused disassembly and tested-source excerpts, with full blob pins.
 ranges={'dialog-proc':(0x486e30,0x4871cb),'check-and-create':(0x4888e0,0x488ed1),'string-lookup':(0x8e45f0,0x8e4704),'lookup-manager':(0x918670,0x9186c2),'string-manager-load':(0x918790,0x918867),'string-table':(0x930530,0x930a00),'startup-load-and-check':(0x489eaa,0x48a1e6),'xml-load':(0x8e9680,0x8e997e),'xml-open':(0x8e7380,0x8e7423),'string-load-wrapper':(0x8e4bc0,0x8e4bfd)}
 for n,(lo,hi) in ranges.items():
  r=subprocess.run(['objdump','-d','-Mintel','--start-address='+hex(lo),'--stop-address='+hex(hi),str(E/'original/age3.exe')],capture_output=True,check=True)
  (E/(n+'.asm')).write_bytes(r.stdout)
 source={'src/10-helpers.wat':[(8120,8170),(8321,8385),(8672,8790)],'src/09a-handlers1-user.wat':[(2080,2145),(2220,2248),(2280,2305)],'src/09a5c-handlers-wide.wat':[(360,426)],'src/09a5-handlers-window.wat':[(4350,4387),(3668,3689)],'src/09c3a-dialog-runtime.wat':[(412,582)],'src/09a7-handlers-dispatch.wat':[(3243,3260),(3460,3530)],'test/run.js':[(292,307),(883,899)]}
 pins=[];(E/'source').mkdir(exist_ok=True)
 for path,spans in source.items():
  data=subprocess.check_output(['git','-C',str(E.parents[2]),'show','c26252c4a95babe583ade1d1c6e2da0c050be45c:'+path],stderr=subprocess.DEVNULL)
  oid=subprocess.check_output(['git','-C',str(E.parents[2]),'rev-parse','c26252c4:'+path],stderr=subprocess.DEVNULL).decode().strip()
  lines=data.decode().splitlines();out='\n'.join('\n'.join(f'{i}: {lines[i-1]}' for i in range(lo,min(hi,len(lines))+1)) for lo,hi in spans)+'\n'
  dest=E/'source'/(path.replace('/','__')+'.txt');dest.write_text(out)
  pins.append(dict(path=path,gitBlob=oid,sha256=sha(data),spans=spans,excerptSha256=sha(dest.read_bytes())))
 save('source-pins.json',pins)
 (E/'dialog177.bin').write_bytes(b[8631880:8631880+432])
if __name__=='__main__':
 if sys.argv[1:] == ['fetch']:fetch()
 else:analyze()
