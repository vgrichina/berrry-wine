import ast,difflib,hashlib,json,pathlib,shutil,time
H=pathlib.Path(__file__).parent;R=H.parent/'repo';T='enigma-reviewed-menu-budget-repair-oct27'
D=pathlib.Path('/tmp/enigma-accepted-progressive-menu-main-integrate-oct27/repo')
O=R/'docs/reviews'/T;O.mkdir(parents=True,exist_ok=True)
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
inputs=json.loads((H/'input-pins.json').read_text())
for p,h in inputs['pins'].items():assert sha(D/p)==h,p
changed=['tools/enigma-frozen-gameplay-controller.py','tools/enigma-supervised-gameplay.py','test/fixtures/enigma-controller/test_review_budget.py']
for p in changed:ast.parse((R/p).read_text(),filename=p)
pins={p:sha(R/p) for p in changed}
for p in changed[:2]:
 (H/(pathlib.Path(p).name+'.diff')).write_text(''.join(difflib.unified_diff((D/p).read_text().splitlines(True),(R/p).read_text().splitlines(True),fromfile='accepted/'+p,tofile='candidate/'+p)))
for label in ('original-boundary-v4','final-adequate-v2','final-preflight','final-plan-guards-v2','progressive-reserve-remainder','progressive-stale-remainder','progressive-action-remainder','affected-review'):
 q=json.loads((H/(label+'.json')).read_text())
 assert q['exit']==0 and q['stopReason'] is None and q['cleanupComplete'],label
assert sha(R/'test/run.js')==inputs['pins']['test/run.js']=='6dc104b3c10db701c0b1aec5954dd00cc29a7b6009970a5876ccc27426e7fa9e'
status=dict(status='PASS_SOURCE_TEST_ONLY_PENDING_INDEPENDENT_ACCEPTANCE',at=time.time(),
 task=T,sourceRevision=inputs['sourceRevision'],originalPins=inputs['pins'],candidatePins=pins,
 firstBoundary=dict(entry='unchanged production enigma-supervised-gameplay.py main --launch-config',
  productionSupervisorSHA256=inputs['pins']['tools/enigma-supervised-gameplay.py'],
  controllerSHA256=inputs['pins']['tools/enigma-frozen-gameplay-controller.py'],
  reproducerSHA256=sha(H/'original-reproducer.py'),evidence='original-boundary-v4.json',
  delays=[14.54351074877195,16.862725148908794],result='28s exhausted, second review unfinished, zero clicks, cleanupComplete'),
 retainedRuntimeFailure=dict(receipt='/tmp/enigma-published-progressive-startgame-oct27/ops/result.json',
  readOnce=True,menuBatch=78593,menuSize=[640,480],menuSHA256='8ffead1b04adbe5fac8d82c5a374375f5883898b29e87962d72c3c3e26da18d5',
  requestedStartGame=[343,213],clicked=False,reviewSeconds=28),
 tests=dict(delayedAdequate='final-adequate-v2.json',preflightAndSlot='final-preflight.json',
  noResetAndReviewIO='final-plan-guards-v2.json',affectedReview='affected-review.json',
  progressive='6 methods passed before guarded RSS stop in progressive-affected.stderr; remaining 3 methods each passed in isolated processes',
  remainingProgressive=['progressive-reserve-remainder.json','progressive-stale-remainder.json','progressive-action-remainder.json'],
  unchangedSourceNativeAcceptance='Reuse pinned accepted source/native/JS runner receipts; no Node/native/build/guest executed'),
 nextRuntime=dict(authorization='Fresh coordinator assignment, independent acceptance and scoped integration required; no existing run budget reset',
  readiness='Full exact immutable fixture/module/import/worker/mount closure, fresh admission, lifecycle and exact Node startup receipt required; not tested by source-only fixture',
  duration_seconds=110,ready_seconds=8,supervisorCPU=90,supervisorWall=120,
  controller=dict(review_seconds=36,request_timeout=1,cleanup_seconds=12,checkpoint_seconds=18,
   review_plan=dict(checkpoint_seconds=[17,19],progress_seconds=36),
   progress=dict(max_checkpoints=2,total_seconds=110,cpu_reserve=15,api_bytes=1048576,capture_total_bytes=2800000),
   max_captures=4,capture_bytes=700000,width=640,height=480),
  totalRequiredSeconds=108,measuredFetchSecondsTotal=31.406235897680744,
  qualification='Preflight feasible, not proof of future network latency, 36s progress sufficiency, actual menu, gameplay or Quit. Slower/missing review stops without input. One-second control timeout must be explicitly admitted; any uncertainty stops without replay.',
  input='Only fresh full-image correlated review can authorize StartGame. Historical menu coordinates are not an input authorization.'),
 resource=dict(localAllocation=134217728,reserve=8388608,gitPhysical=268435456,gitData=536870912,pythonPhysical=134217728,
  cpu=90,wall=120,file=25165824,output=2097152,display=8192,cumulativeOutput=1048576,
  controls='Git child-only DATA via prlimit, two-permit pool+flock; trusted supervisor Python one-permit pool; fresh peer-once admission per operation'),
 scope=dict(reportOnlyOrphan=True,neverMergeWholeTree=True,changedPaths=changed,rootDonorsReadOnly=True,noMain=True,
  noAPI=True,noGuest=True,noNode=True,noBoat=True,noWorkers=True,noPublicDeployment=True),
 lifecycle=dict(assignedBoxes=[],existingBox='bx_pa3bb5zc',state='Not queried or touched in this source-only task; last supplied runtime receipt RUNNING_API_EXEC_OBSERVED',
  shutdownOwner='coordinator',shutdown='2026-10-27T11:00:00Z',expiry='2026-10-27T11:06:11Z',action='unchanged'),
 incidents=['Initial combined policy and board displays exceeded8192B; preserved transcript, no retrospective compliance claim.',
  'First shell used unavailable python instead of python3 and failed before operation creation; exit127 retained in session.',
  'First regression fixture omitted parent mkdir; exact separate child stdout/stderr retained original-boundary.',
  'Two fixture iterations counted delayed review completion during cleanup; exact failed assertions retained original-boundary-v2/v3. Final fixture stops fake transport advancement after controller outcome and preserves completed flags at terminal.',
  'Broad progressive run hit enforced aggregate RSS128MiB, peak141893632; stopped and cleanupComplete. Six completed methods retained; three remaining methods ran in smaller isolated processes without changing caps.'],
 publication='pending task branch; no main ownership')
