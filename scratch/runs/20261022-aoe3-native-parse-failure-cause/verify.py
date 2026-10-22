"""Validate real recorded evidence against full raw log and original native PE."""
import pathlib,json,gzip,hashlib,struct,copy,subprocess
E=pathlib.Path(__file__).resolve().parent
sha=lambda b:hashlib.sha256(b).hexdigest()
def validate(ev):
 assert all(x['instanceId']=='main' for x in ev)
 def block(ip):
  a=[x for x in ev if x['kind']=='block' and x['ip']==ip];assert len(a)==1,hex(ip);return a[0]
 def api(name):
  a=[x for x in ev if x['kind']=='api-entry' and x['name']==name];assert len(a)==1,name;return a[0]
 load=api('LoadLibraryA');assert load['request']=='OLEAUT32.dll' and load['ret']==0x1779c69
 loaded=block(0x1779c69);assert loaded['regs']['eax']==0x400000
 gpa=api('GetProcAddress');assert gpa['args'][:2]==[0x400000,8] and gpa['request']=={'ordinal':8} and gpa['ret']==0x1779bfb
 returned=block(0x1779bfb);assert returned['regs']['eax']==0 and returned['regs']['esp']==gpa['regs']['esp']+12
 raised=api('RaiseException');assert raised['args'][:3]==[0xc06d007f,0,1] and raised['ret']==0x17d00b7
 d=raised['delayInfo'];assert d['dll']=='OLEAUT32.dll' and d['procedure']==8 and d['words'][4]==0 and d['words'][6:]==[0x400000,0,0]
 assert block(0x17d0081)['regs']['eax']==0 # actual GetLastError guest continuation
 assert block(0x17d825d)['regs']['edi']==0xc06d007f # executed native exception filter
 assert block(0x1780c90)['regs']['eax']==0xc06d007f
 assert block(0x17ae549)['regs']['eax']==0xc06d007f
 ret=block(0x17ae567);assert ret['regs']['eax']==0xc06d007f and ret['stack'][0]==0x8e9904
 final=block(0x8e9904);assert final['regs']['eax']==0xc06d007f
 assert final['regs']['esp']==block(0x8e98fb)['regs']['esp']==0x74fe1c8
 assert final['stack'][:12]==block(0x8e98fb)['stack'][:12]
 assert block(0x489ece)['regs']['eax']&255==0
 assert load['seq']<loaded['seq']<gpa['seq']<returned['seq']<raised['seq']<final['seq']<block(0x8e990d)['seq']
 for ip in [0x8e98b7,0x8e98ca,0x8e98dc]:assert block(ip)['regs']['eax']==0
 start=block(0x17ae4f4);assert start['stack'][:3]==[0x8e9904,0x18e4a08,0x900e410]
 entry=block(0x1779af5);assert entry['stack'][:6]==[0x1779af1,0x1857d4c,0x1859080,0,0x18e4a08,0x17a62bc]
 return True
ev=[json.loads(l) for l in (E/'raw/boundary.jsonl').read_text().splitlines()];assert len(ev)==258;validate(ev)
summary=json.loads((E/'raw/trace-summary.json').read_text());expected={x['rawLine']:x for x in ev};h=hashlib.sha256();offset=0;count=0
with gzip.open(E/'raw/output.log.gz','rb') as f:
 for n,line in enumerate(f,1):
  h.update(line)
  if n in expected:
   x=expected[n];assert line.startswith(b'[BOUNDARY] ') and offset==x['rawByte'];r=json.loads(line[11:]);assert r=={k:v for k,v in x.items() if k not in ['rawLine','rawByte']};count+=1
  offset+=len(line)
assert (offset,n,h.hexdigest(),count)==(summary['rawBytes'],summary['rawLines'],summary['rawSha256'],258)
for x in json.loads((E/'raw/collected-manifest.json').read_text()):
 p=E/'raw'/x['path'];assert p.stat().st_size==x['size'] and sha(p.read_bytes())==x['sha256']
