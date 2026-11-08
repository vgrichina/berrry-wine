# Recoil native HUD gate, 2026-11-08

Run: `scratch/runs/20261108-recoil-native-hud-gate/`.

This worker repairs the retained v2 compound driver in a new run directory.
The prior pinned v1, retained v2 and their raw failures are unchanged. The
power-control/forcefield/onward-access objective is not accepted by driver
qualification. The single original ended at a new dependency-packaging boundary before
Resume input. The substantive driver repair is locally qualified; the native
power-control objective remains unproved.

## Reproduced driver failures and repair

`baseline-regressions.json` reproduces two failures in the retained v2 bytes:
a synchronous HUD probe can delay the overall timer callback and admit a
gameplay DOWN after the absolute deadline; a delayed C DOWN acknowledgement
can extend the planned 80-ms C pulse beyond 1.1 seconds. These are harness
failures, not demonstrated emulator divergences.

The newly owned `compound-v2.cjs` checks the absolute deadline before each
gameplay DOWN and releases C on its own 80-ms timer, independently of its
acknowledgement. Arrow releases have their own timer and the overall
release/Escape remains independently armed before Resume. A gameplay DOWN
also requires the qualified image to remain at most 250 ms old. A delayed C
acknowledgement therefore cannot admit an ordinary action using expired HUD
evidence. Releases can follow a deadline; further gameplay DOWNs cannot.

`hudProbe` reads the full owner/module identity before and after the native
canvas image, saves its PNG and hash, and retains the 250-ms freshness check.
It first requires a nonliving pre-Resume image, rejecting an already visible
HUD as a cached-backdrop admission. It then requires two living HUD candidates
with distinct green timer-glyph masks. Hashing only the glyph mask prevents a
changing sky or cursor from impersonating timer progress. Repeated captures
of the same HUD cannot qualify. Missing health, unsupported dimensions, the
retained death capture and identity changes reject gameplay input. This is a
specific 640×480 Software HUD gate, not target recognition or a general
game-state oracle.

## Qualification and source identity

The selected published closure is
`49874a81c5ae180c20a15c6bb169d9041f028cae`, including protocol `663f1c139`
and the browser journal decoder repair. WAT sources are read from Git and
compiled in an in-memory VFS. Published bytes are served through the retained
Git provider; peer WIP is excluded from the selected runtime. Git SHA, binary
diff and new-input patches provide recovery; no source/media archive is made.

The real registration qualifies **106 manifest entries + EXE + manifest =
108 pins / 76,019,820 bytes**. Empty, missing, duplicate and wrong staged EXE
cases and the invalid zero-file report reject. All 113 HTTP dependency pins
pass. The unchanged bound-input, ordinary-keys, native-pointer and transport
control helpers match their retained SHA-256 values; their existing controls
are reused rather than claimed as new original-game evidence.

`repair-regression-final.log` covers twelve timing/failure cases, including
synchronous overdue probes, an overdue interval between two ordinary keys,
independent per-key releases, slow sampling, changed identity, stale images,
late/absent HUD and partial UNKNOWN. Recorded native image tests reject an
unchanged cached HUD and death; two distinct timer images qualify.

The full browser driver is tested separately from these helper tests. Its
generated fixture uses production renderer-input and an actual recovered
Worker module, displaying explicitly labeled retained menu/HUD images. This
does not launch Recoil or prove Recoil consumes an input. The first integrated
attempt's Chrome-exit/driver-exit assertion mistake and its captures are
retained, alongside the corrected final attempt. Browser normal exit and a
driver's expected failure are different facts.

## Original-game interpretation

Host dispatch times, actual native key consumption and first observed native
menu are separate observations. A first sampled HUD after Resume is an upper
bound on that visible transition, not an exact simulation-resumption time.
Generated fixture events cannot establish native Recoil C or movement
consumption. The prior loading display's 1.3 rocket-site text and historical
1.1 power-control brief still require an ordinary fresh briefing/map before
any mission-objective claim. Full27, parity, audio and simulation FPS remain
open.

## Integrated results and dependency repair

`final-integrated-qualification.json` records eleven full-driver cases:
delayed, absent, late, cached-after, cached-baseline, changed-owner, stale,
slow-1100-ms, partial UNKNOWN, per-key C and per-key arrow/overall timers.
Nine unchanged results were reused. A 50-ms timer-image fixture could change
between identity reads and correctly admitted no gameplay; only that fixture
interval was corrected to 400 ms for the two timer cases. Both raw failures
are retained. The delayed C acknowledgement case released C after 81 ms and
rejected the following arrow because its HUD evidence had expired. The
slow-probe case also demonstrates that host UP dispatch is not a native
release deadline when the browser event loop stalls.

