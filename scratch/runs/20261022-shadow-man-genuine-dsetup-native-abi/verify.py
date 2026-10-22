"""Offline acceptance and integrity verification; never executes or compiles WASM."""
import pathlib,json,hashlib,subprocess,os
E=pathlib.Path(__file__).resolve().parent;R=E.parents[2]
def load(p):return json.loads(p.read_text())
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def verify_execution(r):
 assert r['verdict'].startswith('PASS') and 'blocker' not in r
 assert r['canonicalInstances']==r['canonicalCompiles']==1
 assert r['module']==dict(bytes=1879387,sha256='ccd5b0a8e4fcb84d06bf539c8a4af28b377472072f3422750122048e9339f553')
 assert r['original']==dict(bytes=135680,sha256='5112c736fa664cfd658c465fad781fe7ffd2753470cbcf7019b5a6ab08c4800f')
 assert len(r['importBindings'])==6 and sum(len(i['names']) for i in r['importBindings'])==99
 assert not any(i['unknown'] for i in r['importBindings'])
 assert r['handle']==0x503000 and r['proc']==r['handle']+0x18b0 and r['lifecycle']==dict(state=2,pin=0)
 assert r['loadedPrimitive']=='83ec08c744240000000000c7442404000000008d44240050e8a3fcffff8b44241083c40485c074068b4c240089088b44241085c074068b4c24048908b80100000083c408c20800'
 mapped=r['events'][2]['mapped'][0];assert mapped['result']['initializationFinished'] and mapped['result']['loadAddr']==r['handle'] and mapped['result']['dllMain']==r['handle']+0x3080 and mapped['originalBytesReceipt']['sha256']==r['original']['sha256']
 assert r['registryBefore']==r['registryAfter'] and not any('directx' in k.lower() for k in r['registryBefore'])
 assert [c['name'] for c in r['calls']]==['both','firstNULL','secondNULL','bothNULL','safe-cross-page']
 assert [c['outputs'] for c in r['calls']]==[[0,0],[None,0],[0,None],[None,None],[0,0]]
 assert r['calls'][4]['args'][0]%4096==4094
 for c in r['calls']:
  assert c['eax']==1 and c['delta']==c['returnESP']-c['entryESP']==12
  for j,(before,after) in enumerate(zip(c['before'],c['after'])):
   want=bytearray.fromhex(before['hex']);assert want==b'\xa5'*20
   if c['args'][j]:want[8:12]=b'\0'*4
   assert after['hex']==want.hex() and before['pointer']==after['pointer']
 assert len(r['registry'])==5
 for row in r['registry']:
  assert row['name']=='reg_open_key' and row['args'][0]&0xffffffff==0x80000002 and row['text']=='Software\\Microsoft\\Directx' and row['result']==0
 assert r['installedRegistry']=='UNKNOWN' and r['game']=='NOT RUN'
r=load(E/'execution.json');verify_execution(r)
# Executable evidence controls reject false ABI/output/registry/export claims.
import copy
controls=[]
for name,mutate in [('BOOL',lambda q:q['calls'][0].update(eax=0)),('ESP',lambda q:q['calls'][1].update(delta=8)),('guard',lambda q:q['calls'][2]['after'][0].update(hex='00'*20)),('registry',lambda q:q['registry'][0].update(result=1)),('export',lambda q:q.update(proc=0x7500000))]:
 q=copy.deepcopy(r);mutate(q)
 try:verify_execution(q)
 except AssertionError:controls.append(name)
 else:raise AssertionError('acceptance control failed to reject '+name)
h=load(E/'handback.json');assert h['sourcePins']==3426 and h['codecFiles']==23 and h['priorPinnedEvidenceFiles']==64 and h['ownedBuildTestProcesses']==[] and h['gitClean']
assert h['rawExecution']['sha256']==r['receiptNormalization']['rawSHA256'] and sha(E/'driver.cjs')==h['driverSHA256']
before=load(E/'remote-before-api.json');assert json.loads(before['stdout'])['modules']==h['modules']
assert h['allocated']+67108864+2000000<1073741824 and h['free']>2147483648
for row in load(E/'original-pins-before.json'):
 p=pathlib.Path(row['path']);assert p.stat().st_size==row['size'] and sha(p)==row['sha256']
assert load(E/'original-pins-before.json')==load(E/'original-pins-after.json')
for p,want in load(E/'protected-git-before.json').items():
 path=pathlib.Path(p);assert (sha(path) if path.exists() else None)==want,p
adm=load(E/'admission.json');sizes={p:int(subprocess.check_output(['du','-s','-B1',p]).split()[0]) for p in list(adm['sizes'])+[str(R)]};free=os.statvfs(R).f_bavail*os.statvfs(R).f_frsize
assert sum(sizes.values())+8388608+1048576<67108864 and free>2982150144
if (E/'artifact-manifest.json').exists():
 for row in load(E/'artifact-manifest.json'):
  p=E/row['path'];assert p.is_file() and not p.is_symlink() and p.stat().st_size==row['bytes'] and sha(p)==row['sha256'],row['path']
out=dict(verdict='PASS',genuinePrimitive=True,cases=5,negativeEvidenceControls=controls,canonicalInstances=1,newCanonicalBuilds=0,installedRegistry='UNKNOWN',game='NOT RUN',sourcePins=3426,codecPins=23,priorEvidenceFiles=64,protectedGitUnchanged=True,originalPins=4,localSizes=sizes,localAllocated=sum(sizes.values()),localReserve=8388608,localFinishingAllowance=1048576,localCap=67108864,hostFree=free,hostFloor=2982150144,box=h['box'],remoteAllocated=h['allocated'],remoteFree=h['free'],ownedBuildTestProcesses=[])
(E/'verification.json').write_text(json.dumps(out,indent=2)+'\n');print(json.dumps(out,indent=2))
