# Secondary sound-buffer interface candidate

The original .kkrieger requests IID_IDirectSoundBuffer8 after creating its
secondary PCM buffer. Existing QueryInterface refuses that IID. The retained
unpacked image and the new EIP-zero stop identify a null audio-buffer call as
the next lead; the actual initialization HRESULT still needs a runtime capture.
See `docs/re-notes/kkrieger-beta.md` and the original run evidence
`scratch/runs/20261015-kkrieger-short-original` in the coordinator checkout.

This candidate adds a distinct 24-slot secondary-buffer wrapper. Its 21
inherited methods share the original buffer, reference count, PCM storage and
voice. QI retains controlling IUnknown identity, checks all GUID words,
rejects primary buffers and reports auxiliary-wrapper exhaustion without
rewriting another interface. The shared vtable registry is extended at its
tail, preserving existing Worker offsets.

SetFX, AcquireResources and GetObjectInPath have real appended dispatch slots
with the correct argument counts, but remain **explicitly unimplemented**:
they call the normal fail-fast diagnostic. Effects and deferred resources are
open API work. There is no successful no-op, fabricated capability error or
change to existing creation flags. This is inherited Buffer8 compatibility,
not complete Buffer8 support or a gameplay qualification.

`test/test-directsound-buffer8.js` prepares actual generated-thunk dispatch
checks, stdcall frames, full identity/primary/exhaustion/Worker-registry
checks, Lock/Unlock/Play/cursor/Stop on the real host audio model, final voice
release, and all three explicit extension traps. No external PE is required.
Canonical build and all six suites passed on corrected candidate
`42b0be0454393da9f75821e44c916b45d68f0414`. The original registered run reached
the animated 3D main menu within its 600-second bound. Player control, starting
a level, combat, audible sound and full Buffer8 extensions remain unqualified.

Initial canonical validation found and retained two gate failures: registry
storage had not grown with the appended entry (fixed 312 to 316 bytes, generated
mirror updated), then the exact-duplicate ratchet rejected the three explicit
extension traps. Those three one-call fail-fast handlers were reviewed and
added individually to the existing duplicate-member allowance. No group-count
cap was increased, no guard disabled and no successful stub introduced.

Validation controller (executed; receipts below):
`tools/kkrieger-buffer8-validate.js`. From an isolated clean remote clone with
the existing `node_modules` and pinned calc fixture linked/copied, run:

```sh
WA_TEST_ROOT=/home/user/wa-kkrieger-buffer8 WA_RUN_OUT=/home/user/kkrieger-buffer8-validation timeout --kill-after=10s 1740s node /home/user/wa-kkrieger-buffer8/tools/kkrieger-buffer8-validate.js
```

Launch through `boat exec bx_erf37bxf --detach -- ...` only after the runtime
grant; poll `boat exec bx_erf37bxf --status PID --json`. No SSH. Canonical has
a 600s ceiling, each of six sequential suites 180s. Expected normal duration
is a few minutes, but reserve the full bound or shorten deliberately before
launch if box TTL cannot accommodate it. No tests run concurrently. Each
exit/log and source hash is retained; failures prevent original-run acceptance.
The controller requires 2GiB free plus a 512MiB working reserve.

After all seven exits are zero, record canonical SHA256 and source equivalence,
then launch the existing controller with `WA_MAX_SECONDS=600`,
`WA_CAPTURE_AUDIO=1`, `WA_EXPECT_WASM_SHA256=<recorded canonical hash>`,
`WA_TEST_ROOT=/home/user/wa-kkrieger-buffer8` and a new exclusive `WA_RUN_OUT`.
Use an outer `timeout --kill-after=10s 720s node tools/kkrieger-registered-startup.js`.
Do not repeat signed-vertex conformance. The original executable and manifest
come from the retained registered fixture; preserve all archive/member pins.

The before-load audio probe installs the existing main-thread EIP callback
and arms the diagnostic range as soon as exports appear (recording arming time
and EIP). It records DirectSoundCreate, cooperative level, primary creation and
format, secondary creation, QI and release returns. Snapshots contain raw EAX,
registers, descriptor, requested IID, secondary local and global output pointers,
object and bounded vtable words. Read errors remain explicit. Return EAX at
Release/failure-exit is diagnostic data, not an HRESULT assertion. Missing
points or late arming are incomplete evidence; never infer successful calls.
The diagnostic switch changes interpreter execution cost, so this is not a
performance comparison. Main-thread captures do not establish Worker state.
The probe never patches guest bytes, sets registers or forces success.

Queued validation, in order on the granted box (no concurrent browser/build):

```sh
bash tools/build.sh
node test/test-directsound-buffer8.js
node test/test-directsound-buffer-query-interface.js
node test/test-directsound-notify.js
node test/test-directsound-buffer-format.js
node test/test-directsound-ring-wrap.js
node test/test-directsound-play-cursor.js
```

