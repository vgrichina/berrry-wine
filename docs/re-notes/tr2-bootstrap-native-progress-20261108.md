# TR2 bootstrap and native-key preflight repair — 2026-11-08

The prepared real blank-Chrome delayed-bootstrap regression passed before
allocation. The one authorized fresh attempt then demonstrated a different
integration failure: the blank-page native-key preflight required cold CDP
keydown delivery to acknowledge within the minimum 50 ms hold. It failed closed
before game navigation. A generic run-driver repair now qualifies blank-page
keys with 500 ms bounded holds and preserves per-key receipts. A real local
Chrome regression reproduces the former failure and passes the corrected path.
No second original was launched. TR2 movement, weapon consequence and exact
qualified original joins remain unobserved in this run.

Evidence: `scratch/runs/20261108-tr2-bootstrap-native-progress/`.

## Bootstrap prerequisite and source

The unchanged prepared fixture from `3c152960c` launches one deliberately delayed
blank native Chrome. The former 100 × 100 ms reader fails with ENOENT after
**10,034 ms**. The corrected reader observes a valid endpoint after **11,253 ms**,
inside its absolute 30-second startup cap and immutable overall/cleanup reserve.
Browser.getVersion and SystemInfo.getProcessInfo succeed. Chrome exits 0;
all enumerated owned PIDs are absent, port 36333 is closed, and its profile is
removed. There is no guest, HTTP server or game input in this prerequisite.

The local `wine-runtime.lock` is held only for that actual local Chrome runtime,
then released and acknowledged on the board before allocation/provisioning.
Remote provisioning, supervision, retrieval and reasoning hold no local runtime
lock. The remote browser uses its separate runtime lock.

The staged source commit is main
`098bda796b2ed168d500a2fd9f8e4e07abd8ec4e`.
All **558 tracked runtime inputs** exactly match accepted repair `0e951a0be`;
all **595 input pins** pass before allocation. The driver preflight starts no
Chrome or original. All six served bootstrap responses match their pins.
The staged module SHA-256 is
`6cf120d0d3b3db1823a8105eb26ef52a9093a7f871c37a46117475e213fda1c0`;
no executing game module or owning WebGL binding is claimed.

The eight focused bootstrap checks and accepted actualWorkers full-size 4096
live arm, queue-capacity, association, handoff, retirement/concurrent-arm controls
and nine-process fixture costs are reused without standalone reruns. Peer WIP
is excluded. This task changes run-specific inputs only; no production emulator
source, WASM or production-build claim is introduced.

## First new fault and tested repair

On fresh box **bx_zf338rzj**, corrected startup reaches DevTools in **4,209 ms**.
At **10:07:50.366 UTC**, the unchanged `bound.hold` guard throws
`input delivery exceeded hold bound` during the blank-page trusted-key loop.
That loop used 50 ms holds. Its independent release begins by the hold deadline;
keydown acknowledgment arriving later is terminal. The failure does not retain
an individual hold receipt, so the exact offending key and acknowledgment
latency are unknown.

`launch.json` is absent. No native Graphics review/default-OK Enter, game route,
owning WebGL/module binding, observation arm or original publication occurred.
There are no original commands and no Up, Space or Control delivered to a game.
This failure was not retried.

The owned `native-preflight.cjs`, called by the corrected `browser-run.cjs`,
uses **500 ms** holds for the same six blank-page keys. It records each successful
or failed hold, requires twelve trusted and correctly ordered keydown/keyup
events, and retains the invalid-duration zero-event checks. The existing
50–2000 ms physical bounds, sampler-independent release timer, late-delivery
refusal, terminal UNKNOWN/no replay, immutable run/cleanup deadline and all
scene/identity/writer/source/canonical/display/lifetime gates are unchanged.
This is a larger preflight hold within the established bound, not a retry or
extra time added to an admitted gameplay hold.

The real blank-Chrome regression passes five cases:

- A controlled **90 ms keydown acknowledgment delay** reproduces the former
  50 ms failure; actual browser events remain trusted and balanced.
- The same delay passes all six corrected 500 ms holds with twelve trusted,
  correctly ordered events and invalid durations causing zero events.
- A **650 ms** acknowledgment delay still refuses the first corrected hold,
  releases it, stops the remaining key list and records no replay.
- A **750 ms passive sample** cannot postpone a separate 100 ms key release;
  the sample is marked outside the hold.
- A transport UNKNOWN releases the attempted key, stops the list and never
  resends keydown.

The controlled delays model the integration condition; they are not measurements
of the original remote acknowledgment latency. This regression never leaves
about:blank. Its actual Chrome exits 0, all enumerated PIDs are absent, port
37489 is closed and its profile is removed. The local runtime lock is released
again. The corrected helper and driver pass syntax checks; the corrected driver
has not launched another original.

## Recovery, accounting and lifecycle

Git is the source archive: `source-sha.txt`, `source-audit.json`, `relevant.diff`,
original `runtime-pins.json`, small owned new-file patches and `repair.diff`
identify exact inputs. `browser-run-original.cjs` matches the original driver
pin; `repair-runtime-pins.json` identifies the corrected closure for future use.
Media remains at existing paths referenced by size and SHA-256 in
`media-refs.json`. Unique logs and pinned modules are retained without a
source/media archive. TR2 has no exact candidate-corpus entry; this remains an
investigation note, not an unrelated candidate dashboard attachment.

The original driver's early close also records `runningApps is not defined`
while attempting to retire a journal on about:blank. It then drains Chrome with
its bounded fallback. The first custody check retains a failed profile-absent
assertion: two residual Chrome profile files remained after Chrome exited.
After all known Chrome/controller PIDs were independently absent, those owned
residual files were inventoried by path/size/hash and the profile was removed.
The distinct final custody check passes: all owned PIDs absent, HTTP port 46087
and DevTools port 39885 closed, profile/writer absent, no matching owned process,
Chrome exit 0, all 595 pins unchanged, no original navigation or commands.
The earlier failed custody assertion is preserved.

All **23 remote artifact references, 23 unique hashes, 4,379,955 bytes** were
retrieved and independently reread for size/SHA-256 before requesting normal
stop. A local retrieval-finalization NameError occurred before that request;
its completed inventory was retained, then independently verified locally
without rerunning the remote inventory or runtime.

Both normal shutdown and an observable independent **25-minute watchdog** were
armed before creation. Initial active expiry was **10:32:04.476 UTC**. Normal
stop receipt **stop_a52b82ea23831723** completes at **10:09:08.899 UTC**,
forced=false, error=null. Final box state is **archived**, stopped
**10:09:08.878 UTC**, active expiry **null**. Both lifecycle delegates exit 0;
their supervisor exits with no children. Launch disk exceeds 5 GB.
No old-box resume/delete, second original, public deployment or subworker occurs.

Final original accounting is explicitly **raw=null, qualified=null,
discarded=null (unobserved)**. There is no Join to partition, so
`raw = qualified + discarded` is not asserted as a fabricated 0=0+0.
No empty-Join or zero-FPS inference is made. Next requires fresh authorization
for the corrected preflight, then native Graphics default-OK Enter, actual owner
and module, full-size live arm and exact qualified source/canonical/display rows
before separately reviewed bounded Up/Space/Control. The PC manual documents
Up running, Space weapon draw and Control action; pistols have unlimited ammo
([original manual, pages 2, 5 and 7](https://cdn.akamai.steamstatic.com/steam/apps/225300/manuals/manual.pdf)).
Weapon/ammo consequence, full27, backend parity, audio, game FPS and simulation
FPS remain open.
