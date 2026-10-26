from common import *
import re,difflib,gzip,itertools
admit('admission-review.json',True)
fixture=(R/'test/maelstrom-diagnostic-canonical-native.cjs').read_text();old=(E/'retained-fixture.cjs').read_text();helper=(R/'tools/maelstrom-native-errno-latch.cjs').read_text()
helperSHA=sha(helper.encode());assert helperSHA=='3ea873bc5c18283fc6045b55d00a2e957eaff46b4372534dd59fba18354a9f6f'
assert sha(run(['git','show',INTEGRATION+':tools/maelstrom-native-errno-latch.cjs']))==helperSHA
assert sha(old.encode())=='81898dfe6d9405aa459e837fdc53f9d4fbb5ee9af6bf7560a7f2e156b60ac9c5'
fixtureSHA=sha(fixture.encode());diff=''.join(difflib.unified_diff(old.splitlines(True),fixture.splitlines(True),fromfile='retained fixture',tofile='candidate fixture'));(O/'fixture.diff').write_text(diff)
pattern=r" if\(enabled&&scenario==='wrong-select-return'\)\{.*?return \{states,starting\};\}"
branch=re.search(pattern,fixture).group();oldbranch=re.search(pattern,old).group()
expected=old.replace('H=O,hook=', 'H=process.env.MNE_STANDING||O,hook=')
comment=' // storage().completionChecks[2] preserves predicate-3 ABI for every\n // ineligible UOP completion, including a wrong select return. UOP=1\n // contributes bit 4; only an otherwise-valid completion passes this gate.\n'
expected=expected.replace(oldbranch,comment+oldbranch.replace('d.rejectReason,4','d.rejectReason,3').replace('d.rejectModes,0','d.rejectModes,4'))
assert expected==fixture,'unexpected fixture difference'
for anchor in ["...completionChecks.filter((_, i) => i !== 2)","ne('(global.get $uop_enabled)', c(1))","completionChecks.map((predicate, i)","completionReject(i + 1)","(if ${ne(g('status'), c(1))} (then (return)))","set('rejectExpectedRet', c(a.selectRet))", "set('rejectObservedRet', m('ret'))"]:assert anchor in helper,anchor
assert "const reject = `${set('status', c(5))} (return)`" in helper
assert "const frozen=diag();e.mne_start();assert.deepEqual(diag(),frozen,'rejection diagnostics immutable')" in branch
# Independent ordered-predicate model, tied to exact reviewed source/hash above.
# Booleans cover every subset of the eight other predicates, plus UOP=0/1/2.
def actual(u,others):
 checks=list(others[:2])+[u!=0 and (u!=1 or any(others))]+list(others[2:])
 return next((i+1 for i,v in enumerate(checks) if v),0)
def independent(u,others):
 if others[0]:return 1
 if others[1]:return 2
 if u and (u!=1 or any(others[2:])):return 3
 return next((i+4 for i,v in enumerate(others[2:]) if v),0)
truth=[]
for u,others in itertools.product([0,1,2],itertools.product([False,True],repeat=8)):
 assert actual(u,others)==independent(u,others);truth.append(actual(u,others))
assert actual(1,[False,False,True,False,False,False,False,False])==3
assert actual(0,[False,False,True,False,False,False,False,False])==4
assert actual(1,[False]*8)==0
# Extract every scalar fixture assertion, then challenge each field independently.
terms=re.findall(r'assert.equal\(d\.(\w+),(\w+)\)',branch)
assert len(terms)==10 and dict(terms)['rejectReason']=='3' and dict(terms)['rejectModes']=='4'
values={'HEAD':0x7a3362,'ret':0x7a3362+0x40}
expect={k:values[v] if v in values else int(v) for k,v in terms}
def accepts(d):return all(d.get(k)==v for k,v in expect.items())
assert accepts(expect)
mutants=[]
for key in expect:
 m=dict(expect);m[key]+=1;assert not accepts(m);mutants.append(key)
