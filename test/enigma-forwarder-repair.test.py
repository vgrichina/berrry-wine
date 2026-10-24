#!/usr/bin/env python3
"""Real SDL EAT regression plus parser and resolver controls; no guest execution."""
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
assert retained.resolve() != owned.resolve()
owned.mkdir(parents=True, exist_ok=False)
tool = Path(__file__).resolve().parents[1]/'tools/enigma-unpacked-closure.py'
source = tool.read_bytes()
u = types.ModuleType('repaired')
u.__file__ = str(tool)
exec(compile(source, str(tool), 'exec'), u.__dict__)
bindings = json.loads((retained/'module-bindings.json').read_text())
identity = json.loads((retained/'tool-identity.json').read_text())
auth = u.verify(retained/'outputs', retained/'inputs', bindings, identity)
assert (sum(e['symbols'] for e in auth['edges']), len(auth['edges']), len(auth['packaged_bindings'])) == (849,40,192)
dynamic = auth['fixed_dynamic']['codec_initializers']
assert len(dynamic)==6 and sum(len(x['symbols']) for x in dynamic)==74
assert sum(len(x['symbols']) for x in dynamic if x['status']=='PACKAGED_EXPORTS_BIND')==50
checks=[]
def reject(label, fn, reason):
    try: fn()
    except (AssertionError, ValueError) as error:
        assert reason in str(error), (label,str(error))
        checks.append(dict(control=label,rejected=str(error)))
    else: raise AssertionError('accepted '+label)

raw=(retained/'outputs/SDL.dll').read_bytes()
m=auth['modules']['sdl.dll']
h=struct.unpack_from('<I',raw,60)[0];o=h+24
er,es=struct.unpack_from('<II',raw,o+96)
def off(rva):
    s=next(s for s in m['sections'] if s['rva']<=rva<s['rva']+s['raw_size'])
    return s['raw']+rva-s['rva']
eat=299908
assert struct.unpack_from('<I',raw,eat)[0]==m['export_rvas']['SDL_Init']==0x1340
assert er==0x53000 and er+es==0x5443b and raw[off(er)]==0
fixture=owned/'mutant.dll'
mutant=bytearray(raw);struct.pack_into('<I',mutant,eat,er)
fixture.write_bytes(mutant)
mutant_sha=u.sha(fixture)
assert mutant_sha=='04448e081b6a27c4cf02989d5c763cd2cc9f1d1f0cb7e0e3934964fa5a6791c0'
reject('exact four-byte SDL_Init EAT mutation, semantic parser before seals',lambda:u.closure(dict(auth['modules'], **{'sdl.dll':u.pe(fixture)})),'malformed forwarder')

def graph(value):
    return {'enigma.exe':{'imports':{'a.dll':['alias']},'exports':{}},
            'a.dll':{'imports':{},'exports':{'alias':value}},
            'b.dll':{'imports':{},'exports':{'named':None,'#12':None,'#65535':None}}}
for value in ['b.named','B.DLL.named','b.#12','b.#00012','b.#65535']:
    assert len(u.closure(graph(value))['packaged_bindings'])==2
for value in ['', 'b', '.named','b.', '../b.named','b/name.named','b\\name.named',
              'b..named','b. name','b.\x7f','b.#','b.#0','b.#65536','b.#-1',
              'b.#+1','b.#1x','b.#１２','b.'+'n'*4094]:
    reject('resolver malformed '+repr(value[:50]),lambda:u.closure(graph(value)),'malformed forwarder')
reject('missing forwarded provider',lambda:u.closure(graph('absent.named')),'unresolved DLL')
reject('missing forwarded symbol',lambda:u.closure(graph('b.missing')),'unresolved export')
reject('missing forwarded ordinal',lambda:u.closure(graph('b.#13')),'unresolved export')
g=graph('b.named');g['b.dll']['exports']['named']='a.alias'
reject('forward cycle',lambda:u.closure(g),'forward cycle')

# Place test strings in raw padding after the authentic export extent; preserve
# every real table/name. Only fixture copies extend the declared directory.
def pe_forward(data, declared=None):
    b=bytearray(raw);start=er+es
    at=off(start);assert at+len(data)<=len(b)
    assert not any(b[at:at+len(data)])
    b[at:at+len(data)]=data
    struct.pack_into('<I',b,eat,start)
    struct.pack_into('<I',b,o+100,es+(len(data) if declared is None else declared))
    fixture.write_bytes(b)
    return u.pe(fixture)
for value in ['SDL.SDL_Quit','SDL.dll.SDL_Quit','SDL.#1']:
    parsed=pe_forward(value.encode()+b'\0')
    assert parsed['exports']['SDL_Init']==value
    mods=copy.deepcopy(auth['modules']);mods['sdl.dll']=parsed
    assert u.closure(mods)['normal_imports']=='PASS'
for data in [b'\0',b'.name\0',b'b.\0',b'b.#\0',b'b.#65536\0',b'b/name.x\0']:
    reject('real PE malformed '+repr(data),lambda:pe_forward(data),'malformed forwarder')
reject('NUL just outside export extent',lambda:pe_forward(b'b.named\0',7),'unterminated forwarder in export directory')
reject('last export byte nonzero',lambda:pe_forward(b'b\0',1),'unterminated forwarder in export directory')
reject('non-ASCII forwarder',lambda:pe_forward(b'b.\xff\0'),'ascii')
assert pe_forward(b'b.named\0')['exports']['SDL_Init']=='b.named'
assert u.pe(retained/'outputs/SDL.dll')['exports']['SDL_Init'] is None

# Owned ten-module fixture is also used by the unchanged producer suite, which
# temporarily mutates files. Rebind only paths, keeping all immutable hashes.
for kind in ['inputs','outputs']:
    shutil.copytree(retained/kind,owned/kind)
bs=copy.deepcopy(bindings)
for binding in bs:
    name=Path(binding['original']['path']).name
    binding['test']['argv'][2]=str((owned/'inputs'/name).resolve())
    binding['unpack']['argv'][3]=str((owned/'outputs'/name).resolve())
    binding['unpack']['argv'][4]=str((owned/'inputs'/name).resolve())
(owned/'module-bindings.json').write_text(json.dumps(bs))
(owned/'tool-identity.json').write_text(json.dumps(identity))
sdl=owned/'outputs/SDL.dll';sdl.write_bytes(mutant)
reject('full verify still rejects immutable mutant',lambda:u.verify(owned/'outputs',owned/'inputs',bs,identity),'changed unpacked module')
sdl.write_bytes(raw)
assert u.verify(owned/'outputs',owned/'inputs',bs,identity)['normal_imports']=='PASS'
print(json.dumps(dict(verdict='PASS_REPAIR_REGRESSION',source_sha256=hashlib.sha256(source).hexdigest(),mutant_sha256=mutant_sha,checks=checks,positive_forwarders=8,authentic=dict(imports=849,edges=40,packaged=192,codec_calls=6,requests=74,packaged_requests=50,missing_requests=24),output_pins={k:v[1] for k,v in u.SEALS.items()}),indent=2))
