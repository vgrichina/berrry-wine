#!/usr/bin/env python3
"""Static bounded PE32 imports/exports, assets and standing-support comparison."""
import hashlib, json, pathlib, re, struct, tarfile
H = pathlib.Path(__file__).resolve().parent
R = pathlib.Path('/home/user/wine-assembly')
def sha(b): return hashlib.sha256(b).hexdigest()
def pe(p):
    b = p.read_bytes()
    def u16(o): return struct.unpack_from('<H', b, o)[0]
    def u32(o): return struct.unpack_from('<I', b, o)[0]
    def cs(o): return b[o:b.index(b'\0', o)].decode('ascii')
    assert b[:2] == b'MZ'
    e=u32(60); assert b[e:e+4] == b'PE\0\0'
    op=e+24; assert u16(op)==0x10b, 'Only PE32 authorized'
    sec=op+u16(e+20)
    sections=[(u32(sec+i*40+12),u32(sec+i*40+16),u32(sec+i*40+20)) for i in range(u16(e+6))]
    def off(v):
        if v < u32(op+60): return v
        for va,size,raw in sections:
            if va<=v<va+size: return raw+v-va
        raise ValueError('Unbacked RVA '+hex(v))
    def directory(n): return (u32(op+96+n*8),u32(op+100+n*8))
    imports=[]; v,size=directory(1)
    if v:
        d=off(v)
        for _ in range(256):
            orig,stamp,chain,name,iat=struct.unpack_from('<IIIII',b,d);d+=20
            if not any((orig,stamp,chain,name,iat)): break
            t=off(orig or iat); symbols=[]
            for _ in range(8192):
                v=u32(t);t+=4
                if not v: break
                symbols.append({'ordinal':v&65535} if v&0x80000000 else {'name':cs(off(v)+2),'hint':u16(off(v))})
            else: raise ValueError('Thunk count guard')
            imports.append({'dll':cs(off(name)), 'symbols':symbols})
        else: raise ValueError('Descriptor count guard')
    exports=[]; v,size=directory(0)
    export_name=None
    if v:
        d=off(v);export_name=cs(off(u32(d+12)));base=u32(d+16);nf=u32(d+20);nn=u32(d+24)
        assert nf<20000 and nn<20000
        funcs=off(u32(d+28));names=off(u32(d+32)) if nn else 0;ords=off(u32(d+36)) if nn else 0
        named={u16(ords+2*i):cs(off(u32(names+4*i))) for i in range(nn)}
        for i in range(nf):
            a=u32(funcs+i*4)
            if a: exports.append(dict(ordinal=base+i,name=named.get(i),rva=hex(a),forwarder=cs(off(a)) if v<=a<v+size else None))
    ver=[]
    for m in re.finditer(b'\xbd\x04\xef\xfe',b):
        if m.start()+24<=len(b):
            a,c=struct.unpack_from('<II',b,m.start()+8);ver.append(f'{a>>16}.{a&65535}.{c>>16}.{c&65535}')
    return dict(path=str(p),bytes=len(b),sha256=sha(b),machine=hex(u16(e+4)),entrypoint_rva=hex(u32(op+16)),
                image_base=hex(u32(op+28)),entrypoint_va=hex(u32(op+28)+u32(op+16)),timestamp=u32(e+8),
                subsystem=u16(op+68),file_versions=ver,export_dll_name=export_name,imports=imports,exports=exports,
                delay_import_directory=[hex(x) for x in directory(13)])

release=H/'release/airstrike-pre6a'
images=[pe(p) for p in sorted(release.iterdir()) if p.suffix.lower() in ('.exe','.dll')]
(H/'pe.json').write_text(json.dumps(images,indent=2)+'\n')
local={pathlib.Path(i['path']).name.lower():i for i in images}
donors={}
queue=list(images)
for image in queue:
    for dep in image['imports']:
        name=dep['dll'].lower()
        if name in local or name in donors: continue
        donor=next((p for p in (R/'test/binaries/dlls').iterdir() if p.name.lower()==name),None)
        if donor:
            donors[name]=pe(donor); queue.append(donors[name])
api_bytes=(R/'src/api_table.json').read_bytes();api=json.loads(api_bytes)
def collect(o):
    if isinstance(o,str): return [o]
    if isinstance(o,list): return sum((collect(x) for x in o),[])
    if isinstance(o,dict): return sum((collect(x) for x in o.values()),[])
    return []
known=set(collect(api)); edges=[]; absent=[]
for image in queue:
    for dep in image['imports']:
        name=dep['dll'].lower();target=local.get(name) or donors.get(name)
        if target:
            ns={x['name'] for x in target['exports']};os={x['ordinal'] for x in target['exports']}
            unresolved=[s for s in dep['symbols'] if (s['name'] not in ns if 'name' in s else s['ordinal'] not in os)]
            edges.append(dict(importer=pathlib.Path(image['path']).name,dll=dep['dll'],resolution='bundled PE export table' if name in local else 'standing read-only PE export table',unresolved=unresolved))
        else:
            donor=next((p for p in (R/'test/binaries/dlls').iterdir() if p.name.lower()==name),None)
            missing_names=[s for s in dep['symbols'] if 'name' in s and s['name'] not in known]
            edges.append(dict(importer=pathlib.Path(image['path']).name,dll=dep['dll'],resolution='standing donor' if donor else 'system emulation required; no standing DLL donor',
                missing_api_table_names=missing_names,ordinal_imports=[s for s in dep['symbols'] if 'ordinal' in s]))
            if donor: absent.append(pe(donor))
(H/'dependency-comparison.json').write_text(json.dumps(dict(api_table_sha256=sha(api_bytes),edges=edges,standing_donors=list(donors.values()),
    caveat='API table name presence is not DLL-specific implementation or runtime validation. Dynamic LoadLibrary/GetProcAddress needs runtime observation.'),indent=2)+'\n')
refs=[]
with tarfile.open(H/'airstrike-pre6a-src.tar.gz') as t:
    assert sum(m.size for m in t.getmembers())<4194304
    for m in t.getmembers():
        if not m.isfile() or not m.name.endswith(('.c','.h')): continue
        data=t.extractfile(m).read().decode('latin1')
        for n,line in enumerate(data.splitlines(),1):
            if any(s in line for s in ['.png','.wav','.txt','SDLK_','fopen(', 'keymap','SIGNAL_']):
                refs.append(dict(source=m.name,line=n,text=line))
(H/'source-references.json').write_text(json.dumps(refs,indent=2)+'\n')
print(json.dumps([dict(file=pathlib.Path(i['path']).name,bytes=i['bytes'],machine=i['machine'],entry=i['entrypoint_va'],version=i['file_versions'],imports=[d['dll'] for d in i['imports']]) for i in images],indent=2))
print('PE + dependency + source evidence written; no guest execution')
