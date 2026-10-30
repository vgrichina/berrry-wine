import pathlib,json,hashlib,base64,copy
R=pathlib.Path(__file__).parent.resolve()
def verify(d):
 r=d['report'];b=r['backendReceipt'];fs=b['filesystem']
 assert d['exit']==0 and d['identitiesAfter'] and not d['stderr']
 assert d['mountOwnership'] and all('fuse.toyvm-accounting' in m and 'user_id=1000' in m for m in d['mountOwnership'])
 assert d['observerCleanup']==dict(remainingMounts=[],workPathProcesses=[])
 assert r['accepted'] and r['cleanupComplete'] and r['failures']==[] and not r['browserAllowed']
 assert b['exit']==0 and b['stopReason'] is None and b['cleanupComplete']
 for k,v in dict(inodes=6,live=32768,peak=32768,written=26,openHandles=0,failure=None,liveLimit=262144,writeLimit=32768,fileLimit=32768).items():assert fs[k]==v,(k,fs[k],v)
 assert b['cpuSeconds']<=10 and b['wallSeconds']<=20 and b['peakRSS']<=67108864
 fc=b['filesystemCleanup'];assert fc['unmountExit']==0 and fc['remainingMounts']==[] and fc['serverExit'] in [0,-15]
 lines=base64.b64decode(b['output']['data']).decode().splitlines();assert lines[-1]=='MOUNTED_RENAME_GUARDS_COMPLETED'
 initial=json.loads(lines[0]);cases=[json.loads(l) for l in lines[1:7]];valid=json.loads(lines[7]);assert len(lines)==9
 assert [(c['name'],c['expected'],c['actual']) for c in cases]==[(n,e,e) for n,e in [('file-to-dir',21),('dir-to-file',20),('absent-parent',2),('nondirectory-parent',20),('descendant-cycle',22),('same-path',0)]]
 digest=hashlib.sha256(json.dumps(initial['tree']).encode()).hexdigest()
 assert all(c['unchanged'] is True and c['treeSHA256']==digest for c in cases)
 expected=copy.deepcopy(initial['tree'])
 for row in expected:
  if row[0]=='file':row[0]='dir/moved,file'
 assert valid['correct'] is True and valid['tree']==valid['expectedTree']==sorted(expected)
 assert valid['parents']==dict(sourceParent=1,destinationParent=2)
 e=fs['renameEvidence'];assert e['limit']==16 and e['callbackCount']==1 and not e['countSaturated'] and len(e['records'])==1
 rec=e['records'][0];assert set(rec)=={'opcode','unique','inode','errno','callbackCount'}
 assert rec['opcode']==12 and type(rec['unique']) is int and rec['unique']>0 and rec['inode']==valid['parents']['sourceParent'] and rec['errno']==0 and rec['callbackCount']==1
 return dict(cases=cases,validCrossParent=valid,callback=rec)
d=json.loads((R/'guards.json').read_text());result=verify(d)
controls=[]
for key,value in [('inode',5),('errno',21),('opcode',1)]:
 m=copy.deepcopy(d);m['report']['backendReceipt']['filesystem']['renameEvidence']['records'][0][key]=value
 try:verify(m)
 except AssertionError:controls.append(key)
 else:raise AssertionError('oracle accepted altered '+key)
assert len(controls)==3
for rel,want in json.loads((R/'manifest.json').read_text())['sourcePins'].items():
 b=(R/'repo'/rel).read_bytes();assert dict(bytes=len(b),sha256=hashlib.sha256(b).hexdigest())==want
result.update(PASS=True,rejectingReceiptControls=controls,callbackObserved=['valid-cross-parent'],kernelOnly=[c['name'] for c in result['cases']],productionMutated=False)
(R/'checkpoint.json').write_text(json.dumps(result,indent=2));print(json.dumps(dict(PASS=True,callback=result['callback'],callbackObserved=result['callbackObserved'],kernelOnly=result['kernelOnly'])))
