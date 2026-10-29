import json,base64,pathlib,hashlib,copy
R=pathlib.Path(__file__).parent.resolve()
def verify(d):
 r=d['report'];b=r['backendReceipt']
 assert d['exit']==0 and d['identitiesAfter'] is True and not d['stderr']
 assert d['mountOwnership'] and all('fuse.toyvm-accounting' in m and 'user_id=1000' in m for m in d['mountOwnership'])
 assert d['observerCleanup']==dict(remainingMounts=[],workPathProcesses=[])
 assert r['accepted'] and r['cleanupComplete'] and not r['browserAllowed'] and r['failures']==[]
 assert b['exit']==0 and b['stopReason'] is None and b['cleanupComplete']
 fs=b['filesystem']
 for k,v in dict(inodes=6,live=32768,peak=32768,written=26,openHandles=0,failure=None,liveLimit=262144,writeLimit=32768,fileLimit=32768).items():assert fs[k]==v,(k,fs[k],v)
 fc=b['filesystemCleanup'];assert fc['unmountExit']==0 and fc['remainingMounts']==[] and fc['serverExit'] in [0,-15]
 output=base64.b64decode(b['output']['data']).decode();lines=output.splitlines()
 assert lines[-1]=='MOUNTED_RENAME_GUARDS_COMPLETED'
 initial=json.loads(lines[0]);cases=[json.loads(l) for l in lines[1:-1]]
 expected=[('file-to-dir',21),('dir-to-file',20),('absent-parent',2),('nondirectory-parent',20),('descendant-cycle',22),('same-path',0)]
 assert [(c['name'],c['expected']) for c in cases]==expected
 digest=hashlib.sha256(json.dumps(initial['tree']).encode()).hexdigest()
 for c,(_,e) in zip(cases,expected):assert c['actual']==e and c['unchanged'] is True and c['treeSHA256']==digest,c
 return cases
if __name__=='__main__':
 d=json.loads((R/'guards.json').read_text());cases=verify(d);controls=[]
 for idx,key,value in [(0,'actual',0),(0,'unchanged',False),(0,'treeSHA256','bad'),(5,'actual',22)]:
  mutant=copy.deepcopy(d);out=base64.b64decode(mutant['report']['backendReceipt']['output']['data']).decode().splitlines()
  row=json.loads(out[idx+1]);row[key]=value;out[idx+1]=json.dumps(row)
  mutant['report']['backendReceipt']['output']['data']=base64.b64encode(('\n'.join(out)+'\n').encode()).decode()
  try:verify(mutant)
  except AssertionError:controls.append(dict(case=idx,key=key,rejected=True))
  else:raise AssertionError('bypassed oracle '+key)
 manifest=json.loads((R/'manifest.json').read_text())
 source_root=R/'repo' if (R/'repo').is_dir() else R.parents[1]
 for rel,want in manifest['sourcePins'].items():
  data=(source_root/rel).read_bytes();assert dict(bytes=len(data),sha256=hashlib.sha256(data).hexdigest())==want
 result=dict(PASS=True,caseOutcomes=cases,rejectingControls=controls,productionMutated=False,noRuntimeReplay=True,scope='actual mounted production CLI syscall contract; backend branch coverage not established')
 (R/'checkpoint.json').write_text(json.dumps(result,indent=2));print(json.dumps(result))
