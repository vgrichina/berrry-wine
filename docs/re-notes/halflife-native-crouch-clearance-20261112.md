# Uplink: actual native Control/chords work; wooden clearance still blocks onward

Run: `scratch/runs/20261112-halflife-native-crouch-clearance-1730/`, with
`-control/` and `-control2/` lifecycle evidence.

The new **run-local requester and actual emitted consumer support native
Control and finite movement/jump chords**. Fresh original whole12 Load,
crowbar, actual SoftwareGL and movement pass. A full frame during Control alone
shows a lower viewpoint than the released view. Crouched forward and lateral
movement, a new crouch-forward-jump combination, and a central approach under
the wooden frame **do not establish an onward corridor or encounter**.

The first specific route blocker is the remaining wooden back/end face:
central crouched movement closes on it, while the sign-wall/metal-jamb side
approach ends in a close wooden pocket. This is an observed limit of these
alignments, not proof that the structure is indestructible or every route is
impassable. Health100/armour0 persist. No useful new checkpoint was earned;
no native Save or successor qualification is claimed. The close read-only
export matches all twelve unchanged checkpoint files.

## Actual emitted input and controls

`input.cjs`, `transport.cjs`, `drive.py` and `browser.cjs` are new run-local
revisions, not production repairs. The requester validates complete key/chord
requests before publication; the consumer independently validates before
admission or dispatch. Chords require Control first, at most one W/A/S/D
direction, optional Space, unique keys, and bounded50–2000ms holds. Control
alone uses `ControlLeft`/VK17. Ctrl chords omit text and emit modifier flags.
Every key has its own prearmed release timer and bounded acknowledgement;
UPs are scheduled in reverse order independently. A failed/UNKNOWN DOWN stops
later DOWNs; all scheduled UPs are attempted before the group reports terminal
failure. Cleanup UPs can bypass admission without creating a new held key.
Native-group CDP failures defer terminal cancellation until release attempts
settle. No later command is admitted after UNKNOWN.

`consumer-test.cjs` extracts the actual `execute` body from the emitted browser
and drives the actual requester/numbered consumer, rather than a copied model.
Fifteen cases pass: Control, Control+W, Control+Space, three-key movement/jump,
held capture, capture failure, partial DOWN rejection, UNKNOWN DOWN, failed UP,
persistence failure, invalid key/order/duplicate/hold and zero-duration chord.
Invalid chords produce zero native effects. Tests verify DOWN ordering,
independent per-key UP attempts and sticky terminal admission.

Actual Chrome repeats the emitted-body cases with native CDP events. All DOM
edges are trusted and match the emitted ordering; a real Worker receives the
same event sequence. This Worker is an event echo control, not substituted game
logic. The original game's separate bound guest/renderer Workers and visible
crouch/movement provide the game evidence. The first local fixture assertion
compared DOM `keydown` with CDP `keyDown`; that test assertion was corrected.
Its Chrome was terminated and later profile-process absence checked; its
individual Chrome join record is missing. The final local control has Chrome
exit0 and actual parent wait0 with both EOFs and a joined prearmed watchdog.

A new passive in-hold full capture keeps the ordinary full-frame screenshot
path and before/after22-field identity check while admission owns the chain;
it does not replace the reviewed/latest frame. All eight original held captures
complete before their independently armed release deadlines. This establishes
physical input/capture intervals, not a simulation-step or keyboard-poll count.
Actual UP attempt timestamps differ from planned times by−1..+2ms; both−1ms
observations are retained rather than described as exact-duration holds.

The readiness, postLoad readiness,22-field identity/capture/admission and save
collector revisions match1710 by SHA. Their existing focused negatives/build
receipts are reused by exact hash in `reused-checks.json`. The ACK transport
retains numbered, sticky no-replay semantics with new complete-plan validation.
All new JS/Python syntax, staged import, final616-file pin verification and
actual provisioned-data/import gates pass before the original starts. No
production code changed, and no new production build is claimed.

## Whole12 and native clearance observations

The authoritative [1635 export](halflife-crowbar-obstruction-20261112.md) remains
649713 bytes, SHA256
`f523dfeaf57ef0f4d4c470965d4f036b3e67affde4498f203f55650db204d809`.
Independent strict base64, exact path set, every size/SHA, ordinary required
mounts and fresh VFS checks cover **12 files /2006166 decoded bytes**. No older
auxiliaries replace members. All589 predecessor pins match locally,616 final
runtime pins match remotely, and185 HTTP pins pass before game startup.