bad=dict(expect,status=4);assert not accepts(bad)
save('oracle-review.json',dict(status='PASS',candidate=SHA,integration=INTEGRATION,helperSHA256=helperSHA,fixtureSHA256=fixtureSHA,retainedFixtureSHA256=sha(old.encode()),sourceOnlyChanges=['standing input path selection','wrong-select-return assertion reason/modes/comment'],orderedPredicateCases=len(truth),wrongReturnUOP1Reason=3,wrongReturnUOP0Reason=4,modeBitUOP1=4,scalarAssertions=expect,rejectingSingleFieldControls=mutants,terminalGuardAndImmutabilityReviewed=True,limitations='offline source/model/assertion controls only, no native execution'))
save('checkpoint.json',dict(candidate=SHA,helperSHA256=helperSHA,fixtureSHA256=fixtureSHA,completed=['oracle/source review','768 ordered predicate model controls','10 scalar assertion mutants'],remaining=['evidence dependency review','report/publication']))
print('oracle/source PASS: exact two fixture changes; 768 predicate controls; 10 rejecting field controls')

cp=json.loads((E/'checkpoint-native.json').read_text());assert not cp['remaining'];assert len(cp['completed'])==29 and len(cp['reused'])==7
inputs=json.loads((E/'original-build-inputs.json').read_text());outputs=json.loads((E/'original-build-outputs.json').read_text());originalcp=json.loads((E/'original-checkpoint-native.json').read_text())
assert inputs['acceptedIntegration']==INTEGRATION and inputs['hookSHA256']==helperSHA and inputs['uopNativeBoundaries'] is True
assert inputs['historicalManifestRevision']==cp['sourceClosure']=='b41a7c5f4b752d1f0bdab1141a11d4fed4dc6f9a'
assert len(inputs['inputSeals'])==140 and len(inputs['overlays'])==6
modules=['026ec19da49aeb63c14f4db1ee83c991b5cccc0b69c46b01994814e7f123b441','d49d90fb153d322a8ddcb832812f4e8b0b3129576a2c4db7ba3462d8eb8eab5b']
assert [x['sha256'] for x in outputs]==modules
originalBy={x['scenario']:x for x in originalcp['completed']}
manifest=json.loads((E/'evidence-manifest.json').read_text());seals={pathlib.Path(x['path']).name:x for x in manifest['files']}
rows=[]
for reused,group in [(True,cp['reused']),(False,cp['completed'])]:
 for row in group:
  case=row['scenario']+('-compat' if row['compat'] else '-tail');n=row['localEvidence'] if reused else row['evidence'];b=(E/n).read_bytes()
  assert sha(b)==row['evidenceSHA256']==seals[n]['sha256'];j=json.loads(gzip.decompress(b))
  files=None
  if not reused:
   files=j;j=json.loads(files['native-result-'+case+'.json']);execution=json.loads(files['execution-'+case+'.json']);attempt=json.loads(files['attempt-'+case+'.json'])
   assert execution['exit']==0 and execution['reason'] is None and attempt['case']==case
   assert files[case+'.stderr']=='\n' or files[case+'.stderr']==''
  assert row['status']==j['status']=='PASS' and j['scenario']==row['scenario'] and j['compat']==row['compat']
  assert row['moduleSHA256']==j['moduleSHA256']==modules[int(row['compat'])]
  assert row['helperSHA256']==helperSHA and row['integration']==INTEGRATION
  assert row['fixtureSHA256']==(sha(old.encode()) if reused else fixtureSHA)
  assert row['capture']==j['capture'];d=j['capture'];select=j['select']
  if reused:
   assert row['scenario'] in ['errno0','errno4','errno37','switch-pending','switch-complete','switch-call','stale-start']
   prior=originalBy[row['scenario']]
   assert all(row[k]==v for k,v in prior.items()),'reused checkpoint changed'
   assert not row['compat']
  if row['scenario'].startswith('errno'):
   assert j['equivalent'] and j['off']==j['on'];assert d['status']==4 and d['event']==3 and d['pc']==0x7a3366 and d['errno']==int(row['scenario'][5:])
   assert j['off']['starting']==j['on']['starting']==[0,0]
   assert j['off']['states'][-1]['registers']['eip']=='head+4' and j['on']['states'][-1]['registers']['eip']=='head+4'
   assert j['off']['states'][-1]['registers']['ebp']==1 and j['on']['states'][-1]['registers']['ebp']==1
   assert j['warm'][0]['head']>1 and j['warm'][0]['provider']>1 and j['warm'][0]['call']==j['warm'][0]['ret']==0
   assert select['phase']==3 and select['completions']==1 and select['fault']==select['active']==select['capped']==0
  elif row['scenario']=='wrong-select-return':
   assert accepts(d);assert select['ret']==values['ret'] and select['phase']==3 and select['completions']==1
  elif row['scenario']=='foreign-thread':assert d['status']==2 and d['event']==1
  elif row['scenario']=='foreign-thread-ret':assert d['status']==3 and d['event']==2
  else:assert d['status']==5
  rows.append(dict(case=case,reused=reused,fixtureSHA256=row['fixtureSHA256'],moduleSHA256=j['moduleSHA256'],captureStatus=d['status'],evidence=n,evidenceSHA256=sha(b)))
