# Independent complete-module MIDI evidence acceptance — 2026-10-30

Decision: **ACCEPT the retained synthetic-boundary qualification with scope
downgrade.** Withhold independent full-module execution, general CPU-state
restoration and real Mad Bomber/audio acceptance. No production defect is
established. This reviews the new complete-module harness, not the earlier
extracted-helper fixture.

Candidate: c1ec0a3055f3d1d628fe7324f9715fabee21a0d8.
Candidate tree and independently written initial index tree:
622e343cabbfb0f815b5feb29b338ced9bed2920.
Supplied machine gate:13,495 distinct candidate index objects, none missing.
No checkout, root/donor Git mutation, main integration or deployment occurred.

## Identity and availability

input-pins.json records exact sizes/SHA256s for all20 dispatched inputs.
All verified; the9 source/CLAUDE entries overlapping the original143-pin
inventory agree exactly. The other134 pins are metadata, not134 independently
inspected source files. The original root completion receipt verified:
6,957 bytes, SHA256
18097cad020db7f76d28e20144e7b8a4061cebe8e82e4e878f9fbd87c8555f4a.
Its published SHA agrees with the candidate; PASS/push alone is not correctness.

| Artifact | Bytes | SHA256 | Inspection |
| --- | ---: | --- | --- |
| complete.wasm | 1881185 | 3aa9db179499ba1d56e523620c40ac77ee57b5f5c75f89b2ae7d50691557d4ee | remote snapshot only |
| source.tar.gz | 3758313 | d5af048c35258b4906cc63b28350a4c314d8f4fddb0a72d87f051b587793b5e1 | remote snapshot only |
| module-inventory.json | 198816 | 5ca75365b910b5bda148378e51dd3fb409c31e08c6c5332f871074a725a8f2a3 | remote snapshot only |
| synthetic-midi.exe | 4608 | 15eddb960a875b46fd0814367b0eb8725d0adba996e94960dbbd2703718a9a49 | exact constructor independently executed; guest not run |
| lifecycle.js | 9135 | 60db59885a27d90664af20f1ecb8fd93e8a741f4f107355b572e28ca020dd4c9 | comprehensively inspected |
| lifecycle-report.json | 3483 | ed7dec3a113d8d9e1ae83f210083411f14eae0244669e3351590092e54a5309b | retained observations inspected |
| host-audio.js | 207077 | 00e02890ff3010cb514bbff3e946d9cbc8c00d8cba2d2966a16950e585574bdb | pinned current source; relevant model inspected |

Actual Wasm bytes, archive and inventory were not fetched, compiled,
instantiated or inspected. Hashes are provenance, not independent execution.
The retained compile report gives291 imports/2225 exports; actual inventory
names/types and module-to-source byte identity remain remote-only.

## Claim classification

| Claim | Checked here | Evidence class / limit |
| --- | --- | --- |
| Initializers and real dispatch | Entire lifecycle: unchanged createAudioHost imports, fail-closed unused imports, set_api_log(0), load_pe then seal_thunks before run | Static harness/current-source review; production execution retained only |
| API identity | Six current table IDs/nargs and exact PE named ILT/IAT construction match retained resolved identities | Local executable metadata checks; Wasm thunk resolution retained only |
| Complete-module compile/run | Production compile options, module digest, lifecycle/supervisor receipts agree | Retained only; no independent module execution |
| Callback ABI | Source pushes0, header, instance, message, handle, continuation | Source inspected; five DWORD arguments imply RET20/stdcall |
| Callback bytes/frames | Exact reconstructed PE hash, C2 14 00 at RVA1080, three six-DWORD retained frames checked | Local construction/trace consistency; x86 execution retained only |
| API calls/counters | Ten calls, all result0; original call checks ID/nargs, API count+1, EIP0 and stdcall ESP | Assertions reviewed; per-call counter/ESP values not logged |
| Header flags/ownership | Host owns registration, queue, headers and pending map; submission.done prevents repeated completion; DONE set/INQUEUE cleared | Source inspected; flag assertions retained |
| Stop/delivery | Two stops: first MOM_DONE delivered, second accepted MOM_DONE deliberately dropped by control | Retained sequence; positive callbacks OPEN/DONE/CLOSE total3 |
| Return EIP/ESP/EAX | First slice reaches frame[0]/CACA000A; second restores idle EIP, original ESP, EAX11223344 | Retained assertions; unchanged-oracle controls distinguish corrupt return/stack/EAX |
| General CPU/wait state | Source save/restore/ownership continuation reviewed from exact candidate objects | Not qualified: ECX/EDX/lazy flags/wait state unasserted; RET20 clobbers no general registers |
| No abandoned-note replay | Two explicit service calls after advanced clock; unchanged note-on count/empty queue; later close callback succeeds | Retained bounded evidence; no global callback/service counter |
| Mad Bomber/native/browser/hardware | No relevant execution or recording | Unobserved/open |

The exact candidate generated dispatch also calls all six handlers; see generated-dispatch.txt.

API name → ID/nargs/thunk (hex thunk):
midiStreamOpen2341/6/07500000; midiOutPrepareHeader2343/3/07500008;
midiStreamOut2344/3/07500010; midiStreamRestart2345/1/07500018;
midiStreamStop4593/1/07500020; midiStreamClose2340/1/07500028.
Open reads sixth argument at ESP+24 and cleans28 bytes; prepare/queue clean16;
single-argument controls clean8.

