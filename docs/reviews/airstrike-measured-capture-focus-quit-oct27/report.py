import json,pathlib,hashlib,shutil,time,ast
import run as c
H,R=c.H,c.R;D=R/'docs/reviews/airstrike-measured-capture-focus-quit-oct27';D.mkdir(parents=True,exist_ok=True)
ret=H/'retained'
q=json.loads((ret/'remote-result.json').read_text());cleanup=json.loads((ret/'remote-owned-cleanup.json').read_text());supervision=json.loads((ret/'remote-guest-supervision.json').read_text())
assert q['status']!='normal-quit-observed' and cleanup['complete'] and not cleanup['remaining']
inventory=json.loads((ret/'remote-inventory.json').read_text())
imgs=[x for x in inventory if x['path'].endswith('.png')]
events=json.loads((ret/'remote-events.json').read_text())
reviews=json.loads((H/'review-facts.json').read_text())['frames']
for f in reviews:assert hashlib.sha256((ret/f['file']).read_bytes()).hexdigest()==f['sha256']
log=(ret/'remote-runner.stdout').read_text()
assert [s for s in log.splitlines() if s.startswith('[input] ')]==['[input] click 656,33 at batch 5000','[input] keydown vk=32 at batch 5001','[input] keyup vk=32 at batch 5002']
assert '[Exit] code=0' not in log.splitlines() and len(imgs)==5
assert q['reason']=='overall guest deadline; no replay' and supervision['cleanupComplete'] and supervision['stopReason'] is None
assert not json.loads((H/'api-ledger.json').read_text())['pending']
facts=dict(status='STOP_FIRST_OBSERVED_STARTUP_BOUNDARY',sourceRevision='097f3b2904d833ca8fb152e686032c156c16e39a',historicalRunnerRevision='b41a7c5f4b752d1f0bdab1141a11d4fed4dc6f9a',controllerAndBridgeUnchanged=True,reusedTests=32,offlineReplay=False,guestInvocations=1,inspectedOriginalPNGs=3,captures=len(imgs),captureBytes=sum(x['bytes'] for x in imgs),observedBatch=[5000,5001,5003],actualInputRoute=['accepted guarded caption activation','Space keydown','Space keyup'],menuEstablished=False,ordinaryQuit=False,guestResult=q,cleanup=cleanup,supervision=supervision,apiLedger=json.loads((H/'api-ledger.json').read_text()),reason='New inspected fullPNG after acknowledged Space press/release still displays Press any key to start; no menu/gameplay observation. Stop without Esc/Down/Enter, replay or repair.',limitations=['Time projection used measured admitted API service and review estimates; shared permit queue delay was not reserved. Original overall watchdog retained; exact terminal result is authoritative.','Initial oversized policy displays, missing optional recipe reads, erroneous bounded ELF display, missing accepted controller entries in historical tar, and pending factual-refusal pool delay retained; no retrospective claim of perfect setup.'],box=dict(id='bx_ffsw74qe',state='last supported exec succeeded; leave running, no lifecycle mutation',expiry='2026-10-27T13:11:07.294Z',shutdown='2026-10-27T13:05:00Z',owner='coordinator',watcherUntouched=True))
c.dump('outcome.json',facts)
text='''Airstrike: safe caption activation established; menu and ordinary Quit blocked

One actual guest invocation used the retained historical emulator and runner with unchanged accepted production controller and bridge at 097f3b29. All 265 runtime pins passed before staging. Exact Node v24.22.1 startup, heap flags, environment, inherited CPU90 limits, module validation, API table and canonical tree mount enumeration passed inside the assigned Boat. No compilation, install, download or regression replay occurred.

The model inspected three full 800x600 lossless PNGs. First: Console obscures Airstrike startup. The snapshot identifies both windows and their actual geometry. The unchanged accepted controller selected its guarded exposed caption point and obtained serial ACK/frozen-zero completion. Second: Airstrike is visibly in front, its startup prompt unobscured, focus remains its main window. Third: after acknowledged Space keydown/up, batch5003 still shows the same startup prompt, byte-identical to the second image. No gameplay or menu was inferred. No Esc, Down or Enter was sent. Ordinary Quit and guest Exit0 remain unproven.

The first visual blocker is the unchanged startup after Space. Factual startup submission and terminal collection subsequently waited for the shared two-permit pool; this delay was absent from the projected service/review time. The original watchdog remained active. Exact terminal reason, signal cleanup, API charges, physical resource peaks and wall time are retained in outcome.json and the full causal evidence. A timeout/signal cleanup is never called ordinary Quit. No guest replay, source repair, shared integration or main ownership was attempted.

The box remains under coordinator ownership, with snapshot-stop scheduled13:05UTC and expiry13:11:07.294UTC. This report branch preserves sparse parent source identity through immutable read-only alternates; it is report-only. Root tracked/index/refs and donors remain read-only. All original predecessor refusals and setup incidents retain their original qualification.
'''
(D/'README.md').write_text(text)
for p in H.glob('*.py'):
 ast.parse(p.read_text());shutil.copyfile(p,D/p.name)
for n in ('outcome.json','all-runtime-pins.json','capture-plan.json','prepare.json','prepare.stderr','prepare-corrected.json','startup.json','launch.json','review-facts.json','api-ledger.json','report.admission.json','startup.cjs','abi-preload.cjs'):
 shutil.copyfile(H/n,D/n)
shutil.copytree(ret,D/'evidence',dirs_exist_ok=True)
c.dump('report-validation.json',dict(syntax='PASS',runtimePins=265,acceptedTestsReused=32,notClaimed=['menu','ordinaryQuit','current-main emulator'],cleanupComplete=cleanup['complete'],sourceUnchanged=True))
shutil.copyfile(H/'report-validation.json',D/'report-validation.json')
print('report retained',len(inventory),'remote files',len(imgs),'PNGs',q['status'],q.get('reason'))
