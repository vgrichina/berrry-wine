# GLTron completed-ticket readback lifetime, 2026-11-14

Evidence lives in `scratch/runs/20261114-gltron-ticket-readback-lifetime/`.
The earlier `a918f0b6` original is permanently closed. Its final evidence records
a post-ticket held-paint readiness exception, **not the ticket status**. That
status remains UNKNOWN. No predecessor was reopened, retried or relabelled.

## Source lifetime and bounded repair

`Win98Renderer.requestImmutableCapture` retains status, result and error in a
closure. Only pending requests can complete, fail or cancel. Completion retains
copied source/output arrays and frozen metadata, including frozen composition
and viewport descriptions. `read()` returns new array copies; it does not read
the live canvas. `cancel()` on a completed ticket returns false. Ordinary repaint
replaces the current display record without changing a completed ticket.

`requestCurrentDisplayCapture` still refuses an executing writer at request time.
It completes synchronously for a validated complete idle display, or remains
pending until ordinary scheduled publication validates and copies the display.
The copy checks owner selection, complete output and the same display record
before completing. There is no lifetime proof for a pending ticket's pixels.

The helper now distinguishes these states before running paint readiness:

- Complete: read the immutable copied pixels with their original publication,
  displayed/request/readback timestamps. A newer paint does not require another
  publication or make the earlier bytes a failed ticket. Current owner, output,
  window membership/geometry and full visibility must still match.
- Pending: retain the live readiness guard and wait only within the original
  three-second transaction. It cannot be treated as complete.
- Failed, cancelled or UNKNOWN: terminate without another request or replay.

Every arm, poll and final cancellation observation records the exact status and
wall timestamp. Complete observations include the unchanged metadata and display
and readback ages. A transport UNKNOWN preserves the last observed status as a
separate historical observation; it does not guess the unobserved current state.
Failure evidence includes the final observation and capture nonce. Pending
cancellation records both pre-cancel status and post-cancel status.

Reading pixels grants no input privilege. Personal review, nonce consumption,
permanent identity, current visibility and five-second play/thirty-second menu
freshness remain required. Current unheld display readiness is checked at input
admission and again after independent UP prearm, before DOWN. Identity validation
and later paint never refresh the scene's observation time. The 1,500 ms finite
gesture bound, independent 1,750 ms UP, irreversible 180-second Quit reserve,
three-second CDP deadline and late-response terminal behavior remain.

Host, index and renderer/runtime source remain read-only. The helper schedules
no damage, rendering, publication, hold release, clock write or guest command.

## Validation and sole original

Code `5bec44a883de5d6beeaa4c4ce8d5c55a82e7ed87` is published on main.
`chrome-v3/report.json` passes the production Chrome causal comparison against
exact `a918f0b6`: each helper receives one production ticket after ordinary
publication, with status explicitly observed **complete**, then a normal Worker
begin arrives before controller read. The baseline refuses the newer hold.
The candidate reads the original bytes during that hold. Their decoded pixel
hash matches the retained ticket, metadata is unchanged, and both remain intact
after later ordinary publication. Mutating a returned array copy cannot change
the next read. The candidate never requests another publication or ticket.

The same run observes a genuinely pending ticket before its ordinary completion,
an actual failed production ticket, actual cancellation, complete-ticket owner
replacement and output-size replacement. A three-second CDP UNKNOWN after an
observed complete arm remains terminal after its late reply; current status is
explicitly UNKNOWN, with the prior complete observation retained separately.
Overlay, modal, popover, fullscreen, occlusion, replacement, startup expiry,
nonces/no replay and independent UP controls remain covered.

Two failed development controls remain with logs and actual waits/EOFs. V1
missed the host fullscreen control's thirty-second personal-review window. V2
passed that control but incorrectly tried to validate a synthetic Worker after
the fixture had already retired it. V3 correctly tests the ticket helper against
the remaining idle output; it invents no replacement Worker. Selected images
alone remain, with pruned image hashes recorded.

Focused policy/loopback/actual-child tests pass, all twenty checks in five
renderer test files pass, the full locked build passes in 45.126 seconds, and
actual native-CDP trusted key/mouse controls pass, including finite 1,500 ms
gestures and independent 1,750 ms UP. Publication and remote-main verification
completed before the original. There was no runtime source change.

Thread-sentinel's published SOURCE_READY/explicit no-original release and
SkiFree's actual native/watchdog/supervisor-child waits, both EOFs, released heavy
lock and absent exact processes satisfied the coordinator's queue. No fourth
ancillary wrapper gate was imposed. Historical ancillary UNKNOWNs stay UNKNOWN.

The **one** fresh original used default 1,000-step slices, real clock, the exact
92 existing media files, a 600-second launch bound and prearmed independent
620-second watchdog. `original/host-bootstrap.png` was personally reviewed
before one ordinary trusted host fullscreen click. `original/startup.png` was
then personally reviewed: complete native GLTron title, yellow/blue cycles,
GAME selected above VIDEO/AUDIO/QUIT, with no host overlay. One permanent owner
binding was admitted from initialized actual WebGL evidence.

The original itself confirms the repaired lifetime boundary. Its sole ticket
completed at publication 18, then was read while **held:true**:

| Event | UTC |
| --- | --- |
| Original displayed/publication time | 22:53:11.158 |
| Request | 22:53:11.375 |
| Readback start | 22:53:11.376 |
| Readback completion | 22:53:11.534 |
| Controller poll: complete, later paint held | 22:53:11.564 |
| Cleanup: complete, cancel false | 22:53:11.790 |

Display/readback ages at that held poll were 406/30 ms; cleanup retained the
same timestamps and ages grew to 632/256 ms. It was never a failed ticket.

The manually requested finite Return subsequently hit the **added live input
paint gate**, which refused held/in-flight paint at 22:53:29.131 before DOWN
and before independent-release prearm. This is a stricter input-admission limit
introduced by this change, separate from the corrected ticket lifetime. The
capture succeeded; input did not. The raw failure's ticket field is null because
it is an input failure. `original-failure-ticket-status.json` explicitly links
it to the already-recorded immutable complete ticket and preserves that raw
failure. No status was repolled after refusal and no second ticket was issued.

The chain closed permanently. No Return reached the guest, round started,
human cycle was identified, corner was proved or natural result was observed.
`original/first-failure.png` is a personally reviewed diagnostic of the same
title/menu, never a new input admission. Native Quit is **unproved**; browser
close was host teardown. The published causal capture repair is proved; the
requested gameplay/native-Quit route is partial because input readiness refused.

Native controller exit 1, Chrome exit 0, watchdog exit 0 (unfired), supervisor
child exit 0 and outer caller exit 0 all have actual waits and both EOFs. Outer
zero means custody completed. The native wait was 70.993 seconds after launch.
All exact processes are absent, HTTP is closed, the profile is removed and the
heavy lock is released. All 677 source/input pins, all 92 media hashes and seven
read-only runtime hashes matched before release to Golf. Git plus relevant
binary patches preserve source; no source/media/WASM copies were made.

Box ID and expiry are null, state is NOT_CREATED, stop receipt is N/A. No box,
worker, deployment, full-27, FPS, audio, parity, physical-GPU or human-win claim
is made. This bounded task stops with the original closed and the runtime
already released to the next queued worker.
