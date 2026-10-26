from control import *
limits();signal.alarm(60)
repro='docs/reviews/maelstrom-state-acceptance-retained-closeout-oct26/remaining-independent.cjs'
scalar='test/maelstrom-adapter-scalar-anchor.test.cjs'
assert sha(R/repro)=='10421b75e1ed40dae8e51368537eb76b1f9aba75460cfc3831bd840d556d02e5'
assert sha(R/scalar)=='abfb36515543b9465fdf66f0b0975f18ec10c109c9eb55ad1ffef4bbd69f2bb4'
for name in ['status-event-independent.cjs','independent.cjs']:
 shutil.copyfile(DONOR.parent/'ops'/name,O/name)
 assert sha(O/name)==sha(DONOR.parent/'ops'/name)
remaining=['repair-26','regression68','scalar13','ten','nineteen','semantic7','adapter7','rejection14','independent-challenge','retained-unaffected']
groups=[('repair-26',repro,dict(groups=26,cases=74)),('regression68','test/maelstrom-terminal-callback-closure.test.cjs',dict(cases=68)),('scalar13',scalar,dict(groups=13,cases=3748)),('ten',str(O/'status-event-independent.cjs'),dict(groups=10)),('nineteen',str(O/'independent.cjs'),dict(groups=19)),('semantic7','test/maelstrom-status-event-validation.test.cjs',dict(groups=7,cases=924)),('adapter7','test/maelstrom-original-errno-adapter.cjs',dict(groups=7)),('rejection14','test/maelstrom-native-latch-rejection.test.cjs',dict(groups=14,failureCombinations=511))]
for label,p,result in groups:
 out=run(label,['node',p]);print(label,out[-2000:])
 if label=='repair-26':
  q=R/pathlib.Path(repro).parent/'remaining-results.json';v=json.loads(read(q));assert(v['passed'],v['failed'],v['cases'])==(26,0,74)
  shutil.copyfile(q,O/'repair-26-results.json');shutil.copyfile(DONOR/pathlib.Path(repro).parent/'remaining-results.json',q)
 if label in ['ten','nineteen']:
  q=O/('status-event-results.json' if label=='ten' else 'independent-results.json');v=json.loads(read(q));assert(v['passed'],v['failed'])==(result['groups'],0)
 remaining.remove(label);checkpoint(label,dict(**result,passAll=True),[p],list(remaining))
print('all affected groups complete')
