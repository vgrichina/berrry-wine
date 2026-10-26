from control import *
limits();signal.alarm(60)
gate('fixture-materialization')
# Materialize only missing immutable fixtures; do not modify any oracle.
semantic='test/maelstrom-status-event-validation.test.cjs'
text=git('semantic-blob','show',BASE+':'+semantic)
(R/semantic).write_text(text+'\n')
assert sha(R/semantic)==sha('/tmp/maelstrom-status-event-validation-repair-oct26/repo/'+semantic)
for name in ['status-event-independent.cjs','independent.cjs']:
 src=pathlib.Path('/tmp/maelstrom-status-event-validation-repair-oct26/ops')/name
 shutil.copyfile(src,O/name)
 assert sha(src)==sha(O/name)
repro='docs/reviews/maelstrom-state-acceptance-retained-closeout-oct26/remaining-independent.cjs'
remaining=['regression','scalar13','ten','nineteen','semantic7','existing-adapter','existing-rejection']
out=run('repair-26',['node',repro]);r=R/pathlib.Path(repro).parent/'remaining-results.json'
shutil.copyfile(r,O/'repair-26-results.json');v=json.loads(read(r));assert(v['passed'],v['failed'],v['cases'])==(26,0,74)
checkpoint('repair-26',dict(passed=26,failed=0,cases=74),[repro],remaining)
# Restore the historical published result file after saving the new report.
shutil.copyfile(DONOR/pathlib.Path(repro).parent/'remaining-results.json',r)
groups=[('regression','test/maelstrom-terminal-callback-closure.test.cjs',dict(cases=68)),('scalar13','test/maelstrom-adapter-scalar-anchor.test.cjs',dict(groups=13,cases=3748)),('ten',str(O/'status-event-independent.cjs'),dict(groups=10)),('nineteen',str(O/'independent.cjs'),dict(groups=19)),('semantic7',semantic,dict(groups=7,cases=924)),('existing-adapter','test/maelstrom-original-errno-adapter.cjs',dict(groups=7)),('existing-rejection','test/maelstrom-native-latch-rejection.test.cjs',dict(groups=14))]
for label,p,result in groups:
 out=run(label,['node',p]);print(label,out[-1500:])
 if label in ['ten','nineteen']:
  q=O/('status-event-results.json' if label=='ten' else 'independent-results.json');v=json.loads(read(q));assert(v['passed'],v['failed'])==(result['groups'],0),v
 remaining.remove(label)
 checkpoint(label,dict(**result,passed=True),[p],remaining)
print('affected suites complete')
