import pathlib,json,hashlib,subprocess,tarfile,io
r=pathlib.Path(__file__).parent
sha=lambda b:hashlib.sha256(b).hexdigest()
archive=(r/'evidence.tgz').read_bytes()
assert sha(archive)=='122663afcec1d296b8c1a206e917c8af5a947f4b7369c4a03088b5f28b3c4c6e'
with tarfile.open(fileobj=io.BytesIO(archive),mode='r:gz') as t:
    blobs={m.name.removeprefix('./'):t.extractfile(m).read() for m in t.getmembers() if m.isfile()}
seal=json.loads(blobs['SHA256SUMS.json'])
for f in seal:
    b=blobs[f['path']];assert len(b)==f['bytes'] and sha(b)==f['sha256'],f['path']
assert len(seal)==56
trees=json.loads(blobs['recovery-trees.json'])
originals=json.loads(subprocess.check_output(['git','show',trees['sourceCommit']+':docs/re-notes/jedi-knight-demo-inventory.json']))
if isinstance(originals,dict): originals=originals['files']
originals={f['name']:f for f in originals}
for f in trees['trees']['replay1/vfs']:
    p=f['recovery']
    if p['kind']=='payload': b=blobs['recovery-payload/'+p['path']]
    elif p['kind']=='source': b=subprocess.check_output(['git','show',trees['sourceCommit']+':'+p['path']])
    else:
        o=originals[p['path']];assert o['sha256']==f['sha256'] and o['size']==f['bytes'];continue
    assert len(b)==f['bytes'] and sha(b)==f['sha256']
c=json.loads(blobs['controls.json']);assert len(c['rows'])==9 and len(c['archiveLocalHeaders'])==39
p=json.loads(blobs['payload-blocker.json']);assert p['terminal']['code']==0 and len(p['target'])==3 and not p['installedPayloadComplete']
log=blobs['replay1/output.log'].decode()
assert log.count('FindFirstFileA(pattern="C:\\WebJedi\\*.*"')==6
assert 'Install Jedi Knight Demo      0 MB' in log
print(json.dumps({'pass':True,'sealedFiles':len(seal),'recoveryMappings':len(trees['trees']['replay1/vfs']),'controls':9,'failedWebJediCalls':6,'installedPayload':False}))
