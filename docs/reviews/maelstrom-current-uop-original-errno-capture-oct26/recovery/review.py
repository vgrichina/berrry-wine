from common import *
import struct
def readrows(p):return [json.loads(s) for s in p.read_text().splitlines()] if p.exists() else []
native=readrows(O/'collected/guest/native.jsonl');raw=readrows(O/'collected/guest/native.jsonl.raw.jsonl');term=json.load(open(O/'collected/ops/guest/terminal.json'))
captured=next((r for r in native if r['kind']=='captured'),None);rejected=next((r for r in native if r['kind']=='rejected'),None)
loaded=next((r for r in raw if r.get('stage')=='loaded-verified'),None);last=next((r for r in raw if r.get('stage')=='captured'),raw[-1] if raw else {})
checks={};observation=dict(errno=None,caller=None,selectResult=None,qualification='unknown until terminal native event is acquired')
if captured:
 n=captured['historicalNativeLatch'];m=captured['historicalSelectLatch'];a={r['va']:r['bytes'] for r in last['anchors']};checks=dict(terminalNative=n['status']==4 and n['event']==3,token=n['token']==m['token'],thread=n['thread']==m['thread'],regs=n['regs']==m['regs'],selectCompletion=m['phase']==3 and m['completions']==1 and m['active']==m['fault']==m['capped']==0,selectResult=n['result']==m['result'],stack=n['pre']==m['pre'] and n['post']==m['post']==n['esp'],expectedObservedReturn=n['selectRet']==m['ret']==0x7a3362,nativeOwnedEntry=n['nativeEntry']==0x52e430,nativeOwnedCall=n['callBlock'] in [0x7a3362,0x7a3364],nativeOwnedRet=n['sourceBlock'] in [0x52e435,0x52e438],beforeCmp=n['pc']==0x7a3366,cmpIntact=a[0x7a3362][8:14]=='833804',caller=n['caller']==0x40e12a,callerCodeIntact=a[0x40e125]=='e8c253000083c40885c0756e',loadedVerified=loaded is not None,rawAgreement=all(last['scalars']['mne_'+k]==v for k,v in n.items()))
 # Resolve the call in the authentic pinned CRT and apply only its own PE
 # HIGHLOW relocations to expected bytes; compare to the actual loaded image.
 b=(S/'runtime/system/msvcrt.dll').read_bytes();pe=struct.unpack_from('<I',b,0x3c)[0];opt=pe+24;pref=struct.unpack_from('<I',b,opt+28)[0];sections=struct.unpack_from('<H',b,pe+6)[0];sec=opt+struct.unpack_from('<H',b,pe+20)[0]
 def off(rva):
  for i in range(sections):
   vs,va,rs,rawp=struct.unpack_from('<IIII',b,sec+i*40+8)
   if va<=rva<va+max(vs,rs):return rawp+rva-va
  raise ValueError(hex(rva))
 disp=struct.unpack_from('<i',b,off(0xc431))[0];rva=0xc435+disp;target=0x522000+rva;expected=bytearray(b[off(rva):off(rva)+64]);relocRva,relocSize=struct.unpack_from('<II',b,opt+96+5*8);pos=0;applied=[]
 while pos<relocSize:
  page,block=struct.unpack_from('<II',b,off(relocRva+pos))
  if block<8:break
  for k in range(8,block,2):
   v=struct.unpack_from('<H',b,off(relocRva+pos+k))[0];at=page+(v&4095)
   if v>>12==3 and rva<=at<=rva+60:
    index=at-rva;old=struct.unpack_from('<I',expected,index)[0];struct.pack_into('<I',expected,index,(old+0x522000-pref)&0xffffffff);applied.append(at)
  pos+=block
 checks['getptdTarget']=last['crtGetptdTarget']==target==0x525857;checks['getptdLoadedBytes']=a.get(target)==expected.hex()
 save('authentic-getptd-mapping.json',dict(inputSHA256=sha(b),preferredBase=pref,loadedBase=0x522000,errnoRva=0xc430,callDisplacement=disp,getptdRva=rva,getptdPreferredVA=pref+rva,getptdLoadedVA=target,bytes=64,HIGHLOWApplied=applied,expected=expected.hex(),observed=a.get(target),passChecks=checks['getptdTarget'] and checks['getptdLoadedBytes']))
 observation=dict(errno=n['errno'],caller=n['caller'],selectResult=n['result'],native=n,select=m,batch=captured['batch'],cmpBytes=a[0x7a3362][8:14],expectedReturn=0x7a3362,observedReturn=n['selectRet'],getptdLoadedVA=target,qualification='authentic original-game invocation; native owned CALL/RET acquisition before intact CMP')
for row in json.load(open(O/'collected-manifest.json')):
 p=O/'collected'/row['path'];assert len(p.read_bytes())==row['bytes'] and sha(p.read_bytes())==row['sha256']
accepted=bool(captured) and all(checks.values())
summary=dict(schema='maelstrom-original-current-uop-observation/v1',at=time.time(),candidate=REV,module=json.load(open(O/'tail-retained.json')),guestAttempts=1,originalGameAcceptance=accepted,checks=checks,observation=observation,rejection=rejected,rawTerminalStage=last.get('stage'),rawError=last.get('error'),guestTerminal=term,loaded=loaded,engine=json.loads((O/'collected-build/startup/output.log').read_text()),noQualificationReplay=True,noSourceSemanticChanges=True,unqualified=['gameplay','screenshot or visible play','performance','other engines or architectures'])
if not native and not raw:
 log=(O/'collected/ops/guest/output.log').read_text()
 assert "ENOENT: no such file or directory, open '"+str(H/'guest/native.jsonl.raw.jsonl')+"'" in log
 assert 'nativeRaw' in log and 'Calling DllMain at 0x7a3e4f' in log
 summary['blocker']=dict(kind='diagnostic-output-bootstrap',code='ENOENT',path=str(H/'guest/native.jsonl.raw.jsonl'),missingParent=str(H/'guest'),stage='nativeRaw loaded-before-validation append, before verifyLoaded and nativeAdapter.start',actualRunnerLine=5753,invocationAttempts=1,nativeObserverStarted=False,selectCompletionObserved=False,nativeAcquisitionGuardRejected=None,errno=None,caller=None,expectedReturn=None,observedReturn=None,loadedGetptdVerified=False,recipeCorrection='Create the diagnostic guest directory before Popen; retain raw failure and require a new coordinator-authorized invocation',retry=False)
save('observation.json',summary);print(json.dumps(dict(originalGameAcceptance=accepted,checks=checks,observation=observation,rejection=rejected,blocker=summary.get('blocker'))))
