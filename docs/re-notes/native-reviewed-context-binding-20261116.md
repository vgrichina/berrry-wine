# Personally reviewed native context binding, November 16

Evidence: `scratch/runs/20261116-native-reviewed-context-binding-gameplay/`.
The new, explicit contract is `native-reviewed-context-v1`. Existing
`native-scene-v1` full-PNG binding and historical closed endpoints are unchanged.
No historical refusal or UNKNOWN is reopened or reclassified.

`native-reviewed-capture` retains the exact complete PNG encoder bytes in the
native process, its original start/completion times, an opaque capture ID, and
the surrounding public USER snapshot. The saved PNG is those same bytes.
Observation is bounded by 3000 ms; different native contexts before/after
encoding refuse capture. A caller must personally inspect that complete image,
attest its hash and review time, and explicitly select menu/game scope and a
native target HWND. This protocol records an external personal review; it
cannot perform or manufacture the review itself.

Binding and queued input consumption check the retained capture, original
timestamps, immutable review attestation, current native process/window/USER
generation/owner/thread, focus, modal, capture and physical-UP state. All
published native window/control identities, titles, geometry, styles, control
IDs/classes and button flags are checked. Pointer coordinates must lie inside
the explicitly reviewed target; keys require that exact focused target. The
permanent input owner still pins renderer/queue/device/function identities.
One capture may authorize one finite nonce, with prepare/consume revalidation;
changing its scope, target or review timestamp cannot refresh it.

The supported public semantic classes are custom windows (0), buttons (1),
STATIC (3), and native MessageBox (16). Other control classes refuse the new
capture contract until their semantic state can be checked. For custom-drawn
content, this is a native context contract, not a pixel-semantic recognizer:
no OCR or inference about changing game pixels occurs. Personal targeting and
the original 5-second gameplay / 30-second menu freshness bounds remain
essential. A harmless repaint alone does not replace a native target, and the
new contract never hashes a fresh unreviewed repaint as though it were the
personally reviewed image.

The controller opts in only through a launch record explicitly naming the
contract. Its captures, binding, intent and completion records label the route.
It preserves 500 ms input confirmation, independent 1750 ms physical UP,
3000 ms observation/operation bounds and the irreversible Quit reserve. A
receipt must also match owner/epoch/nonce/deadline and show consumption before
both the immutable operation deadline and capture freshness expiry. Failure
closes the caller permanently, with physical release still independent.

The authored PE fixture uses an ordinary USER window and a real guest Worker.
Repeated guest GDI SetPixel calls repaint a decorative pixel while the target,
menu text, focus and native control metadata stay unchanged. The final reviewed
capture and later full native frame differ at exactly one pixel, (544,264).
The complete frames were personally inspected. Binding accepted that unchanged
native target and exactly one finite Down-arrow intent; confirmation was
36.754 ms and independently acknowledged physical UP was 255.424 ms. These
receipts prove handler consumption/release, not a game consequence.

Native negatives passed for actual SetWindowText control-text changes, focus
changes, renderer-handler replacement, actual DestroyWindow/CreateWindowEx
replacement generations, an actual owned MessageBox opened by the fixture's
explicit WM_APP hook, an unreviewed capture, and real observation timeout.
Refusal/UNKNOWN callers made zero later endpoint requests. The WM_APP hooks
are authored fixture fault stimuli, not physical input or original-game hooks.
Unit checks additionally cover process/window/owner/geometry/control changes,
unsupported classes, altered/unretained images, exact 5/30-second boundaries,
changed review attestations, one-nonce reservation, queued context changes,
and late/mismatched consumption receipts. The standard actual CLI guarded
input test also passed. An initial invocation used the wrong `.cjs` suffix;
that MODULE_NOT_FOUND failure is retained, followed by the actual `.js` pass.