# Independently map native sections and apply original HIGHLOW relocations.
b=gzip.decompress((E/'msxml4.dll.gz').read_bytes());assert sha(b)=='83206377ad3c28a1cc9f11ec0bfd6ef0abd196ee999f556074ff885f29ed99f1'
pe=struct.unpack_from('<I',b,60)[0];base=struct.unpack_from('<I',b,pe+52)[0];assert base==0x69b10000
image=bytearray(struct.unpack_from('<I',b,pe+80)[0]);ns=struct.unpack_from('<H',b,pe+6)[0];opts=struct.unpack_from('<H',b,pe+20)[0]
for i in range(ns):
 o=pe+24+opts+i*40;vs,va,size,raw=struct.unpack_from('<IIII',b,o+8);image[va:va+size]=b[raw:raw+size]
rva,size=struct.unpack_from('<II',b,pe+24+96+5*8);end=rva+size
while rva<end:
 va,n=struct.unpack_from('<II',image,rva);assert n>=8
 for i in range(8,n,2):
  r=struct.unpack_from('<H',image,rva+i)[0]
  if r>>12==3:
   a=va+(r&4095);v=struct.unpack_from('<I',image,a)[0];struct.pack_into('<I',image,a,(v+0x1766000-base)&0xffffffff)
 rva+=n
native=0
for x in ev:
 if x['kind']=='block' and 0x1766000<=x['ip']<0x1894000:
  a=x['ip']-0x1766000;assert bytes(x['code'])==image[a:a+32],x['seq'];native+=1
obj=next(x for x in ev if x.get('ip')==0x8e98bf);assert obj['vtable']==0x17aeff8
r=obj['vtable']-0x1766000;assert bytes(obj['vtableBytes'])==image[r:r+96]
assert [struct.unpack_from('<I',bytes(obj['vtableBytes']),i)[0] for i in [0x28,0x38,0x50]]==[0x1809464,0x17ae41e,0x17ae4f4]
assert image[0x402b6:0x402bc]==bytes.fromhex('ff1580908501') # real ordinal-8 delay call via IAT
assert struct.unpack_from('<I',image,0xf1eb8+21*4)[0]==0x80000008
negatives=[]
for name,mut in [('missing-guest-return',lambda a:a.__setitem__(slice(None),[x for x in a if x.get('ip')!=0x1779bfb])),('stale-native-EAX',lambda a:next(x for x in a if x.get('ip')==0x1779bfb)['regs'].__setitem__('eax',0x400000)),('wrong-instance',lambda a:a[220].__setitem__('instanceId','cooperative:2')),('missing-raised-exception',lambda a:a.__setitem__(slice(None),[x for x in a if not(x['kind']=='api-entry' and x.get('name')=='RaiseException')])),('wrong-ordinal',lambda a:next(x for x in a if x.get('name')=='GetProcAddress')['args'].__setitem__(1,7))]:
 a=copy.deepcopy(ev);mut(a)
 try:validate(a)
 except AssertionError:negatives.append(name)
 else:raise AssertionError('negative accepted: '+name)
pins=json.loads((E/'staging-gate-result.json').read_text());assert pins['passAll'] and len(pins['pins'])==373
assert json.loads((E/'raw/postflight.json').read_text())['pins']==373
state=json.loads((E/'raw/process-state.json').read_text());assert not state['present'] and set(state['portsConnectEx'].values())=={111}
root=pathlib.Path('/home/user/wine-assembly');protected=json.loads((E/'root-protected.json').read_text())
for p,v in protected.items():
 actual=subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip() if p=='HEAD' else sha((root/p).read_bytes());assert actual==v,p
print(json.dumps({'PASS':True,'records':len(ev),'nativeCodeBlocksMatchedToExactRelocatedPE':native,'fullRawBytes':offset,'fullRawSha256':h.hexdigest(),'prePostPins':373,'negativesRejected':negatives,'protectedRootUnchanged':True},indent=2))
