"""Decode original SFX metadata, cross-check original x86 decoder, stage sources."""
import sys,pathlib,struct,hashlib,json,zlib,shutil
R=pathlib.Path('/home/user/jedi-original-layout-install'); O=pathlib.Path('/home/user/jedi-original')
sys.path.insert(0,str(R/'python-tools'))
from unicorn import Uc,UC_ARCH_X86,UC_MODE_16
from unicorn.x86_const import *
sha=lambda b:hashlib.sha256(b).hexdigest()
b=(O/'jedidemo.exe').read_bytes();inv=json.loads((O/'inventory.json').read_text())
assert sha(b)==inv['sourceSha256']=='8aae38165e08b68bb63cfd21b8c28ed1d4d8f1bb400a0162588d5b86acdc827e'
code=(R/'seg2-unpacked.bin').read_bytes();data=(R/'seg3-unpacked.bin').read_bytes();key=data[16:24]
assert key.hex()=='b3f2ea1faa276613'
def decode(c):
 d=bytes((((v^key[7-i%8])>>(7-i%8)|((v^key[7-i%8])<<(1+i%8)))&255)^key[i%8] for i,v in enumerate(c))
 u=Uc(UC_ARCH_X86,UC_MODE_16);u.mem_map(0,0x100000);u.mem_write(0x10000,code);u.mem_write(0x30000,data);u.mem_write(0x38000,c)
 for r,v in [(UC_X86_REG_CS,0x1000),(UC_X86_REG_DS,0x3000),(UC_X86_REG_SS,0xe000),(UC_X86_REG_SP,0xff00)]:u.reg_write(r,v)
 u.mem_write(0xeff00,struct.pack('<HHH',0xeab,0x8000,len(c)))
 u.emu_start(0x10e4c,0x10eab,count=100000)
 assert u.reg_read(UC_X86_REG_IP)==0xeab
 assert bytes(u.mem_read(0x38000,len(c)))==d
 return d
resource=0xa450
assert b[resource:resource+8]==bytes.fromhex('9401000006000000')
fields={str(off):decode(b[resource+off:resource+off+n]).split(b'\0')[0].decode('ascii') for off,n in [(28,40),(68,128),(196,80),(276,128)]}
prefix=fields['276'];assert fields['68']=='setup.exe'
p,count,total=struct.unpack_from('<III',b,resource+8);assert count==39 and total==len(b)
rows=[]
for f in inv['files']:
 n=struct.unpack_from('<I',b,p)[0];path=decode(b[p+4:p+4+n]).decode('ascii');assert path.startswith(prefix)
 timestamp,zipsize=struct.unpack_from('<II',b,p+4+n);zipstart=p+12+n;assert zipstart==f['offset']
 assert b[zipstart:zipstart+4]==b'PK\x03\x04'
 method=struct.unpack_from('<H',b,zipstart+8)[0];cs,sz=struct.unpack_from('<II',b,zipstart+18);nl,xl=struct.unpack_from('<HH',b,zipstart+26)
 name=b[zipstart+30:zipstart+30+nl].decode('ascii');assert name==f['name']
 start=zipstart+30+nl+xl;raw=zlib.decompress(b[start:start+cs],-15) if method==8 else b[start:start+cs]
 assert len(raw)==sz==f['size'] and sha(raw)==f['sha256']==sha((O/'original'/name).read_bytes())
 relative=path[len(prefix):];directory=relative.rsplit('\\',1)[0]+'/' if '\\' in relative else ''
 output=directory.replace('\\','/')+name
 rows.append(dict(**f,recordOffset=p,recordHex=b[p:zipstart].hex(),decodedSource=path,relativeDirectory=directory,output=output,zipSize=zipsize))
 p=zipstart+zipsize
assert p==len(b)
proof=dict(packageSha256=sha(b),packageBytes=len(b),resourceOffset=resource,resourceHex=b[resource:resource+404].hex(),fields=fields,key=key.hex(),decoderSegment=2,decoderOffset=0xe4c,decoderBytes=code[0xe4c:0xeab].hex(),nativeDecoderCrossChecks=43,files=rows)
(R/'layout-proof.json').write_text(json.dumps(proof,indent=2))
# Stage only original sources, never an installed tree. Keep captured support/INI/registry unchanged.
stage=R/'faithful-capture';assert not stage.exists();stage.mkdir()
cap=pathlib.Path('/home/user/jedi-evidence/capture');seal=json.loads(pathlib.Path('/home/user/jedi-evidence/capture-seal.json').read_text())
originalHashes={x['sha256'] for x in rows}
for f in seal['files']:
 src=cap/f['path'];assert sha(src.read_bytes())==f['sha256']
 if f['sha256'] in originalHashes:continue
 dst=stage/f['path'];dst.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(src,dst)
for f in rows:
 dst=stage/f['output'].lower();dst.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(O/'original'/f['name'],dst)
 assert sha(dst.read_bytes())==f['sha256']
print(json.dumps(dict(files=len(rows),nativeCrossChecks=43,base=prefix,outputs=[x['output'] for x in rows],staged=str(stage)),indent=2))
