# SimGolf staged imports repaired; current native stroke reached — 2026-11-12

Run `scratch/runs/20261112-simgolf-staged-import-native-hole-1140/` fixes the
prebrowser dependency failure from `64a7d2273`. It reaches the original Dolphin
Coast championship, a reviewed Sid Golf aim and confirmed stroke on the current
published build. **The hole remains unfinished.** Shared disk space crossed the
mandatory 1.5 GB floor, ending native continuation. The earlier cancellation
failure was already fixed; this task does not diagnose or claim to repair it.

Commit `2504cdfb0` adds `--staged-import-check` to the actual generated caller.
It evaluates the mandatory readiness, bound input, transport, pulse, server,
mount, process-proof and PNG imports before output directories, parent guards,
server startup or Chrome. Process creation, server listening, timers, network
requests and filesystem mutation are guarded during import evaluation. Guards
remain installed through process exit, including deferred import effects.
The stage now includes current `tools/native-input-pulse.cjs` and every observed
transitive mandatory import.

The local test executes that exact generated caller in a temporary minimal
staged tree, without a game or source-tree copy. Removing the pulse helper
reproduces `MODULE_NOT_FOUND`; restoring the complete closure exits zero.
Removing transitive `lib/apps.js` fails too. Injected synchronous and deferred
Chrome spawns fail before creation, and server listening is rejected. Literal
mandatory imports are checked against the generated gate to catch additions.
The temporary tree is removed after testing; these controls establish staging,
not native gameplay.

All 37 existing focused caller controls pass, including current installed Worker
bindings, independent releases, persistent exact ACKs, sticky failures, actual
owning-parent cancellation and child joins/EOF. A separate actual requester and
consumer HTTP test preserves 1–600 execution bounds, known rejection, unknown
accepted POST non-replay and a positive 21-second delayed READ through retained
GET observation. The locked build passes. Its first invocation hung after the
shake gate printed success; that owned process was terminated, the gate passed
independently, and the full locked build then completed successfully.

## Original native run

The production resolver positive and old wrong-URL negative pass, preserving
all 1,762 original manifest entries. All 1,763 original installed files /
65,166,518 bytes match their frozen identities. The retained championship CSE
is 86,831 bytes, SHA-256
`beac714ef16e3574a517c272e5d99b495b1b9eec0f4a4b4e726f121b1eb74cca`;
the original marker remains empty. Media is referenced by existing path and
hash. No golfer, ball, score, resource, configuration, media or guest clock is
edited, and no game callback or export is forced.

The independent watchdog was observably armed before the private 55-minute
allocation. Provisioning actually joined zero with separate EOFs. All 2,253
frozen pins and the deadline hash passed remotely. The generated import-only
caller then actually executed remotely, exited zero with no attempted effects,
and recorded `staged-import-verified.json` **before browser creation**.

Full frames in `review/webgl/` show the original championship picker naming
Dolphin Coast MC, one hole, par 3, 127 yards; the unchanged Sid Golf selection;
and the loaded coastal course. The pro panel eventually exposes the five shot
controls. `straight-shot-selected.png` shows the Straight shot tooltip.
`first-shot-consequence.png` shows the native aim line, 6 Iron and 127 yards.
One separately reviewed confirmation click produces the Professional Tournament
scorecard in `straight-shot-confirmed.png`, with Sid's first stroke.

`shot-resolution.png` includes native feedback that the shot hooked.
`wedge-approach.png` shows Sid at the green-side lie and scorecard Sid 1 /
Harry Paddington 1. Selecting Sid's row and the final passive observation are
retained. **A subsequent wedge, putt, completed hole, final score or tournament
win is not established.** This run reproduces current native play after fixing
staging; it does not extend the earlier accepted wedge result by inference.

All 22 numbered commands have exact ACKs. Ten independent-UP pulses produce
29 trusted events, with no held buttons or queued inputs in the last state.
The recovered executing Worker module matches the locked build:
`04c534192ee3fe39e388536c2ce710c12c47a5cd2ca4d95c19f9d00b1e8f0a17`.
There are 1,279 complete pinned HTTP reads, including the exact native CSE GET.
Presentation is native Canvas/GDI. No physical GPU, FPS, audio or parity claim
is made.

## Interruption and shutdown

Shared `/home` free space fell to **1,496,182,784 bytes** during the final
pending observation. The browser was closed normally; no further input or
launch was attempted. Space later recovered during evidence retrieval, after
the browser had already exited. No peer files were removed.

Compressed review packets were verified, unpacked and discarded as derived
containers. Terminal logs, JSON and the module were compressed remotely before
transfer; already-reviewed original members were reused. All **241 remote
references**, represented by **196 local files / 9,447,319 bytes**, pass encoded
or original-byte hashes and gzip round trips. All **361 tracked child tasks**
were reaped. Chrome exits zero; the actual outer parent wait is zero with both
EOFs. The manager and watchdog also have actual zero waits and both EOFs.

Box **`bx_wp56yzbn`** had initial expiry **2026-11-12T12:38:13.226Z**.
After verified retrieval, normal stop **`stop_7c3e69786fb8562c`** completed at
**11:54:22.062Z**, unforced, error null. Final state is **archived**, expiry null.
No task box remains running. Git SHA, relevant binary diff and required helper
patches provide source recovery; no source/media archive or public deployment
was created.

Next: with sustained disk headroom, use the repaired import gate and the same
original native route to continue past the green-side lie to the hole result.
The new operational blocker is shared disk headroom, not staged imports or the
previously repaired cancellation control.
