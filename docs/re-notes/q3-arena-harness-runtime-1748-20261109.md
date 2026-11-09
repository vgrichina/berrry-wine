# Q3 arena harness and native runtime, 1748

The arena scheduling harness now includes the generated startup diagnostic
prelude together with `send`. The former function-only extraction left
`startupOutbound` and `startupSettlement` undefined and produced an empty wire;
that was a harness incompatibility, not evidence of a production transport
failure. No exception suppression, replacement send/receive implementation,
production timeout, routing, auto-attach or debugger-policy change was made.

Harness fix published on main as `d829d3545`. Evidence belongs to
`scratch/runs/20261109-q3-arena-harness-runtime-1748/`. Recover source using
`gitbase.txt` and `relevant-uncommitted.patch`; Git holds the source archive.
Only the four small run-specific Python inputs and generated authenticated
callers/runtimes are staged. Media remain referenced by path, SHA-256 and size.

## Checks

- Seven actual composed command/screenshot scheduling cases pass: baseline
  losing continuation, fixed late screenshot, overdue response, overdue owner,
  success before deadline, first protocol error, and untimed fixture. Exact
  outbound command envelope hashes, session/method/request identity and one
  settlement per request are checked using the generated diagnostic functions.
  First failure survives later command refusal; no input or screenshot
  continuation is admitted after terminal failure. The scheduling harness
  retains inert owner replies; it is not a complete browser implementation.
- The separate full authenticated generated-relative-caller peer suite passes
  all 16 cases, including transformed transport byte identity, send return,
  public inbound, promise settlement, callback/error/throw identity, observer
  failure isolation, record/timer bounds, late unmatched replies and unchanged
  20-second request failure. Those peer timings are not native measurements.
- Current foreign closure: production preparation, staged generated caller,
  Git-free actual consumer compilation and 27 refusal controls pass.
- Both generated native lifecycle prelaunch/custody/staged checks pass before
  Chrome; actual generated owning-caller integration and fresh interactive
  controller tests pass, including distinct wait/EOF and independent watchdog
  joins. These offline waits do not establish native browser cleanup.
- `flock /tmp/wine-build.lock bash tools/build.sh` passes (`build.log`).

## Native run

Fresh preparation independently SHA/size-verified 942 providers. Manifest
SHA-256 is `949e95016d5bf2a863716b835f7432e1002f02b22da5b4a30790572fed70c64a`.
The actual CPU and renderer module identity is
`3e491c0840bb7771328738a0d160b4bbaa3d7ab72074cbd38a7b41e5d7e8ec18`;
compat remains `ecb45716b1ee7fc5218b1670dd270b19c7664ee30d000b3360a12786a1c21eaf`.

This assignment explicitly authorized the runtime after Nox1733's no-box final
release and ReturnFire's verified archived stop. Historical ReturnFire missing
terminal/watchdog joins remain FAILED and were never inferred from absence.

One box, `bx_7de5kh4r`, was created at 17:50:59.313Z. Its unique watchdog UUID
is `17ced03f-eeb2-4328-989c-8859b48b0edd`; the immutable deadline was armed and
independently observed live before allocation. Initial archiveAfter is
`2026-11-09T18:15:58.170Z`; expiresAt was not returned.

The single changed fixture passed production-worker/module ownership, nine
negative controls, positive owning WebGL draw/presentation, physical held-key
and release checks, and actual screenshot/ACK0. Planned owning cancellation
passed separate generated-parent/prelaunch/runtime waits and stdout/stderr EOF;
kernel custody reaped 164/164 identities. Physical inspection passed with ports
closed, profile absent and locks drained. Normal browser close remains UNKNOWN
for this deliberately cancelled fixture; kernel reaping is a separate fact.

The conditional original reached the main menu, CHOOSE LEVEL and DIFFICULTY.
Each action was reviewed against its actual captured image. An early read-only
download of `arena-fight-capture.json` returned 404 while the command was still
pending; after its successful ACK, the published image was retrieved and hash
verified. No browser command was replayed for that inspection mistake.

The original returned successful ACKs 0–8 and nine native captures. The
`start-arena` screenshot showed CONNECTING TO LOCALHOST; the next wait capture
was unchanged. `arena-settle.png` then shows the textured Q3DM1 courtyard,
weapon, bot and HUD (100 rounds, 119 health). This is verified current original
world rendering, not a fixture promoted to gameplay. After a balanced 1500 ms
W command, `move-forward.png` shows a death scene and “Fragged by Major.” That
camera change cannot establish useful forward movement. Firing is unverified.

The concrete terminal cause is command admission, not a screenshot timeout:
`respawn-fire` failed at 17:59:10.542Z with **command cannot fit immutable
run/cleanup deadlines; not queued**. The actual original browser stop was
18:00:29.024Z. The unchanged owning caller passes a 55-second minimum ACK
budget, and transport reserves 30 seconds for cleanup. Its latest admission
was therefore 17:59:04.024Z, before this request. No command 9 was published,
no respawn/fire input was dispatched, and no later input/capture/retry ran.
Owning transport cancellation followed; local controller exit 1 and every
separate wait/EOF are retained. No deadline or admission rule was relaxed.

## Transport evidence and limits

`transport-analysis.json` independently checks compressed SHA/size, decompressed
SHA/size and gzip CRC, plus exact outbound/public inbound byte identities.
For page-session `Target.setAutoAttach` request 6, the changed fixture observed
159.363069 ms from synchronous send return to public inbound, and 159.727366 ms
to consumer resolution. The original observed 0.728128 ms to public inbound
and 1.521038 ms to resolution. Request/session identities match. The previous
startup stall did not recur in these two sessions; this does not repair or
explain the historical stall.

The bounded startup observer stopped at successful navigation, before the first
250 ms scheduling tick: both sessions have **zero native Node scheduling
samples**. No claim about later Node stalls follows from that absence. Later
input/screenshot diagnostics are retained separately; startup observations do
not cover arena screenshot transport. Send return is API return, public inbound
follows buffering/decoding/Node dispatch, and settlement is consumer promise
settlement. None proves socket flush or browser-internal receipt/dispatch.

## Recovery and shutdown

All 76 fixture and 143 original unique-per-session compressed artifacts were
retrieved and independently reread before delegated normal stop. The global
unique count and complete SHA/size/gzip-CRC audit are recorded in
`transport-analysis.json`. No source tree or game-media archive was made.
Original kernel custody reaped 355/355 identities; independent inspection
passed with both ports closed, profile absent, no runtime FD holders and locks
drained. Browser ordinary close/EOF remains UNKNOWN: owning cancellation and
kernel reaping are separate from normal browser completion. The local
interactive controller actually waited exit 1, separate stdout/stderr EOF,
unforced. Its launch transport's -9 is retained, not relabeled normal exit.

Box `bx_7de5kh4r` is **ARCHIVED**, unforced completed stop
`stop_92a6058ee1659620`, ended at `2026-11-09T17:59:54.128Z`, with final
archiveAfter null and expiresAt not returned. My immutable UUID watchdog
observed that normal-stop receipt, wrote its terminal record and was actually
waited with exit 0 and separate stdout/stderr EOF. No box remains billing idle.

Next: preserve these current world/transport observations and plan original
input admission from the actual browser deadline early enough to test movement
and fire before the existing 55-second ACK plus 30-second cleanup boundary.
This task ends with the tested published harness fix and a verified current
world screenshot plus a concrete pre-dispatch deadline refusal; movement/fire
remain unverified. No emulator causal repair is claimed.
