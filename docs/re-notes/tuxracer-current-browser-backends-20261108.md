# Current original Tux Racer browser races, 2026-11-08

Original `tuxracer_original_061a` completes **Practice → Frozen River** on
both current browser backends. Personally inspected native **Race Over** and
subsequent **Best result** screens agree within each run:

| Actual backend | Race Over / matching Best result | Reviewed race progression |
| --- | --- | --- |
| WebGL 1 | **02:02.96, Herring 19, Score 0 / 000000** | 00:12.17 / 0 fish; 00:34.87 / 2; 00:51.26 / 7; 01:07.77 / 7; 01:27.12 / 12; 01:48.08 / 18; finish. |
| WAT software GL | **01:50.50, Herring 15, Score 0 / 000000** | 00:19.11 / 1 fish; 00:34.02 / 2; 00:48.86 / 3; 01:07.12 / 6; 01:30.36 / 11; finish. |

Evidence belongs to ignored
`scratch/runs/20261108-tuxracer-current-browser-backends/`.
This documentation-only change requires no emulator repair. The accepted
historical browser finish and GLU power-of-two/alpha repair in [tuxracer.md](tuxracer.md)
remain accepted. Earlier October 30 CLI title/loading investigations do not
override the later browser success or these current completed races.

## Original route and controls

Each fresh browser follows ordinary **Enter → Main Menu → P → Practice /
Frozen River → Enter → native race**. Native Up, Left and Right are finite
physical key holds with independently armed release timers. Up uses 2000 ms;
Left and Right use 750 ms; menu keys use 100 ms. Captures include the held
interval and released state. Up frames show paddling/downhill progression;
steering changes Tux's bank/orientation and course position. After each hold,
the bound capture reports all four host arrow states zero. These observations
establish ordinary race input and release, without claiming isolated physics
conformance or equating passive counters with guest keyboard polls.

Both routes show textured snow/ice and mountains, Tux, flags/herring,
recognizable trees with transparent silhouettes, and readable changing HUDs.
The reviewed finish frames include a black rectangular backing behind the
speed readout. This bounded review is not a claim of flawless rendering.
Different viewpoints, race paths and displayed times do not establish pixel
parity, competitive clock accuracy or FPS. Audio quality and full27 remain open.

Before allocation, the actual `request-safe.py` → numbered publication →
consumer → exact ACK path passed generated positive requests with real
**0, 1000, 2000 and 10000 ms waits**, the exact upcoming Enter/P/Escape/arrow
keys, 100/750/2000 ms holds, and qualified optional Up+steering combinations.
Only the single-key routes were used in the original. No mouse action was
needed. Oversized waits, post-UNKNOWN input and insufficient immutable-deadline
budget publish no command. All eight existing MW3 deadline regressions pass;
the independent-UP control passes slow observation and injected UNKNOWN.

Preallocation qualification first exposed that the reused run-local helper
lacked `p`. That generated consumer stopped; no original existed yet. Adding
the ordinary P mapping to the owned helpers and using a new generated stream
passed. A second generated attempt rejected reused local IDs before publication;
the final qualification uses distinct IDs. These failures are retained. The
runtime source and guest bindings were unchanged. Original commands have no
UNKNOWN, replay or refused input. Capture/admission binds the actual process,
guest Worker/module, owning render endpoint/Worker/module, epoch and canvas.
Every dependent scene was personally inspected before further native input.

## Actual backend and build identity

WebGL's unique live `WebGLBackend` belongs to the owning render Worker and
GL endpoint 1. It owns a non-lost `WebGLRenderingContext`, WebGL 1, with ANGLE
reporting Intel UHD Graphics 620 / Mesa 23.2.1, OpenGL 4.6. The main guest
and renderer CPU exports both return `gl_sw_enabled() == 0`.

Software GL's unique live `OpenGLHostBridge` reports backend software,
software-consumer true, context 1 for HWND 65537, current owner 0/context 1,
and a software backend. Its export memory is the renderer instance's memory.
The main guest (endpoint 1 / slot 0) and renderer CPU exports both return
`gl_sw_enabled() == 1`; a race observation records 709 guest software presents.
The audio thread's separate CPU reports zero, and legacy endpoint 2 uses WebGL
for presentation. Neither is substituted for the owning software GL context.

Both browsers run Chrome **151.0.7922.108**, V8 **15.1.206.16**, with native
viewport and browser guest threads enabled. Live debugger-retrieved guest and
renderer modules match the staged 2,182,500-byte standard module:
`f9650607181301b5d2a9990420f437bd9f1ca10d40ac73067339f07499d53121`.
The compatibility module is also retained by hash.

Runtime source Git is **`7ce76eae9ed98a9cac0b23f609c2fbc5857e4f3f`**, with
empty relevant tracked binary diff and the retained untracked
`new-lib_wininit-boot.js.patch` dependency. The exact pinned closure is in
`runtime-pins.json`. `fixture-identity.json` records all **158** canonical
original media paths/sizes/SHA-256 values and the **157** browser mounts;
the original inventory hash remains
`2c2d29a9dc7e5f9bc9e972b408fd83dbb17e8ca48a6aed09ffd375830284d8d8`.
No media or source-tree archive was created. Owned helpers and this note are
preserved as new-file patches; Git plus the recorded patches is source recovery.

Two extra historical static test invocations did not provide new acceptance:
the registration test stops at its stale `test/run.js` SHA pin, before asset
checks; the staging test was invoked without its required argument. It was
not rerun because its recipe moves the shared fixture and writes outside this
run. The complete canonical hash/mount preflight and actual served browser
closure checks provide this task's original-media validation.

## Resource closeout

One fresh UUID-created box, **`bx_dsjw226m`**, was allocated at
**01:08:27.557 UTC**, initial expiry **01:33:27.397 UTC**. The detached
supervisor, 25-minute watchdog and normal-stop delegate were observable before
allocation; the immutable local deadline is **01:33:27.200 UTC**.

WebGL Chrome exited normally at **01:13:16.681 UTC**. Its controller/browser
PIDs, two ports and profile were proved absent before software GL launched at
01:13:30.768 UTC. Software Chrome exited normally at **01:17:22.623 UTC**.
Both controllers and browsers are gone, all four ports are closed, both profiles
and writer locks are absent, and all **801 staged pins** match after shutdown.
All **24** original commands (13 WebGL / 11 software, including quits) have
exact successful ACKs; all **16** key holds have independent release receipts.
All **40** retrieved PNGs pass CRC/IDAT validation, bound capture hashes match,
and the **697** successful served reads match pinned bytes. The final
**324 artifact references / 290 unique contents**, 21,289,617 reference bytes,
were retrieved and independently size/SHA-256 verified before shutdown.

Delegated normal stop **`stop_b87ce352ed3b906a`** completed at
**01:18:21.315 UTC**, forced=false, error=null. Final box state is
**archived**, current expiry **null**. Both lifecycle delegates exit zero;
the supervisor reports no remaining children. The independent verification
helper also exited. No box remains running for this task.

No guest code, state, config, save or clock was written by the harness; no
private game handler or fabricated result was used. No RAM gate, stopped-box
resume/delete, extra box, archive or public deployment occurred. Sampled local
and remote free disk remained above 5 GB.

Next work is separately assigned broader course/browser/visual coverage.
Full27, full parity, competitive timing, sustained FPS and audio remain open.
This single-task worker releases its resources and stops.

The corpus manifest currently has no Tux Racer candidate entry. Per the
dashboard workflow, the reviewed outcome remains in this note and run-local
`completion.json`; it is not attached to another game's dashboard card.
