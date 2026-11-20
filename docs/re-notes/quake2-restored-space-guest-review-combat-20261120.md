# Quake II guest review timing and restored-space original, 2026-11-20

Evidence: `scratch/runs/20261120-quake2-restored-space-guest-review-combat/`.

The predecessor's three readback-request-to-refusal ages were 7,906, 5,260
and 5,246 ms. Its post-whole-capture-to-personal-review gaps were 7,749,
5,058 and 5,096 ms; readback and complete display capture took approximately
0.1–0.15 seconds. Preparation already preceded capture. None reached the
controller's prepare or input socket, so there is no measured slow guest
prepare/socket operation behind these refusals. See `prior-timing.json`.
The existing CLI `native-reviewed-context-v1` registry validates native
snapshot/control identity and retains original images/times. The pinned browser
guard has no corresponding adapter, and applying the CLI's longer personal
review limits would violate this task's unchanged five-second fence. No stale
allowance, timestamp substitution, automatic review or speculative repair was
introduced. No oldfail/newpass repair success is claimed.

This run reuses the proven consent ordering and native/independent-UP controls.
The guest admission and dispatch function is byte-identical after removing an
additive timing record. Focused checks execute that actual extracted function
with authored identity/controller doubles: real 5,100 ms delay, target change,
focus change and expiry all refuse with zero DOWN; a fresh authored edge passes.
These checks are not original native consumption. A real child SIGTERM/close
test verifies that the additive invocation trace preserves signal status and
both stream EOFs. Trace records are restricted to this invocation's own spawn,
PID start identities, owned kill calls, exit, close and stream EOF events.
Shared capture/native guard/WAT/MCM/regions and foreign work remained read-only.
No causal c50c-style cancellation defect was proved in the retained Q2 launcher,
which already forwards termination and awaits its direct child. The earlier
external SIGTERM sender remains UNKNOWN.

One fresh original started at 08:22:28 UTC with 1,634,873,344 actual free bytes
on `/home`, unchanged 1,200,000 ms runtime and finite independent watchdog.
All helper/unarmed-release imports and 67 media hashes were prepared before the
budget. The executing CPU Worker was attested once: 2,418,815 bytes, SHA-256
`10bdae2c56c79eeb5d0b4ebbc602c8a233e36351380da274a70f7f5e25363564`,
graph34c plus72dc with committed65a guards; renderer gl-gps/WebGL. Complete
consent and fullscreen main-menu images were personally reviewed. The ordinary
host fullscreen click and independent matching physical-zero UP succeeded.
The capture tool call returned the full image immediately, removing an extra
image-opening tool round trip; no freshness rule changed.

Guest preparation entered at 1795162967541, capture at 1795162967558,
readback requested at 1795162967563 and the complete image was published at
1795162967810 (269 ms total preparation/capture). At 1795162971847 the disk
boundary observed **1,495,150,592 bytes** and permanently closed the generation.
The Game-send helper then refused locally before command publication. There are
only commands 0–2, zero guest DOWNs and zero postclosure endpoint requests.
The disk watchdog's 1,507,221,504-byte minimum covers successful samples only;
the decisive throwing LOW observation above is the actual lower boundary.
The writer is UNKNOWN. Later recovered free space did not reopen admission.
No retry, successor, later capture or ordinary Quit attempt followed closure.
Living-enemy combat and ordinary Quit remain UNPROVED; host cleanup is not Quit.

All 22 supervisor-tracked descendants are nonlive, `leaked:false`. The direct
launcher, supervisor, watchdogs, browser, release participants and display waits
include actual close and both stdout/stderr EOFs. The new supervisor recorded
no termination signal; this original failed on LOW disk, not the historical
unknown SIGTERM. Unique logs and selected named images were copied, SHA-256
verified and fsynced before the owned tmpfs directory was removed. Git commit,
relevant binary diff and owned driver patches are the source archive; media and
module remain references to existing pinned paths. No production code change
or new build; unchanged passing controls/build were reused as requested.

Box ID null, state NOT_CREATED, expiry null, stop receipt null; root owns
shutdown. No workers, Python, Wine or deployment. Publication disposition and
the final precise blocker are recorded in `result.json`, written last.
