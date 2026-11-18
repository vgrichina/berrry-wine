# NFS3 rendered Continue/Quit and driving, 2026-11-18

The CLI frame-routing defect is fixed and published as `70062e2eb`.
The authored rendered Pause/Continue/ordinary-Quit workflow passes. The one
original reached a rendered race and consumed all four tested native key-downs,
but the intended driving/steering and Pause effects were not demonstrated.
Original Continue and ordinary Quit remain unverified; the owned run is closed.

Evidence: `scratch/runs/20261118-nfs3-rendered-continue-quit-driving/`.

## Measured frame-routing defect

The unchanged one-draw Device2 RGB565/D16 fixture initially displayed only its
grey GDI canvas. A readback found 605 presents rejected, no accepted presents,
and no window GPU layer. A separate passive diagnostic recorded eight frames
whose HWND, native RT, exact present sequence, CPU stamp and exports all matched.
The renderer window lacked `processId`, while its host context owned process
1000. The CLI's `create_window` override omitted the process/lifetime metadata
that the shared host-window implementation publishes. The exact D3DIM process
ownership check therefore correctly rejected those frames.

The fix publishes `ctx.processId` and `ctx.windowLookupLifetime` when the CLI
creates its native renderer window. Frame admission, native input confirmation,
deadlines, application polling, viewport and pixels are unchanged. The candidate
uses the pinned `0888e0e4c` inventory plus the exact retained CLI patch; its
source hash equals the committed CLI file. It accepted 479/479 presents and
displayed the fixture's blue upper-left quarter against white. This is a native
fixture pattern, not an original-game frame.

The focused GPU Flip suite and async execution suite pass. The latter retained
equal pixels, sequence 73 and arena tail 12292: local event turn 1417.17 ms,
async owner 4.02 ms. The locked canonical build passed. Commit `70062e2eb`
was immediately strictly pulled and pushed. Its `src/` and `lib/` are identical
to the retained module's source base; module
`7d347a6a631ab77335a14935a533feb896be71aa2508fc5aa19b1e5df8f096ce`
is reused. Loader `0888e0e4c` startup/lifecycle and async-owner `9191d4afb`
equivalence proofs are reused without broad qualification.

## Actual manual gate

All whole frames were inspected in completed image calls before their following
input calls. Published `fixture-final` showed the known rendered pattern,
native PAUSED caption, then the restored pattern after Continue. Native USER
consumption took Pause 57 ms, Continue 74 ms, Quit 96 ms; host application took
35/70/71 ms. Confirmation deadlines stayed 800 ms. Independently armed release
helpers all acknowledged release and actually waited zero with both pipe EOFs.
Quit release was scheduled at 400 ms within the unchanged 800 ms input deadline.

The authored Q action now exits on native Q-up after Q-down. It does not assume
that guest Sleep(1200) lasts 1200 host milliseconds. The original Q-down fixture
exited before its independent release; a subsequent Q-up fixture raced automatic
deadline cleanup with the independent request. Those failed release receipts
remain explicit and excluded from the complete gate. No endpoint was reused
after closure. The final Q-up scope exited zero without host termination,
with actual supervisor/watchdog waits, separate EOFs and `leaked:false`.
Directional inputs reuse the published predecessor's accepted native cases.

The first current fixture received supervisor SIGTERM after about 35 seconds,
with no disk-floor/watchdog trigger. Its signal sender is unknown; the ensuing
ECONNREFUSED closed that scope permanently. It is separate from the predecessor's
disk stop and the earlier 32-draw slow application polling UNKNOWN. No old
scope was reopened and no scope was extended.

## Original and cleanup

Exactly one registered `nfs3_chosen_renderer` run
was launched after `fixture-final/PASS.json`, using published source, the
supported software/cooperative `--d3dim-render-owner` route, the unchanged
genuine chooser and all 135 media pins. No media was copied.

Whole reviewed images show the original loading screens, Corvette cockpit,
road/traffic, countdown and active race HUD. The ordinary D3DIM bridge accepted
all 572 presents; the guest issued 44,696 draws. These counters are not FPS or
playability claims. There were no renderer fallbacks or CPU readbacks.

After the countdown disappeared, the first reviewed race frame showed 0 MPH
and race time 0:00.62. The bounded Up edge returned native USER consumption
on thread 2/HWND 0x18001 in 258 ms, following host application at 198 ms.
The next reviewed frame showed 0 MPH and RPM 1.0 instead of 0.9. This does not
demonstrate sustained acceleration or establish the current transmission/bindings.

Escape then returned native consumption in 87 ms (host application 79 ms).
Both its immediate and a separately reviewed later whole frame still show the
running road and advancing race clock, not the Pause menu. Later 1 MPH is not
attributed to the preceding Up. Left and Right were separately reviewed,
consumed in 123/164 ms (host application 118/146 ms), and independently released.
The resulting whole frames do not demonstrate an attributable steering effect.
All four original release helpers acknowledged and actually waited zero with
separate stdout/stderr EOFs. Every confirmation deadline remained 800 ms.

These are host application and native USER-return measurements. Actual
application control/DirectInput poll intervals were not measured. A native
message receipt is not evidence that the game acted on that message. The
concrete blocker is the reviewed failure to reach Pause or demonstrate the
intended controls through this bounded workflow; its deeper cause is unknown.
No repeated Escape, unreviewed Continue/Quit target, longer deadline, forced
viewport, replay or second original was used.

The worker requested SIGTERM on its exact owned native supervisor after these
observations. This is cleanup, not ordinary game Quit. The guest and supervisor
waited zero; supervisor records its SIGTERM, both EOFs and `leaked:false`.
The independent finite/disk watchdog also actually waited zero with both EOFs.
The run used 320.25 seconds of batch-loop wall time; the finite scope was never
extended. Final cleanup verifies every known owned runtime/release-helper PID
is nonlive and the listeners are absent. The advisory board watcher returned
143; its signal sender is unknown.

No box was created: ID null, state NOT_CREATED, expiry null, stop receipt null.
No agents/workers, Wine, Python, media copies, source archives, frame archives,
capture bundles, deployment or foreign-file cleanup were used. Relevant Git
patches, unique inputs, module recovery recipe, selected named whole PNGs,
actual waits and media readbacks are retained. `result.json` is written last.