The old stale fixture's desktop ETIMEDOUT remains a failed run: its stale
assertion did not execute. New diagnostics use the same immutable Git loader
bytes, real guest Worker mode, unchanged process-desktop source and 3000 ms
broker bound, with its existing passive phase tracing enabled. One new run
recorded poll submission-to-client receipt of 67.581 seconds and a further
36.375 seconds before socket write; its driver/watchdog also serviced late.
This locates a real failure before timely broker servicing, not PNG equality
or stale-review policy. Its exact OS scheduling cause and the old untraced
failure's precise phase cannot be reconstructed. No broker timeout was relaxed.
Those runs required host termination and remain failures. A later fresh run,
`stale-v7`, completed the actual elapsed-time stale assertion, rejected with
`binding review expired`, and proved zero later requests. Neither eventual
process absence nor an unexecuted assertion is counted as a PASS.

An early timed replacement fixture had already replaced its child before
capture and therefore failed its intended subsequent-change assertion. The
final fault fixture uses an explicit public message after personal review to
make the actual API transition observable. Earlier review-window expirations,
startup stalls, missing wait receipts and forced waits are retained. An initial
visual disappearance report was corrected after viewing the exact complete
PNG again: only the decorative pixel changed; the window remained present.

The independently compiled canonical module is
`83703369cc49c3e16077a4abd43def27262487f83dd52583d1b433adf7095f5f`.
Runtime sources use published Git plus explicitly owned patches, sealed in
memory, excluding foreign WIP. Git and binary patches are the source archive;
no source tree, media or Wasm archive is stored. Canonical locked full builds,
focused tests and the unchanged 128 original media SHA-256 pins / 127 manifest
rows / real-DLL closure are recorded in the run. Original-game outcome and
final process/box closure are recorded in its final `result.json`; native
fixture success alone does not claim NewQuest, a quest consequence or Quit.


The one authorized original was launched only after publication of
`2593c43eaaaafb34e668cb43f6739306fc195220` and fresh unchanged-media preflight.
The immutable runtime used canonical Git `85f7dd61ace7b22a289d9d5b37975e5faa9797c0`
plus exactly that publication's owned source paths, with every loaded source
hash recorded. Its native limit was 1200 seconds, independent watchdog 1220,
and irreversible Quit reserve 180, all recorded before launch. No second
original, prior save, replay, OCR, solver, private board read or configuration
change was used.

Personally viewed complete scenes reached Single Player, New Quest, the
ordinary “The Search for Timmoria” quest list, available Undead Hordes race,
and Warrior Lord / Average setup. Nine finite reviewed actions, each with its
own capture and nonce, have consumption and independent-UP receipts inside
500/1750 ms. All these are setup/exit-seeking actions, not a quest consequence.
The race selector's delayed changes were observed again rather than inferred
from receipts. The final Enter reached “Please Wait” with an hourglass. One reviewed
Escape sought the ordinary native exit/options route and was acknowledged,
but no exit menu appeared. Subsequent complete frames became black. Later,
after the irreversible Quit phase had begun, fresh full scenes visibly reached
the quest map, an undead capital and turn indicator 1, then “Beginning day 1”
with income 150/25/0/0/0. This proves ordinary NewQuest startup and its initial
day consequence; no town interaction, manual turn advancement or battle is
claimed. A fresh exit intent was NOT_SENT because its game capture exceeded
the unchanged five-second limit. No DOWN was delivered for it. The day dialog
was not dismissed through gameplay after the Quit latch. Native Quit remains
unproved. The caller was permanently closed and the owned supervisor received
a local host-cancellation file, with no further HTTP. Native exit 0 and
independent watchdog exit 0 have actual waits and both EOFs; the host-triggered
shutdown is not native Quit. Runtime lasted about 1117 seconds within its fixed
1200/1220 limits. Final receipts are in `result.json`.

The tool-managed sealed source holder and original outer launcher returned
actual status 143. Their normal holder-close / outer-child-wait receipts are
missing; process absence is not substituted for those receipts. The original
supervisor and independently armed watchdog survived and retain their own
native-child waits. Source/module hashes were verified during immutable
launch; a final holder recheck failed because its `/proc` descriptors were
already gone. The cause of that external tool-parent termination is unknown.
These lifecycle limits remain explicit alongside the native fixture passes.
