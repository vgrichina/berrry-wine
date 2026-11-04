# Deus Ex: readiness established; hold timing separated; preparation interrupted

The original count14 load reaches inspected gameplay and exact, settled native
Small0 state before preparation. One requested40ms Left adjustment has a measured
**42ms trusted hold within a50ms operation**, releases normally and settles on
Small0. This validates the timing/readiness helper on one actual pulse, alongside
mock cases that distinguish dispatch overhead from an excessive hold. It does
not establish complete preparation or successful takeoff. **Z96 remains unreached;
no forward run or Space/jump was issued.**

The next request encounters an inherited command-publication race: the driver
reads partially written JSON and records `SyntaxError: Unexpected end of JSON
input`. Its first failure is preserved; the browser closes automatically. There
is no retry, reload, second browser or further game input. Atomic publication is
repaired and tested offline afterward, without a runtime claim for that repair.

Evidence: `scratch/runs/20261104-deusex-preparation-readiness-timing/`.
Predecessor: `deusex-earlier-supported-takeoff-20261104.md` at `c66edc193`.
The supported-short-runup, native-speed and aligned-jump notes and retained
helpers were read before runtime. No production source, guest memory, console,
executable, config or game check changed; no build/rebuild was needed.

## Offline diagnosis and helper tests

The predecessor's fourth40ms pulse measured51ms from before dispatch through
keyup acknowledgement, while trusted browser events measured47ms held. The old
50ms guard therefore conflates dispatch overhead and hold time. Its restored
capture still shows LOADING despite a valid native player. The earlier
native-speed run's06-restored-small0 capture was also inspected: it shows the
gameplay HUD and crate room. Native actor validity alone is insufficient for
the visual readiness gate.

The run-only `hold.cjs` now reads the trusted keydown event time, subtracts elapsed
dispatch time from the requested hold's remaining delay, and releases in
`finally`, including when keydown acknowledgement fails. It independently records
`trustedHoldMs` and `operationMs`. Missing/untrusted/unbalanced events or an actual
hold over50ms terminate the sequence after release. This is a measured bound
with an overrun guard, not a hard real-time scheduling guarantee. Outstanding
keys remain tracked for the driver's final cleanup if release itself fails.

Every pulse requires explicit inspected visual readiness, reflected Physics1,
BaseCrateUnbreakableSmall0, positive radial support margin and velocity below
0.01 before input and after the400ms release/settle interval. The original
read-only typed-object/reflection anchors and three-worker identity checks remain.
The inherited single-jump helper retains its145ms earlier-runup candidate and
Physics/Base/eight-unit pre-Space margin guards; it is never invoked.

Before Chrome,14 timing/readiness/support mock cases pass locally and on the
assigned box. They include67ms total operation with40ms actual hold passing,
delayed keydown acknowledgement shortening the remaining wait,51ms actual hold
failing after release, keydown transport error releasing, absent visual approval
preventing input, and Physics/Base/velocity/margin failures before and after a
pulse. Nine JS helper syntax checks, actual Puppeteer/Chrome dependency checks,
and the native exporter mock also pass. Export mock bytes remain explicitly
separate from real saves. Syntax is not treated as timing proof.

## Immutable runtime and readiness

Assigned bx_a9uvp4n2 was verified and ACKed before use: RUNNING/APIidle,
healthok, hydratedtrue, expiry2026-11-04T03:35:26.275Z. There were no Chrome
processes before launch. Coordinator owns shutdown; no allocation, resume, stop
or delete occurred. All game/browser execution stayed on that box.

Historical source remains `a504fa248caaecbbb042b65e9ae5384a340ade26` plus the
authoritative nine-file historical-source.patch, SHA256
`9415aea6dbced13143b9dcdceb9d2d3594219a467263f7b3cf2bb623da36c796`.
The actual canonical module is1,898,260 bytes, SHA256
`8459597c8d66e098d727fb4ab53e1cf46332241dc7eef2e158f3c475a78b1676`.
**Historical second module ABSENT**; no substitution. Original SoftDrv and
three original guest workers are retained. All453 runtime pins match before
and after use. Exact current Git SHA and relevant binary diff are retained in
source-record.json/current-relevant-tracked.patch; the owned new note is retained
as a patch. Git remains the source archive. Media remain at their existing
paths, referenced by the provision manifest and full hashes, without copies.

