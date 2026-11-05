# Stronghold fresh setup: readiness prerequisite remains unproved, 2026-11-05

The retained command-14 image is populated setup artwork, but it does not prove
a completed setup frame or a ready control. The actual native history stops
inside an unreturned fourth draw. No recognizer/readiness acceptance change is
warranted by this evidence. The three production helpers and their focused
tests remain unchanged; no screenshot/hash whitelist, tolerance expansion,
unknown-scene bypass or control permission is introduced.

This is the concrete blocker permitted by the assignment's instruction to
document missing native prerequisites when control readiness cannot be proved.
It does **not** resolve the runtime prerequisite or authorize another original.
Source/retained analysis only was performed, starting from published
`666b5ee4c211d20baa5c7927b07bc04084b1683f` and
[the predecessor report](stronghold-repaired-bypass-original-20261105.md).
Evidence is in `scratch/runs/20261105-stronghold-fresh-setup-readiness/`.

## Actual images and independent pixel comparison

I personally viewed the original full-size captures, rather than relying on
their filenames, prior annotations or hashes. Paths below are under
`scratch/runs/20261105-stronghold-repaired-bypass-original/browser/`.

| Capture | Steps | Visible observation | Existing composed recognition |
| --- | ---: | --- | --- |
| `route-native-boundary-7.png` | 10176 | ChooseType / Custom Game hover | `choose-type-custom-hover` |
| `route-native-boundary-8.png` | 10432 | Sword/shield background and unavailable text; no populated panels or numbered buttons | `setup-transition-observation` diagnostic only |
| `route-native-boundary-9.png` | 10688 | Human/Lord Crusader, map, Deathmatch Game, 10000/10000, Crusader Demo row, numbered buttons and unavailable text | `unknown` |

The final PNG SHA-256 is
`89bb4fe560a2f8cb79b64091597f98c3be9694ea128ec05ee423715a89f37d1f`.
The preceding PNG is
`b9ccb3f4a3078cd008964db6794a9a9eb9f6ebd250b4d801b1ea25a4ceee928d`.
The predecessor note's description of the preceding image as having colored
buttons is inaccurate for that retained file. This observation corrects the
description without altering its original evidence.

I also viewed historical setup
`scratch/runs/20261104-stronghold-current-request-native/review/route-native-boundary-12.png`.
The existing classifier accepts that historical image as
`actual-scene20-observation`; this remains an observation label, not native input
permission. Direct decoded-RGBA comparisons cover all 574,480 pixels of the
opaque game rectangle `(10,194,860,668)`, plus separately measured Human/Lord,
map, Deathmatch/gold, player-list, numbered-button and unavailable-label regions.
There is no alignment search, masking, threshold fitting or derived screenshot.

Compared with that historical setup, step10432 differs at 397,531 pixels and
step10688 differs at 3,130 pixels. The latter still differs in every named
region: 1,841 Human/Lord pixels, 184 map pixels, 410 Deathmatch/gold pixels,
60 player-list pixels and 77 numbered-button pixels. The unavailable-label
subregion differs at 1,594 pixels and overlaps the Human/Lord region.
These measurements distinguish the actual populated layout from the preceding
transition and historical setup without treating a digest as readiness proof.
Deleting the unavailable text from recognition would not account for all other
differences or establish their acceptability.

## Native evidence defeats screenshot-only readiness

`browser/preset-attachment-107.json` binds each capture SHA, step and epoch to
the same original trace. Its actual terminal status is `command-failed`, fault
null, 43,338,271 continuous boundaries. Its last native PC is `0x44f810`;
the final capture annotation reports `0x44f7d8`. Both addresses are inside the
original RGB565 lookup pixel loop, verified against original executable bytes.
Neither is a draw return.

The trace establishes more than the older partial-frame investigation:

- Draw entry sequence64, at boundary38,852,956, advances fade24 to zero and
  direction to zero. Its real caller/ESP return is sequence76 at
  boundary41,127,277. Input suppression is still **1** at that return.
- Draw entry sequence78, at boundary41,992,129, begins with fade0, direction0,
  refresh0 and suppression0. This draw remains pending at phase3 in the terminal
  report; there is no corresponding return. The final capture occurs at
  boundary43,338,271 during that draw.
