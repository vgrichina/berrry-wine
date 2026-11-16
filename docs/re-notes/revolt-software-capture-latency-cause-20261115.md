# Re-Volt software capture latency, 2026-11-15

The retained original establishes an aggregate capture deadline failure. It
does not identify a slow subcall or prove an engine defect. No repair or new
original is authorized by that evidence alone.

Run: `scratch/runs/20261115-revolt-software-capture-latency-cause/`.
Runtime order: SimsLocalServer1677139, GTA2DirectX1699004, then this worker.
Until both current releases and personal direct-closure/PID/process-group/lock
checks, work was limited to retained/static evidence and newly authored inputs.
Historical UNKNOWN records stay closed; no original reconnect or replay occurs.

Sims released at 17:32:42Z, release SHA-256
`aba80362b3a6dfc8ed8abeb2dfd40d74af69aeec994d216b7bb13d924389e424`.
Personal checks verified nine release references, 105 actual waits with both
EOFs, and current absence of all 337 recorded PIDs/process groups. Its declared
failed baseline child wait and ancillary watcher EOF remain UNKNOWN. They are
not admission conditions for unrelated new work. GTA2 released commit
`cb30b2c6a0c0bc7bb57e074e0221f0f4ec90d6c2`, release SHA-256
`67f6e10d396adf4b01343444524d2a3496c56a6622aeb095936ec4226d5ed54f`.
Personal admission verified its five release references, 1,149 artifact hashes,
244 actual waits with both EOFs and current absence of 292 PIDs/groups. Sims'
337 PIDs/groups were rechecked absent. Both locks were free and /home had
4,552,830,976 bytes free. Runtime began only after these checks.

The original source pin is `abf5d6bb61786977b524df778787783a431e4a8b` plus
`original-source-uncommitted.patch` in the preceding run. The actual controller
imports `scratch/runs/20261108-redline-car-door-native/bound-input.cjs`
(SHA-256 `6afe28a48024594b971fd060733c7bdfe47fbe3a6e596bd3da1886c59d723777`).
`tools/cli-gameplay-helper.cjs` does not exist in this checkout. The retained
helper imports only Node assert and crypto. Its page/guest/render expressions
reach the runtime through CDP, rather than importing guarded CLI input.
`lib/cli-guarded-input.js` and `lib/cli-native-scene.js` remain relevant guard
references, but are not imports on this controller's capture path.

Capture runs a complete live observation, takes a full page screenshot, then
runs another complete live observation and checks identities again. Each live
observation reads page identities, enumerates live guest Worker instances,
retrieves and hashes actual guest module bytes, finds the owning render
endpoint, retrieves and hashes its actual module, then rechecks page references.
No required stage can be removed merely to fit the deadline.

The final retained request, number 190, was issued at 16:50:05.462Z. The
operation became permanent UNKNOWN at 16:50:08.322Z: 2,860 ms later. That is
less than the fixed three-second per-request bound. The aggregate operation
timer ended the operation first. The trace lacks expression text, begin/end
events and replies, so queue residence, expression execution and reply delivery
are all UNKNOWN. The final request's session is absent from both the retained
executed-source inventory and the last completed scene's Worker inventory;
assigning it a known owning Worker would be a guess. There are 190 total
requests, zero input requests and zero requests after UNKNOWN.

The new focused test verifies retained release hashes, exact source pins,
capture structure, request numbering and terminal closure without executing
the controller/helper/runtime. Its diagnostic expression candidate uses unique
nonces and separately records body entry, body completion and reply data. Its native results below remain distinct from any game-cause claim.
Synchronous values, multi-statement completion values, fulfilled promises and
rejected promises retain their results under the diagnostic wrapper in the authored instrumentation controls.

The authored native fixture creates a Win32 HWND and D3D3 software device,
an auxiliary native guest thread, and a varying count of real triangle draws
per frame. Its independently specified color is RGB (51,68,204), with native
surface GetDC/GetPixel/ReleaseDC required to return COLORREF `0xcc4433` before
capture qualification. Success is then published by native SetWindowTextA
on that HWND; guest debug logs are not forwarded in this configuration. A
readback error remains a failure. The driver
retains pin hashing, both complete live observations, the screenshot and the
controller's backend post-observation inside one fixed three-second operation.
The original's full 766-pin, 70,464,841-byte read-only hash workload is retained
by reference, including existing media paths; no game media is copied or run.
The prior fixture's 323 pins covered only 32,820,869 bytes. Byte counts do not
assign latency to hashing. Any runtime source differences from the original
are recorded explicitly rather than treating a later build as its exact pin.
It separately records native HWND generation/process/thread/focus/capture/modal
state, physical keys UP, layout and an observation nonce/intent. Natural queue
latency under actual native draw work remains distinct from explicit delayed
promise-body and delayed transport-delivery controls. A separate queue fault
parks only the authored guest Worker with a timed Atomics.wait before issuing
an observation; its entered marker and absent queued-body marker are explicit
fault evidence, not native draw latency. The latter are fault
controls and cannot establish the original game's cause.