Native menus select OpenGL/Default/640×480 and the bottom earned01:48 slot.
`d12` performs normal Load with unchanged passive readiness; `d13`/`d14`
remain loading frames. `d15-readyview` restores the cleared bay/crowbar.
`d16-bound` anchors the living owner and `d17-fresh-right` visibly strafes.
Actual guest and owning renderer modules both hash to
`04c534192ee3fe39e388536c2ce710c12c47a5cd2ca4d95c19f9d00b1e8f0a17`;
the actual owning context independently reports `software:true`.

`d18-control-alone-held` and released `d18-control-alone` show the lowered and
returned viewpoint. `d19` crouches forward toward the tall face; `d20` crouches
right into a close wooden recess. `d21` turns toward the sign-wall side.
`d22` crouches along that narrow lane and ends at its wooden end face.
`d23` adds the newly supported Control+W+Space combination at that changed
position; the result is still a near wooden surface, not an onward view.
`d24`/`d25` back clear; `d26` inspects the opposite edge while crouched.
`d27` approaches centrally under the open-front wooden frame and again ends
at its back face. Early in-hold frames need not include the full movement
later visible in the released frame; they are not extra distance proofs.

The already-destroyed small crate is not attacked again. No E/use loop,
unchanged Space-only jump, familiar-room reopening, console/config/state/AI/
health/position/clock write, forced export or replay supplies these results.
No new room, enemy, destruction or pickup is attributed to the close recess.
Next: retain whole12; resolve the remaining wooden back/end obstruction with a
newly justified alignment or ordinary interaction, or establish a different
route from fresh full frames. Another unchanged crouch/push loop is not evidence.

## Refusal, evidence and lifecycle

The first box's blank endpoint/CDP/full-PNG/clean-close control passes,133/133
custody tasks reaped. Its final read-only pin/import command is rejected by the
provider with HTTP400 before any original browser starts. The emitted attempt
is177897 bytes; excessive command size is an inference, not a provider-proved
cause. Admission closes and the box normally stops. An earlier local adapter invocation
without its controller module path also failed before API dispatch; subsequent
requesters explicitly set that path. The corrected command
reads a SHA-pinned manifest in place, is bounded below4096 bytes, and passes
locally before a fresh caller/box. The second actual blank control passes with
131/131 custody tasks reaped before the original starts in that same box.
The [historical1655 endpoint cause](halflife-chrome-endpoint-repair-20261112.md)
remains UNKNOWN; no runtime endpoint repair is claimed.

Original postflight verifies365 recovered references,36 full captures,20
postbinding captures anchored on all22 fields,23 balanced acknowledged pulses
and73 trusted events. All20 keyboard DOWN/UP pairs balance, including8 Control
pairs. Original Chrome exits0/signalnull; the actual outer parent waits0 with
both EOFs and364/364 custody tasks reaped, no cancellation or remaining tasks.
Unique evidence is SHA-verified before delegated normal stop.

Both boxes have observable independent two-hour watchdogs armed before
allocation. Both local managers and watchdogs actually join0 with both EOFs.

| Box | Final state / expiry | Completed normal stop |
| --- | --- | --- |
| `bx_a6ynygpq` | archived / null | `stop_de374c9c29e15fd3`,17:37:21.165Z, forcedfalse/errornull |
| `bx_99b5q9pf` | archived / null | `stop_7fd3882dc824d0ea`,17:49:34.738Z, forcedfalse/errornull |

Initial expiries are19:31:45.795Z and19:37:56.317Z. Neither box is deleted or
resumed; neither is left billing idle.

Git is the source archive: final original freeze records
`700fbb1ec61fbbea6f27fdcbed74b81bd2cd4522`, relevant binary diff and helper
patches; the final helper patch also preserves evidence-only readers/verifiers.
Exact compression journals retain raw/gzip hashes and roundtrip checks;
byte-identical owned files are deduplicated with hashes and every path retained.
Retrieval manifests retain original paths/hashes; a later exact gzip may replace
a local raw JSON, so readers decompress its sibling `.gz` before checking the
original receipt. No source/media tree archive is created.

The native-command disk samples remain above1.5GB. After ordinary quit ACK
at17:48:31, shared free space is observed at1499824128 bytes during retrieval,
then1497624576 during cleanup. No further native input is sent. Own exact
compression/dedup and another worker's documented cache cleanup subsequently
restore sampled free space above the floor. **Continuous floor compliance is
not claimed.** No RAM gate, workers, public deployment, HeroesII/Claude panes,
parity, FPS, audio or full27 claim.
