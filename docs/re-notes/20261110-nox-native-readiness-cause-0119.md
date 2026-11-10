# Nox native readiness: reuse the durable release service

Evidence: `scratch/runs/20261110-nox-native-readiness-cause-0119/`.
Prior fixture repair: [visible pointer publication](20261110-nox-visible-pointer-fixture-0110.md).

The retained failure is before CDP or guest admission. Chrome PID 6128 was in
`ptrace_stop.part.0`, state `t`, with zero user/system ticks in all 101 samples.
The monotonic sample window was 10164.210123 ms. Twenty-two synchronous journal
writes overlapped 10125.790473 ms of it; nested fsync calls overlapped
10117.760935 ms. These totals overlap each other and must not be added.
Kernel records show real fork/exec/signal stops and releases for that launcher.
This identifies tracer durable-service delay at the launcher boundary; it does
not establish a Chromium internal fault, device-only latency, or guest failure.
The browser was alive but repeatedly stopped, not independently making progress.

Nox now generates `custody-run.py`, reusing the published Q3 release-cohort
adapter from `7607cab84`. Its authenticated `load()` supplies the shared kernel
supervisor; Q3's app-specific observation wrapper is not used. Both Python
inputs are exact size/SHA pins in the reviewed full closure and are checked
before loading. The Q3 adapter and shared custody provider are unchanged here.
The native caller must use this generated entrypoint. Browser readiness remains
100 polls of 100 ms; protocol, runtime and cleanup deadlines are unchanged.

The actual generated consumer was exercised under real ptrace with a Node
browser peer, twenty real fork/exec children, delayed port publication and
80 ms synchronous storage service. With the old Nox adapter it exhausted all
100 polls, admitted no protocol and reaped 38/38 tasks. The reused service
published readiness at poll 56, completed ordinary shutdown and reaped 38/38.
Fsync count fell from 170 to 95. Missing-port and malformed-port controls
remained terminal with zero protocol, actual child waits, separate stdout and
stderr EOFs, full kernel drains and unchanged deadlines. Adapter/provider
corruption controls refused before load. This is a causal offline service
control, not a claim of native Chrome or compositor acceptance.

Readiness repair `bce2b316f` was published before the sole native attempt.
The generated fixture publication, foreign-owner and changed-image controls
and twelve observer command/image bindings passed, as did the locked build.
A second local plan inspection initially refused existing provenance patches
with EEXIST. Using a fresh plan directory resolved that packaging error before
allocation; both the error and passing result are retained. The native plan
pins the exact published readiness commit, and its inputs match the tested
offline closure byte for byte. No source archive or repeated media copy was made.

Native readiness succeeded: four polls, 460.687499 ms in the monotonic sample
window, followed by Browser.getVersion and the final app-selection boundary.
The exact first fixture PNG was separately model-viewed and hash-checked. It
shows the dark fixture panel, title, green TARGET and initial yellow crosshair.
The review authorized one native center click with independent 150 ms release.

The first live failure was the fixture's document-level DOM count assertion
`1 != 2`, before its after-image. The owning supervisor received immediate
pidfd SIGTERM after the terminal record was observed. No later game protocol,
input, capture, retry, quit or deadline extension followed. The conditional
original was not started; Jack, Bunker and staff impact remain untested.

Retrieved records prove renderer handleMouseDown and handleMouseUp at logical
(320,240), matching DirectInput delivery types 1 and 2, tail 2 and final buttons
zero. The document observer saw trusted mousemove and mousedown, but no mouseup.
The source-backed cause is separate from readiness: browser-input.js installs
windowMouseUp at window capture after mousedown; it stops propagation before
the observer's document capture listener. The bridge successfully delivered
release. This is a fixture observation failure, not guest nonresponse or lost
native release. Exact source pins and the native facts are retained in
`native-observation-cause.json`.

The same worker reproduced this with the actual generated consumer by correcting
the offline peer's capture order to window → document → target and honoring
stopPropagation. Previously the peer delivered document events first, hiding
the bug. The fixture-only observer adapter now routes mouse listeners to window
capture before the bridge arms drag capture; pointer-lock events and getters
remain on document. It still requires both trusted down/up events. The shared
observer, production input bridge, Q3 adapter and custody provider are unchanged.
All four final generated controls passed: positive, foreign owner, changed PNG
and dropped release. Every negative remained terminal before the after-image,
with actual child waits and separate EOFs. The final locked build passed.
This second repair is tested offline only: the single
native attempt had already ended, and no additional native attempt was made.

Cleanup reaped all 151 owned tasks with complete kernel fork lineage, actual
parent wait 1, separate stdout/stderr EOFs, no surviving named processes, closed
ports and absent profile. All 102 artifact references (99 unique contents,
1543280 unique bytes) were retrieved and independently reread by SHA-256 and
size, with gzip/PNG validation, before the sole normal unforced stop.

Box `bx_k96mm34m` is archived, expiry null, independently confirmed with stop
receipt `stop_12fe81b31d1f856b`, completed unforced at
2026-11-10T01:32:07.104Z. Prearmed watchdog UUID
`3e7c40a6-1bcf-48f2-bdfb-7bb414831d55` retained its immutable deadline
2026-11-10T01:54:51.093Z; initial API expiry was 01:54:52.434Z. Its independent
supervisor recorded actual watchdog wait 0 and separate EOFs. Home remained
above 1.5 GB free. No owned live box remains; `bx_xk729gjr` and all other prior
boxes were untouched.

Next is a separately authorized native fixture for the window-observation
repair, then the conditional Jack/Bunker staff route if that fixture passes.
