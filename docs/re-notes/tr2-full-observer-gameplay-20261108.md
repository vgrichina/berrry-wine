# TR2 full observer trials and live admission repair — 2026-11-08

The watched original reached textured Venice through native Graphics default-OK
Enter. Its first publication-arm request exposed a new integration blocker:
`writer observation requires an idle live GuestThreadHost`. The running scheduler
had an unanswered guest command. This task repairs that admission boundary with
an actual browser regression and a passing locked build. No second original or
input replay was used. Movement, weapon consequence and qualified publication
on the original remain unproved by this run.

Evidence is in `scratch/runs/20261108-tr2-full-observer-gameplay/`. The original
and matched cost trials use published main
`35442d3d47d46a82a3c17499382a705177bb541f`, which includes `88e276f31` and
`f50c6d32e`. The original's 596 input pins match before runtime and after drain;
peer WIP is excluded. Both actual guest and render Workers run recovered module
SHA-256 `6cf120d0d3b3db1823a8105eb26ef52a9093a7f871c37a46117475e213fda1c0`.
The subsequent locked build produces that same module. This is a host-only
repair, not a change to the interpreter or game.

## Matched raw fixture costs before the original

Nine fresh Chrome processes, each with its own PID and UUID, run three groups
of baseline/unarmed/armed trials, reversing order in the middle group. No retired
Join is rearmed. Each process executes 40 ordinary native queued flips/fences,
640×480 canonical conversion and actual canvas publication, through shipped
guest/render Workers. The common full-source fixture module only adds test
exports; no original is used for these measurements. Baseline serves the whole
pre-Join JavaScript closure from Git `279ede77e`; unarmed and armed serve the
published current closure. All ordinary pixel assertions pass.

`g0-*`, `g1-*`, `g2-*` and `cost-summary.json` retain all 360 raw timing trials.
Publication timing includes the native command, source finalization, journal
encoding/decoding, canonical conversion and composition. Diagnostic observer
read/transport time is recorded separately, along with arm and final snapshot
cost. These fixture timings do not measure gameplay, simulation identity or an
external production sampler. They are not an estimate of game FPS or a stable
causal overhead bound across the two source revisions.

| Group | Baseline median ms | Unarmed median ms | Armed median ms | Armed qualified / discarded |
| --- | ---: | ---: | ---: | ---: |
| 0 | 7.305 | 2.5575 | 6.2425 | 40 / 0 |
| 1 | 2.8325 | 2.5300 | 5.2750 | 37 / 3 |
| 2 | 2.0175 | 3.0725 | 3.4025 | 39 / 1 |

The 120 armed raw versions equal 116 qualified rows plus four
`uncovered-publication-writer` ledger entries, with exact one-to-one identities.
No outlier or disposition is removed. The earlier armed pilot independently has
40 raw versions, 38 rows and two such discards. The first baseline pilot's
missing `producerObservation` API failure is retained: the pre-Join endpoint
has no diagnostic API. The harness now makes that read optional for baseline;
all three corrected baseline processes pass. No emulator gate changed for it.
Every cost browser exits 0, all recorded Chrome PIDs are absent, and all owning
Workers retire with heap adoption. Full end-to-end observer impact in a living
game remains open, including the new scheduler admission seam.

## One watched original and the first new failure

The production route is unchanged:
`index.html?debug&threads&app=tomb_raider_2_demo&gl-renderer=webgl&d3d-renderer=webgl`.
Media is referenced by existing path, size and SHA-256 in `media-refs.json` and
`runtime-pins.json`; it is not copied into evidence.

Personally reviewed `review/webgl/graphics-fresh.png` shows native Graphics,
Hardware 3D Acceleration, Full Screen 640×480 High Color and the default OK
outline. SHA-256:
`f395730ae57accca07f3a89c6965b28a25b0d96cf5c2ed2792ee92c069cecddf`.
Trusted Enter 100 ms is admitted at age 6419 ms, inside the unchanged 12000 ms
guard, with an independent release and exact successful ACK.
`review/webgl/venice-native-ok.png`, captured 09:05:26.991 UTC, visibly shows
Lara standing in the textured passage below the slope and lattice window.
SHA-256: `31eb12b87decb56234225deec4d6f4db8fea5f956dfab8a5ba4194139dd4379d`.

The actual render target is `BE33A79EFC287925276DCE1C4EAC1309`, endpoint 1,
legacy/WebGL; guest target is `819A137308264AE16AA34368A95A8D62`, endpoint 1,
slot 0. The owning Worker observes WebGL 2.0 on ANGLE Intel UHD Graphics 620 / Mesa
23.2.1. Its ready/error values are 1/0, failed is null, and software draw
completions are zero. These are ownership/backend observations, not frame rates.

