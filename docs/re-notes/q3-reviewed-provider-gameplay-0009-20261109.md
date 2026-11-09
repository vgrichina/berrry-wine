# Q3 original with screenshot completion telemetry — 2026-11-09

One fresh original reached the main menu and Q3DM1 Arena Gate level selection.
Actual movement, firing, in-world rendering and death remain UNVERIFIED. The
original ended at the first command UNKNOWN; there was no replay, extra capture,
second original, cap/options/ACK/input change or speculative GPU/emulator cause.

This run reproduced and repaired an actual diagnostic defect. Successful
screenshot300 returned in **52.595394ms**, but later completion snapshots called
its record age **39,546.316ms**, then **41,338.187ms**, `elapsedMs`. This falsely
made a completed fast capture look slow while screenshot343 was pending. The
helper now records the first response/send-failure/CDP-deadline settlement and
keeps that elapsed interval fixed; `ageMs` separately describes record age.
A response after CDP deadline preserves the deadline interval and sticky UNKNOWN.
The owning composition pins the new helper. The marker-clock source from
7227918eb is byte unchanged, SHA256
1858eea7efb8875e44088ffe9f5ea434c3b22915444113204fb51673e4f5ac0d.
This corrects duration attribution; it does not fix screenshot343's missing reply.

Evidence is in `scratch/runs/20261109-q3-reviewed-provider-gameplay-0009/`.
The exact retained completion log is selected with original/stored SHA and sizes
in `actual-duration-selection.json.gz`; `actual-duration-replay.json.gz` verifies
the correction on those actual events. Focused controls exercise the composed
send/receive functions over a real localhost WebSocket and actual numbered
consumer, including the unchanged real20s deadline, wrong sessions, late replies,
no ACK/replay, lifecycle events and bounded storage. The added duration regression
covers successful/error replies, pending capture, send throw and late reply after
deadline. All seven controls passed with socket/server closed, pending0/timers0
and actual wait0/EOF. The repaired canonical full local check and final locked
build passed. The first locked build refused a peer's active producer-hash WIP;
that owner refreshed its reviewed pin before the final build. These offline
protocol controls provide no synthetic gameplay proof.

SuperTux2356's explicit archived/drained RUNTIME_RELEASE at00:08:23 preceded
allocation. The final canonical914-provider local prelaunch passed against Git
cc2cb5a31f0a65c49364394e2d8c7e10ce2f6dc5 with no relevant tracked WIP. A fresh
UUID, independent observable25min watchdog and finite1499s TTL were prearmed.
The identical full remote provider barrier preceded the sole original claim.
Composition remained before execution preload. The current Q2-published CPU
module was pinned and actually observed in the browser:
a320d4c85156644fd12b6134d66b11784f3100b9b135756206c087cdacd43295,
2185596bytes. This is a current-module attempt, not the prior2337 module.
Accepted unchanged controls, including0003's nine prelaunch controls, were reused
by verified PATH/SHA. Git SHA plus small relevant patches retain source identity;
there are no source archives, repeated media/module copies or peer edits/deletion.

Four captures completed and were personally reviewed: startup, singleplayer,
enter-menu and fight. Commands0–2 have actual ACKs. Native click/Enter evidence
does not establish DirectInput polls or simulation steps. The FIGHT click's
capture remained at level selection, with the cursor near SKIRMISH; its host ACK
was not called guest acceptance. One subsequent reviewed500ms Enter had an
independent UP and settled physical-release promise, then attempted its ordinary
capture. Command3 `activate_level` hit first UNKNOWN at00:21:52.030Z, no ACK.

The new completion log records screenshot343 at00:21:33.817Z, session
9794E37A7491B85C6E74869A4031BE8B, original `{format:"png"}`, send returned
about0.601ms later. There is no raw response for that request through its
20,003ms CDP deadline or transport close; no late response or routing/session
mismatch was observed for it. Existing page evaluations344–347 returned while
the screenshot was pending. PAGE/guest/renderer owner reads342/337/339 returned
before submission; there were no such owner replies during it. The render owner
reported apiGL/backendWebGL, failed:false, control:null. No frame/context/target
replacement event was recorded between submission and first UNKNOWN; absence
does not prove continuity. Target detach/destruction followed Browser.close.
This narrows the observed boundary to a submitted capture with no raw response;
it does not distinguish compositor/readback internals or prove their cause.

Automatic first-failure close received Browser.close ACK; Chrome exited0 without
signals, normal:true/drained:true in16876ms under the unchanged30s cap. Runtime,
native command and outer launch status1 are preserved. All240 owned tasks had
actual reaps and before-wait PID/start witnesses across2226 journal events.
Actual parent wait/EOF, ports33557/44001 closed, absent profile/writer lock,
empty runtime FD holders and a drained runtime lock were checked. Untraced clone
flags and nonleader completeness remain UNKNOWN; historical local143 is unchanged.

All92 remote regular files were recovered or identified as exact pinned inputs;
88 unique retained artifacts total2016806 stored bytes. Independent rereads check
stored/original SHA256, sizes and GNUgzip CRC before delegated normal stop.
Box **bx_xh3swzjg is archived**, stopped00:22:36.249Z. Stop
**stop_30cf9529bd252586** completed00:22:36.266Z, forced:false/error:null.
Initial expiry/archiveAfter was00:43:02.249Z; final archiveAfter:null and no
separate expiresAt returned. The watchdog had actual same-shell wait0/EOF;
allocation/watch parent also wait0/EOF. Explicit archived/drained RUNTIME_RELEASE
was posted00:22:55. No runtime remains held by this task.

Next: investigate the missing raw screenshot343 response using the retained
actual session/lifecycle records. The duration repair is tested offline and
does not authorize another unchanged original or extra screenshot retry.
