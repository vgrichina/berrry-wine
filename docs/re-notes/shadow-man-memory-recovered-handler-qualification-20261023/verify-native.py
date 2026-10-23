#!/usr/bin/env python3
"""Validate retained execution, not a new native run or static reacceptance."""
import hashlib,json,pathlib,struct,sys,traceback
H=pathlib.Path(__file__).resolve().parent
def retain_failure(kind,error,tb):
    (H/'verification-failure.txt').write_text(''.join(traceback.format_exception(kind,error,tb)))
sys.excepthook=retain_failure
def load(n):return json.loads((H/n).read_text())
def lines(n):return [json.loads(s) for s in (H/n).read_text().splitlines()]
def sha(x):return hashlib.sha256(json.dumps(x,separators=(',',':'),ensure_ascii=False).encode()).hexdigest()
receipts={m:load(m+'.receipt.json') for m in ['normal','capture','wrong-command']}
for mode,r in receipts.items():
    assert r['childExit']==(86 if mode=='capture' else 0)
    assert r['reason'] is None and r['reaped'] and r['remaining']==[]
    assert r['cpuSeconds']==r['wallSeconds']==150 and r['capturedBytes']==0
    assert '--max-old-space-size=512' in r['argv']
    a=load(mode+'.admission.json')
    assert a['verdict']=='PASS' and a['memAvailable']>=1610612736
    assert a['projected']<=67108864 and a['hostAfterProjection']>=2982150144
    assert a['liveTaskArenas']==a['concurrentNativeChildren']==0
    assert a['nextChildArenaCount']==1 and a['initialPages']==a['maximumPages']==8192
    obs=lines(mode+'.observations.jsonl')
    assert {o['pid'] for o in obs}=={r['pid']}
    assert obs[1]['sha256']=='8fac39936b6df2418ad86cab118cef19a65a727f649fbc14c412b37818904686'
    assert obs[1]['bytes']==1879746 and obs[1]['arenaBytes']==536870912
    assert not any('failure' in o for o in obs)
    assert obs[0]['fixtureSha256']==hashlib.sha256((H/'fixture.cjs').read_bytes()).hexdigest()
normal=lines('normal.observations.jsonl')
assert normal[-1]['phase']=='normal-complete'
assert normal[-1]['modalResult']==0x77 and normal[-1]['diagCount']==0
assert normal[-1]['registersRestored'] and normal[-1]['syncDepth']==0
assert not (H/'normal.capture.jsonl').exists()
negative=lines('wrong-command.observations.jsonl')
rejected=[o for o in negative if o.get('phase')=='intended-negative-rejected']
assert len(rejected)==1
assert rejected[0]['guestCallbackNotRun'] and rejected[0]['registersUnchanged']
assert rejected[0]['error']=='Error: wrong or late selected action/HWND'
assert rejected[0]['diagCount']==0
# Actual preload's exit listener fsyncs its required missing-terminal record.
assert negative[-1]['phase']=='capture-fsync-complete'
negcap=lines('wrong-command.capture.jsonl')
assert negcap==[{'terminal':False,'failure':'missing terminal capture','exit':0}]
envelopes=lines('capture.capture.jsonl')
assert len(envelopes)==7 and envelopes[-1]=={'terminal':True,'reason':'first-zero','exit':86}
for e in envelopes[:-1]:
    payload=e.get('record',e.get('receipt'))
    assert e['sha256']==sha(payload),'retained seal'
