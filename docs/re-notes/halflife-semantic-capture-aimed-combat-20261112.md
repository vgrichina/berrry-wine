# Uplink: acknowledged capture selection before aimed combat

Run: `scratch/runs/20261112-halflife-semantic-capture-aimed-combat-1930/`,
with `-control/` for the private lifecycle and blank control.

The local operator now selects the latest successfully acknowledged command's
delivered full frame. Filesystem mtimes and lexical capture labels no longer
determine review selection. Remote exact-latest, strict22 identity, freshness,
PNG hash and terminal admission guards remain unchanged.

## Selector and regression

`latest_capture.py` reads immutable delivery receipts, checks exact command IDs,
successful ACKs and contiguous unique numeric command sequence, then selects
the highest ACK number. It checks the receipt's packet label, capture timestamp,
original identity and completed capture, local image location and PNG SHA.
Only initial startup may have no command ACK. Missing or ambiguous receipts
are refused; no command is retried. `step.py` supplies this selected label to
the unchanged delivery and remote consumer.

`selector-tests.json` proves the old failure with two frames named n9 and n10:
compressing/restoring the older JSON and assigning it a newer mtime makes the
old selector choose n9. The replacement selects acknowledged n10 and ignores
an even newer unacknowledged n99 file. The test sends PageDown through actual
`delivery.drive`, packet verification, numbered `transport.cjs` and the exact
extracted emitted `execute` consumer. One native pair is admitted, producing
acknowledged n11. A subsequent deliberately stale n9 reference is refused by
the original exact-latest assertion before another admission or DOWN. The
terminal transport closes and the caller performs cleanup, without replay.
This local consumer test mocks native delivery; the unchanged real Chrome
Worker key proofs are reused separately.

`parent-selection-regression.json` also selects **n24-align-crab** with exact
PNG SHA `cf736948c72307d3b049bf8f4e5e273ee7f10de73f56f30e3be12f7806c8010e`
directly from the original failed run's retained receipts and captures.
It performs no remote effects. The parent n25 refusal remains an exact
reference mismatch before admission, not a proved age failure.

The final input SHA remains
`c775c93ccbff8b74efb70fa23d99b6a621f498c7a773363b3c82f661f24fc303`.
The parent's 21 emitted consumer and actual Chrome Worker cases, seven exact
helpers and four earlier proof reports are reverified by SHA and reused.
`final-freeze.json` freezes 815 runtime pins before allocation; the final
local import gate passes. Helper patches, exact Git source SHA and relevant
uncommitted source diff are retained. No source-tree archive is created.

## Original gameplay and remaining blocker

The complete whole13 checkpoint remains758472 compressed bytes, SHA256
`df8d61b2fcdd285a6a28e2e180930e6ee60eff388cd9bf31c557d3409dd18e51`,
13 strict-base64/size/SHA-checked records totaling2342063 decoded bytes.
The005 save remains336143 bytes, SHA256
`5d02d6bc10c55a7502acf69a83f7bde3b6aab8fe9c07e728d562dc83ab6b7bdb`.
All13, including both maps' auxiliaries, pass fresh-browser VFS verification
together before native Load. The bottom03:18 row is selected normally.

`n18-bound` binds the actual CPU and owning SoftwareGL to module
`04c534192ee3fe39e388536c2ce710c12c47a5cd2ca4d95c19f9d00b1e8f0a17`.
The full frame is already35/0 with damage. PageDown1800ms in `n19-lookdown`
visibly lowers the camera at30/0. Backward650ms in `n20-retreat` exposes a
complete nearby floor headcrab left of center, at25/0. Left150ms in `n21-align`
ends with the headcrab lunging into the upper/right foreground at15/0.
One ordinary left-button attack600ms follows in `n22-shortattack`. Its
returned original frame is the rolled **0-health death view** with headcrab
and loading text. A visible hit or kill is not established. The target was
moving at close range; the attack is not evidence of accurate centering.