Retained frames [return, handle, message, instance, param1, param2]:
return07500130, handle000c0001, instance00098765 for all.
OPEN message3c7/param1=0; DONE3c9/param1=00405100;
CLOSE3c8/param1=0; param2 always0. This is a declared synthetic PE, not the
original Mad Bomber binary. MIDI API entry sets EIP to a PE-resolved thunk
then calls run(1); x86 CALL instructions for those APIs are not executed.
The callback RET20 is the relevant executed x86 in the retained report.

References: host-audio.js2175–2333/3920–4010; exports3457–3502.
Exact candidate-object excerpts retained in register-frame.txt,
continuation.txt, loader-frame.txt, callback-finish.txt and
dispatch-initializer.txt show40 saved bytes (EIP/EAX/ECX/EDX/lazy flags),
24 callback bytes, real CACA000A → mm_callback_finish, invocation validation,
register/wait cleanup. RET20 removes24 bytes including return; continuation
consumes40 saved bytes. These source facts are not new runtime observations.

## Executable controls and counterexamples

check.js check produced results.json:8 positive groups and8 distinguishing
rejections. It executes the **unchanged pump text** from pinned lifecycle.js
against an explicitly abstract register/frame observation adapter. The exact
PE constructor is separately executed without load_pe. Only Node builtins
fs/path/crypto/vm/assert are imported. No production host/fake Wasm execution
is substituted. Every control is an evidence/oracle control, not a production
mutation.

| Control | Intended rejection observed |
| --- | --- |
| Callback message corrupt | 968 != expected969 |
| Return continuation corrupt | callback reaches real return continuation; +8 address |
| Continuation marker corrupt | CACA000B != CACA000A |
| Restored stack corrupt | oldESP-4 != oldESP |
| Restored EAX corrupt | DEAD !=11223344 |
| Accepted MOM_DONE suppressed | one stop delivery/callback required;0 deliveries |
| Expected module identity falsified | expected module identity |
| Expected source identity falsified | expected source identity |

Identity controls belong to this independent checker. Original lifecycle
records actual module digest without asserting an external expected digest.
Source launch pins alone do not prove which module was compiled. We bind
retained reports to manifest pins; byte inspection remains remote-only.

Precise counterexamples:
1. Original pump accepts an observation model with ECX=DEAD, EDX=BEEF and
   flags=0 after return while EIP/ESP/EAX match. General CPU restoration is
   unproved. Even EAX equality uses a callback which never clobbers EAX;
   it is not a clobber-and-restore challenge.
2. Exact post-stop service assertion excerpt accepts a transport consuming
   a stale callback and redirecting EIP while evidence.callbacks and sent
   note count stay unchanged. Only pump() updates evidence.callbacks.
   This is an excerpt-level blind spot: later close can catch an outstanding
   guarded callback, so **no whole-harness bypass is claimed**.

These are oracle scope limits, not established production defects. The
single future-note no-replay assertion remains useful; it does not prove
arbitrary replay/cardinality behavior.

## Incidents, limits and lifecycle

incident-review.json decodes read-only prior root API response wrappers and
pins those wrapper bytes. Incident1 fails on log_api_exit before callbacks.
Incident2 reports correct OPEN frame but EIP07500130 instead of idle00401000
after one block. Final fixture uses production set_api_log(0), asserts the exact
return continuation/marker and takes the second bounded run slice. Retained
stepped run passes with the same module digest and all3 frames. These changes
fit diagnostic/stepping fixture errors; no production repair or weaker final
return assertion is evidenced. Remote incident-report bytes remain remote-only;
decoded local wrappers corroborate them without bytewise remote verification.

First local run failed on a diagnostic regex: Node printed marker values on
separate diff lines. Only this regex was corrected to match both exact values
across whitespace. Original oracle/assertions unchanged. Failure retained in
task e/evidence-controls.{json,stderr}; corrected run exit0, about0.10s.
This was a fixture formatting correction; no admission/policy denial occurred.

startup.json records resolved installed Node24.18.1, heap192MiB, original
unlimited DATA/AS, CPU60/file12MiB. Configuration reused unchanged. Unmodified
ops.py separately enforces groupRSS512MiB/parentRSS128MiB/wall90/capture512KiB.
Old-space is not total RSS. Git-only DATA256 never caps an ancestor or Node.
All20 input pins, supervisor/limit pins and canonical receipt verified.
Initial ref digest and supervisor receipts retained. No mount argv exists:
no checkout/runtime/mount was assigned; filename-bearing parser is inapplicable.

Boat bx_3ckx3mvs was already snapshot-stopped02:30:38Z, original expiry
2026-10-30T02:50:23.495Z. This task did not contact/resume/stop/delete/allocate
a box. Coordinator keeps lifecycle ownership.

## Remaining gates and publication

Actual Mad Bomber inputs/build/media identity, original guest callback ABI,
startup/gameplay/sound controls, nested/requeue callbacks and actual CPU
clobber/restore observations remain open. Native application behavior, browser
scheduling/owner transport, TinySynth/WebAudio and audible hardware output are
unobserved. Other callback modes and MIDI event types are outside this
cooperative synthetic single-header qualification.

Only this test/report branch is published. Root completion-receipt.json records
exact commit/remote-SHA verification and recovery.patch SHA. No main/public
deployment. Shared board is not accessed; messageboard-note.txt is for coordinator
append. The8MiB publication reserve remains through closeout.