`native-final-qualification.json` records the actual published Calculator
Edit → Copy route through the complete v2 driver and recovered production
module `6cf120d0d3b3db1823a8105eb26ef52a9093a7f871c37a46117475e213fda1c0`.
Its unsupported HUD admitted zero gameplay keys; independent Escape and
visible menu closure were checked. These local tests did **not** prove the
remote dependency closure: the original pin scanner followed relative
requires and missed the bare `pngjs` import. The local installation concealed
that omission. This qualification failure belongs to this worker.

After the original stopped, `browser-run-v3.cjs` was created separately; the
actual original v2 bytes and inventory remain unchanged. V3 eagerly loads the
HUD decoder before creating a browser. `prepare-dependency-repair.cjs` pins
23 reachable pngjs 7.0.0 files (63,864 bytes), checks every installed byte
against the lockfile's SHA-512-verified npm artifact in memory, and writes a
755-file repaired runtime manifest. No npm archive or package tree is copied
to evidence. `dependency-closure.json` retains the package URL, integrity,
archive hash and dependency edges for recovery. The repaired stage byte check
passes all 755 pins against the same selected published closure.

`hermetic-modules.cjs` refuses resolution of any unstaged nonbuiltin module.
The missing-dependency full-entry regression exits before creating browser
output; the good full integrated delayed-HUD case passes with that loader,
including trusted input consumption in the generated fixture, independent
releases and clean Chrome exit. The unchanged native route and eleven timing
controls above are reused; they are not relabeled as new original evidence.
The separate provisioning reference supports npm pins, but deliberately
refuses execution in this completed task. No second box was allocated.

## Single original: observations and stopping boundary

The one UUID-idempotent original was `bx_qfgwy3ra`, created at 08:35:46.821Z.
It used the selected 730-file closure, independently checked in the remote
runtime, and the actual recovered module hash above. A detached observable
25-minute watchdog was armed before allocation, with deadline 09:00:47Z;
initial box expiry was 09:01:46.835Z.

Fresh pixels established Software mode, default name `user`, Medium, ordinary
native Start/New Game, the loading sequence and a living tank with health 100
and timer 00:00:04 (`opening-camera.png`). Ordinary loading/briefing frames
showed “1.2 Missile Control” with SAM-site text/map and “1.4 Go to Landing
Site.” This demonstrates cycling subobjective text; it does not resolve the
historical 1.1 power-control brief versus 1.3 rocket-site display. No mission
objective is accepted.

Command 25 dispatched and independently released Escape; `native-pause.png`
first visibly establishes the native pause menu. Command 26 produced the
fresh highlighted Resume image. Command 27 attempted the first HUD-gated
compound action but failed while requiring pngjs in its **pre-Resume baseline
probe**. Its error is `Cannot find module 'pngjs'`; no Resume, C or arrow was
sent by that compound. Admission had already marked possible dispatch, so
transport conservatively became sticky UNKNOWN with no exact command ACK.
The browser closed normally, and there was no retry, death/restart sequence,
fire, targeted defense, private guest call, state/clock edit or hotpatch.

Commands 0–26 have exact ACKs, including command 9's stale-review refusal
before effects and a fresh review afterward. Command 27 is UNKNOWN; it must
not be recast as an acknowledged zero-effect action. Source ordering supports
the pre-input failure, while the transport record remains ambiguous by design.
No native HUD-gate-before-C, C consumption, ordinary movement consumption,
control identification, forcefield change or onward access was proved. The
last sampled health is not a final-state claim. A read-only presentation
check found the logical canvas and exclusive source identical; the earlier
OffscreenCanvas inspection error is retained and does not establish an
emulator divergence.

The terminal collector verified 15 process IDs absent, HTTP/CDP ports closed,
profile/writer gone and last observed buttons/arrows released. All **323
unique remote artifacts / 25,728,292 bytes** were retrieved and independently
rehashed before requesting normal shutdown. `terminal-retrieval-verification.json`
and `final-stop-receipt.json` retain the checks and lifecycle. The box became
**archived at 08:50:52.535Z**, final expiry **null**; stop receipt
`stop_48ae8d97f58840d0` completed at 08:50:52.558Z, forced false, error null.
Normal and watchdog supervisors exited cleanly. No old box was resumed or
deleted.

The new concrete boundary is dependency qualification on an isolated runtime,
not the former early-Resume delay. A future separately authorized original
must use the repaired closure and hermetic loader, then establish the native
HUD gate before C and ordinary action consumption plus independent UP and
visible MENU closure. Fresh ordinary briefing/map evidence must resolve 1.1
before approaching a reviewed ramp/control. No production emulator edit was
justified, and no production build or public deployment is claimed here.
