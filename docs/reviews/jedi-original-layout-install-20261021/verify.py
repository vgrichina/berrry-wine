"""Offline verification of sealed evidence; no runtime or original download."""
import hashlib,io,json,pathlib,struct,tarfile
R=pathlib.Path(__file__).parent
sha=lambda b:hashlib.sha256(b).hexdigest()
archive=(R/'evidence.tgz').read_bytes()
assert sha(archive)=='fea97ead7fe1b0f4f9bba0264d8073e5956857150dba2d97a2b1a4a62190f9cb'
with tarfile.open(fileobj=io.BytesIO(archive),mode='r:gz') as t:
 files={m.name.removeprefix('./'):t.extractfile(m).read() for m in t.getmembers() if m.isfile()}
J=lambda p:json.loads(files[p])
seal=J('SHA256SUMS.json')
for f in seal:assert len(files[f['path']])==f['bytes'] and sha(files[f['path']])==f['sha256'],f['path']
proof=J('layout-proof.json');key=bytes.fromhex(proof['key'])
def decode(c):
 return bytes((((v^key[7-i%8])>>(7-i%8)|((v^key[7-i%8])<<(1+i%8)))&255)^key[i%8] for i,v in enumerate(c))
resource=bytes.fromhex(proof['resourceHex']);prefix=decode(resource[276:404]).split(b'\0')[0].decode('ascii')
assert prefix==proof['fields']['276'];assert proof['nativeDecoderCrossChecks']==43
assert files['seg3-unpacked.bin'][16:24]==key
assert files['seg2-unpacked.bin'][0xe4c:0xeab].hex()==proof['decoderBytes']
for x in J('unpack.json'):assert sha(files[f"seg{x['segment']}-unpacked.bin"])==x['sha256']
p,count,total=struct.unpack_from('<III',resource,8);assert count==39
inv={x['name']:x for x in J('original-inventory.json')['files']}
for f in proof['files']:
 raw=bytes.fromhex(f['recordHex']);n=struct.unpack_from('<I',raw)[0]
 assert f['recordOffset']==p and p+len(raw)==f['offset'] and len(raw)==n+12
 path=decode(raw[4:4+n]).decode('ascii');assert path==f['decodedSource'] and path.startswith(prefix)
 rel=path[len(prefix):];directory=(rel.rsplit('\\',1)[0]+'/' if '\\' in rel else '').replace('\\','/')
 assert directory+f['name']==f['output']
 assert f['sha256']==inv[f['name']]['sha256'] and f['size']==inv[f['name']]['size']
 p=f['offset']+f['zipSize']
assert p==total==21195858
source=J('source-manifest.json');sources={f['path']:f for f in source['files']}
trees=J('recovery-trees.json')['trees'];mapped=0
for tree,rows in trees.items():
 for f in rows:
  rec=f['recovery'];kind=rec['kind'];path=rec['path']
  if kind=='original':assert inv[path]['sha256']==f['sha256'] and inv[path]['size']==f['bytes']
  elif kind=='source':assert sources[path]['sha256']==f['sha256']
  else:assert sha(files['recovery-payload/'+path])==f['sha256'] and len(files['recovery-payload/'+path])==f['bytes']
  mapped+=1
installed=J('installed-payload.json')['installed'];assert len(installed)==28
im={f['path']:f for f in trees['install1/vfs']}
for f in installed:assert im[f['path']]['sha256']==f['sha256']
assert sum(f['bytes'] for f in installed)==39900850
controls=J('controls.json');assert controls['pass'] and controls['checks']==79
assert all(x['expected']==x['actual'] for x in controls['rows'])
assert J('install1/terminal.json')['code']==0
assert J('install1/license.json')['command']['cmd']=='click:415:395'
assert J('launch2/play-input.json')['cmd']['cmd']=='click:320:284'
assert b'DirectX 5.0 drivers are required' in files['launch2/output.log']
assert b'[spawn]' not in files['launch2/output.log']
post=J('postflight.json');assert post['sourceFilesVerified']==7403 and post['originalsVerified']==39 and post['captureUnchanged'] and post['gitStatus']=='' and post['processes']==[]
assert post['sourceCommit']=='fe49a84e745015ecdbe752e028235924ef4324dc'
assert post['moduleHash']=='728e1de80ec20a284fc41b339895ee8ac29f16e4ded83325b27576cfacd4466c'
print(json.dumps(dict(pass_=True,seals=len(seal),recoveryMappings=mapped,originalPaths=39,installedOriginals=28,vfsControls=79,gameplay=False)))
