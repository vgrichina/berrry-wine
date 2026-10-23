#!/usr/bin/env python3
"""Bounded static checks, reusing the standing parser without its side effects."""
import ast, hashlib, json, pathlib, re
H = pathlib.Path(__file__).resolve().parent
D = pathlib.Path('/tmp/airstrike-original-private-oct23/docs/re-notes/airstrike-original-20261023')
R = pathlib.Path('/home/user/wine-assembly')
def sha(p):
    assert p.stat().st_size <= 25165824
    return hashlib.sha256(p.read_bytes()).hexdigest()
def save(name, obj):
    b = (json.dumps(obj, indent=2)+'\n').encode()
    assert len(b) <= 131072
    (H/name).write_bytes(b)
parser = D/'inspect.py'
tree = ast.parse(parser.read_text())
keep = [n for n in tree.body if isinstance(n,(ast.Import,ast.ImportFrom)) or isinstance(n,ast.FunctionDef) and n.name in ('sha','pe')]
ns = {}
exec(compile(ast.Module(body=keep,type_ignores=[]),'standing-pe-parser','exec'),ns)
pe = ns['pe']
z = pe(H/'zlib.dll')
assert z['sha256'] == '0df0c22bf411ad670d7b8fe5a533e4831313d5a3118cf9216389c642c90ec2f9'
assert z['machine'] == '0x14c' and z['export_dll_name'] == 'zlib.dll'
save('zlib-pe.json',z)
images = json.loads((D/'pe.json').read_text())
matches = []
for i in images:
    name = pathlib.Path(i['path']).name
    p = H/('sdl123-'+name)
    if p.exists():
        assert sha(p) == i['sha256']
        matches.append({'file':name,'sha256':sha(p),'identical_to_airstrike':True})
assert {m['file'] for m in matches} == {'libpng1.dll','SDL_image.dll','jpeg.dll'}
save('matching-distribution.json',matches)
png = next(i for i in images if pathlib.Path(i['path']).name=='libpng1.dll')
required = next(d for d in png['imports'] if d['dll'].lower()=='zlib.dll')['symbols']
mapping = {10:'deflateReset',3:'crc32',7:'deflateInit2_',6:'deflateEnd',4:'deflate',20:'inflateEnd',22:'inflateInit_',19:'inflate',23:'inflateReset'}
assert [s['ordinal'] for s in required] == list(mapping)
exports = {e['ordinal']:e for e in z['exports']}
for o,n in mapping.items():
    assert exports[o]['name'] == n and exports[o]['forwarder'] is None
source_def = dict((int(o),n) for n,o in re.findall(r'^\s*(\w+)\s+@(\d+)',(H/'source-minizip-zlib.def').read_text(),re.M))
assert {e['ordinal']:e['name'] for e in z['exports']} == source_def
save('required-mapping.json',{'importer_sha256':png['sha256'],'provider_sha256':z['sha256'],'proof':'Exact importer and its SDL_image/jpeg companions are byte-identical to official SDL_image 1.2.3 Win32 distribution shipping this provider.','mapping':[exports[o] for o in mapping]})
api = json.loads((R/'src/api_table.json').read_text())
known = {x['name'] for x in api}
prior = json.loads((D/'dependency-comparison.json').read_text())
providers = {pathlib.Path(i['path']).name.lower():i for i in images + prior['standing_donors'] + [z]}
edges = []
for name,i in providers.items():
    for dep in i['imports']:
        target = providers.get(dep['dll'].lower())
        if target:
            names = {e['name'] for e in target['exports']}
            ords = {e['ordinal'] for e in target['exports']}
            missing = [s for s in dep['symbols'] if (s['name'] not in names if 'name' in s else s['ordinal'] not in ords)]
            assert not missing
            edges.append({'importer':name,'dll':dep['dll'],'resolution':'real PE','missing':missing})
        else:
            edges.append({'importer':name,'dll':dep['dll'],'resolution':'system emulation; runtime untested','missing_api_names':[s['name'] for s in dep['symbols'] if 'name' in s and s['name'] not in known],'ordinal_imports':[s for s in dep['symbols'] if 'ordinal' in s]})
save('recursive-closure.json',{'api_table_sha256':sha(R/'src/api_table.json'),'standing_parser_sha256':sha(parser),'edges':edges,'qualification':'All real-PE imports resolve. System API names are a static inventory, not runtime validation.'})
files = json.loads((D/'files.json').read_text())['files']
vfs = []
for f in files:
    rel = f['path'].removeprefix('airstrike-pre6a/')
    if rel in ('airstrike-pre6a.exe','airstrikerc') or rel.startswith('data/'):
        vfs.append({'path':rel,'bytes':f['bytes'],'sha256':f['sha256']})
save('minimal-vfs.json',{'files':vfs,'bytes':sum(f['bytes'] for f in vfs),'cwd':'C:\\'})
paths = ['test/run.js','lib/vfs-host-files.js','lib/dll-loader.js','src/api_table.json']
save('launch-source-identities.json',[{'path':p,'bytes':(R/p).stat().st_size,'sha256':sha(R/p)} for p in paths])
print(json.dumps({'matching_distribution_files':len(matches),'required_ordinals_pass':len(mapping),'real_pe_imports':'PASS','system_api_gaps':[e for e in edges if e.get('missing_api_names')],'vfs_files':len(vfs)}))
