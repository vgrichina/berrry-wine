#!/usr/bin/env python3
"""Offline, read-only proof/recipe for the retained Maelstrom 3.0.6 Win32 bytes.
No guest execution, mutation, networking, compilation, or harness instantiation.
"""
import argparse, hashlib, json, os, pathlib, struct, subprocess, tempfile, zlib, collections
EXE_SHA='0eca5703e512d33c5e5a0bc1a27f14bd3aa4ecddded6e09b4d4019c2f27a15e5'
SDL_SHA='02433232425e68009843bd3ecec20ad67453a48487f7b5828c595b76e2f9d373'
HARNESS_SHA='4d7b9587676db38fcf3314807acb2b2a42b5f09d2c98fcf3dccb8a6cde9e1809'
# Each expected sequence was independently decoded by GNU objdump on ORIGINAL bytes.
ANCHORS=[
 ('RunPlayGame',0x40b0c0,'8b0d74f94100'),
 ('NewGame',0x406230,'833dfcf9410001'),
 ('NextWave',0x4064f0,'a1d8f94100'),
 ('Player_NewGame',0x411300,'b801000000'),
 ('Player_NewWave',0x411340,'568bf15733ff'),
 ('Player_NewShip',0x411410,'568bf15733ff'),
 ('DrawStatus',0x4057a0,'8a44240481ec80020000'),
 ('NextWave_stars',0x40682a,'8b357cf94100'),
 ('Fade',0x416850,'81ec04020000'),
 ('NewGame_after_NextWave',0x406378,'e823b6ffff'),
 ('RunFrame',0x4019a0,'566a00e8a80e0000'),
 ('RunFrame_after_HandleEvents',0x4019ab,'e850c60000'),
 ('RunFrame_after_SyncNetwork',0x4019c5,'a1fcf94100'),
 ('RunFrame_after_player_blits',0x401d84,'8b0d7cf94100'),
 ('RunFrame_return_path',0x401e58,'8bc75f5b5ec3'),
 ('DoHouseKeeping',0x4063c0,'a114f34100'),
]
STATE=[
 ('gStartLives',0x41f9ac,0x40b0c6,'c705acf9410003000000'),
 ('gStartLevel',0x41f9bc,0x40b0d0,'c705bcf9410001000000'),
 ('gNoDelay',0x41f990,0x40b0da,'c70590f9410000000000'),
 ('gGameOn',0x41f2a4,0x406323,'c705a4f2410001000000'),
 ('gPaused',0x41f314,0x40632d,'c70514f3410000000000'),
 ('gWave',0x41f29c,0x406337,'a39cf24100'),
 ('gNumPlayers',0x41f9fc,0x406317,'8b35fcf94100'),
 ('gNumSprites',0x41f4e0,0x406369,'c705e0f4410000000000'),
 ('gLastDrawn',0x41f724,0x40635f,'c70524f7410000000000'),
 ('screen',0x41f97c,0x4062a8,'8b0d7cf94100'),
 ('geneva',0x41f348,0x40627c,'a348f34100'),
 ('gNumRocks',0x41f30c,0x40650c,'891d0cf34100'),
 ('gStatusLine',0x41f8c4,0x4058a6,'8b15c4f84100'),
 ('gPlayers_first',0x420c0c,0x401d75,'8b0cb50c0c4200'),
 ('gPlayerShip',0x41f8e4,0x41142f,'a1e4f84100'),
]
CALLS=[(0x40ace4,0x40b0c0),(0x40b134,0x406230),(0x406306,0x416850),(0x406373,0x4064f0),
       (0x406378,0x4019a0),(0x40638b,0x4063c0),(0x4067d9,0x4057a0),
       (0x4067e8,0x415e20),(0x406877,0x415e20),(0x40689e,0x416850),
       (0x4019a3,0x402850),(0x4019ab,0x40e000),(0x401d8c,0x415e20),
       (0x401dfa,0x41342c),(0x401e23,0x413420)]
