# Shadow Man retained full-module handler capture — 2026-10-23

**PASS for the focused synthetic native handler capture.** The actual retained
1,879,746-byte module executed the shipping `send_message` → nested interpreter
→ guest callback → `DialogBoxIndirectParamA` → guest DLGPROC → `EndDialog` →
CACA0004 modal continuation → guest return → CACA0005 synchronous continuation.
The actual pinned preload/capture binding retained pre-arm context and stopped
the native execution durably at first zero. This replaces the scripted fragment
gap for this deliberately constructed callback, not for the original game.

The executable is adjacent **`fixture.cjs`**, driven by **`run-fixture.py`**.
`verify-native.py` validates the retained execution without rerunning it;
**`native-results.json`** is the machine-readable result.

```text
# cwd /home/user/wine-assembly-shadow-man-memory-recovered-handler-qualification-oct23
/usr/bin/python3 -B docs/re-notes/shadow-man-memory-recovered-handler-qualification-20261023/run-fixture.py normal
/usr/bin/python3 -B docs/re-notes/shadow-man-memory-recovered-handler-qualification-20261023/run-fixture.py capture
/usr/bin/python3 -B docs/re-notes/shadow-man-memory-recovered-handler-qualification-20261023/run-fixture.py wrong-command
```

The actual child argv for each was:

```text
/usr/local/bin/node --max-old-space-size=512 /home/user/wine-assembly-shadow-man-memory-recovered-handler-qualification-oct23/docs/re-notes/shadow-man-memory-recovered-handler-qualification-20261023/fixture.cjs CASE
```

These are one-shot evidence destinations: existing admission/output files refuse
overwrite. For an authorized fresh reproduction, materialize only `fixture.cjs`,
`run-fixture.py`, `guard.py`, `accepted-contract.json` and `api-ids.json` into a
fresh matching report/evidence directory, retain the absolute standing inputs,
and rerun admission. Do not run build commands or overwrite these receipts.

| Case | Native PID | Child exit | Elapsed | Observed result |
|---|---:|---:|---:|---|
| Normal, no hook | 1989221 | 0 | 0.0534 s | Actual modal result 0x77, full saved register restoration, sync depth 0, diagnostic count 0 |
| Selected capture | 1989364 | 86 | 0.1162 s | Actual preload terminal `first-zero`; five sealed native observation records |
| Wrong selected command | 1990236 | 0 | 0.0642 s | Expected adapter rejection `wrong or late selected action/HWND`, before arm/send; registers and marker unchanged |

The negative wrapper exits0 only after asserting the expected rejection. The
actual preload also emits its required **missing terminal capture** exit record
for that case; it is not a successful capture. Each group's raw command,
admission and terminal receipt, with `remaining: []`, is retained. Native cases
ran sequentially and every group was completely reaped before the next began.

The positive record order is exactly:

```text
pre-arm receipt (fsync completed before arm/native send)
sender-pre           saved EIP 0x404100, saved ESP 0x740f000, depth 1, count 1
decoded-block        real x86 callback at 0x4015d4
modal-frame-consume  actual CACA0004; ended dialog 65537, count 2
modal-frame-complete return 0x4015f2, ESP advances 24, EAX 0x77, count 3
first-zero           actual CACA0005 return; EIP 0, caller ESP, count 4
terminal             reason first-zero, exit 86
```

The child/root invocation tokens remain3/2 throughout those boundary records.
The decoded stack contains the actual CACA0005 thunk return and all four
WndProc arguments `{hwnd:0x550,msg:0x111,wParam:3,lParam:0}`. The record's code
bytes match the hand-encoded guest callback. The modal frame restores the
previous empty pump, returns the real EndDialog result, and the guest stores that
result before its stdcall return. No `sender-before-restore` is expected in the
capture case: its fail-stop happens inside nested `run`, before sender restore.
The normal case demonstrates the subsequent normal restoration with diagnostics
OFF. All envelope SHA256 seals, stack offsets, frame transitions, token/root
continuity, PID, actual module identity and terminal semantics passed verification.

