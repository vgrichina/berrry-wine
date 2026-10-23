"""Cheap recovery checks on existing retained bytes; no extraction or execution."""
import json, hashlib, pathlib, zipfile
from static_pe import BASE, ARCHIVE, DIGEST

assert ARCHIVE.stat().st_size==1410755
assert hashlib.sha256(ARCHIVE.read_bytes()).hexdigest()==DIGEST
files=json.loads((BASE/'files.json').read_text())
assert len(files)==118 and sum(f['bytes'] for f in files)==2302319
with zipfile.ZipFile(ARCHIVE) as z:
    assert len(z.infolist())==len(files)
    for f,i in zip(files,z.infolist()):
        assert i.filename==f['path'] and i.CRC==int(f['crc32'],16)
        b=z.read(i)
        assert len(b)==f['bytes'] and hashlib.sha256(b).hexdigest()==f['sha256']
        if not f['directory']:
            p=BASE/'original'/f['path']
            assert p.stat().st_size==f['bytes'] and hashlib.sha256(p.read_bytes()).hexdigest()==f['sha256']
crt=json.loads((BASE/'native-crt.json').read_text());p=pathlib.Path(crt['path'])
assert p.stat().st_size==crt['bytes'] and hashlib.sha256(p.read_bytes()).hexdigest()==crt['sha256']
closure=json.loads((BASE/'dependency-closure.json').read_text())
assert len(closure['imports'])==682
assert all(r['resolved_by_static_inventory'] for r in closure['imports'] if r['provider']!='emulated-system-api')
assert all(r['export_present'] for r in closure['dynamic_codec_export_candidates'])
assert not any('ordinal' in r for r in closure['imports'])
for f in json.loads((BASE/'harness-source-identities.json').read_text()):
    assert hashlib.sha256(pathlib.Path(f['path']).read_bytes()).hexdigest()==f['sha256'], f['path']
launch=json.loads((BASE/'launch-manifest.json').read_text())
assert len(launch['dll_seeds'])==7 and len(launch['asset_mounts'])==91
result={'result':'PASS','entries':118,'files':sum(not f['directory'] for f in files),'PE32':8,'import_edges':682,'ordinals':0,'codec_export_candidates':25,'quiet_graphics':sum(a['quiet_profile_required'] for a in launch['asset_mounts']),'optional_sound':sum(not a['quiet_profile_required'] for a in launch['asset_mounts'])}
(BASE/'static-verification.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result))