RANGES=[('p-key-decode',0x40ab72,0x40ab94),('p-key-call',0x40ace4,0x40acee),('start-action',0x40b0c0,0x40b145),('new-game',0x406230,0x4063b5),
        ('wave-start',0x4064f0,0x406548),('wave-publish',0x40674f,0x4068a3),
        ('fade',0x416850,0x41690c),('frame-input',0x4019a0,0x4019f3),
        ('frame-draw-timing',0x401d4c,0x401e5e),('event-drain',0x402850,0x40289e),
        ('status-labels',0x4057a0,0x40598f),('framebuffer-update',0x415e20,0x415ec6),
        ('player-start',0x411300,0x411408),('ship-create',0x411410,0x4114e3)]

def sha(b):return hashlib.sha256(b).hexdigest()
def dis_text(s):return '\n'.join(line.rstrip() for line in s.splitlines())+'\n'
class PE:
 def __init__(self,b):
  self.b=b;self.pe=self.u32(0x3c);assert b[self.pe:self.pe+4]==b'PE\0\0'
  self.op=self.pe+24;assert self.u16(self.op)==0x10b
  self.base=self.u32(self.op+28);self.sections=[]
  for i in range(self.u16(self.pe+6)):
   o=self.op+self.u16(self.pe+20)+i*40;vs,rva,rs,off=struct.unpack_from('<IIII',b,o+8)
   self.sections.append(dict(name=b[o:o+8].rstrip(b'\0').decode(),rva=rva,vsize=vs,rawsize=rs,offset=off))
 def u16(self,o):return struct.unpack_from('<H',self.b,o)[0]
 def u32(self,o):return struct.unpack_from('<I',self.b,o)[0]
 def offset(self,va,n=1):
  r=va-self.base
  for s in self.sections:
   if s['rva']<=r and r+n<=s['rva']+s['rawsize']:return s['offset']+r-s['rva']
  raise ValueError('VA not fully file-backed: '+hex(va))
 def read(self,va,n):o=self.offset(va,n);return self.b[o:o+n]
 def cstr(self,r):return self.b[self.offset(self.base+r):].split(b'\0',1)[0].decode()
 def imports(self):
  r=self.u32(self.op+104);o=self.offset(self.base+r);result={}
  while self.u32(o+12):
   orig,_,_,name,iat=struct.unpack_from('<5I',self.b,o);dll=self.cstr(name);j=0
   while True:
    x=self.u32(self.offset(self.base+(orig or iat))+4*j)
    if not x:break
    result[self.base+iat+4*j]=(dll,'ordinal:'+str(x&65535) if x>>31 else self.cstr(x+2));j+=1
   o+=20
  return result
 def exports(self):
  o=self.offset(self.base+self.u32(self.op+96));v=struct.unpack_from('<IIHHIIIIIII',self.b,o);result={}
  for i in range(v[7]):
   name=self.cstr(self.u32(self.offset(self.base+v[9])+i*4));idx=self.u16(self.offset(self.base+v[10])+i*2)
   result[name]=self.base+self.u32(self.offset(self.base+v[8])+idx*4)
  return result

def verify_anchor(pe,addr,expected):
 actual=pe.read(addr,len(bytes.fromhex(expected))).hex()
 if actual!=expected:raise ValueError('instruction bytes mismatch at '+hex(addr))

def pixels(path):
 b=path.read_bytes();assert b[:8]==b'\x89PNG\r\n\x1a\n';o=8;data=b''
 while o<len(b):
  n=struct.unpack_from('>I',b,o)[0];typ=b[o+4:o+8];v=b[o+8:o+8+n]
  assert zlib.crc32(typ+v)&0xffffffff==struct.unpack_from('>I',b,o+8+n)[0]
  if typ==b'IHDR':w,h,depth,color,comp,filt,inter=struct.unpack('>IIBBBBB',v)
  if typ==b'IDAT':data+=v
  o+=12+n
 assert (w,h,depth,color,comp,filt,inter)==(640,480,8,6,0,0,0)
 raw=zlib.decompress(data);assert len(raw)==h*(1+w*4);rows=[];prev=bytearray(w*4);o=0
 for y in range(h):
  f=raw[o];o+=1;r=bytearray(raw[o:o+w*4]);o+=w*4
  for x in range(len(r)):
   a=r[x-4] if x>=4 else 0;c=prev[x-4] if x>=4 else 0;bb=prev[x]
   if f==1:v=a
   elif f==2:v=bb
   elif f==3:v=(a+bb)//2
   elif f==4:
    p=a+bb-c;ds=[abs(p-a),abs(p-bb),abs(p-c)];v=[a,bb,c][ds.index(min(ds))]
   else:assert f==0;v=0
   r[x]=(r[x]+v)&255
  rows.extend(tuple(r[x:x+4]) for x in range(0,len(r),4));prev=r
 return rows