The immutable count14 pair remains unchanged at
`scratch/runs/20261104-deusex-small0-reload-onward/recovered/native-save-export/`:

| File | SHA256 |
| --- | --- |
| saveinfo.dxs | `4cfa57f28a079c1b0bcc0f4a002b24f845005122adf3d5ed39f04cd2fc2ba2a6` |
| 00_training.dxs | `ab8b1fa27157a6dc6f6e9a000acab0082f02be3c7478a7f982c27eab2759a730` |

Earlier count15 lower wood is not input. Original BSP target remains
Brush1765/node8270, topZ96, X7024–7088/Y−1872–−1808; tall front/east nodes
8301/8305 and their radius-expanded boundaries are unchanged geometry references.

Inspected02-count14-dialog.png shows count14/time01:17:23. A single ordinary
Enter loads the checkpoint. After20s without movement, inspected04-restored.png
shows the crate room, gameplay HUD and inventory, with no LOADING overlay.
Read-only observation restores exactly
`(7026.704590,-1707.887939,109.602844)`, yaw250640, Physics1, height43,
BaseSmall0 and velocity0. Reflection also confirms healthy standing running
state, GroundSpeed320, AccelRate1000 and bCanJump. Request4 records visual
approval and rechecks settled native support before the first adjustment.

## Actual adjustment and first failure

The single Left40ms pulse records42ms trusted keydown-to-keyup and50ms total
operation. It settles at `(7012.748535,-1714.939209,109.602844)`, yaw250640,
Physics1/BaseSmall0, velocity0, with11.431784 radial support margin. All1160
basic samples remain Physics1; all826 reflected samples remain Physics1/BaseSmall0.
There is no observed support-loss guard failure.

The actual displacement differs from historical individual pulses, so the next
request is selected from this measured position: one40ms Down adjustment toward
the earlier safe setup. It is not a blind replay of five Left/four Down pulses.
However, request5 fails at the driver's JSON.parse before admission or dispatch:
the sender's inherited `Path.write_text(command.json)` exposes an empty/partial
file to the100ms polling driver. The completed pending command is recovered;
commands.jsonl ends at4, with no receipt5 and no backward-preparation key event.
The sole ArrowDown keypress in native-input.json is Load-dialog navigation.

The first runtime failure and stack remain in recovered/first-failure.json.
A separate premature, read-only startup capture fetch had returned FileNotFound
while request1 was pending; it is recorded separately and caused no input or
retry. Request1 subsequently completed and ACKed before request2.

After the runtime failure, run-only queue_io.py/operate.py are repaired offline
to publish a fully written/fsynced temporary command by atomic rename. Three
mock tests verify complete content before visibility, pending-request refusal,
prior-ACK/terminal-failure refusal and cleanup after publication failure. The
terminal failure prevents further publication. These tests do not establish
runtime validation of the atomic transport, and no new browser is launched.

## Verification and handoff

All47 unique recovered files and the actual canonical module pass full size/SHA
verification. Requests1–4 ACK sequentially, maximum6 steps; request5 is terminally
unacknowledged and is not resubmitted. All12 trusted browser input events balance,
including the sole preparation pulse. Original checkpoint bytes and453 pins are
unchanged. No real native save/export or fresh Load follows: the target was not
reached. No floor/lower-wood progress, FPS, full-game or guest-exit claim.

The browser segment lasts97.107s. Automatic error cleanup completes
03:08:21.281Z with held keys empty, Chrome15304/driver15288 absent and port8123
closed. Because the inherited driver automatically closes on this error, unique
evidence recovery occurs **after automatic close**, rather than before close;
all unique files/modules survive and are recovered before03:25Z. This ordering
limitation is explicit. The box remains RUNNING/APIidle, healthy and hydrated,
with expiry03:35:26.275Z, handed back to the coordinator for shutdown.

This single task stops. The concrete remaining dependency is runtime validation
of atomic command publication, then measured short preparation from a separately
authorized count14 load. Earlier supported takeoff remains untested; no successor
is launched here.
