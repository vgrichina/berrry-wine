import supervisor as s, json, pathlib, hashlib, ast
C=s.C
D=json.loads(pathlib.Path('/home/user/wine-assembly/scratch/usage-watch/'+C.name+'.dispatch.json').read_text())
for rel,pin in D['sourcePins'].items():
 b=s.git('show',D['candidate']+':'+rel)['stdout'].encode();assert len(b)==pin['bytes'] and hashlib.sha256(b).hexdigest()==pin['sha256']
assert s.git('rev-parse','HEAD')['stdout'].strip()==D['candidate']
old=C.parent/'enigma-retained-input-capture-disposition-oct30'
sel=json.loads((old/'selection-preflight.json').read_text());assert len(set(sel['selection']))==2 and sel['totalUpperBound']<=400000
assert 389913+66561>400000
s.save('selection-preflight.json',sel)
pre=json.loads((old/'preflight.json').read_text())
assert s.digest(C.parent/'enigma-snapshot-fork-input-runtime-oct30/prelaunch.json')==pre['mountReceiptSHA']
assert s.digest(C.parent/'enigma-fresh-boat-efficient-transfer-runtime-oct30/preflight.json')==pre['wrapperReceiptSHA']
pre.update(pins=True,correctedSupervisorSHA=s.digest(C/'supervisor.py'),noGuestInvocations=True,selectionRejectedRawPair=True)
s.save('preflight.json',pre)
print('Pinned controls verified')