The actual unwrapped production-transport baseline passed three complete
captures in 2,918 / 1,813 / 2,654 ms. The diagnostic baseline passed in
2,108 / 1,690 / 1,457 ms. A separate real 64-draws-per-frame fixture passed in
942 / 906 / 1,240 ms. These are whole capture operations, including the original
read-only pin workload, both full helper observations, screenshot/file output,
and independent backend post-observation. Each successful scene also passed
native GetPixel, 165,487 exact known-color captured pixels, live HWND generation
1, process/thread ownership, focus on HWND 65537, no capture/modal and physical
keys/mouse UP. The images are authored blue triangles, not Re-Volt progress.
Timing variation between these separate runs is not a before/after repair or
proof that more native draws improve capture speed.

Injected queue control measured 2,373 ms from request issue to expression body
entry, a 0.19 ms body and 2,387 ms total reply. Its 2,400 ms timed Atomics.wait
parks only the authored guest Worker. The body control deliberately awaits a
3,200 ms promise and closes at the fixed aggregate three-second deadline. The
delivery control completes a 0.44 ms body, receives raw reply 21 ms after issue,
but withholds parser delivery and closes at the same deadline. Each UNKNOWN
records permanent closure, locally refuses later evaluate/screenshot/input,
and has zero later requests and zero input. None is a game-cause observation.
The source negative refuses actual module bytes against a wrong expected hash;
the backend negative refuses actual software ownership against WebGL. Actual
identity values also exercise every helper identity-field replacement refusal.

Earlier authored attempts remain failures: unforwarded-debug-log readiness
expired (561 requests), a complete capture then native-focus refusal (93),
a diagnostic script wrapper SyntaxError (18), and an injected-block-entry marker
not observed before its readiness limit (200). Each endpoint was permanently
closed without later requests or input. The authored inputs were corrected in
new fixture sessions; no original was retried. Exact tested owned-source
versions are recoverable from hash-verified new-file patches.

The real elapsed-time stale negative passed against the actual helper at
120,012 ms: zero dispatches, zero additional requests, no clock changes and no
replacement capture. This tests the helper's 120-second rejection; it does not
relax the controller's five-second gameplay/thirty-second menu policy.

Full locked shared and HEAD-plus-whole-owned builds passed, as did the focused
controller protocol checks in both views. HEAD source commit
`d57a9dfc3eb9268de160752dc8a6a92c7bbe438c` produced module SHA-256
`ed7abcb17bc968d876e8d5ca598f4cb947c6a020dc9039c99ec31f86277c2bf6`.
Its unwrapped actual native scenes passed in 1,152 / 1,184 / 1,504 ms with the
same native readback, pixels and ownership/context guards. The read-only overlay
serves HEAD sources plus the whole new owned test. The unrelated untracked
`lib/wininit-boot.js`, present in the original's broad hash list, remains only
unchanged read-only hash workload: it is absent from HEAD and cannot be served
as HEAD source. Runtime pins distinguish this role explicitly. Thirteen foreign
source files remained byte-exact after the shared and HEAD builds. The final
shared restoration build passed and restored module SHA-256
`878e49103bdeff048d0685ecc47a23d4f769310d66776a7e9fdbb2e884c9d7dc`.
The final retained-evidence/instrumentation controls also passed.

No necessary generic capture defect has been demonstrated, so no production
source fix is made. The precise remaining blocker is evidentiary: the original
aggregate timeout has no request-expression/reply/body boundaries or identified
last target, while the new real-native captures complete under the fixed bound.
Injected delays qualify diagnostic separation and closure only. A new Re-Volt
original is not authorized; none was launched. WebGL is withheld, and no native
Quit, checkpoint, lap or result is claimed. The Q3 strict packet-count 14-versus-6 failure is not
changed or waived. No wider deadlines, observation removal, source/endpoint/
owner/current-scene/pixel/freshness bypasses or WebGL substitutions are proposed.

Selected full screenshots were personally reviewed and moved, without copies,
to result-named PNGs in the run directory. Actual OS waits and both pipe EOFs
cover native, watchdog, supervisor-child and outer-owner processes. The
ancillary messageboard watcher returned exit 143 through the tool API; its
separate pipe EOFs remain UNKNOWN and are excluded from sealed runtime receipts.
Its PID/process group are absent.

No box has been created: ID null, state NOT_CREATED, expiry null, stop receipt
NOT_APPLICABLE.
