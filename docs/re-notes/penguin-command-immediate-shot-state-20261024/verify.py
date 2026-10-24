from work import *
import re,struct
logs={n:(E/n/'output.log').read_text() for n in ['filter','cannon']}
filterlog=logs['filter'];cannonlog=logs['cannon']
hits=re.findall(r'^\[TRACE-AT.*$',filterlog,re.M);assert len(hits)==1
event=re.search(r'ebx@0x074ffa44=([0-9a-f]+)',hits[0])[1];data=bytes.fromhex(event)
assert data[0]==2 and data[2]==1 and struct.unpack_from('<I',data,8)[0]==0x61
assert 'batch=40033' in hits[0] and 'EIP=0x004031a1' in hits[0]
assert not re.search(r'^\[TRACE-AT',cannonlog,re.M)
dispatch={}
for n,l in logs.items():
 dispatch[n]=[x for x in l.splitlines() if '[dispatch-input]' in x and ('msg=0x100 ' in x or 'msg=0x101 ' in x)]
 assert len(dispatch[n])==2 and 'batch=40033 ' in dispatch[n][0] and 'lParam=0x1e0001 ' in dispatch[n][0] and 'batch=40295 ' in dispatch[n][1]
 t=json.load(open(E/n/'terminal.json'));assert t['returncode']==0 and not t['remainingGroup']
 assert '43000 batches' in l
j=dict(verdict='SDL A filter delivery proven; immediate cannon acceptance/rejection UNKNOWN',filterHit=hits[0],eventHex=event,eventType=data[0],pressed=data[2],symbol=struct.unpack_from('<I',data,8)[0],filterBatch=40033,filterBatchClockMs=8006600,preFilterState=dict(reverse=0,count=0,ammo=[10,10,10],target=[237,177]),cannonBoundary='0x406ef0 immediately after406eec ammo store',cannonTraceHits=0,missing='No hit at accepted-path boundary; no immediate post-write count/ammo/record and no rejection-branch operands captured. Missing hit alone cannot distinguish rejected call, unreached call, or exact-address trace visibility.',dispatch=dispatch,runs=2,thirdRun=False,projectileVisibility='unproven',build='exact-main runner + qualified historical module; NOT current-main Wasm',passEvidenceValidation=True)
save('verification.json',j);(E/'verification.json').write_text(json.dumps(j,indent=2)+'\n')
print(json.dumps({k:j[k] for k in ['verdict','eventType','pressed','symbol','filterBatch','cannonTraceHits','runs','passEvidenceValidation']}))