The format suite covers creation and duplication. The last two cover host
PCM ring wrapping and cursor progression. Preserve each exit code/log and
canonical module/source hashes separately; the tests compile their own
export-augmented module and are not canonical-module executions. Existing QI
and format suites need `test/binaries/calc.exe` solely to initialize the PE:
94208bytes, SHA256 `cb71fcc9726f756421519a215c39cf89efd930c9ae0fa5bbb59b64050faef52b`
in the coordinator checkout. Transfer that pinned small fixture if absent;
do not silently skip those tests or substitute the canonical module.

Only after conformance passes, an authorized original registered run must
retain the same original archive/file pins and capture the secondary
CreateSoundBuffer return at0x80490d, QI return at0x804927, and output pointer
0x83f890. Before-load read-only instrumentation should use the established
EIP hook and record both HRESULT and interface/vtable bytes. Do not set
registers, skip the call or edit guest state. Compare against the previous
310second EIP-zero run without treating timing as a benchmark. Existing
600second bound and viewport-preserving observer rules still apply.

## Executed evidence, 2026-10-15

CPU controller43883 finished0 at09:49:19Z on `bx_erf37bxf`, Node24.18.1.
Canonical plus Buffer8, query-interface, notify, format, ring-wrap and cursor
suites all pass. The new test initially rejected legacy Lock's capped five-word
dispatcher metadata as if it described the full COM ABI. Its correction retains
the actual eight-argument frame, 36-byte ESP pop, output and sentinel assertions.
The three earlier failed attempts remain in
`scratch/runs/20261015-kkrieger-buffer8-cpu/`; 960 tested source hashes match.
Canonical WASM SHA256:
`2dc9775e260c872d098a7b9db43ba0d9797977d6c43f552ddcc0ec235f47ec87`.

Original controller46631 ran09:51:52.552–10:01:53.226Z, Chrome151.0.7922.108,
1100x800, cooperative/not cross-origin isolated, fixed2GiB, OOM0 in all40
samples. Controller exit0 means the normal600s capture boundary, not guest exit.
Postflight10:02:19 reports no browser/controller survivors, unchanged960 source
hashes, identical module and all three original fixture hashes. The earlier
45328 attempt never loaded the guest: a fixture symlink outside the static
server root returned403. It was scoped-killed, retained separately in
`20261015-kkrieger-buffer8-launch-error`, and the pinned fixture was copied
inside the isolated clone for the successful launch. No fixture bytes changed.

The audio probe armed at379.5ms, before all seven return captures around986ms:
DirectSoundCreate, cooperative level, primary creation/format, secondary
creation at0x80490d and Buffer8 QI at0x804927 all returned EAX0. QI wrote
`0x086f2000` to guest0x83f890; its distinct24-slot vtable shares the first21
slots with the base interface. Base Release returned refcount1. No capture
errors. This directly demonstrates successful original audio initialization
on the candidate; it does not retroactively measure the prior run's HRESULT.

Reviewed screenshots show loading, then the rendered3D menu background, then
the menu text “start new game / credits / exit .kkrieger”. Input observer51371
captured3s idle, click(390,470), W4s, A4s, Space and click. Observer51944 sent
Enter to the highlighted menu, waited4s, captured3s idle, then W4s and A3s.
Both observers used `defaultViewport:null`, disconnected and exited0. The
menu remained visible after both sequences. Background camera changes during
idle as well, so none is accepted as player movement. One later idle capture
is black; subsequent captures show the menu again. The input log contains
keyboard WM messages with hwnd0 and mouse messages with hwnd0x10001; this is
a routing-investigation lead, not a proven cause. No forced success, guest
patch, register write, runtime extension, or subsequent retry was used.

Self-contained evidence:
`scratch/runs/20261015-kkrieger-buffer8-original/` — 81 transferred artifacts,
13,367,696bytes independently size/SHA256 checked; `node analyze.js` verifies
all40 samples, audio returns, vtable inheritance, source postflight and three
controller exit codes. `input-events.json`/`start-events.json` and process
receipts preserve full commands. `final.png`, `input-before.png`,
`input-idle.png`, `start-entered.png`, `start-forward.png` and `start-left.png`
were inspected. Own evidence schema/containment passes; the global checker
still reports the unrelated historical Zuma external artifact reference.

Next acceptance work is ordinary menu-start/input routing followed by genuine
level movement and combat, on a separately authorized runtime. The current
slot was explicitly released to the CMR3 recovery lane.

Official contract references:

- [Buffer8 identity and primary-buffer restriction](https://learn.microsoft.com/en-us/previous-versions/windows/desktop/ee418055(v=vs.85))
- [Microsoft SDK header, GUID and vtable order](https://raw.githubusercontent.com/microsoft/win32metadata/main/generation/WinSDK/RecompiledIdlHeaders/um/dsound.h)
- [SetFX](https://learn.microsoft.com/en-us/previous-versions/windows/desktop/ee418145(v=vs.85)), [AcquireResources](https://learn.microsoft.com/en-us/previous-versions/windows/desktop/ee418057(v=vs.85)), [GetObjectInPath](https://learn.microsoft.com/en-us/previous-versions/windows/desktop/ee418068(v=vs.85))
