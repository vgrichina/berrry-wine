p=json.loads((O/'compressed-transfer-plan.json').read_text());groups=p['groups'];ranges=[];first=4;n=0
for i in range(4,len(groups)):
 q=groups[i]['requests']+1
 if n and n+q>160:ranges.append((first,i));first=i;n=0
 n+=q
if first<len(groups):ranges.append((first,len(groups)))
(O/'ranges.txt').write_text(''.join(str(a)+' '+str(b)+'\n' for a,b in ranges));save('bounded-stage-ranges.json',ranges)
v=dict(p);v.pop('groups');v.update(rawCapturePlan=dict(remoteImages=4,perImageCeiling=4194304,initialFullFrameTransfers=3,fourthConditionalOnMeasuredRemaining=True,maxFullFrameBytes=1232000,base64AndEnvelopePerImage=1750000),rawResponseProjected=p['rawResponsesUsed']+(p['remainingRequests']+len(groups))*600+5250000+1048576,reason='Three full-frame transfers pre-reserved: reviewed menu, world before, world after; fourth full PNG retained remotely with retrieval conditional on measured wire remaining.');v['wirePass']=v['rawResponseProjected']<=8388608;assert v['wirePass'];save('transfer-plan-admitted.json',v);print(ranges,v['rawResponseProjected'])
