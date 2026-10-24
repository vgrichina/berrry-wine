#!/usr/bin/env python3
"""Independent exact-candidate probes; never mutate standing retained artifacts.

Usage: python3 -B test/enigma-unpacked-independent-review.test.py RETAINED OWNED
Exit zero means the known-candidate behavior was reproduced, not acceptance.
"""
import copy
import hashlib
import json
from pathlib import Path
import shutil
import struct
import sys
import types

sys.dont_write_bytecode = True
retained, owned = map(Path, sys.argv[1:])
owned.mkdir(parents=True, exist_ok=True)
tool = Path(__file__).resolve().parents[1]/'tools/enigma-unpacked-closure.py'
source = tool.read_bytes()
assert hashlib.sha256(source).hexdigest() == '9cb012199d5307b63e369f140aea0875aee0b519b136c0033dd3ef735a8a298a'
u = types.ModuleType('candidate')
u.__file__ = str(tool)
exec(compile(source, str(tool), 'exec'), u.__dict__)
bindings = json.loads((retained/'module-bindings.json').read_text())
identity = json.loads((retained/'tool-identity.json').read_text())
result = u.verify(retained/'outputs', retained/'inputs', bindings, identity)
assert sum(e['symbols'] for e in result['edges']) == 849
assert len(result['edges']) == 40 and len(result['packaged_bindings']) == 192
assert sum(len(x['symbols']) for x in result['fixed_dynamic']['codec_initializers']) == 74
checks = []
def reject(label, fn, reason):
    try:
        fn()
    except (AssertionError, ValueError) as error:
        assert reason in str(error), (label,str(error))
        checks.append(dict(control=label,result='REJECT',reason=str(error)))
    else:
        raise AssertionError('unexpected acceptance '+label)
def verify(bs=bindings, ti=identity):
    return u.verify(retained/'outputs',retained/'inputs',bs,ti)
wrong=copy.deepcopy(bindings); wrong[0]['output_sha256']='0'*64
reject('invented output receipt cannot bless bytes',lambda:verify(wrong),'changed unpacked module')
wrong=copy.deepcopy(bindings); wrong.append(copy.deepcopy(wrong[0]))
reject('extra binding',lambda:verify(wrong),'ten bindings required')
wrong=copy.deepcopy(bindings); wrong[1]=copy.deepcopy(wrong[0])
reject('duplicate binding',lambda:verify(wrong),'duplicate/unknown binding')
wrong=copy.deepcopy(bindings); wrong[0]['unpack']['argv'][-1]+='.invented'
reject('different command input',lambda:verify(wrong),'wrong unpack command')

# Bounded reads and actual descriptor termination, with authentic repeated DLLs.
assert any(len(m['import_descriptors'])>len(m['imports']) for m in result['modules'].values())
fixture=owned/'malformed.dll'
sdl=(retained/'outputs/SDL.dll').read_bytes()
sh=struct.unpack_from('<I',sdl,60)[0]; so=sh+24
section_table=so+struct.unpack_from('<H',sdl,sh+20)[0]
def patch(b,at,value):
    b=bytearray(b);struct.pack_into('<I',b,at,value);return b
for label,mutate,reason in [
    ('truncated section payload',lambda b:b[:-4096],'PE file bounds'),
    ('overlapping virtual sections',lambda b:patch(b,section_table+40+12,struct.unpack_from('<I',b,section_table+12)[0]),'overlapping sections'),
    ('import descriptors without terminator in declared extent',lambda b:patch(b,so+108,20),'unterminated import descriptors'),
]:
    fixture.write_bytes(mutate(sdl))
    reject(label,lambda:u.pe(fixture),reason)

# A call opcode and DLL string alone must not satisfy the dynamic oracle.
dynamic=owned/'dynamic';dynamic.mkdir(exist_ok=True)
for name in ['SDL.dll','SDL_image.dll','SDL_mixer.dll']:
    shutil.copyfile(retained/'outputs'/name,dynamic/name)
im=result['modules']['sdl_image.dll']; image=bytearray((dynamic/'SDL_image.dll').read_bytes())
def image_off(va):
    rva=va-im['image_base']
    s=next(s for s in im['sections'] if s['rva']<=rva<s['rva']+s['raw_size'])
    return s['raw']+rva-s['rva']