At 09:05:34.463 UTC the single diagnostic arm request fails on the pending
GuestThreadHost command, before any Join exists. The first-fault transport
records and stack are preserved. Chrome closes normally, exit 0, at
09:05:34.826 UTC. No Up, Left, Space or Control reaches this original. No empty
Join or missing publication is interpreted as zero FPS.

## Repair and regression

`WineAssembly.armD3dimPublicationObservation()` still reserves admission
synchronously. For a running host it now waits for the ordinary completed-step
`_scheduleStep` boundary instead of trying to attach during an unanswered
command. The wait is bounded, default 1000 ms, with a validated maximum of
5000 ms. The existing 20-second render-observation timeout remains in force.
The next scheduler continuation waits through the render acknowledgement.
Duplicate wakes coalesce, and the observation wait adds no fictitious step.

Guest, main instance, memory, process ID, thread manager, renderer, link and endpoint identities are
checked again before attaching and after acknowledgement. All existing idle,
writer, ambiguity, freshness, page, canonical, palette and lifetime gates remain.
A timeout before attachment leaves the outstanding command and coverage alone.
Failure releases the held continuation only for the same live owner; a stopped
or replaced owner cannot resume an obsolete continuation. No guest entry, input,
clock rebasing, scene, seed, configuration or restoration handler is introduced.
Retired Joins still cannot rearm. The callback census records this review while
leaving callback ownership pending.

`node test/test-d3dim-publication-live-arm-web.js` uses actual shipped guest and
render Workers, a genuinely outstanding native fence command, the installed
host method and installed scheduler continuation path. Against the published
host it reproduces the same immediate idle-GuestThreadHost refusal. Final code
passes bounded waiting without retroactive attachment, guest/memory/process-ID replacement,
stop, held real render acknowledgement and duplicate-wake controls. Exactly
one continuation then produces one raw source, one qualified exact
source/request/canonical/display row, no discard and all four ordinary red-17
pixels. Owning Workers retire, heap adoption succeeds, Chrome exits 0 and its
PID/profile are absent. Both before and after reports remain available.
An additional strengthening run failed its one-publication assertion before
that fixture revision saved the source snapshot. Its error and partial report
are retained, with the raw disposition explicitly UNKNOWN. The final fixture
waits for the diagnostic reader's writer contribution to close before composing
and snapshots dispositions before assertions and after retirement. The earlier
diagnostic-writer race is a possible explanation for that failure, not an
established source disposition. Production gates were not changed for it.

The final locked full build passes. Production consumed-version/display
association and direct command-handoff regressions pass, as do browser step
scheduling, Worker input wake, D3D render-wait scheduling, wave callback
scheduling and test-tier validation. The broader CLI main-scheduler observer
test has an unrelated `SyntaxError: Illegal break statement` in its extracted
source. Its test, runner, thread-manager and fixture inputs exactly match the
published baseline, where the failure reproduces; both logs and source hashes
are retained. The accepted concurrent-arm lifecycle and four-qualified/four-
discard production controls were reused, without a standalone repeat run.

## Recovery and shutdown

Git is the source archive. `source-sha.txt`, the original empty relevant binary
diff, `source-audit.json`, `repair.diff` and owned new-file patches identify the
source closure. Run inputs, unique logs, captures and recovered modules are
preserved without source/media archives. The 304 audited tracked runtime and
fixture/compiler inputs match the original published base except the owned
host repair. Untracked peer `lib/wininit-boot.js` is excluded.
All 183 successful served responses match their input pins, and all six retained
PNG files pass CRC and inflation checks. Five HTTP 404 responses for optional
build/auth/favicon/font-bundle endpoints are retained with their fallback path;
no successful response is unpinned. TR2 has no candidate-corpus entry, so the
run uses investigation metadata rather than inventing a dashboard attachment.

One UUID-idempotent box, **bx_73bgveew**, was created after local prerequisites
and observable detached normal/watchdog delegates were armed. Its immutable
deadline was **09:29:21.669 UTC**, initial expiry **09:29:21.845 UTC**. A final
drain proves controller and Chrome PIDs absent, both HTTP/CDP ports refusing,
profile/writer absent, no matching processes and all 596 input pins unchanged.
All **64 remote artifact references, 56 unique hashes**, were retrieved and
independently reread for size/SHA-256 before the normal stop request.

Final state: **archived**, active expiry **null**, stopped **09:06:15.740 UTC**.
Receipt **stop_d4584e774fa2ec7f** completed **09:06:15.757 UTC**, forced=false,
error=null. Both delegates and their supervisor exited. Heavy local runtimes
use `wine-runtime.lock`, builds use `wine-build.lock`, and independent external
timeouts bound browser regressions. Local disk stays above 5 GB. No old box,
public deployment or subworker is used.

This satisfies the requested substantive tested repair of the first new
blocker. Next is a separately authorized watched original using live boundary
admission, followed by reviewed bounded movement and documented weapon
consequence with exact publication joins. Full27, parity, audio, game FPS and
simulation FPS remain open.
