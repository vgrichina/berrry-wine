"""Static retained-release inspection. No guest/native code execution.

Run only for a newly admitted extraction. Existing manifests can be verified
without repeating extraction with verify.py.
"""
import hashlib, json, pathlib, struct, zipfile, sys

BASE = pathlib.Path(__file__).resolve().parent
ARCHIVE = pathlib.Path('/home/user/wine-assembly-penguin-command-original-oct23/docs/re-notes/penguin-command-original-20261023/archive.zip')
DIGEST = '4399b52a1f8fec2501737a53ab42def6d5faebde37c0de5efc1295ab495caf34'

def save(name, data):
    raw = (json.dumps(data, indent=2) + '\n').encode()
    assert len(raw) <= 2*1024*1024
    (BASE/name).write_bytes(raw)

def pe(data):
    def u16(o): return struct.unpack_from('<H', data, o)[0]
    def u32(o): return struct.unpack_from('<I', data, o)[0]
    assert data[:2] == b'MZ'
    h=u32(60); assert data[h:h+4]==b'PE\0\0'
    n=u16(h+6); opt=h+24; assert u16(opt)==0x10b and n<128
    sections=[]
    for i in range(n):
        s=opt+u16(h+20)+40*i
        sections.append((u32(s+12),u32(s+8),u32(s+20),u32(s+16)))
    def off(rva):
        if rva<u32(opt+60): return rva
        for va,vs,raw,rs in sections:
            if va<=rva<va+max(vs,rs):
                assert rva-va<rs
                return raw+rva-va
        raise ValueError(hex(rva))
    def string(rva):
        o=off(rva); end=data.index(b'\0',o,min(o+4096,len(data)))
        return data[o:end].decode('ascii')
    imports=[]; r=u32(opt+104)
    if r:
        d=off(r)
        for i in range(4096):
            original,stamp,forward,name,first=struct.unpack_from('<5I',data,d+i*20)
            if not any((original,stamp,forward,name,first)):break
            t=off(original or first); syms=[]
            for j in range(65536):
                v=u32(t+4*j)
                if not v:break
                syms.append({'ordinal':v&65535} if v&0x80000000 else {'name':string(v+2),'hint':u16(off(v))})
            imports.append({'dll':string(name),'symbols':syms})
    exports=[]; r=u32(opt+96)
    if r:
        o=off(r); base,count,names,funcs,np,ords=struct.unpack_from('<6I',data,o+16)
        assert count<65536 and names<65536
        byord={}
        for i in range(names):byord.setdefault(u16(off(ords)+2*i),[]).append(string(u32(off(np)+4*i)))
        for i in range(count):
            v=u32(off(funcs)+4*i)
            if v:exports.append({'ordinal':base+i,'names':byord.get(i,[]),'rva':hex(v),'forwarder':string(v) if r<=v<r+u32(opt+100) else None})
    return {'machine':hex(u16(h+4)),'pe_magic':'PE32','image_base':hex(u32(opt+28)), 'entry_rva':hex(u32(opt+16)), 'subsystem':u16(opt+68),'imports':imports,'exports':exports}

def main():
    assert ARCHIVE.stat().st_size==1410755
    assert hashlib.sha256(ARCHIVE.read_bytes()).hexdigest()==DIGEST
    dest=BASE/'original'; assert not dest.exists(), 'extract once; use existing manifests for repeat review'
    with zipfile.ZipFile(ARCHIVE) as z:
        members=z.infolist(); assert len(members)==118 and sum(i.file_size for i in members)==2302319
        names=set()
        for i in members:
            p=pathlib.PurePosixPath(i.filename.replace('\\','/'))
            assert not p.is_absolute() and '..' not in p.parts and ':' not in str(p)
            assert not i.flag_bits&1 and i.file_size<=25165824 and not (i.external_attr>>16)&0o170000==0o120000
            assert str(p).casefold() not in names;names.add(str(p).casefold())
        assert z.testzip() is None
        inventory=[];pes={}
        dest.mkdir()
        for i in members:
            p=pathlib.PurePosixPath(i.filename.replace('\\','/'));target=dest.joinpath(*p.parts)
            b=z.read(i) # zipfile checks CRC, including all zero-byte directory entries
            item={'path':i.filename,'bytes':len(b),'compressed':i.compress_size,'crc32':f'{i.CRC:08x}','sha256':hashlib.sha256(b).hexdigest(),'directory':i.is_dir()}
            inventory.append(item)
            if i.is_dir():target.mkdir(parents=True,exist_ok=True)
            else:
                target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(b)
                if p.suffix.lower() in ('.exe','.dll'):pes[str(p)]=dict(sha256=item['sha256'],bytes=len(b),**pe(b))
    save('files.json',inventory);save('pe.json',pes)
    print(json.dumps({'entries':len(inventory),'bytes':sum(i['bytes'] for i in inventory),'PE':list(pes),'texts':[i['path'] for i in inventory if any(k in i['path'].lower() for k in ('readme','copying','license'))]}))

if __name__=='__main__':main()
