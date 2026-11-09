# SuperTux early-choice pillar attempt

The single authorized original stopped on the worker's **incorrect menu command**,
before any native input. A fresh main-menu screenshot was personally viewed,
but no gameplay, pillar jump, onward movement or first-level exit was verified.
No production defect was established, and no production code changed.

Evidence: `scratch/runs/20261109-supertux-early-choice-pillar-0016/`.

## Actual last command and stop

Capture `menu`, at **2026-11-09T00:35:04.386Z**, shows Start Game highlighted.
Its PNG SHA-256 is
`e81287308be139c4c32bb2fa4fd8517e9b5830a4e0ab51897e7fddc1fb9598f0`;
the compressed local image is `review/menu.png.gz`.

After viewing it, the worker invoked `setup.py start-game keys Enter 100 ...`.
The retained driver accepts singular `key`; it does **not** accept `keys`.
The resulting command was number **1**, ID `start-game`, action `keys`, keys
`["Enter"]`, hold 100 ms, review reference `menu`. At **00:35:14.653Z**, its
allowed-action assertion produced the first sticky UNKNOWN, before dispatch.
The client-side request subsequently reached its existing 30-second missing-ACK
deadline. There was no retry, refresh, extra capture, replay, second life or
second box. `original/native-input.json` is exactly `[]`, and terminal physical
pending input is **0**. Enter was requested but never dispatched; the only
completed numbered command was the initial capture.

The remote command began at 00:35:14.535Z, **10,149 ms** after capture. This
missed the intended 8-second early-choice target, even for the menu. It does not
establish that paused gameplay review fits the later phase checks of the
unchanged 12-second controller. No native Pause/grounded gameplay image was
obtained, and no HTTP gameplay choice or `jump-right-200` was issued. The
published HTTP review client was running, but this attempt failed during menu
setup. There are no new score/coin gains or death observations to report.

Historical 2356's 24 right-100 ms actions, initial score 150/six coins, and
11,777/12,100 ms boundary remain that earlier run's evidence. Historical 2330's
local status-143 cause UNKNOWN and 2356's preallocation heartbeat CRC failure
remain unchanged; neither is a failure of this run's recovered transports.

## Providers and slot

No Q3 box was accessed. Q3's exact archived/drained **RUNTIME_RELEASE at
00:22:55Z** was checked before allocation. The first local watcher incorrectly
matched an acquire line mentioning an earlier release; this was caught before
allocation. The replacement watcher missed the release already in history;
the ten-minute fallback check found it, and the watcher was interrupted and
actually awaited with its gzip stream closed.

The initial offline canonical check refused the old 2356 build-module pins.
The coordinator's 00:18:01Z authorization selected the current tested
`cc2cb5a31f0a65c49364394e2d8c7e10ce2f6dc5` module, with native observation OFF.
Standard module SHA-256:
`a320d4c85156644fd12b6134d66b11784f3100b9b135756206c087cdacd43295`
(2,185,596 bytes); compatibility module:
`bf7aa00db5459f0bd1f4721c31e7c96a03c80ffd4a4339891e7b487abd70f462`
(2,188,242 bytes). This was a current-module attempt, not a reproduction of
2356's module. Existing 2358 off/on core/native parity and locked-build records
were read and bound by PATH+HASH, without repeating unchanged tests.

The refreshed canonical local and final remote barriers passed **1,398 providers /
61,341,977 bytes**, including the published `e78cb70d2` review client. Both used
manifest SHA-256
`408afd8d6573131f02b26d6ef40eb5a460e526c06db33b1d76604aefc834a8e9`.
Composition verification/compilation passed. The exact Git-blob resolver and
retained recipes were reused with small run-specific wrappers and manifests;
preload order, input, options, ACK bounds and controller caps stayed unchanged.
Evidence uses Git SHA plus small owned patches, not source archives or repeated
media/module copies. No unrelated peer edits were adopted.

## Recovery and normal shutdown

An immutable UUID/deadline and independent observable watchdog were armed before
the only create. Deadline: **00:58:08.786Z**. Box **bx_5w27v39f** had TTL
**1,493 seconds**, initial `archiveAfter=00:58:08.148Z`; `expiresAt` was not
returned. Browser execution started at **00:34:17.941Z**.

Local launch PID **686559**, start **223166622**, actually waited **0** with
stdout/stderr EOF. Remote custody parent PID **6593**, start **9717**, waited
**1**; its outer PID **6592**, start **9708**, waited **0**, both with EOF.
Chrome closed normally: Browser.close ACK, exit **0**, signal null, no
escalation, drained in **10,729 ms**. Review client PID **6903**, start **12865**,
exited **0** with both streams at EOF. Custody checked **1,583 events**, **174
owned PID/start identities** and **174 actual reaps**, including before-reap
witnesses. Ports **35209 / 35727 / 8787**, writable run FDs, active profile,
input lock, runtime lock and client lock were drained. Existing untraced-clone,
nonleader-exec and external-signal coverage limits remain explicit.

Before delegated normal shutdown, all **68 remote regular files** were accounted
for: **62 evidence files / six source references**, **56 unique gzip transports**,
**755,275 stored bytes**. Independent reopens checked original/stored SHA-256,
sizes, nested GNU gzip CRC and the exact retrieved transport set. Source
references stayed pinned rather than copied into recovery.

The box was **archived at 00:36:29.227Z**. Receipt
**stop_6b2cd9de0ac76234** completed at **00:36:29.245Z**, `forced=false`,
`error=null`; final `archiveAfter=null`, `expiresAt` not returned. Watchdog PID
**684588** actually waited **0**, its tail **684589** waited **-15**, with EOF
and supervision awaited. Archived/drained RUNTIME_RELEASE was posted at
**00:37:10Z**. No heavy runtime remains. Free-/home samples stayed above
1,500,000,000 bytes; no RAM gate, peer/old deletion, agents or public deployment.

This task stops after publishing the failure note. Any later attempt requires
separate authorization and must use the accepted singular menu action; this run
does not authorize another original.