pre=envelopes[0]['receipt'];records=[e['record'] for e in envelopes[1:-1]]
assert pre['phase']=='pre-arm' and pre['prior']['boundary']['eventCount']==0
obs=lines('capture.observations.jsonl')
initial=next(o for o in obs if o.get('phase')=='initialized-before-action')
assert pre['prior']['registers']==initial['registers']
sel=pre['selection'];meta=pre['metadata']
assert sel['intent']=={'mode':'selected-action','actionSequence':1,'cmdId':3}
assert {k:sel[k] for k in ['actionSequence','batch','cmdId','hwnd']}=={'actionSequence':1,'batch':50,'cmdId':3,'hwnd':0x550}
assert sel['pid']==meta['pid']==receipts['capture']['pid']
assert sel['runner']==meta['runner']==obs[0]['runner']
assert sel['resolution']=='resolved-dialog' and sel['action']=='dlg-cmd' and sel['priorActions']==[]
assert meta['actualModule']['moduleSha256']==obs[1]['sha256']
assert [r['kind'] for r in records]==['sender-pre','decoded-block','modal-frame-consume','modal-frame-complete','first-zero']
assert [r['sequence'] for r in records]==list(range(5))
sender,block,consume,complete,zero=records
assert sender['boundary']['savedEip']==pre['prior']['registers']['eip']
assert sender['boundary']['savedEsp']==pre['prior']['registers']['esp']
assert sender['boundary']['syncDepth']==1 and sender['boundary']['eventCount']==1
assert block['registers']['eip']==0x4015d4
assert block['code']['bytes'].startswith(initial['code'])
assert block['registers']['esp']==sender['registers']['esp']-20
def word(r,g):
    data=bytes.fromhex(r['stack']['bytes']);offset=g-r['stack']['address']
    assert 0<=offset<=len(data)-4
    return struct.unpack_from('<I',data,offset)[0]
assert word(block,block['registers']['esp'])==initial['thunkGuest']
assert [word(block,block['registers']['esp']+4*i) for i in range(1,5)]==[0x550,0x111,3,0]
assert consume['boundary']['pumpHwnd']==consume['boundary']['sharedPumpHwnd']!=0
assert consume['boundary']['ended']==1
assert consume['registers']['eip']==initial['thunkGuest']+8 # actual CACA0004
assert complete['registers']['eip']==consume['boundary']['returnAddress']==0x4015f2
assert complete['registers']['esp']==consume['registers']['esp']+24
assert complete['boundary']['pumpHwnd']==complete['boundary']['sharedPumpHwnd']==0
assert complete['registers']['eax']==0x77
assert zero['registers']['eip']==0 and zero['registers']['esp']==pre['prior']['registers']['esp']
assert zero['registers']['eax']==0x77 and zero['stop'] and zero['continuation']=='forbidden'
assert zero['classification']=='ordinary-or-unknown; zero-writer unproven'
assert [r['boundary']['eventCount'] for r in [sender,consume,complete,zero]]==[1,2,3,4]
assert len({(r['boundary']['token'],r['boundary']['root']) for r in [sender,consume,complete,zero]})==1
assert int(sender['boundary']['token'])!=int(sender['boundary']['root'])!=0
fsync=[o['sequence'] for o in obs if o.get('phase')=='capture-fsync-complete']
assert len(fsync)==len(envelopes)
boundary=next(o['sequence'] for o in obs if o.get('phase')=='selected-boundary-entry')
dialog=next(o['sequence'] for o in obs if o.get('host')=='dialog_loaded')
assert boundary<fsync[0]<fsync[1]<fsync[2]<dialog
result=dict(verdict='PASS_SYNTHETIC_FULL_MODULE_HANDLER_CAPTURE',cases={m:dict(pid=r['pid'],exit=r['childExit'],seconds=r['elapsedSeconds'],reaped=r['reaped']) for m,r in receipts.items()},eventKinds=[r['kind'] for r in records],preArmFsyncBeforeNativeHandler=True,modalResult=0x77,zeroClassification=zero['classification'],fullCLIStartup=False,originalGame=False,arenaCountPerProcess=1,arenaBytes=536870912,diagnosticSourceUnchanged=True,knownSetupFailuresRetained=True,captureBudgetExhaustedByPriorDeniedSourceRead=True)
(H/'native-results.json').write_text(json.dumps(result,indent=2)+'\n')
