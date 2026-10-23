"""Account imported names against bundled exports, standing CRT and API names."""
import pathlib, json, hashlib, re
from static_pe import BASE, save

ROOT=pathlib.Path('/home/user/wine-assembly')
pes=json.loads((BASE/'pe.json').read_text())
crt=json.loads((BASE/'native-crt.json').read_text())
api={x['name'] for x in json.loads((ROOT/'src/api_table.json').read_text())}
providers={pathlib.PurePosixPath(n).name.lower():v for n,v in pes.items() if n.lower().endswith('.dll')}
providers['msvcrt.dll']=crt
rows=[]
for module,p in list(pes.items())+[(crt['path'],crt)]:
    for imp in p['imports']:
        name=imp['dll'].lower(); provider=providers.get(name)
        exnames={n for e in provider['exports'] for n in e['names']} if provider else set()
        exords={e['ordinal'] for e in provider['exports']} if provider else set()
        for sym in imp['symbols']:
            inapi=sym.get('name') in api
            resolved=(sym.get('name') in exnames if 'name' in sym else sym['ordinal'] in exords) if provider else inapi
            rows.append({'consumer':module,'dll':name,**sym,'in_api_table':inapi,
                         'provider':'standing-native-crt' if name=='msvcrt.dll' else 'bundled-native-pe' if provider else 'emulated-system-api',
                         'resolved_by_static_inventory':resolved})
dynamic=[]
s=json.loads((BASE/'selected-strings.json').read_text())
for provider,prefix in [('jpeg.dll','jpeg_'),('libpng12-0.dll','png_')]:
    names={n for e in providers[provider]['exports'] for n in e['names']}
    for n in s['SDL_image.dll']:
        if n.startswith(prefix):dynamic.append({'consumer':'SDL_image.dll','dll':provider,'name':n,'export_present':n in names,'evidence':'ASCII string candidate, not executed lookup'})
save('dependency-closure.json',{'classification':'static inventory only; missing names do not establish executed failure',
    'imports':rows,'dynamic_codec_export_candidates':dynamic,
    'unresolved_imports':[r for r in rows if not r['resolved_by_static_inventory']],
    'native_crt_names_absent_api_but_exported':sorted({r['name'] for r in rows if r['dll']=='msvcrt.dll' and not r['in_api_table'] and r['resolved_by_static_inventory']}),
    'provider_forwarders':{n:[e for e in p['exports'] if e['forwarder']] for n,p in providers.items()}})
files=['test/run.js','lib/dll-loader.js','lib/dll-registry.js','lib/process-boot.js','lib/vfs-host-files.js','src/api_table.json','lib/renderer.js','src/09a5-handlers-window.wat']
save('harness-source-identities.json',[{'path':str(ROOT/f),'bytes':(ROOT/f).stat().st_size,'sha256':hashlib.sha256((ROOT/f).read_bytes()).hexdigest()} for f in files])
assets=[i for i in json.loads((BASE/'files.json').read_text()) if not i['directory'] and '/data/' in i['path'] and pathlib.PurePosixPath(i['path']).suffix.lower() in ('.png','.jpg','.wav','.s3m')]
seeds=['SDL.dll','SDL_image.dll','SDL_mixer.dll','jpeg.dll','libpng12-0.dll','zlib1.dll']
save('launch-manifest.json',{'exe':'penguin-command.exe','exe_sha256':pes['penguin-command-1.6.11/penguin-command.exe']['sha256'],
    'guest_exe':'c:\\penguin-command.exe','guest_cwd':'c:\\','args':'--windowed --nosound',
    'dll_seeds':[{'relative_path':n,'sha256':providers[n.lower()]['sha256']} for n in seeds]+[{'host_path':crt['path'],'sha256':crt['sha256']}],
    'asset_mounts':[{'relative_path':i['path'].split('/',1)[1],'guest_path':'c:\\'+i['path'].split('/',1)[1].replace('/','\\'),'bytes':i['bytes'],'sha256':i['sha256'],'quiet_profile_required':'/gfx/' in i['path']} for i in assets],
    'runtime_created_file':'c:\\penguin-command.dat',
    'asset_scope':'quiet profile mounts retained PNG/JPG graphics; sound WAV/S3M optional. XBM/XPM source cursor/icon files excluded; strict minimal path coverage unproven without execution'})
print(json.dumps({'import_edges':len(rows),'unresolved':sorted({(r['dll'],r.get('name',str(r.get('ordinal')))) for r in rows if not r['resolved_by_static_inventory']}),
    'native_crt_absent_api_but_exported':sorted({r['name'] for r in rows if r['dll']=='msvcrt.dll' and not r['in_api_table'] and r['resolved_by_static_inventory']}),
    'dynamic_codec_candidates':len(dynamic),'dynamic_codec_missing':[r for r in dynamic if not r['export_present']],'assets':len(assets)}))
