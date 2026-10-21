import sys,pathlib,struct,hashlib,json,subprocess
root=pathlib.Path('/home/user/jedi-original-layout-install')
sys.path.insert(0,str(root/'python-tools'))
from unicorn import Uc,UC_ARCH_X86,UC_MODE_16
from unicorn.x86_const import *
b=pathlib.Path('/home/user/jedi-original/jedidemo.exe').read_bytes()
assert hashlib.sha256(b).hexdigest()=='8aae38165e08b68bb63cfd21b8c28ed1d4d8f1bb400a0162588d5b86acdc827e'
records=[]
for num,offset,size in [(2,683*8,31364),(3,4696*8,3450)]:
 u=Uc(UC_ARCH_X86,UC_MODE_16);u.mem_map(0,0x100000)
 u.mem_write(0x10000,b[992:5345]);u.mem_write(0x30000,b[offset:offset+size])
 def word(a,v):u.mem_write(a,struct.pack('<H',v))
 word(0x1002c,0x1000)
 for a,v in [(0xc0b,0x3000),(0xc0d,65535),(0xc11,0xa000),(0xc13,0xa000),(0xc18,0x7000),(0xc1a,0x3000),(0xc1c,0xa000)]:word(0x10000+a,v)
 for r,v in [(UC_X86_REG_CS,0x1000),(UC_X86_REG_DS,0x1000),(UC_X86_REG_ES,0x3000),(UC_X86_REG_SS,0xe000),(UC_X86_REG_SP,0xff00),(UC_X86_REG_BP,0xff80),(UC_X86_REG_DI,size)]:u.reg_write(r,v)
 word(0xeff7c,0x5000);word(0xeff00,0x1101)
 u.emu_start(0x1061e,0x11101,count=200000000)
 assert u.reg_read(UC_X86_REG_IP)==0x1101,hex(u.reg_read(UC_X86_REG_IP))
 n=u.reg_read(UC_X86_REG_DI);assert n>size,(n,size)
 data=bytes(u.mem_read(0x50000,n));(root/f'seg{num}-unpacked.bin').write_bytes(data)
 dis=subprocess.run(['objdump','-D','-b','binary','-mi386','-M','addr16,data16,intel',str(root/f'seg{num}-unpacked.bin')],capture_output=True,text=True,check=True).stdout
 (root/f'seg{num}-unpacked.dis').write_text(dis)
 records.append(dict(segment=num,offset=offset,compressed=size,expanded=n,sha256=hashlib.sha256(data).hexdigest()))
 print(records[-1]);print(subprocess.run(['strings','-t','x',str(root/f'seg{num}-unpacked.bin')],capture_output=True,text=True).stdout)
(root/'unpack.json').write_text(json.dumps(records,indent=2))
