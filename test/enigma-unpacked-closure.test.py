#!/usr/bin/env python3
"""Fail-closed guard/sentinel controls; optional real diagnostic closure tests."""
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import copy
import struct

tool = Path(__file__).resolve().parents[1] / 'tools/enigma-unpacked-closure.py'
spec = importlib.util.spec_from_file_location('unpacked', tool)
u = importlib.util.module_from_spec(spec)
spec.loader.exec_module(u)
original = u.original_helper()
controls = []
with tempfile.TemporaryDirectory(prefix='unpacked-controls-', dir=tool.parents[2]) as td:
    root = Path(td)
    sentinel = root / 'download-sentinel'
    dependent = [sys.executable, '-c', 'from pathlib import Path; import sys; Path(sys.argv[1]).write_text("download")', str(sentinel)]
    for name, command, fixture in [
        ('allocation', 'guard', {'projected': 67108865, 'host_after': 4000000000, 'mem_available': 900000000, 'pass': True}),
        ('release identity', 'metadata', {'tag_name': 'v0-wrong'}),
    ]:
        f = root / 'fixture.json'
        f.write_text(json.dumps(fixture))
        status = original.sequence([sys.executable, str(tool), command, str(f)], dependent)
        assert status != 0 and not sentinel.exists(), name
        controls.append({'control': name, 'status': status, 'sentinel_absent': True})
print(json.dumps({'pre_download_controls': controls, 'pass': True}))

if len(sys.argv) == 2:
    root = Path(sys.argv[1]).resolve()
    outputs, inputs = root/'outputs', root/'inputs'
    bindings = json.loads((root/'module-bindings.json').read_text())
    identity = json.loads((root/'tool-identity.json').read_text())
    checked = []
    def rejects(label, operation, reason):
        try:
            operation()
        except (AssertionError, ValueError) as error:
            assert reason in str(error), (label,str(error),reason)
            checked.append(dict(control=label,rejected=str(error)))
        else:
            raise AssertionError('accepted '+label)
    def verify(bs=bindings, ti=identity):
        return u.verify(outputs,inputs,bs,ti)
    result = verify()
    assert sum(e['symbols'] for e in result['edges']) == 849
    assert len(result['packaged_bindings']) == 192
    assert result['normal_imports']=='PASS' and result['dynamic_closure']=='UNPROVEN'
    assert any(len(m['import_descriptors']) > len(m['imports']) for m in result['modules'].values())
    missing = outputs/'SDL.dll'
    held = root/'held-SDL.dll'
    missing.rename(held)
    try: rejects('missing DLL',verify,'missing/extra')
    finally: held.rename(missing)
    with missing.open('r+b') as f:
        byte = f.read(1); f.seek(0); f.write(bytes([byte[0]^1]))
    try: rejects('changed unpacked DLL',verify,'changed unpacked module')
    finally:
        with missing.open('r+b') as f: f.write(byte)
    wrong = copy.deepcopy(bindings); wrong[0]['original']['sha256'] = '0'*64
    rejects('wrong original binding',lambda:verify(wrong),'wrong original binding')
    wrong = copy.deepcopy(identity); wrong['executable_sha256'] = '0'*64
    rejects('wrong tool identity',lambda:verify(ti=wrong),'wrong tool identity')
    wrong = copy.deepcopy(bindings); wrong[0]['test']['status'] = 2
    rejects('failed UPX test',lambda:verify(wrong),'UPX command failed')
    wrong = copy.deepcopy(bindings); wrong[0]['unpack']['argv'][1] = '--force'
    rejects('wrong unpack command',lambda:verify(wrong),'wrong unpack command')
    for label,dll,symbol,reason in [('unresolved DLL','absent.dll','missing','unresolved DLL'),('unresolved export','sdl.dll','absent_export','unresolved export')]:
        wrong = copy.deepcopy(result['modules']); wrong['enigma.exe']['imports'][dll]=[symbol]
        rejects(label,lambda:u.closure(wrong),reason)
    graph = {'enigma.exe':{'imports':{'a.dll':['#7']},'exports':{}},
             'a.dll':{'imports':{},'exports':{'#7':'b.#12'}},
             'b.dll':{'imports':{},'exports':{'#12':None}}}
    assert len(u.closure(graph)['packaged_bindings'])==2
    wrong = copy.deepcopy(graph); wrong['a.dll']['exports']['#7']='b.#13'
    rejects('unresolved forwarded ordinal',lambda:u.closure(wrong),'unresolved export')
    wrong = copy.deepcopy(graph); wrong['b.dll']['exports']['#12']='a.#7'
    rejects('forward cycle',lambda:u.closure(wrong),'forward cycle')
    # Corrupt real owned PE copies; no synthetic or replacement programs compiled.
    with tempfile.TemporaryDirectory(prefix='pe-controls-',dir=root) as td:
        f = Path(td)/'damaged.dll'; raw = missing.read_bytes()
        h = struct.unpack_from('<I',raw,60)[0]
        for label,offset,value,reason in [('entrypoint',h+24+16,0xffffffff,'entrypoint'),
                                          ('section raw bounds',h+24+224+20,0xffffffff,'PE file bounds')]:
            changed = bytearray(raw); struct.pack_into('<I',changed,offset,value); f.write_bytes(changed)
            rejects(label,lambda:u.pe(f),reason)
    rejects('packed input is not diagnostic output',lambda:u.pe(inputs/'enigma.exe'),'still packed')
    # Decode the six codec arguments and all 74 named function requests.
    dynamic = result['fixed_dynamic']
    assert sum(len(x['symbols']) for x in dynamic['codec_initializers'])==74
    assert [x['dll'] for x in dynamic['codec_initializers'] if x['status'].startswith('MISSING')] == ['libtiff-3.dll','libvorbisfile-3.dll','smpeg.dll']
    image = outputs/'SDL_image.dll'; raw = image.read_bytes(); m=result['modules']['sdl_image.dll']
    rva = 0x62e436d0-m['image_base']
    s = next(s for s in m['sections'] if s['rva']<=rva<s['rva']+s['raw_size']); off=s['raw']+rva-s['rva']
    with image.open('r+b') as f: f.seek(off); f.write(b'\x90')
    try: rejects('codec argument instruction changed',lambda:u.fixed_dynamic(outputs,result['modules']),'codec literal argument')
    finally:
        with image.open('r+b') as f: f.seek(off); f.write(raw[off:off+1])
    assert verify()['normal_imports']=='PASS'
    print(json.dumps({'real_unpacked_controls':checked,'positive_ordinal_forwarder':True,'six_codec_initializers':True,'pass':True}))
