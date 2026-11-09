# SuperTux onward attempt: review-client capture handoff missed

The requested new coin, interactive question-block consequence, or level exit
was **not achieved**. The sole fresh original reached Welcome to Antarctica
and native Pause. I personally inspected all twelve setup images. I then
attempted the first `right-100` through the review page without first requesting
that client's own initial capture. Its choices were correctly disabled:
`createClient` starts with `current=null`; a capture made through the separate
setup transport does not supply the client's capture token. This was my
command-sequencing mistake, not an established emulator/runtime defect.
No production code changed.

Evidence: `scratch/runs/20261109-supertux-interactive-onward-0300/`.
`personally-inspected-frames.json.gz` names the exact images, original times
and SHA-256 values; the lossless originals are in `review/*.png.gz` and the
hash-addressed remote recovery set. `initial-pause` at **03:07:49.419Z** shows
Tux grounded on the snowy floor with native Pause visible. Score 50 and coins 2
were already present at level entry; neither is a new consequence of this run.
The first gameplay helper began about **5,943 ms** after that setup capture
and failed at **03:07:55Z** with `review choice disabled`, before `click()`,
HTTP submission, numbered game command, or physical gameplay input.
This was not a stale-frame refusal. The helper's newly opened review page had
no client capture. `failure-command-audit.json.gz` verifies zero accepted
Pause steps and zero review-client capture commands. No later game input or
capture followed the failure. Only ordinary no-input cleanup quit followed.
There was no retry, route, detector, replay, retimestamp, freshness workaround,
cap change, or new scenery/collision claim. The accepted first-enemy stomp and
floor landings remain prior evidence; the early snowy pillars remain scenery.

Offline preparation reused 0251 by exact SHA/size, including published
`df0932c1c` failure replies and the explicit `airborne=true`, `grounded=false`,
empty-key 200 ms neutral-settle helper. Neither airborne settling nor any
gameplay choice ran here. Exact singular Enter/ArrowDown/Escape composed
validation and accepted unchanged focused/build evidence were hash-verified
and reused, not rerun. `offline-reuse.json.gz` and
`repair-build-reuse-verified.json.gz` record the paths and hashes.
The final local/remote barrier matched **1,497 providers / 61,507,039 bytes**,
manifest SHA-256
`4fe8f43e8291ebb7a1889aa3e4067472de013254f335db06f78c2bfdfba619b4`.
Preparation selected current published providers at Git
`0060f6935fbed715655c59cf4efa28b5141ee963`; the CPU stayed
`a320d4c85156644fd12b6134d66b11784f3100b9b135756206c087cdacd43295`.
Native observation remained OFF. Small run-input patches plus Git preserve
source recovery; no source/media/module archive was made.

The exact Warcraft0244 release for `bx_6psgpzsk` was posted at **03:03:57Z**.
The board watcher actually waited 0 and awaited its tail, recording PID/start
and separate stdout/stderr EOF. The independent watchdog was prearmed at
**03:04:53Z**, UUID `28031804-57f9-4541-bf41-75f1bcf9361c`,
PID **913454/start224070253**, immutable deadline **03:29:53.176Z**.
Only then was **bx_bw4vg5br** created at **03:04:59.817Z**, TTL **1,493 s**,
initial `archiveAfter=03:29:52.671Z`; `expiresAt` was not returned.
The original began at **03:05:45.177Z**. No second original was started.

Browser.close received ACK and completed normally in **11,376 ms** under the
unchanged 30-second cap: terminal code 0, signal null, streams drained, no
escalation. The review client exited 0 with both EOFs. Both physical-drain
records report pending 0. The generic cleanup record still says
`pending="UNKNOWN; never replay"`; that field is preserved, not rewritten.
Custody verified **249 owned identities / 249 actual reaps / 2,434 events**,
including before-wait PID/start witnesses. Kernel parent **6345/start8843**
and outer parent **6339/start8832** actually waited 0 with separate stdout and
stderr EOF. Ports **36007, 42155 and 8787**, writable run FDs, active profile,
input/client locks and runtime lock drained. Historical CLONE_UNTRACED,
nonleader-exec and external-signal limitations remain UNKNOWN.

Recovery accounted for **214 retained regular files**, including pinned input
references, through **169 unique transports / 3,074,569 stored bytes**.
Original/stored SHA-256, sizes, independent reopen, GNU gzip CRC and exact-set
checks passed **before** delegated normal stop. The inventory's inactive
Chrome-cache exclusion selected zero files; unique game evidence was retained.
The box was archived at **03:09:01.171Z**; stop receipt
**stop_063972e579437d2e** completed **03:09:01.194Z**, `forced=false`,
`error=null`, final `archiveAfter=null`, `expiresAt` not returned.
The local runtime/Boat launch and watchdog-supervisor wrappers actually waited
0 with separate stdout/stderr EOF. Watchdog waited 0; its tail
**913455/start224070253** waited -15 with both streams closed.
Runtime release was posted at **03:09:17Z**.

Free `/home` stayed above 1.5 GB at recorded allocation/recovery checks after
coordinator-restored headroom. No local browser, local heavy execution, peer
box, agent/worker, RAM gate or deployment was used. Next work requires a
separately authorized fresh original: after setup reaches native Pause,
request and personally inspect the review client's initial fresh capture,
then submit the chosen bounded action promptly under the unchanged 12-second
bound. This run stops here under the first-owned-failure rule.
