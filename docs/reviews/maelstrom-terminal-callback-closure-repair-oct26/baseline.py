from control import *
limits();signal.alarm(60)
p='docs/reviews/maelstrom-state-acceptance-retained-closeout-oct26/remaining-independent.cjs'
run('baseline-26',['node',p],expected=1)
r=R/pathlib.Path(p).parent/'remaining-results.json';shutil.copyfile(r,O/'baseline-26-results.json')
v=json.loads(read(r));assert (v['passed'],v['failed'])==(10,16)
checkpoint('baseline-26',dict(passed=10,failed=16,cases=v['cases'],expectedFailure=True),[p],['repair','26','regression','scalar13','10+19','semantic7','existing'])
print('baseline confirmed 10PASS16FAIL',v['cases'])
