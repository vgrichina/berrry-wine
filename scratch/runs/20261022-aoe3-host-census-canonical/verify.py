import pathlib,json,hashlib,difflib
E=pathlib.Path(__file__).parent
h=lambda b:hashlib.sha256(b).hexdigest()
a=json.loads((E/'census-before.json').read_text());b=json.loads((E/'census-after.json').read_text());assert len(a['entries'])==len(b['entries'])==407
changes=[(x,y) for x,y in zip(a['entries'],b['entries']) if x!=y];assert len(changes)==1
x,y=changes[0];assert x['file']==y['file']=='lib/host-imports.js' and x['name']==y['name']=='host-file';assert {k for k in x if x[k]!=y[k]}=={'sha256','reason'};assert y['kind']=='host-entry' and y['ownership']=='pending' and y['reason'].startswith(x['reason'])
base=(E/'host-before.js').read_bytes();candidate=(E/'host-after.js').read_bytes();addition=b"        // Wine's oleaut32.spec: 8 stdcall VariantInit(ptr), matching the\n        // static system-ordinal resolver in src/08b-dll-loader.wat.\n        'OLEAUT32.DLL#8': 'VariantInit',\n";assert candidate.count(addition)==1 and candidate.replace(addition,b'')==base;assert h(base)==x['sha256'] and h(candidate)==y['sha256']
checks=json.loads((E/'checks.json').read_text());assert [x['exit'] for x in checks]==[1,0,1,0,0]
for i in [0,2]:assert checks[i]['stderr'].strip()=='changed producer lib/host-imports.js:host-file (sha256); review its lifetime'
for i in [1,3]:assert '407 source boundaries unchanged; nonlocal APIs remain disabled (ownership pending)' in checks[i]['stdout']
r=json.loads((E/'build-result.json').read_text());assert r['attempt']==1 and r['exit']==1 and r['module'] is None and r['command']==['bash','tools/build.sh'];assert h((E/'build.log').read_bytes())==r['logSHA256'];assert "fonts/Terminal.fon" in (E/'build.log').read_text() and 'Error: ENOENT' in (E/'build.log').read_text();assert r['pinsBefore']==r['pinsAfter']=={'count':373,'passAll':True}
state=json.loads((E/'final-integrity.json').read_text());rows=json.loads((E/'source-manifest.json').read_text());assert state['postBuildSourceDrift']==[] and len(rows)==1078 and h((E/'source-manifest.json').read_bytes())==state['sourceManifestSHA256'];assert h(b''.join(x['path'].encode()+b'\0'+x['sha256'].encode()+b'\n' for x in rows))==state['sourceFingerprint']
orig=json.loads((E/'accepted-source-manifest.json').read_text());assert [x['path'] for x,y in zip(orig,rows) if x!=y]==['tools/callback-ownership-census.json'];assert next(x['sha256'] for x in rows if x['path']=='tools/callback-ownership-census.json')==h((E/'census-after.json').read_bytes())
s=json.loads((E/'root-seals.json').read_text());assert s['pass'] and s['before']==s['after']
hb=json.loads((E/'handback.json').read_text());assert hb['originalPins']==373 and hb['passAll'] and hb['runtimeProcesses']==[] and hb['portsConnectEx']=={'8123':111,'8124':111}
box=json.loads((E/'box-state.json').read_text())['sandbox'];assert box['id']=='bx_32262dnp' and box['state']=='idle' and box['health']=='ok' and box['stop'] is None and box['archiveAfter']=='2026-10-22T12:53:29.069Z'
for name,digest in json.loads((E/'evidence-seals.json').read_text()).items():assert h((E/name).read_bytes())==digest,name
print('PASS: exact host delta; one census row/two fields; 407 boundaries and negative control; build first blocker; 1078 source seals; 373 pins; root seals; running handback; evidence seals')