- Final ACK10624→10688 advances exactly64 steps at the original frozen16ms.
  Queue empty, active/last input null and mouse mask0 prove host rest. They do
  not prove native setup widgets are ready.
- Native presentation remains `pending`, `hostRelation:null`,
  `readinessGranted:false`. The same-epoch host report ends
  `first-command-failed`, fault null. Normal host upload/repaint/capture records
  do not identify which native operation produced the final captured pixels.

Thus even **fade0/direction0/suppression0** is an actual retained negative for
the proposed inference “setup is complete and controls are ready.” A prior
completed fade-zero draw and a later zero suppression sample cannot be joined
into a fabricated completed unsuppressed draw or pixel publication.

## Exact missing native prerequisite

The original executable remains at its existing path
`test/binaries/candidates/stronghold-crusader-demo/installed/App_Executables/Stronghold Crusader multiplayer demo.exe`,
SHA-256 `9024c533095f2227b0105b7e8a9e4cf28ec4fb206b165629787b2c97cf99f13f`.
Fourteen byte anchors are checked directly; bounded fresh static disassembly
is retained in this run. Original setup, draw and widget source contracts agree
with [the earlier static investigation](stronghold-setup-render-completion-20261104.md).

For setup-frame completion, missing evidence is a real same-owner/epoch return
of the unsuppressed fade-zero draw, followed by an identified ordinary
presentation of its output and fresh independently reviewed pixels. The actual
pending fourth draw cannot supply that return. Neither its remaining boundary
headroom nor a host capture supplies the missing presentation identity.

For the numbered preset, original hover `0x42d850` checks mode99 and feedback
`[0x995674]`; active input suppression clears feedback at `0x4e9ee0–0x4e9ef3`.
Original activation `0x42d880` independently requires mode99 and
`[0x69165c]==0` (no pending preset). The retained observer reads mode and fade,
but **does not read pending preset or widget feedback/activation state**.
Generic widget visibility/disabled flags and the selected widget's ownership
also need evidence before interpreting artwork as an enabled control.

Application is another event: updater `0x42db40` tests the pending preset and
native press edge `[0x1bd26a4]`, then calls `0x42e490` and clears pending state.
The native edge and application are not observed here. A press edge would have
to come from an authorized ordinary gesture, not be required or fabricated at
host rest. Hover, activation and application must retain their distinct
evidence; none is inferred from a visible numbered circle or description.
Strict Zephyr/Start/world conditions remain separate and unproved.

The existing helper intentionally forbids `route-stability`, `route-review`,
`route-next`, preset hover/press, handoff and native gestures in this diagnostic
lane. Even the historical complete-layout label stops with “no readiness
grant.” Extending the fresh image list would at most permit more diagnostic
arrival observations; it would not remedy the native/control prerequisite.
No such extension is installed. Unknown scenes still stop at first failure.

## Scope, validation and handoff

`analyze-retained.cjs` performs only retained-image comparisons, real capture/
epoch/ACK/report binding checks, current recognizer calls and original-EXE
byte inspection. `analysis.json` and `analysis.log` retain the results and all
existing input paths/SHA-256 values. Known ChooseType and historical setup are
positive recognition controls; the background-only transition and current
unknown frame distinguish the actual cases. There is **no retained positive
for fresh control readiness**, and no synthetic native history is substituted.

No shared code edit, executable heavy suite or full build was performed.
ReturnFire0305 then MDK0320 retain their queue priority and neither FINAL
release had arrived at the source-analysis decision. Their release/cleanup
gate was not bypassed. No code implementation is being committed, so a code
build pass is not claimed or reused as fresh validation. Documentation is
checked with `git diff --check`.

The original first failure/reply14, terminal latch, complete ACK/full-rest
contract, original clock, unknown-scene guards and 50M/360s/2048-record/1MB
caps remain intact. No command15, browser/game/original attempt, native fixture,
guest write, forced render/load/time, second attempt or new runtime occurred.
The next technical prerequisite is the missing native draw/publication and
control-state evidence above, within unchanged caps and first-failure rules;
this report grants no new runtime authority.

Recovery uses exact Git SHA plus relevant binary diff and owned new-file
patches. Existing captures/media/modules stay at their original paths; no
source archive, snapshot, tar or repeated media/module copy is created.
Box ID/state/expiry: N/A; no assigned box was used. Shutdown ownership remains
with the coordinator. This worker releases its documentation/evidence and stops.
