#!/usr/bin/env python3
"""Offline evidence extraction. No guest, build, or network. Outputs bounded JSON."""
import hashlib, json, pathlib, struct, subprocess
ROOT = pathlib.Path(__file__).resolve().parents[3]
DONOR = pathlib.Path('/home/user/wine-assembly-shadow-man-original-recover-runtime-oct22')
RUN = DONOR/'scratch/runs/20261022-shadow-man-original-recover-runtime'
SETUP = DONOR/'scratch/runs/20261022-shadow-man-original-source/ranges/161796096-73728.bin'
E = pathlib.Path(__file__).parent
def digest(b): return hashlib.sha256(b).hexdigest()
def pe_strings(b):
    pe = struct.unpack_from('<I',b,60)[0]
    count = struct.unpack_from('<H',b,pe+6)[0]
    optional = struct.unpack_from('<H',b,pe+20)[0]
    sections = [struct.unpack_from('<III',b,pe+24+optional+40*i+12) for i in range(count)]
    def rva(v):
        return next(v-a+o for a,s,o in sections if a <= v < a+s)
    root = rva(struct.unpack_from('<I',b,pe+24+112)[0]); result = {}
    def walk(rel,keys):
        pos=root+rel; nn,ni=struct.unpack_from('<HH',b,pos+12)
        for i in range(nn+ni):
            key,target=struct.unpack_from('<II',b,pos+16+8*i)
            if key & 0x80000000: continue
            if target & 0x80000000: walk(target & 0x7fffffff,keys+[key])
            elif keys and keys[0]==6:
                addr,size=struct.unpack_from('<II',b,root+target); p=rva(addr)
                for j in range(16):
                    n=struct.unpack_from('<H',b,p)[0]; p+=2
                    s=b[p:p+2*n].decode('utf-16le'); p+=2*n
                    if s: result[hex((keys[1]-1)*16+j)]=s
    walk(0,[])
    return result
setup=SETUP.read_bytes()
assert len(setup)==73728 and digest(setup)=='5656e87da0641c9dcfcd0ee8949ce72b3fa6a7d0e8b1fd985a16f6bd6c34ce52'
boot=(ROOT/'local/source/Demos/Shadowman/_inst32i.ex_').read_bytes()
dll=(ROOT/'local/source/Demos/Shadowman/_Setup.dll').read_bytes()
for receipt in json.loads((E/'acquisition.json').read_text()):
    b=(ROOT/'local/source'/receipt['path']).read_bytes()
    assert len(b)==receipt['bytes'] and digest(b)==receipt['sha256']
assert struct.unpack_from('<II',boot)==(0xd879ab2a,0x100)
members=[]; p=82
for i in range(struct.unpack_from('<I',boot,78)[0]):
    offset,compressed,size,u1,u2=struct.unpack_from('<5I',boot,p); p+=20; names=[]
    for j in range(2):
        n=struct.unpack_from('<H',boot,p)[0]; p+=2
        names.append(boot[p:p+n].decode('ascii')); p+=n
    assert offset+compressed<=len(boot)
    members.append(dict(offset=offset,compressed=compressed,expanded=size,names=names))
assert p==members[0]['offset'] and members[-1]['offset']+members[-1]['compressed']==len(boot)
strings=pe_strings(dll)
log=(RUN/'raw/setup-run/output.log').read_text()
assert strings['0x1b98'] in log
partial=(RUN/'raw/setup-run/vfs/windows/temp/_istmp1.dir/_ins5576._mp').read_bytes()
assert len(partial)==69632 and digest(partial)=='23eaf19af07202fae358284fcc2d9e045b1fd16fbfecc2066136b3f3ba311d90'
# Pin decisive instructions against original file (text RVA == file offset).
signatures={0x404773:'ff15c0d04000',0x404779:'ff15c4d04000',0x404789:'3b06',
            0x40478e:'c705f4074100fcffffff',0x40656c:'e807ddffff',0x406577:'68981b0000'}
for va,h in signatures.items(): assert setup[va-0x400000:va-0x400000+len(bytes.fromhex(h))].hex()==h
disasm=subprocess.check_output(['objdump','-d','-Mintel',str(SETUP)],text=True)
ranges=[(0x404278,0x4043bf),(0x404544,0x4045f2),(0x4046da,0x4047a5),
        (0x40507a,0x4051b4),(0x405ea1,0x405fa9),(0x40626f,0x406377),
        (0x4064e6,0x40658c),(0x4065b5,0x4065f5)]
lines=[]
for line in disasm.splitlines():
    try: va=int(line.split(':')[0].strip(),16)
    except ValueError: continue
    if any(a<=va<b for a,b in ranges): lines.append(line.rstrip())
(E/'control-flow.asm').write_text('\n'.join(lines)+'\n')
result={'setupSha256':digest(setup),'archiveSha256':digest(boot),'resourceSha256':digest(dll),
        'members':members,'resources':strings,'partial':{'bytes':len(partial),'sha256':digest(partial)},
        'instructionSignatures':{hex(k):v for k,v in signatures.items()},'messageMatchesLiteralResource':True,
        'warning':'Static path and literal message proved; invoked failure/API result absent from historical trace.'}
(E/'analysis.json').write_text(json.dumps(result,indent=2)+'\n')
print('PASS authentic hashes, complete archive member boundaries, literal dialog match, opcode signatures')
