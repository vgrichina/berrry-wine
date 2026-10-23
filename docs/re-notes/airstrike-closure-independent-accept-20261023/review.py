"""Independent bounded PE32 table reader; no producer parser or guest execution."""
import struct, pathlib, hashlib, json, re, zipfile, tarfile, io, runpy, unittest.mock
E=pathlib.Path(__file__).resolve().parent
L=pathlib.Path('/tmp/airstrike-legacy-zlib-private-oct23/docs/re-notes/airstrike-legacy-zlib-20261023')
D=pathlib.Path('/tmp/airstrike-original-private-oct23/docs/re-notes/airstrike-original-20261023')
A=D/'release/airstrike-pre6a'
R=pathlib.Path('/home/user/wine-assembly')
def read(p):
    assert p.stat().st_size<=25165824
    return p.read_bytes()
def sha(p): return hashlib.sha256(read(p)).hexdigest()
def save(n,v):
    b=(json.dumps(v,indent=2)+'\n').encode(); assert len(b)<131072; (E/n).write_bytes(b)
def pe(p):
    b=read(p)
    def u(o,f='I'): return struct.unpack_from('<'+f,b,o)[0]
    h=u(60); assert b[:2]==b'MZ' and b[h:h+4]==b'PE\0\0'
    assert u(h+4,'H')==0x14c
    n=u(h+6,'H'); opt=h+24; assert u(opt,'H')==0x10b
    sec=opt+u(h+20,'H'); sections=[]
    for i in range(n):
        s=sec+40*i; sections.append((u(s+12),u(s+16),u(s+20),u(s+36)))
    def off(r):
        for va,sz,raw,flags in sections:
            if va<=r<va+sz: return raw+r-va
        if r<u(opt+60): return r
        raise ValueError(('unbacked RVA',hex(r),str(p)))
    def string(r):
        o=off(r); end=b.index(b'\0',o,min(o+4096,len(b))); return b[o:end].decode('ascii')
    dirs=[(u(opt+96+8*i),u(opt+100+8*i)) for i in range(16)]
    assert dirs[13]==(0,0), 'delay imports require additional parsing'
    imports={}; r,size=dirs[1]
    if r:
        for k in range(512):
            o=off(r+20*k); ilt,stamp,chain,name,iat=struct.unpack_from('<IIIII',b,o)
            if not any((ilt,stamp,chain,name,iat)): break
            syms=[]
            for j in range(4096):
                t=u(off((ilt or iat)+4*j))
                if not t: break
                syms.append(t&65535 if t&0x80000000 else string(t+2))
            else: raise ValueError('unterminated thunk')
            imports[string(name).lower()]=syms
        else: raise ValueError('unterminated imports')
    exports={}; er,esz=dirs[0]; module=None
    if er:
        o=off(er); module=string(u(o+12)); base=u(o+16); nf=u(o+20); nn=u(o+24)
        eat=u(o+28); names=u(o+32); ords=u(o+36); assert nf<65536 and nn<=nf
        byidx={u(off(ords+2*j),'H'):string(u(off(names+4*j))) for j in range(nn)}
        for j in range(nf):
            rva=u(off(eat+4*j))
            if not rva: continue
            forward=string(rva) if er<=rva<er+esz else None
            # CRT exports include zero-initialized data outside raw section bytes.
            if not forward:
                assert any(u(sec+40*k+12)<=rva<u(sec+40*k+12)+max(u(sec+40*k+8),u(sec+40*k+16)) for k in range(n))
            exports[base+j]={'name':byidx.get(j),'rva':rva,'forwarder':forward,'executable':any(va<=rva<va+sz and flags&0x20000000 for va,sz,raw,flags in sections)}
    return {'path':str(p),'sha256':sha(p),'module':module,'imports':imports,'exports':exports,'delay_imports':False}
paths=list(A.glob('*.dll'))+[A/'airstrike-pre6a.exe',R/'test/binaries/dlls/msvcrt.dll',L/'zlib.dll']
assert len(paths)==9
images={p.name.lower():pe(p) for p in paths}
z=images['zlib.dll']; png=images['libpng1.dll']
required=[10,3,7,6,4,20,22,19,23]
expected=['deflateReset','crc32','deflateInit2_','deflateEnd','deflate','inflateEnd','inflateInit_','inflate','inflateReset']
assert png['imports']['zlib.dll']==required
assert [z['exports'][i]['name'] for i in required]==expected
assert all(z['exports'][i]['executable'] and not z['exports'][i]['forwarder'] for i in required)
defs={int(o):n for n,o in re.findall(r'^\s*(\w+)\s+@(\d+)',(L/'source-minizip-zlib.def').read_text(),re.M)}
assert {i:e['name'] for i,e in z['exports'].items()}==defs and len(defs)==61
with tarfile.open(L/'zlib-1.1.3.tar.gz') as t:
    member=next(m for m in t.getmembers() if m.name.endswith('/contrib/minizip/zlibvc.def'))
    assert t.extractfile(member).read()==read(L/'source-minizip-zlib.def')
with zipfile.ZipFile(L/'sdl123.zip') as archive:
    matches={n:hashlib.sha256(archive.read(n)).hexdigest() for n in ['zlib.dll','libpng1.dll','SDL_image.dll','jpeg.dll']}
    assert all(images[n.lower()]['sha256']==v for n,v in matches.items())
