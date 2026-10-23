"""Pure PE data inspection. Never imports runner/compiler or executes guest code."""
import hashlib, json, pathlib, re, struct
E = pathlib.Path(__file__).resolve().parent
R = pathlib.Path('/home/user/wine-assembly')
N = R / 'scratch/usage-watch/shadow-man-dsetup-native-input-oct22'

def sha(b): return hashlib.sha256(b).hexdigest()

def pe(b):
    u16 = lambda o: struct.unpack_from('<H', b, o)[0]
    u32 = lambda o: struct.unpack_from('<I', b, o)[0]
    cs = lambda o: b[o:b.index(0, o)].decode('latin1')
    p = u32(60)
    if b[p:p+2] == b'NE': return {'format': 'NE', 'imports': None}
    assert b[p:p+4] == b'PE\0\0' and u16(p+24) == 0x10b
    secs = [p+24+u16(p+20)+40*i for i in range(u16(p+6))]
    def off(r):
        for s in secs:
            if u32(s+12) <= r < u32(s+12)+u32(s+16): return u32(s+20)+r-u32(s+12)
        raise ValueError(f'unbacked RVA {r:x}')
    imports = []
    if u32(p+128):
        d = off(u32(p+128))
        while u32(d) or u32(d+12):
            t = off(u32(d) or u32(d+16)); names=[]; ords=[]
            while u32(t):
                v=u32(t)
                if v & 0x80000000: ords.append(v & 65535)
                else: names.append(cs(off(v)+2))
                t += 4
            imports.append({'dll': cs(off(u32(d+12))).lower(), 'names': names, 'ordinals': ords})
            d += 20
    exports=[]; er=u32(p+120); es=u32(p+124)
    if er:
        ex=off(er); base=u32(ex+16); funcs=off(u32(ex+28)); name_by_ord={}
        for i in range(u32(ex+24)):
            name_by_ord[u16(off(u32(ex+36))+i*2)]=cs(off(u32(off(u32(ex+32))+i*4)))
        for i in range(u32(ex+20)):
            r=u32(funcs+4*i)
            if r: exports.append({'ordinal':base+i,'name':name_by_ord.get(i),'rva':hex(r),'forwarder':cs(off(r)) if er <= r < er+es else None})
    dialogs=[]
    if u32(p+136):
        root=off(u32(p+136))
        def entries(at):
            return [(u32(at+16+8*i),u32(at+20+8*i)) for i in range(u16(at+12)+u16(at+14))]
        def field(at):
            v=u16(at);at+=2
            if v==65535:return {'ordinal':u16(at)},at+2
            if not v:return '',at
            start=at-2
            while u16(at):at+=2
            return b[start:at].decode('utf-16le'),at+2
        for typ,ptr in entries(root):
            if typ!=5:continue
            for ident,dp in entries(root+(ptr&0x7fffffff)):
                for lang,lp in entries(root+(dp&0x7fffffff)):
                    de=root+lp;at=off(u32(de));extended=u16(at+2)==65535
                    if extended:continue
                    style=u32(at);count=u16(at+8);at+=18
                    menu,at=field(at);cls,at=field(at);title,at=field(at)
                    if style&64:at+=2; font,at=field(at)
                    controls=[]
                    for _ in range(count):
                        at=(at+3)&~3;st=u32(at);identc=u16(at+16);rect=list(struct.unpack_from('<hhhh',b,at+8));at+=18
                        cl,at=field(at);text,at=field(at);extra=u16(at);at+=2+extra
                        controls.append({'id':identc,'class':cl,'text':text,'rectDlu':rect,'style':hex(st)})
                    dialogs.append({'id':ident,'language':lang,'title':title,'style':hex(style),'controls':controls})
    return {'format':'PE32','imageBase':hex(u32(p+52)), 'entryRva':hex(u32(p+40)), 'imports':imports,'exports':exports,'dialogs':dialogs}

def analyze():
    receipt=json.loads((E/'accepted/native-receipt.json').read_text())
    files={}
    for x in receipt['originalInstalledFiles']:
        p=N/x['name']; b=p.read_bytes(); assert len(b)==x['size'] and sha(b)==x['sha256']
        files[x['name']]={'source':str(p),'bytes':len(b),'sha256':sha(b),'provenance':'accepted original installed receipt bx_m4xrrj5a cmd_m7vjlhyyj5lx',**pe(b)}
    p=R/'test/binaries/dlls/comctl32.dll';b=p.read_bytes()
    files['comctl32.dll']={'source':str(p),'bytes':len(b),'sha256':sha(b),'provenance':'existing ignored host DLL; not installed Shadow Man payload; upstream distribution provenance unavailable',**pe(b)}
    reg=(E/'source/lib/dll-registry.js').read_text()
    loadable=set(re.findall(r"'([^']+\.dll)'",reg))
    edges=[]
    for name,x in files.items():
        for imp in x['imports'] or []:
            edges.append({'from':name,**imp,'policy':'native candidate' if imp['dll'] in loadable else 'WAT system boundary','available':imp['dll'] in files})
    payload=json.loads((E/'accepted/installed-payload.json').read_text())
    selected=[x for x in payload['mapping'] if x['installed']['path'].split('/')[-1] in ['mss32.dll','shadowman.exe','d3dconfigutility.exe','dsetup.dll','dsetup32.dll','dsetup16.dll']]
    return {'files':files,'edges':edges,'loadableRegistry':sorted(loadable),'installedOriginalPins':selected,'limitations':['Exact installed MSS32 and ShadowMan PE bytes are not in the permitted local originals folder; recursive graph beyond these nodes unavailable.','ole32.dll is absent at test/binaries/dlls/ole32.dll; no acquisition or remote reads.','Static imports indicate possible reachability; only raw trace establishes calls exercised.']}

if __name__=='__main__':
    result=analyze();(E/'native-graph.json').write_text(json.dumps(result,indent=2)+'\n')
    for n,x in result['files'].items():
        print(n,x['bytes'],x['sha256'],x['format'])
        for i in x['imports'] or []:print(' ',i['dll'],len(i['names']),'names',i['ordinals'],'ordinals',i['names'] if len(i['names'])<15 else '')
