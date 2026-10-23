import hashlib,json,pathlib,sys
sys.dont_write_bytecode=True
H=pathlib.Path(__file__).resolve().parent
C=pathlib.Path('/home/user/wine-assembly-shadow-man-span-static-canonical-oct23')
sha=lambda b:hashlib.sha256(b).hexdigest()
x=json.loads((H/'static-abi.json').read_text())
old=json.loads((C/'docs/re-notes/shadow-man-span-static-canonical-20261023/static-abi.json').read_text())
assert x==old,'exact entire detailed old JSON equality'
assert x['state']=='STATIC_ABI_PASS' and x['fullSourceImportsCompared']==291 and x['fullSourceFunctionExportsCompared']==2227
r=x['layout']['regions']
assert len(r)==269 and sum(a['kind']=='storage' for a in r)==268 and x['layout']['spans']==1
assert [a['name'] for a in r if a['kind']=='span']==['DIRECT_WINDOW']
assert x['layout']['payload']=='9a3bc9149d58209c'
assert sha(x['layout']['serialization'].encode())[:16]=='9a3bc9149d58209c'
artifacts=[('wine-assembly.wasm',1879746,'8fac39936b6df2418ad86cab118cef19a65a727f649fbc14c412b37818904686'),('wine-assembly.compat.wasm',1882319,'8590966d0fb0e015ee78d2f9897c5e87aff65861a58de0f7b392e549e099293d')]
for o,(name,size,digest) in zip(x['outputs'],artifacts,strict=True):
 b=(C/'build'/name).read_bytes()
 assert len(b)==o['bytes']==size and sha(b)==o['sha256']==digest
 assert len(o['types'])==172 and o['noStart'] and not o['native']
 assert o['memories']==[dict(flags=3,min=8192,max=32768,shared=True)]
 custom=[a for a in o['customSections'] if a['name']=='wine-region-layout']
 assert len(custom)==1 and bytes.fromhex(custom[0]['payloadHex'])==b'9a3bc9149d58209c'
for label,n in [('original16',16),('new14',14)]:
 receipt=json.loads((H/(label+'.receipt.json')).read_text())
 assert receipt['exit']==0 and f'Ran {n} tests' in receipt['stderr'] and receipt['stderr'].rstrip().endswith('OK')
probe=json.loads((H/'unchanged-rejecting-probe.receipt.json').read_text())
assert probe['exit']==0 and 'stride/count size law' in probe['stdout']
controls=json.loads(json.loads((H/'independent-controls.receipt.json').read_text())['stdout'])
assert controls['positiveDerivedGlobalControl'] and len(controls['controls'])==3 and all(a['rejected'] for a in controls['controls'])
result=dict(verdict='ACCEPT_SCOPED_STATIC_INSPECTOR',helperSHA256=sha((H/'static-abi.py').read_bytes()),exactDetailedOldJSONEquality=True,artifacts=[dict(name=n,bytes=b,sha256=s) for n,b,s in artifacts],inventory=269,storage=268,span='DIRECT_WINDOW',fingerprint=x['layout']['payload'],imports=291,exports=2227,types=172,sharedMemoryPages=[8192,32768],noStart=True,exactCustomPayload=True,original16=True,new14=True,unchangedProbeIntendedLaw=True,independentControls=controls,compiled=False,native=False,guest=False,box=None)
(H/'acceptance-results.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result))