site=0x62e436d7;at=image_off(site)
thunk=site+5+struct.unpack_from('<i',image,at+1)[0]
assert image[image_off(thunk):image_off(thunk)+2]==b'\xff\x25'
other=next(i for i in im['iat'] if i['symbol']!='SDL_LoadObject')
struct.pack_into('<I',image,image_off(thunk)+2,im['image_base']+other['rva'])
(dynamic/'SDL_image.dll').write_bytes(image)
reject('codec call redirected to another authentic IAT slot',lambda:u.fixed_dynamic(dynamic,result['modules']),'dynamic IAT binding')

# A genuine malformed forwarder in a real PE, not a fabricated graph.
raw=bytearray((retained/'outputs/SDL.dll').read_bytes())
h=struct.unpack_from('<I',raw,60)[0]; o=h+24
er,es=struct.unpack_from('<II',raw,o+96)
m=result['modules']['sdl.dll']
def off(rva):
    s=next(s for s in m['sections'] if s['rva']<=rva<s['rva']+s['raw_size'])
    return s['raw']+rva-s['rva']
e=off(er)
base,nf,nn,fr,nr,orr=struct.unpack_from('<IIIIII',raw,e+16)
index=next(i for i in range(nn) if raw[off(struct.unpack_from('<I',raw,off(nr)+4*i)[0]):].split(b'\0',1)[0]==b'SDL_Init')
ordinal=struct.unpack_from('<H',raw,off(orr)+2*index)[0]
eat=off(fr)+4*ordinal
null_rva=next(v for v in range(er,er+es) if raw[off(v)]==0)
before=struct.unpack_from('<I',raw,eat)[0]
struct.pack_into('<I',raw,eat,null_rva)
bad=owned/'empty-forwarder-SDL.dll';bad.write_bytes(raw)
parsed=u.pe(bad)
assert parsed['exports']['SDL_Init']==''
mods=copy.deepcopy(result['modules']); mods['sdl.dll']=parsed
closed=u.closure(mods)
assert ['sdl.dll','SDL_Init'] in closed['packaged_bindings']
assert closed['normal_imports']=='PASS'
checks.append(dict(control='empty forwarder for actually imported SDL_Init',result='INCORRECT_PASS',file=str(bad),sha256=u.sha(bad),patch_file_offset=eat,old_rva=hex(before),new_rva=hex(null_rva),export_directory=[hex(er),hex(er+es)],parsed_forwarder=parsed['exports']['SDL_Init'],normal_imports=closed['normal_imports']))

# Pinning still stops this PE at the full verify boundary: no arbitrary binary bypass.
checks.append(dict(control='mutant versus immutable output seal',result='DIFFERENT',expected=u.SEALS['sdl.dll'][1],actual=u.sha(bad)))
assert u.sha(bad)!=u.SEALS['sdl.dll'][1]

# Receipt provenance is weaker than immutable byte identity: invented original path
# and arbitrary replacement logs still pass. These do not bless other PE bytes.
wrong=copy.deepcopy(bindings)
wrong[0]['original']['path']='Invented-tree/'+Path(wrong[0]['original']['path']).name
assert verify(wrong)['normal_imports']=='PASS'
checks.append(dict(control='invented original directory',result='ACCEPTED_RECEIPT',path=wrong[0]['original']['path']))
empty=owned/'invented-command.log';empty.write_bytes(b'')
wrong=copy.deepcopy(bindings)
for key in ['test','unpack']:
    wrong[0][key]['log']=str(empty);wrong[0][key]['log_sha256']=u.sha(empty)
assert verify(wrong)['normal_imports']=='PASS'
checks.append(dict(control='invented empty command logs',result='ACCEPTED_RECEIPT',sha256=u.sha(empty)))
print(json.dumps(dict(candidate='def12ace9c3157ca270495a6b770b5119d776683',verdict='REJECT_PARSER_CORRECTNESS',positive=dict(imports=849,edges=40,packaged=192,codec_calls=6,symbols=74),controls=checks),indent=2))