system=set(re.findall(r"'([^']+)'",(R/'lib/dll-loader.js').read_text().split('const WINDOWS_SYSTEM_DLLS = new Set([')[1].split(']);')[0]))
api={x['name'] for x in json.loads((R/'src/api_table.json').read_text())}
def closure(imgs):
    count=0; gaps=[]
    for name,im in imgs.items():
        for dll,syms in im['imports'].items():
            if dll in imgs:
                ex=imgs[dll]['exports']; names={v['name'] for v in ex.values()}
                for sym in syms:
                    assert (sym in ex if isinstance(sym,int) else sym in names),(name,dll,sym)
                    exp=ex[sym] if isinstance(sym,int) else next(e for e in ex.values() if e['name']==sym)
                    assert exp['forwarder'] is None, 'forwarded export needs recursive proof'
                count+=len(syms)
            else:
                assert dll.removesuffix('.dll') in system,('missing vendor',name,dll)
                assert all(isinstance(s,str) for s in syms), 'unreviewed system ordinal'
                gaps += [(name,dll,s) for s in syms if s not in api]
    return count,gaps
count,gaps=closure(images)
manifest=json.loads((L/'minimal-vfs.json').read_text())
actual={p.relative_to(A).as_posix():{'bytes':p.stat().st_size,'sha256':sha(p)} for p in A.rglob('*') if p.is_file() and (p.name in ('airstrike-pre6a.exe','airstrikerc') or p.relative_to(A).parts[0]=='data')}
def vfs_check(m,cwd='C:\\'):
    assert cwd.lower()=='c:\\'
    got={}
    for f in m:
        p=pathlib.PurePosixPath(f['path']); assert not p.is_absolute() and '..' not in p.parts and '\\' not in f['path']
        assert f['path'] not in got
        assert (A/p).is_file() and not (A/p).is_symlink()
        got[f['path']]={k:f[k] for k in ('bytes','sha256')}
    assert got==actual
vfs_check(manifest['files']); assert len(actual)==81 and sum(f['bytes'] for f in actual.values())==2632138
controls={}
def rejects(name,f):
    try:f()
    except (AssertionError,KeyError,ValueError):controls[name]='REJECTED'; return
    raise AssertionError(('negative control accepted',name))
rejects('omitted_zlib_provider',lambda:closure({k:v for k,v in images.items() if k!='zlib.dll'}))
import copy
bad=copy.deepcopy(images); del bad['zlib.dll']['exports'][22]
rejects('omitted_ordinal22',lambda:closure(bad))
badmap=dict(defs); badmap[22]='inflateInit2_'
rejects('wrong_ordinal_name',lambda:(_ for _ in ()).throw(AssertionError()) if badmap!={i:e['name'] for i,e in z['exports'].items()} else None)
bad=copy.deepcopy(images); bad['sdl_image.dll']['imports']['jpeg.dll'].append('absent_independent_control')
rejects('missing_named_export',lambda:closure(bad))
rejects('omitted_asset',lambda:vfs_check(manifest['files'][:-1]))
rejects('wrong_cwd',lambda:vfs_check(manifest['files'],'C:\\data'))
bad=copy.deepcopy(manifest['files']); bad[0]['path']='../airstrike-pre6a.exe'
rejects('escaping_path',lambda:vfs_check(bad))
# Exercise authentic recovery main with a fake HTTP response that rejects metadata.
# No network opener is called and its body-read sentinel must stay false.
ns=runpy.run_path(str(L/'recover.py'),run_name='offline_review')
class Response:
    status=200; headers={'Content-Length':'160220'}; body_read=False
    def __enter__(self):return self
    def __exit__(self,*a):pass
    def read(self,*a):self.body_read=True; raise AssertionError('downstream body executed')
r=Response()
dest=E/'rejecting-metadata-destination'
with unittest.mock.patch.object(ns['urllib'].request,'build_opener') as opener:
    opener.return_value.open.return_value=r
    rejects('metadata_predecessor',lambda:ns['main'](dest))
assert not r.body_read and not list(dest.iterdir()); dest.rmdir()
assert ns['guard_test']()=={'overflow_rejected':True,'downstream_sentinel':False}
controls['authentic_byte_guard']='REJECTED before downstream sentinel'
identities=[{'path':x['path'],'bytes':(R/x['path']).stat().st_size,'sha256':sha(R/x['path'])} for x in json.loads((L/'launch-source-identities.json').read_text())]
assert identities==json.loads((L/'launch-source-identities.json').read_text()),'source changed'
save('independent-pe.json',{k:{**{f:v[f] for f in ('path','sha256','module','imports','delay_imports')},'export_count':len(v['exports']),'zlib_exports':v['exports'] if k=='zlib.dll' else None} for k,v in images.items()})
save('results.json',{'verdict':'PASS static scope','required_mapping':dict(zip(required,expected)),'exports':len(defs),'matching_zip_members':matches,'images':len(images),'real_pe_symbol_edges':count,'system_api_gaps':gaps,'vfs_files':len(actual),'vfs_bytes':sum(f['bytes'] for f in actual.values()),'negative_controls':controls,'metadata_body_read':r.body_read,'source_identities':identities})
print(json.dumps({'images':len(images),'real_pe_symbol_edges':count,'ordinals':len(required),'exports':len(defs),'vfs_files':len(actual),'controls':controls,'gaps':gaps}))
