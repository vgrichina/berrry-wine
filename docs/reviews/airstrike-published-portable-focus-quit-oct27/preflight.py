import pathlib,json,hashlib,time,ast
import run as c
H,R=c.H,c.R
D=pathlib.Path('/tmp/airstrike-portable-fixtures-accepted-main-integration-oct27/repo')
rev='097f3b2904d833ca8fb152e686032c156c16e39a'
manifest=D.parent/'ops/receipt-manifest.json'
assert hashlib.sha256(manifest.read_bytes()).hexdigest()=='63b146fe860bfb21603f1eba79df4de27f164ce3023e2dc80e74c6008a0a00c9'
pins={}
for name,expected in [('airstrike-menu-controller.py','a3425f91a36eef1ed1413e6ddb3cb814617a924d8a1e23cb78a00c65b951c662'),('airstrike-observation-bridge.py','a7c07110c128c9a521b9e05affdbf6fa86fff672e228680d5a7d5b15cbbb924e')]:
 p=D/'tools'/name;b=p.read_bytes();assert hashlib.sha256(b).hexdigest()==expected
 tree=ast.parse(b);pins[name]=dict(path=str(p),bytes=len(b),sha256=expected,definitions={n.name:dict(line=n.lineno,endLine=n.end_lineno) for n in ast.walk(tree) if isinstance(n,(ast.FunctionDef,ast.ClassDef))})
fixture=D/'test/fixtures/airstrike-caption'
f=json.loads((fixture/'manifest.json').read_text())
for row in f['files']:
 b=(fixture/row['path']).read_bytes();assert len(b)==row['bytes'] and hashlib.sha256(b).hexdigest()==row['sha256']
request=json.loads((fixture/'review-request.json').read_text());review=json.loads((fixture/'review-9b55685e506a4124abd456510ebaf254.json').read_text())
c.dump('historical-review-request.json',request);c.dump('historical-review.json',review)
# Static production-path accounting only: no controller/fixture execution,
# no guest, no image inference, no replacement of accepted guard semantics.
ledger=[dict(boundary='initial Console obstruction -> caption activation',review=1,freshBeforeInput=1),dict(boundary='new unobscured startup -> Space',review=1,freshBeforeInput=1)]
ledger += [dict(boundary='menu selected row '+str(i)+' -> '+('Down' if i<6 else 'Enter'),review=1,freshBeforeInput=1) for i in range(7)]
minimum=sum(x['review']+x['freshBeforeInput'] for x in ledger)
assert minimum==18 and minimum>16
q=dict(status='BLOCKED_CAPTURE_PLAN_BEFORE_GUEST',at=time.time(),revision=rev,pins=pins,acceptedReceipt=str(manifest),acceptedReceiptSHA256=hashlib.sha256(manifest.read_bytes()).hexdigest(),reuse='32 merged tests and unchanged independent acceptance; no offline replay',ledger=ledger,minimumCaptures=minimum,gameplayBeforeEscAdditionalCaptures=2,expectedGameplayPathCaptures=20,authorizedMaximumCaptures=16,individualCap=2097152,apiAllowance=8388608,terminalCleanupReserve=1048576,actualGuestInvocations=0,actualAPIResponses=0,actualCaptures=0,actualInputs=0,unproven=['fresh Boat Node executable/version/env/startup','fresh Boat parser/mount enumeration','actual Console focus activation','actual menu rows0..6','ordinary Quit','normal guest Exit0 and runner exit'],reason='Known Console/startup route needs at least18 captures under unchanged accepted observation+freshness guard; no compliant <=16 plan. With separately observed gameplay before Esc,20. Do not consume guest invocation or weaken guard.',resumePrerequisite='Coordinator-authorized reconciled capture/time/full-wire plan for unchanged controller, or a separately independently accepted controller change. This task does not authorize either change.',lifecycle=dict(box='bx_ffsw74qe',owner='coordinator',guestCutoff='2026-10-27T12:59:00Z',handback='2026-10-27T13:02:00Z',shutdown='2026-10-27T13:05:00Z',expiry='2026-10-27T13:11:07.294Z',state='assigned running at dispatch; not queried or mutated by this worker'),cleanup=dict(guestStarted=False,remoteStagedFiles=0,ownedGuestProcesses=0,shutdownWatcherUntouched=True),incidents=['Initial combined policy and skill displays exceeded8192bytes; original tool transcript retained.','Attempted reads confirmed predecessor task.py references missing remote.py/proxy.py; no predecessor write or launch.','Read-only broad /tmp filename search was unnecessary and encountered permission-denied paths; no retry or access bypass.'],rootRefs='Launcher digest reused, capturedListingBytes0; root/donor tracked/index/refs read-only')
c.dump('capture-plan.json',q)
print(json.dumps(dict(status=q['status'],minimumCaptures=minimum,maximum=16,guest=0,API=0)))
