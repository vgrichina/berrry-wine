# SuperTux: native paused review and first-life progress, 2026-11-08

The native review/reaction gap is resolved for this scoped driver. The level
was **not cleared** and the next map node remains locked. One original attempt
ended after its first death, rather than repeating live review deaths.

Evidence: `scratch/runs/20261108-supertux-native-pause-progress/`.
No emulator, game, registry, configuration, clock or scheduler repair was made.

The tested runtime source is main
`eaf62236c594a029ca47bef32df963f708e83f15`. Its 1,383 pinned runtime inputs,
relevant tracked/untracked patches, owned harness patches and media references
provide recovery without source/media archives. The actual executing Worker
module was recovered and matched
`f9650607181301b5d2a9990420f437bd9f1ca10d40ac73067339f07499d53121`.
The original 787-file fixture, authentic CRT and 786 manifest mappings passed
the filesystem verifier. Existing media paths and SHA-256 references are retained.

## Narrow native composition

The owned `native-pause.cjs` reuses the released `input.cjs` independently armed
UP pulse and `bound-input.cjs` admission. A reviewed paused boundary sends
Escape DOWN/UP to resume, the bounded action DOWN/reverse UP, then Escape
DOWN/UP to pause. A live initial boundary omits resume explicitly. No future
DOWN is timer-scheduled. Cancellation or UNKNOWN allows the already-armed
release but closes subsequent actions, including Pause; no replay follows.

Synthetic tests and corrected local controls on actual production guest/render
Workers passed. Trusted Chromium event logs establish exact Escape and
Right+Space, Right+LeftControl+Space, Left+Space composition ordering. Controls
include independently released pending/rejected acknowledgements, invalid and
stale zero-effect admission, exact owner identity fields, actual generated
wrapper replacement, executing-module refusal, and no delayed actions after
closure. Generated controls never assert original game Pause semantics.

The first local closure test failed because its cancellation timer fired during
identity admission, before native DOWN. Its zero-event result and clean close
are retained. The corrected test starts cancellation after actual Escape DOWN;
only its independent UP occurs, with no later action or Pause. The fresh corrected
browser passed and closed before original allocation.

Original `initial-action-pause.png` and `pause-freeze.png` visibly show the real
**Pause / Continue / Options / Abort Level** menu. The timer stays **288** from
05:14:14.676Z to 05:14:25.717Z, while owning production Worker slice sequence
advances **22,269 → 23,325**. The actual canvas reports
`CanvasRenderingContext2D`, with its process/Worker/module/canvas identity bound
to these captures. This is native game pause, with ordinary host execution.
Subsequent actions visibly return to Pause; timer decrements only across active
sequences. Menu animation remains visible during paused review.

## Original progress and remaining obstacle

Ordinary Start Game → Slot 1 Free → story → map → first red node entered
**Welcome to Antarctica** with four lives, score 100 and four coins. Space jump,
cursor movement and LeftControl run remain the documented native controls.

Reviewed first-life progress includes both opening block rows, snow pillars,
the raised and tall ice platforms, three-pillar sections, wooden platforms over
the first pit, the long ice surface and stairs, the bomb section, multiple wide
ice gaps, and the high ledge drop. Coin/block changes and two visible flattened
enemies with floating 50-point awards are preserved. At
`flying-enemy-pass.png`, score is **675**, coins **23**, lives **four**.

The next 600 ms action, `coin-enemies-cross`, began with Tux airborne after a
stomp, with two ground enemies ahead. Its resulting Pause capture shows the
native death pose and **three lives**, score **750**, coins **26**, timer **260**.
This death occurred during the bounded active action, not during a live review
gap. Airborne-to-ground timing near those two enemies remains the concrete
control obstacle. Reviewed `death-boundary.png` retains the descent near the
first ground enemy at **05:29:17.309Z** and the death pose at
**05:29:17.554Z**, before the composition's Pause DOWN at **05:29:17.720Z**.
The action's intended jump is not proof that a grounded jump occurred.

No second life was played or joined to the first. Native Pause → Options →
Abort Level returned to the map; `map-final.png` and `next-node-check.png`
show **Welcome to Antarctica**, the first and following nodes still red, and
three lives. Down did not move Tux to the next node. There was no native exit,
result screen, unlock or respawn-progress claim.

Immediate captures occasionally lose the upper canvas during layout changes.
Fresh full captures while paused restore HUD/geometry; no live wait is used to
review those images. Two passive segments retain the action/death chronology.
The final ledger has **75 exact command ACKs**, **54 compositions** with
**161 phase pulses**, **227 balanced trusted DOWN/UP pairs**, zero UNKNOWN
game outcomes and no held keys. All phases have independent release receipts
and exact ordering; host release-attempt offsets are -1 to +3 ms from their
integer timer targets. There are **3,816 passive frames** and **3,892 PNG CRC
checks**, including reviewed command images and the death contact sheet.

## Lifecycle and limits

An initial 5.068 GB free-disk reading left insufficient evidence headroom;
allocation waited until the coordinator deduplicated closed evidence and free
disk reached 5.637 GB. No foreign files were cleaned by this worker.

Fresh UUID-idempotent box **bx_7uvshu4u** was created at 05:11:43.706Z after
the independent 25-minute watchdog and normal-stop delegate were observable.
Initial expiry: **05:37:43.534Z**. Browser/controller closed normally before
retrieval. An immediate custody assertion failed without recording its
predicate; that failure is retained. Subsequent read-only custody establishes
both PIDs absent, ports closed, profile/writer absent, no held keys and Chrome
exit 0. No original input was replayed.

All **4,533 remote references**, **597,531,809 bytes**, **1,288 distinct hashes**
were retrieved and independently rehashed at **05:33:07.502Z**, before normal
stop. Identical downloaded captures were hash-checked and hard-linked locally
to preserve disk headroom. Runtime pins were unchanged. Box **bx_7uvshu4u**
was normally stopped at **05:33:09.058Z**, state **archived**, expiry **null**.
Receipt **stop_2364cc6b0b7880aa** completed at **05:33:09.076Z**,
`forced=false`. Normal/watchdog delegates exited and the supervisor has no
remaining children. No old-box resume/delete, RAM gate, nested worker or public
deployment was used.

SDL Canvas2D level progress does not establish GL,
FPS, audio quality or full-game playability. Next work should resolve the
reviewed airborne landing/enemy transition while retaining native paused review.