def compare_pixels(a,b):
 changed=[i for i in range(len(a)) if a[i]!=b[i]]
 assert changed
 return dict(changedPixels=len(changed),coordinates=[[i%640,i//640] for i in changed],
   allEarlierChannelsFloorLaterDiv8=all(a[i][c]==b[i][c]//8 for i in changed for c in range(3)),
   allChangeInsidePlayfield=all(i//640<460 for i in changed),bottomRowsEqual=a[460*640:]==b[460*640:],
   allNonblackCoordinatesEqual={i for i,v in enumerate(a) if any(v[:3])}=={i for i,v in enumerate(b) if any(v[:3])})

def node_validate(harness,recipe,out):
 # Execute only the EXACT retained argument/input parser and dump-read branches,
 # in a mock VM. No harness require/import/instantiation or guest code executes.
 h=harness.decode();start=h.index('  const scheduledInput = [];');end=h.index('  if (INPUT_SPEC) {',start)
 parser=h[start:end]
 count=h[h.index('const countAddrs = COUNT_SPEC ?'):h.index('// --trace-esp=LO',h.index('const countAddrs = COUNT_SPEC ?'))]
 dump=h[h.index("        const at = parseInt(ev.arg, 16) >>> 0;",h.index("} else if (ev.action === 'dump-mem')")):h.index("      } else if (ev.action === 'heap-walk')",h.index("} else if (ev.action === 'dump-mem')"))]
 hit=h[h.index("        const label = ev.label ? ':' + ev.label : '';",h.index("} else if (ev.action === 'hit-counts')")):h.index("      } else if (ev.action === 'dump-windows'",h.index("} else if (ev.action === 'hit-counts')"))]
 getarg=h[h.index('const getArg = (name, def) => {'):h.index('const getArgs = name => {')]
 traceflags='\n'.join(line for line in h.splitlines() if line.startswith(('const TRACE_AT =','const TRACE_AT_DUMP =','const TRACE_AT_MEM =','const TRACE_AT_START_BATCH =','const TRACE_AT_LIMIT =')))
 dumpinit=h[h.index('const traceAtDumps = TRACE_AT_DUMP ?'):h.index('// `expr[:len]')]
 meminit=h[h.index('const traceAtMem = TRACE_AT_MEM ?'):h.index('const traceEipDumps = TRACE_EIP_DUMP ?')]
 expr=h[h.index('            const parseAddrExpr = (expr) => {'):h.index('            const parts = [];',h.index('            const parseAddrExpr = (expr) => {'))]
 js="const vm=require('node:vm'),assert=require('node:assert/strict');\n"
 js+='const recipe='+json.dumps(recipe)+';\n'
 js+='const tsrc='+json.dumps(getarg+traceflags+'\n'+dumpinit+meminit+expr+'\nglobalThis.traceResult={TRACE_AT,TRACE_AT_START_BATCH,TRACE_AT_LIMIT,traceAtDumps,traceAtMem,pointers:traceAtMem.map(d=>parseAddrExpr(d.expr))};')+';\n'
 js+="const tc={args:recipe.traceAt,e:{},regValue:()=>null,g2w:a=>a,dv:{getUint32:a=>a===0x41f97c?0x800000:a===0x420c0c?0x810000:0}};vm.runInNewContext(tsrc,tc,{timeout:1000});assert.equal(tc.traceResult.TRACE_AT,'0x406378');assert.equal(tc.traceResult.TRACE_AT_START_BATCH,30000);assert.equal(tc.traceResult.TRACE_AT_LIMIT,1);assert.equal(JSON.stringify(tc.traceResult.pointers),JSON.stringify([0x800000,0x810000]));assert.equal(JSON.stringify(tc.traceResult.traceAtMem.map(d=>d.len)),JSON.stringify([64,176]));assert.equal(tc.traceResult.traceAtDumps.length,4);\n"

 js+='const src='+json.dumps(parser+count+"\nglobalThis.result={events:parseInputEntries(spec.split(',')),countAddrs};")+';\n'
 js+="const ctx={spec:recipe.input,COUNT_SPEC:recipe.count,process:{exit:n=>{throw Error('exit '+n)}},console:{error:()=>{}}};vm.runInNewContext(src,ctx,{timeout:1000});const r=ctx.result;assert.equal(r.countAddrs.length,16);assert.equal(r.events.filter(e=>e.action==='keydown').length,4);assert.equal(r.events.filter(e=>e.action==='keyup').length,4);\n"
 js+="const logs=[],reads=[],instance={exports:{get_count:i=>i+2}},batch=34000;const flushLogs=()=>{};const hexdump=(a,n)=>reads.push([a,n]);\n"
 js+='const doDump=new Function("ev","batch","logs","flushLogs","hexdump",'+json.dumps(dump)+');\n'
 js+='const doHit=new Function("ev","batch","logs","instance","countAddrs",'+json.dumps(hit)+');\n'
 js+="for(const ev of r.events){assert.ok(Number.isInteger(ev.batch)&&ev.batch>=0&&ev.batch<42000);if(ev.action==='dump-mem'){assert.ok(Number.parseInt(ev.arg2,10)<=4096);doDump(ev,ev.batch,logs,flushLogs,hexdump);}else if(ev.action==='hit-counts')doHit(ev,ev.batch,logs,instance,r.countAddrs);else assert.ok(['keydown','keyup','png'].includes(ev.action),ev.action);}assert.ok(reads.some(([a,n])=>a===0x41f280&&n===256));assert.ok(reads.some(([a,n])=>a===0x074ff000&&n===4096));assert.equal(logs.filter(l=>l.includes('hit-counts')).length,4);\n"
 js+="assert.throws(()=>vm.runInNewContext(src,{...ctx,COUNT_SPEC:recipe.count+',0x401000'},{timeout:1000}),/exit 1/);console.log(JSON.stringify({pass:true,exactParserBytes:Buffer.byteLength(src),events:r.events.length,dumpReads:reads.length,counterSnapshots:4,rejected17Counters:true,traceFlagsAndPointerExpressions:true}));\n"
 path=out/'harness-parser-fixture.cjs';path.write_text(js)
 available=int(next(l.split()[1] for l in pathlib.Path('/proc/meminfo').read_text().splitlines() if l.startswith('MemAvailable:')))*1024
 assert available>=805306368
 def cpu_limit():
  import resource
  resource.setrlimit(resource.RLIMIT_CPU,(60,60))
 p=subprocess.run(['node','--max-old-space-size=256',str(path)],capture_output=True,text=True,timeout=60,preexec_fn=cpu_limit)
 (out/'harness-parser-test.log').write_text(p.stdout+p.stderr);assert p.returncode==0,p.stderr
 return dict(memAvailable=available,oldspaceMiB=256,cpuWallSeconds=60,result=json.loads(p.stdout),fixtureSHA=sha(path.read_bytes()),parserSHA=sha(parser.encode()),dumpBranchSHA=sha(dump.encode()),hitBranchSHA=sha(hit.encode()))

def main():
 ap=argparse.ArgumentParser(description=__doc__);ap.add_argument('--game',type=pathlib.Path,required=True);ap.add_argument('--harness',type=pathlib.Path,required=True);ap.add_argument('--runtime-evidence',type=pathlib.Path,required=True);ap.add_argument('--wasm',type=pathlib.Path,required=True);ap.add_argument('--out',type=pathlib.Path,required=True);a=ap.parse_args();a.out.mkdir(parents=True,exist_ok=True)
 eb=(a.game/'Maelstrom.exe').read_bytes();sb=(a.game/'SDL.dll').read_bytes();hb=a.harness.read_bytes();assert sha(eb)==EXE_SHA and sha(sb)==SDL_SHA and sha(hb)==HARNESS_SHA
 wb=a.wasm.read_bytes();assert sha(wb)=='8fac39936b6df2418ad86cab118cef19a65a727f649fbc14c412b37818904686' and wb[:8]==b'\0asm\1\0\0\0'
 def leb(o):
  v=0;shift=0
  while True:
   x=wb[o];o+=1;v|=(x&127)<<shift
   if x<128:return v,o
   shift+=7;assert shift<35
 exports=[];o=8
 while o<len(wb):
  kind=wb[o];size,c=leb(o+1);end=c+size
  if kind==7:
   count,c=leb(c)
   for _ in range(count):
    n,c=leb(c);name=wb[c:c+n].decode();c+=n;typ=wb[c];c+=1;idx,c=leb(c);exports.append(dict(name=name,kind=typ,index=idx))
  o=end
 required={'set_count','get_count','set_bp','get_eip','get_esp'};assert required<={x['name'] for x in exports}
 pe=PE(eb);sdl=PE(sb);assert pe.base==0x400000 and pe.u32(pe.op+96+5*8)==0
 controls=[]
 for name,addr,b in ANCHORS:verify_anchor(pe,addr,b)
 for name,state,addr,b in STATE:
  verify_anchor(pe,addr,b);assert struct.pack("<I",state) in bytes.fromhex(b)
 for label,addr,b in [('wrong-address',ANCHORS[0][1]+1,ANCHORS[0][2]),('wrong-bytes',ANCHORS[0][1],'00'+ANCHORS[0][2][2:])]:
  try:verify_anchor(pe,addr,b)
  except ValueError:controls.append(label)
  else:raise AssertionError('accepted '+label)
 try:pe.read(0x420c0c,4)
 except ValueError:controls.append('zero-fill-state-is-not-retained-runtime-memory')
 else:raise AssertionError('BSS mistaken for captured memory')
 for addr,target in CALLS:
  b=pe.read(addr,5);assert b[0] in (0xe8,0xe9) and addr+5+struct.unpack_from('<i',b,1)[0]==target
 imports=pe.imports();assert imports[0x419100]==('SDL.dll','SDL_Delay') and imports[0x419150]==('SDL.dll','SDL_PollEvent') and imports[0x419154]==('SDL.dll','SDL_GetTicks')
 assert pe.read(0x413420,18).hex()=='ff2500914100ff2550914100ff2554914100'
 # Player ctor pins vtable; those virtual slots bind NewGame, NewWave, NewShip.
 assert pe.read(0x4111ee,6).hex()=='c706889a4100'
 verify_anchor(pe,0x4114c6,'89beac000000897e54')
 verify_anchor(pe,0x4114da,'ff4e5c')
 verify_anchor(pe,0x40ab85,'83f8700f8f600100000f8450010000')
 assert [struct.unpack('<I',pe.read(0x419a88+x,4))[0] for x in [0x78,0x7c,0x80]]==[0x411300,0x411340,0x411410]
 ex=sdl.exports();assert ex['SDL_Delay']==0x10022d50 and ex['SDL_GetTicks']==0x10022cd0
 simp=sdl.imports();assert simp[0x1002a090]==('KERNEL32.dll','Sleep');assert simp[0x1002a08c][1]=='QueryPerformanceCounter';assert simp[0x1002a214][1]=='timeGetTime'
 verify_anchor(sdl,0x10022d50,'8b44240450ff1590a00210c3')
 dis=[]
 for name,start,end in RANGES:
  assert end-start<=8192
  p=subprocess.run(['objdump','-d','-Mintel','--start-address='+hex(start),'--stop-address='+hex(end),str(a.game/'Maelstrom.exe')],capture_output=True,text=True,check=True,timeout=60)
  (a.out/(name+'.asm')).write_text(dis_text(p.stdout));dis.append(dict(name=name,start=hex(start),end=hex(end),bytesSHA=sha(pe.read(start,end-start)),disassemblySHA=sha(dis_text(p.stdout).encode()),rawObjdumpSHA=sha(p.stdout.encode())))
 for name,start,end in [('sdl-clock',0x10022cd0,0x10022d5c)]:
  p=subprocess.run(['objdump','-d','-Mintel','--start-address='+hex(start),'--stop-address='+hex(end),str(a.game/'SDL.dll')],capture_output=True,text=True,check=True,timeout=60);(a.out/(name+'.asm')).write_text(dis_text(p.stdout))
 recipe={'count':','.join(hex(addr) for _,addr,_ in ANCHORS),'tickMsPerBatch':200,'maxBatches':42000,'traceAt':['--trace-at=0x406378','--trace-at-start-batch=30000','--trace-at-limit=1','--trace-at-dump=0x41f280:256,0x41f720:64,0x41f970:160,0x420c0c:32','--trace-at-mem=*0x41f97c:64,*0x420c0c:176'],'input':''}
 events=['30000:png:OWN/menu.png','31000:keydown:80','31200:keyup:80','34000:png:OWN/play.png','35000:keydown:37','35200:keydown:38','35500:keydown:32','36000:keyup:37','36200:keyup:38','36500:keyup:32','39000:png:OWN/input.png']
 for batch in [30000,34000,39000,41900]:
  events.append(f'{batch}:hit-counts:phase')
  for addr,n in [(0x41f280,256),(0x41f4e0,16),(0x41f720,64),(0x41f8c0,64),(0x41f970,160),(0x420c0c,32),(0x074ff000,4096)]:events.append(f'{batch}:dump-mem:{hex(addr)}:{n}')
 recipe['input']=','.join(events);recipe['argvDelta']=['--count='+recipe['count'],'--input='+recipe['input'],'--tick-ms-per-batch=200','--max-batches=42000']+recipe['traceAt'];(a.out/'capture-delta.json').write_text(json.dumps(recipe,indent=2)+'\n')
 node=node_validate(hb,recipe,a.out)
 px=compare_pixels(pixels(a.runtime_evidence/'play.png'),pixels(a.runtime_evidence/'input.png'));assert px['changedPixels']==30 and px['allEarlierChannelsFloorLaterDiv8'] and px['allChangeInsidePlayfield'] and px['bottomRowsEqual'] and px['allNonblackCoordinatesEqual']
 # Reject moved pixels and arbitrary brightness as evidence for that exact relationship.
 first=pixels(a.runtime_evidence/'play.png');last=pixels(a.runtime_evidence/'input.png');bad=last.copy();i=next(i for i,v in enumerate(last) if i//640<460 and v[0] and first[i]!=v);bad[i]=(1,2,3,255)
 assert not compare_pixels(first,bad)['allEarlierChannelsFloorLaterDiv8'];controls.append('wrong-brightness-relationship')
 bad=last.copy();bad[i],bad[i+1]=bad[i+1],bad[i];assert not compare_pixels(first,bad)['allNonblackCoordinatesEqual'];controls.append('moved-star-fixture')
 result=dict(passOffline=True,exeSHA=sha(eb),sdlSHA=sha(sb),harnessSHA=sha(hb),imageBase=hex(pe.base),runtimeEXEBase='0x400000',relocationDirectoryAbsent=True,sections=pe.sections,state=[dict(name=n,va=hex(v),referenceVA=hex(r),referenceBytes=b) for n,v,r,b in STATE],anchors=[dict(name=n,va=hex(v),fileOffset=hex(pe.offset(v)),bytes=b) for n,v,b in ANCHORS],calls=[dict(va=hex(v),target=hex(t)) for v,t in CALLS],imports={hex(k):v for k,v in imports.items() if k in [0x419100,0x419150,0x419154]},sdlExports={k:dict(preferred=hex(ex[k]),retainedRuntime=hex(0x666000+ex[k]-sdl.base)) for k in ['SDL_Delay','SDL_GetTicks','SDL_PollEvent','SDL_WaitEvent']},controls=controls,moduleSHA=sha(wb),moduleExportProof=[x for x in exports if x['name'] in required],harnessTest=node,pixels=px,disassembly=dis,noGuestExecution=True)
 (a.out/'proof.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(dict(passOffline=True,anchors=len(ANCHORS),calls=len(CALLS),controls=controls,harness=node['result'],changedPixels=px['changedPixels'])))
if __name__=='__main__':main()
