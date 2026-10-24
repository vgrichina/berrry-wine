import re,json,pathlib,struct
H=pathlib.Path(__file__).parent;s=(H/'collected/guest/output.log').read_text();snaps={};batch=None;addr=None;remaining=0;pending=False
for l in s.splitlines():
 m=re.match(r'\[input\] dump-mem at batch (\d+)',l)
 if m:batch=int(m[1]);snaps.setdefault(batch,{});pending=True
 m=re.match(r'Hexdump 0x([0-9a-fA-F]+) \((\d+) bytes\)',l)
 if m:
  if pending:addr=int(m[1],16);remaining=int(m[2]);pending=False
  else:remaining=0
 m=re.match(r'  0x([0-9a-fA-F]+)  ((?:[0-9a-f]{2} ){1,16})',l)
 if m and batch and remaining>0:
  start=int(m[1],16);b=bytes.fromhex(m[2]);snaps[batch].update({start+i:v for i,v in enumerate(b)});remaining-=len(b)
def word(mem,a):return struct.unpack('<I',bytes(mem[a+i] for i in range(4)))[0]
states={'gameOn':0x41f2a4,'paused':0x41f314,'wave':0x41f29c,'rocks':0x41f30c,'lastStar':0x41f2b0,'sprites':0x41f4e0,'lastDrawn':0x41f724,'screen':0x41f97c,'font':0x41f348,'startLives':0x41f9ac,'startLevel':0x41f9bc,'noDelay':0x41f990,'players':0x41f9fc,'player0':0x420c0c,'playerShip':0x41f8e4,'statusLine':0x41f8c4}
r={}
for batch,mem in snaps.items():
 w={n:word(mem,a) for n,a in states.items()};stack=[dict(slot=hex(a),value=hex(word(mem,a))) for a in range(0x74ffb00,0x7500000,4) if 0x400000<=word(mem,a)<0x7a8000];r[batch]=dict(state=w,stackCandidates=stack)
(H/'state-analysis.json').write_text(json.dumps(r,indent=2))
for k,v in r.items():print(k,v['state']);print(v['stackCandidates'][:45])
