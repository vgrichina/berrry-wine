# Return Fire A1 armored attack: persistent flag exposure

Run: `scratch/runs/20261109-return-fire-armored-flag-1940/`.
Tested runtime commit: `649da4d08b974ed8cffc7056cd61734e050198f7`.

The original A1 green flag became visible after the ASV ground attack and
remained visible in a separate settled capture three seconds later. Jeep
pickup/return was not completed: the living ASV reached and overlapped the home
bunker, but the reviewed fire-key entry attempt did not transition into the
bunker. The finite run ended normally without a vehicle death, runtime failure
or demonstrated emulator defect. No production code was changed.

## Source, selection and attack

Read CLAUDE.md, current-flag-attack1910 and reproducible-body-fixture1858. The
previous fourteen-helicopter-attack trajectory was not repeated. The shipped
RFIRE.HLP documents ASV armor, jeep flag retrieval, J map/K information/H
selection in the bunker, H ground fire/J air fire/K switch-drop-center in the
field, and returning over a lit bunker followed by a fire key. Q/E turret
adjustment is absent from this run's inherited ordinary-key helper, so ASV
selection avoided depending on the tank's independent turret.

Original WRL/PE analysis supplies home `(47,66)`, flag-building `(55,56)` and
road `(47,68) → (50,68) → (50,58) → (55,58) → (55,56)`. The fresh map passed the
A1 fit. These are source-derived coordinates; pixels alone do not establish
internal object identity. The ASV followed the road approach with bounded,
reviewed corrections and some turning arcs over adjacent sand.

An initial S selection selected the jeep; this was inspected and corrected
with A to the lower-left ASV before deployment. K showed the ASV and its
missile-shaped ammunition rows. The movement panel was toggled with D and
reviewed. Before field ammunition, `pre-ammunition-review.json` records actual
ASV selection, the H ground-fire missile weapon, no field K/J weapon switch,
and the visible northeast launcher/body axis toward the building's southwest
base. Internal numeric health and exact impact coordinates were not traced.

H100ms left the building standing; a second H500ms burst removed its roof and
exposed the green flag. `review/asv-pre-shot-aim.png`,
`review/asv-ground-shot-one.png`, `review/asv-ground-burst-two.png` and the
separate `review/asv-exposure-settled.png` preserve the sequence. The settled
frame shows ruins/open structure and the green flag, rather than relying on a
transient explosion or zoom. No further target attack was made.

## Return limitation

The ASV retraced the approach to home. Short movement holds near the bunker
continued through turning arcs; the information-panel interpretation did not
establish instantaneous screen-axis movement. Supported native cursor-up holds
produced no visible displacement in the two reviewed captures. This is an
observation, not a proven input defect. WASD remained visibly effective.

At `asv-home-entry-align` the ASV overlapped the bunker; H100ms did not produce
a bunker transition. The apparent yellow dashboard icon was insufficient proof
of an active entry light. Further bounded alignment attempts ended at
`asv-entry-west-center`, alive at the home footprint. The run then closed before
the fixed deadline. It did not select/deploy the jeep, pick up the flag, or
return it. Next work is precise, help-backed bunker-entry and movement-mode
calibration; no causal code repair is justified by this evidence.

## Validation and exact source

Tracked `9bf9ea8aa` composition fixture: 33 cases pass; collector 129, native
keys five, lifecycle six and `flock /tmp/wine-build.lock bash tools/build.sh`
pass. Routine offline invocation/lookup corrections are retained. One fresh
native fixture passed before exactly one original. The final audit verifies
57 commands/captures and all 58 required original response bodies against their
consumer completion SHA/size. Screenshots were returned and inspected in
separate calls before subsequent input.

Both exact authored predecessor final publications were verified before pins
or runtime, and their boxes independently confirmed archived after completed
unforced stops. Relevant source diffs were reviewed before selecting current
pins: 698 closure inputs matched predecessor1910 except seven run-local path
substitutions; protected originals/fonts and both modules were unchanged.
Primary module SHA-256:
`3e491c0840bb7771328738a0d160b4bbaa3d7ab72074cbd38a7b41e5d7e8ec18`.
`runtime-pins.json`, `relevant-source.patch` and `run-inputs.patch` retain exact
source identity and small run-specific inputs. No source/media archive exists.

## Closed lifecycle

Box `bx_e4md8t48`, UUID `e6dc11dd-e809-4ef0-82f6-23a70d2170fe`, initial expiry
`2026-11-09T20:41:26.587Z`; immutable independent watchdog deadline
`2026-11-09T20:41:25.429778Z` was prearmed and observable before creation.
Normal browser/driver completion was joined with separate stdout/stderr EOF;
processes, ports and browser profile were independently absent afterward.

All 788 unique-evidence references were retrieved with content deduplication,
then independently reread for SHA-256/size and PNG CRC/decompression before
exactly one delegated normal stop. Final independent API state: **archived**,
expiry cleared (`archiveAfter: null`), completed unforced receipt
`stop_9910b2da9d460023`, ended `2026-11-09T20:36:14.798Z`. The actual watchdog
wait returned zero with both EOFs and its supervisor joined/reaped it. No box
was deleted or resumed; no guard/deadline was relaxed.