The model's interval from `n21-align` capture to `n22-shortattack` capture is
about25 seconds. This is a concrete failure of the attempted review cadence
under active headcrab damage. Acknowledged native edges cannot establish a
timely guest hit. There is no blind attack loop, End retry or Pause retry.

Ordinary Escape and the native Save/load, bottom03:18, Load and confirmation
UI recover the checkpoint after death. **`n33-recovery-wait` shows40/0**.
Forward2000ms in `n34-forward`, a short left650ms in `n35-left-door`, and
left2000ms in `n36-face-opening` expose the open striped doorway and a
standing guard with a floor headcrab. `n36` is already5/0 and remains outside
the room. Forward2000ms in `n37-approach-guard` returns a second preserved
rolled0-health death facing the doorway. **Living guard-room traversal,
healing, weapon acquisition and safe onward progress remain unproved.**

The normal native Load path is completed again after the second death.
`n46-final-loadwait` shows the restored corridor/crowbar at **35/0**.
`n47-ordinary-quit` is acknowledged. The read-only closing VFS export contains
the same13 file records and independently verified decoded data as the
original checkpoint. No new native Save was requested or earned. The closing
gzip is758587 bytes, SHA256
`06a3ac8be6496ad34db2f6525d33eccaec51559b970751f519b4009fa8e6c18a`;
different export packaging is not a successor checkpoint.

Before another allocation, qualify one predeclared bounded ordinary-native
attack/held-full-frame/menu-inspection cycle if continuing this encounter.
It must retain strict binding and review before the cycle, independently
prearmed UPs before DOWN, an original full game frame before opening the menu,
and no further non-cleanup keys after UNKNOWN. Actual original full frames
must establish any useful Escape/menu pause and explicit ordinary UI resume;
Pause delivery alone remains insufficient. No adaptive blind chain or
runtime clock, AI, health, position or memory writes are justified.

## Verification and lifecycle

`terminal-verification.json` verifies508 recovered original references,
**46 full PNGs**, all22 within-capture identity fields,29 gameplay captures
against the living owner anchor,224 exact HTTP pins,32 balanced pulses
(10 key pairs/22 click pairs),86 trusted events and46 numbered ACKs.
Every original input command names the immediately preceding acknowledged
frame; no original first-failure, transport-closed or terminal-error artifact
exists. All releases are attempted. Offsets from planned release range
-1..357ms; the357ms delay is the `n28-select318` menu click, not a combat hold.
The seven unchanged helpers and final input are reused without runtime edits.

The fresh blank control reaps133/133 owned processes with actual outer wait0
and both EOFs; its23 recovered references pass SHA checks. Original Chrome
exits0 without signal, its actual outer parent waits0 with both EOFs, and
364/364 owned processes reap with no remaining/unreaped tasks and command EOF.
This original shutdown is ordinary completion, without guard cancellation.

The independent two-hour watchdog is armed and observed alive before the
single private creation. **`bx_d35zv9tv` is archived, expiry null.** Initial
expiry21:32:07.583Z. All unique evidence is recovered and hash-verified before
normal delegated stop. The local unified-exec manager session returns143
during its first stop attempt, leaving no manager-parent or watchdog actual
wait receipts. Those waits remain **UNKNOWN**. Independent GET observes the
box still idle without a stop operation. A separate delegated cleanup caller
performs normal stop **`stop_ffa7dfb7c54a31e1`**, completed
19:49:12.681Z, forcedfalse/errornull. Independent GET confirms archived state
and null expiry. The watchdog records terminal confirmation and its PID is
absent; neither observation is relabeled as an actual parent wait.

Every owned pre-action disk sample exceeds1.5GB; minimum1528582144 bytes.
Shared disk subsequently falls below the floor after all gameplay, during
cleanup; root records the same condition. No continuous floor compliance is
claimed. No RAM gate, reserve change, additional allocation, other worker,
console/direct configuration/media write, forced guest call, runtime fix,
build, public deployment, full27, parity, FPS, audio or broad crash-free claim
results. End centering, Pause effects and useful paused inspection remain
unqualified. The selector is fixed and tested; combat/safe onward is blocked
by lethal damage during the current review cadence.