The fixed selected action is sequence1/command3, resolved at batch50 to a
synthetic renderer dialog record for0x550 through the **exact whole shipping
`dlg-cmd` branch**. The branch is extracted from the pinned runner with only its
outer `else if` converted to the first `if` in a one-iteration fixture loop.
Its retained transformed SHA256 is
`a231512463281994fd1ebe646dba0a62d325000c35d304344b8b70a89e1fd4c5`.
There is no scripted sender, translator, allocator, callback executor or `run`.
The HWND registration and small x86 program/template/thunk descriptors are
deliberate guest fixture inputs. Actual WAT initializes the heap/thread,
invocation ownership, window registration, translation, cache and interpreter.
All placements come from accepted ABI inventory; none is guessed from main.

The actual preload executes in this fixture process, verifies the pinned runner
realpath/hash, PID and explicit module path/hash, binds exactly one Module and
Instance, installs the supported selected-send hook, and remains OFF until the
branch invokes it. The fixture sets `process.argv` to the validated runner path
to exercise that contract; it **does not launch the full runner CLI**. Both
fixture identity and this extracted-runner identity are recorded, rather than
claiming this is a game runner session. Existing accepted selection/binding/OFF/
one-shot controls are reused, not replayed broadly. The actual `fsyncSync` call
is observed after completion, without replacing the retained bytes or suppressing
fsync. Its seven completed writes correspond to the pre-arm receipt, five sealed
records and terminal. Source ordering plus the first sender event/count1 binds
the retained prior count0 to arm-before-send. No export is replaced or proxied.

The headless host facade supplies notifications, a bounded100×80 window rect,
clock queries, no-pending-DLL service response and beep process/thread lifetime
acknowledgements. Every unimplemented import throws with its accepted signature
and arguments. A genuine pending DLL load is explicitly rejected, not serviced
by a dummy success. No audio request, actual renderer, browser, installed game,
codec or source compiler runs. This facade is sufficient for this hidden,
zero-control indirect dialog, not a general Win32 host implementation.

Exact inputs and retained evidence:

| Input | Identity |
|---|---|
| Source candidate | b41a7c5f4b752d1f0bdab1141a11d4fed4dc6f9a |
| Source acceptance | 4dab22cfefb7b7048fbb6189b81cdccdd4ab8753 |
| Independent static acceptance reused | cf5612a1482cbfead91450b679a58b18958f53dc |
| Primary wasm, used in place | 1879746 B, SHA256 8fac39936b6df2418ad86cab118cef19a65a727f649fbc14c412b37818904686 |
| Unchanged <=8MiB entry guard | SHA256 47ce2e2b835be33eab6b2b24f027ecaab8ceb61c559890e51548c78199beb197 |
| Actual runner | SHA256 4d7b9587676db38fcf3314807acb2b2a42b5f09d2c98fcf3dccb8a6cde9e1809 |
| Actual preload | SHA256 78dcac659f82f4c93325d126d072d006e0c6995bac53f9a182431a956eb8e42b |
| Actual capture adapter | SHA256 3440377e102575906809bb36a1ba10c291a00f87ae63f05dac5ae24394529cea |

`accepted-contract.json` retains all291 imports,2227 function exports,172 types,
shared8192..32768/noStart, exact layout payload9a3bc9149d58209c, all269 inventory
records and source/blob/hash paths. The prior24 and accepted38 seals/static
findings are reused; no static inspector acceptance, compiler/schema control,
gate, decoder, guard control, packaging acceptance or build was repeated.
The two API IDs2875/131 come from the exact candidate's API table read through
the direct standing object store, not current-main sources. Compat is unused.
No retained module bytes were rewritten or copied. Immediately before native
Module entry, the full primary hash and length were checked again. The fixture's
`WebAssembly.compile` routes through the unchanged guarded Module constructor;
the actual preload's compile/instantiate binding then applies to that Module.
No implicit compiler helper or default-source fallback is reachable.

