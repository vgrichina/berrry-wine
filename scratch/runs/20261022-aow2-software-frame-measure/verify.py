import pathlib,json,hashlib
E=pathlib.Path(__file__).resolve().parent
for x in json.loads((E/'seals.json').read_text()):
 b=(E/x['path']).read_bytes()
 assert len(b)==x['size'] and hashlib.sha256(b).hexdigest()==x['sha256'],x['path']
d=json.loads((E/'dependency-audit.json').read_text())
g=json.loads((E/'source-gate.json').read_text())
assert not g['passed'] and len(g['blocked'])==4
assert {x['owner'] for x in g['blocked']}=={'vcl50.bpl','ml42nd50.bpl'}
assert {x['name'] for x in g['blocked']}=={'GetOverlappedResult','ActivateKeyboardLayout'}
assert not g['registryNativeFallback'] and not g['standardNativePayloadPresent']
api={x['name'] for x in json.loads((E/'api_table.json').read_text())}
assert not api.intersection({'GetOverlappedResult','ActivateKeyboardLayout'})
registry=(E/'dll-registry.js').read_text()
assert 'kernel32.dll' not in registry and 'user32.dll' not in registry
assert g['sourceSearchExit']==1 and not g['sourceSearchOutput']
assert sum(len(d['imports'][x]) for x in d['startupOwners'])==3145
for x in g['blocked']:
 assert any(row['dll']==x['dll'] and row['name']==x['name'] for row in d['imports'][x['owner']])
 names={'vcl50.bpl':'vcl50.bpl','ml42nd50.bpl':'Ml42ND50.bpl'}
 assert x['name'] in (E/'imports'/(names[x['owner']]+'.txt')).read_text()
a=json.loads((E/'assets.json').read_text())
assert len(a['files'])==1064 and a['manifestEntries']==1059
assert len(json.loads((E/'font-manifest.json').read_text()))==29
assert json.loads((E/'module-inventory.json').read_text())['verifiedCanonicalSourceBlobs']==5625
print('PASS sealed offline blocker: four named import edges; no runtime or metric claimed')
