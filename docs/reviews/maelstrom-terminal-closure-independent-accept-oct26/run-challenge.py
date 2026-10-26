from control import *
limits();signal.alarm(60)
print(run('independent-challenge',['node',str(O/'challenge.cjs')]))
v=json.loads(read(O/'challenge-results.json'));assert(v['passed'],v['failed'],v['cases'])==(174,0,174)
checkpoint('independent-challenge',dict(groups=174,cases=174,passAll=True),[str(O/'challenge.cjs')],['retained-unaffected','review','publication','cleanup'])