(H/'acceptance-checkpoint.json').write_text(json.dumps(status,indent=2)+'\n')
(O/'receipt.json').write_text(json.dumps(status,indent=2)+'\n')
(O/'README.md').write_text('''# Enigma explicit review reservation repair

The retained actual menu at batch 78593 was fully reviewed, but its 14.5435s +
16.8627s frame fetches exhausted the nonrenewable 28s review allowance before
Start Game. No click was dispatched. This source repair preserves that failure.

An optional controller `review_plan` contains `checkpoint_seconds` (one positive
transport-plus-full-image-review allowance per progress checkpoint) and
`progress_seconds` (the total advance-window allowance). The production launch
entry rejects incompatible review, capture and wall budgets before child creation.
Required controller seconds are progress + all review slots + cleanup +
`(4 * checkpoints + 8) * request_timeout`; readiness is added by the supervisor.
This includes bounded step/snapshot window overrun and all action/cleanup calls.
The controller reserves later slots before progress/capture/review, debits actual
review to the original single cumulative allowance, and refuses late decisions.
No plan keeps the existing legacy scheduling contract, including immediate
prewritten reviews at zero wait. No existing budget, CPU/API/capture counter,
listener/authority proof, serial ACK or frozen-zero requirement is renewed.

The source-only regression invokes actual production `main --launch-config`
with the unchanged offline child transport, real subprocess/listener/HTTP and
full synthetic 640x480 PNGs. A fake review clock uses the retained transport
measurements. It does not run Node, a guest, Boat or a remote API, and does not
claim to see the actual retained menu. With explicit 34s admission both reviews
complete and exactly one input follows a fresh frozen-zero snapshot. With 28s
the unplanned regression retains the original zero-input failure. An explicit
inadequate plan rejects before any child. A short first slot cannot spend a
later slot; depleted CPU/API/captures/deadline still refuse input.

The separately admitted example in receipt.json needs 108s inside the unchanged
110s cap, with 17s+19s review slots, 36s progress, 8s readiness, 12s cleanup and
1s control timeout. The old 3s timeout cannot fit that plan and is rejected.
Future transport latency and progress rate remain runtime acceptance gates.
Never replay the exhausted invocation or infer input authority from old images.

This is an orphan report/source task branch: integrate only the two tools, new
test and review receipt after independent acceptance. Never merge the whole tree.
Original diagnostics and canonical publication/cleanup/accounting are in the
worker-owned ops directory and receipt-manifest.json. No main or public deploy.
''')
E=O/'evidence';E.mkdir(exist_ok=True)
directories=('original-boundary','original-boundary-v2','original-boundary-v3',
 'original-boundary-v4','repaired-boundary','preflight-matrix','preflight-final',
 'final-preflight','final-adequate','final-adequate-v2','progressive-affected')
for name in directories:
 if (H/name).exists():shutil.copytree(H/name,E/name,dirs_exist_ok=True)
for p in H.iterdir():
 if p.is_file() and (p.suffix in ('.json','.stdout','.stderr','.diff') or p.name in ('original-reproducer.py','run.py','setup.py','package.py')):
  if p.name not in ('package.json','package.stdout','package.stderr'):
   shutil.copyfile(p,E/p.name)
manifest=[dict(path=str(p.relative_to(O)),bytes=p.stat().st_size,sha256=sha(p))
          for p in sorted(E.rglob('*')) if p.is_file()]
(O/'evidence-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print('PASS source pins, accepted donor identities, checks, scoped documentation; checkpoint retained')