assert len({r['case'] for r in rows})==36
# Exact changes are disjoint from these seven case branches; transport opens the SAME standing files.
remote=(E/'remote-run.py').read_text();assert "MNE_STANDING='/home/user/maelstrom-uop-canonical-native-qualification-oct26/ops'" in remote
assert "abi.outputs[compat?1:0].sha256" in fixture and "hook.verifyBinaries(binaries)" in fixture
assert "e.clear_counts();assert.equal(e.get_dbg_tier_guard(),0" in fixture
assert "assert(e.uop_stats(4)>enters,'dispatch entered installed warm UOP trace')" in fixture
failures=[]
oldops=pathlib.Path('/tmp/maelstrom-uop-canonical-native-qualification-oct26/ops')
for ext in ['stdout','stderr']:
 n='original-failure-wrong-select-return-tail.'+ext;b=(E/n).read_bytes();assert sha(b)==seals[n]['sha256']
 assert b==(oldops/('failure-wrong-select-return-tail.'+ext)).read_bytes()
 failures.append(dict(path=n,sha256=sha(b),bytes=len(b),unchangedOriginal=True))
assert b'3 !== 4' in (E/'original-failure-wrong-select-return-tail.stderr').read_bytes()
for n in ['original-incident-first-native.txt','original-incident-prefix.txt','original-incident-no-debug.txt']:
 b=(E/n).read_bytes();assert sha(b)==seals[n]['sha256'];failures.append(dict(path=n,sha256=sha(b),bytes=len(b)))
changed=git('diff','--name-only',INTEGRATION,SHA).splitlines();assert all(p.startswith(('docs/','test/')) or p=='tools/maelstrom-diagnostic-canonical-build.cjs' for p in changed)
save('reuse-review.json',dict(status='PASS',candidate=SHA,integration=INTEGRATION,sourceClosure=cp['sourceClosure'],sourceFiles=140,overlays=inputs['overlays'],modules=modules,rows=rows,reusedCases=sorted(originalBy),new=29,reused=7,exactReuseDependencies=['helper/integration','both module output seals','same standing static-abi/module paths','verified authentic anchor bytes','identical shared fixture code outside unreachable wrong-return branch','seven retained payloads match manifest and all original checkpoint fields'],originalFailures=failures,changedPaths=changed,rootPackagingVerificationReused=True,claims='historical synthetic fixture only; OFF/ON is observer OFF/ON, UOP remains enabled in both',noRuntime=True))
save('checkpoint.json',dict(candidate=SHA,helperSHA256=helperSHA,fixtureSHA256=fixtureSHA,completed=['oracle/source review','768 predicate model controls','10 rejecting field controls','29 new and 7 retained exact dependency receipts','original failure byte comparison'],remaining=['report/publication']))
print('reuse PASS: 29 new+7 retained; original wrong-select failure untouched; historical closure 140+6')