Fresh recovery evidence records three passing samples over40.00095s, minimum
3,372,908,544 B. The fresh consolidated native admission measured
**3,832,561,664 B >=1,610,612,736 B**, projected materialization
**39,405,342 /67,108,864 B**, host after projection5,422,053,602 B above the
2,982,150,144 B floor. Per-case admission records fresh memory, complete measured
tree/privateGit/index/newobjects, external launcher/events/stderr and separately
measured session, future growth and8MiB reserve **inside** the cap. Installed
Node24.18.1/V8 13.6.233.17 and Python/Git execute in place, with separate hashes
and standing footprints. Core dependencies load; optional pngjs/skia-canvas/
canvas are unavailable and unnecessary for this extracted-boundary fixture.
Full CLI dependency closure is not claimed. `launch-identity.json` retains the
coordinator's actual gpt-6.1-sol medium/200000 TOTAL session argv.

Each native child has oldspace512MiB, CPU/wall150s, one fixed536870912-byte shared
arena (8192 initial=maximum pages), no Workers or concurrent native children.
The supervisor retains regular-file24MiB, aggregate captured stdout+stderr512KiB,
failclosed125, TERM then5sKILL, subreaper and full reap. All successful native
children emitted zero stdout/stderr. Initial readiness Python was invoked
directly by the shell tool; its Node probe and subsequent check/publication
children used the retained supervisor. This is not a claim that every metadata
setup command itself ran under that supervisor.

Failures and corrections remain visible. The initial API-table command wrongly
sent the whole source blob to stdout: the guard rejected aggregate overflow125,
reaped its process, and retained only the bounded prefix. **It was not retried.**
The two needed records were recovered from that already retained prefix. The
task capture budget remains saturated; later supervised children have zero room,
and any child output still causes denial. `guard.py` corrects only its strict
`used < cap` precondition to `used <= cap`, allowing a zero-output operation at
the exact boundary without increasing the cap or resetting counters. Git
publication data is retained separately inside its supervised structured command.

Four short initial normal runs failed closed on missing headless contracts:
beep lifetime begin, window rectangle, invalidate notification, and the shipping
sender's eagerly evaluated no-pending-DLL probe. Each was reaped; each correction
was restricted to this fixture and preserved all diagnostics/rejection rules.
Their original command/admission/observation/terminal receipts remain under
`normal-*-failure.*`. A verifier initially expected the negative receipt to be
the last observation; actual preload exit fsync comes afterward. The failure and
corrected phase/order assertion are retained. No unchanged native case was
repeated after passing; the verifier correction replayed evidence only.

All changes are additions under this report and adjacent evidence. Private Git/
index uses one direct standing object store `/home/user/wine-assembly/.git/objects`,
base594537144f3e153a338c5f7861cf87c9c183fece. Strict read-only remote reconciliation
observed that main; it was not used as diagnostic source. Final remote task SHA
and measurements are in external `publication.json` and the messageboard. No
donor mutation, shared ref/index/main mutation, merge, deployment, source build,
worker launch or replacement work occurred. RichEdit, integrated POSITIONT,
Claude B&W2 helpers/runtime and laptop ownership are untouched.

Box ID/state/expiry **N/A**. No Boat/browser/media/game/box action occurred.
Coordinator retains lifecycle ownership; last Codex boxbx_fn7pn7yg remains
coordinator-reported STOPPED03:03:34, not probed here. Every recorded child group
is reaped; board watcher is terminated/joined for handoff with external receipt.

Ordinary CACA0005 zero remains **ordinary-or-unknown; zero-writer unproven**.
No proven null instruction, zero writer, persistence, reopen, Play, UI or gameplay
claim follows. The original-game capture still needs its own authorized runtime,
complete game inputs and an observed fresh action/UI route in the actual runner,
with matching PID/module/instance, selected intent, block policy and watchdog.
This worker stops after publishing this bounded qualification; the coordinator
owns follow-up.
