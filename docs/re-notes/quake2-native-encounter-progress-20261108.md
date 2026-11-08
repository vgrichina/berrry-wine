# Quake II native pickup progress, 2026-11-08

Both actual browser backends now prove a native health pickup beyond the
previous movement, discharge and incoming-damage evidence. Ordinary **Game →
Easy** and the unchanged registered `quake2_demo` closure were used.

| Owning backend | Reviewed native consequence |
| --- | --- |
| WebGL | `original/left-passage.png` shows the two floor health items and health 100. After ordinary forward movement, `original/left-route.png` shows the native **HEALTH** notification and health **104**. `pickup-settled.png` retains 104. |
| SoftwareGL | `software/s-item-align.png` shows both floor items and health 100; `s-item-approach.png` shows them immediately ahead. `s-cross-item.png` shows **HEALTH** and health **102**. `s-pickup-settled.png` retains 102. |

Paths above are under the ignored evidence root
`scratch/runs/20261108-quake2-native-encounter-progress/retrieved/`.
Raw bound captures, state, review bindings, input admissions, independent
release receipts and exact numbered ACKs accompany the screenshots.
No outgoing hit, guard defeat, door transition or level completion is claimed.
The corpse beside the broken alcove was present before interaction and is
explicitly excluded from defeat evidence. Health never falls below 100; there
is no death, respawn or hidden life boundary.

## Route and input

From the starting support, forward movement exposes the lower room. Turn
toward its descending floor, descend, and approach the floor items beside the
ribbed alcove and corpse. WebGL's longer exploration entered the alcove and
returned around the support before crossing both items. SoftwareGL used the
reviewed shorter approach, turned toward the two visible items, then crossed
one with a final 250 ms forward hold. Positioning follows the screenshots;
these wall durations are not a portable blind replay script.

The released bounded-world driver and input helpers match their predecessor
after run-path substitution (`released-driver-reuse.json`). No new action
form was required: only ordinary arrow keys, Enter, passive capture and quit.
The actual request helper and numbered ACK consumer pass waits of 0, 1000,
2000 and 10000 ms, including 250/750 ms holds. Oversized waits, sticky UNKNOWN
and insufficient immutable-deadline reserve reject before publication. All
eight timing regressions and the independent-UP slow-observer/injected-UNKNOWN
control pass. No guest memory, config, binding, clock or scheduler was edited;
no console/map command was used.

## Actual backend and module identity

WebGL's owning render Worker endpoint 1 is `api: gl`, backend `webgl`.
Its live `WebGLBackend` owns a non-lost WebGL 1 `WebGLRenderingContext`;
Chrome reports ANGLE Vulkan SwiftShader. Both guest and renderer CPU exports
report `gl_sw_enabled() == 0`. This differs from the previous run's Intel
provider and is recorded without a hardware-rendering or parity claim.

SoftwareGL's live `OpenGLHostBridge` reports backend `software`,
software-consumer true and software context 1 for HWND 65537, current owner
0/context 1. Its export memory matches the renderer instance. Both CPU
exports report `gl_sw_enabled() == 1`; the sampled guest software-present
counter is 511. Its separate legacy WebGL endpoint/presentation device is
not substituted for the owning software GL context.

Both sessions use Chrome **151.0.7922.71**, V8 **15.1.206.10**, with the native
viewport and no emulated resize. All 46 recovered PNGs pass CRC/IDAT checks;
33 bound capture hashes and guest/renderer identities pass. All 33 numbered
commands have exact successful ACKs, including quit. All 27 key holds have
independent release receipts (249–752 ms across requested 250/750 ms holds).
There is zero gameplay UNKNOWN or replay.

Runtime Git SHA is `ca3d5ecc2defe12e5aa39f6295b003fc808636ff`, with empty
relevant tracked diff at staging and the retained untracked
`lib/wininit-boot.js` dependency patch. Executing guest and renderer modules
match `build/wine-assembly.wasm`, SHA-256
`f9650607181301b5d2a9990420f437bd9f1ca10d40ac73067339f07499d53121`.
The complete 67-path registered media closure and original 642-byte controls
remain unchanged; media paths, sizes and hashes are in `fixture-identity.json`.
Controls SHA-256 is
`afb166910b596b204e1c11f93ff4972999804d18299bde134d6380a51587e3b3`;
PAK SHA-256 is
`cae257182f34d3913f3d663e1d7cf865d668feda6af393d4ecf3e9e408b48d09`.
Git plus relevant/new-file patches is the recovery source; no source/media
archive was created. No emulator regression was demonstrated or repaired.

## Retained limitations and lifecycle

Early WebGL route reviews twice described little movement too strongly;
subsequent captures show advancement toward the support. Corrections remain
in the raw command reviews. The pickup claim uses the visible HEALTH
notification and changed health counter, independently of that interpretation.

The first post-quit drain check ran while the WebGL controller PID was still
exiting. Chrome had already exited zero and both ports, profile and writer
were clear. A later passive check proved both PIDs absent before SoftwareGL
was launched. This retained host assertion did not dispatch or replay input.

One fresh UUID-idempotent box, `bx_gk5mhwwz`, was allocated at
04:52:15.413 UTC. The detached supervisor and independent 25-minute watchdog
were observable before allocation. Initial provider expiry was
05:17:15.243 UTC; the fixed local deadline was 05:17:15.037 UTC.
WebGL Chrome exited zero at 04:58:59.227 UTC; SoftwareGL Chrome exited zero
at 05:02:36.718 UTC. Final drain proves all four PIDs absent, all four ports
closed, profiles/writer locks absent and all 707 staged pins unchanged.

All **436 artifact references / 394 unique contents**, 21,099,844 reference
bytes, were retrieved and independently size/SHA-256 verified at 05:04:12.315
UTC. Stop **`stop_b8518c4b39f7a7ad`** completed at **05:04:12.892 UTC**,
forced=false, error=null. Final state is **archived**, current expiry null.
Both lifecycle delegates exit zero and the supervisor has no remaining
children. All 359 successful served reads match pinned bytes. No resume, delete, second
box, nested worker, RAM gate or public deployment is used. Local sampled free
disk stays above 5 GB.

Next work is an attributable outgoing hit/guard defeat or native door/onward
route. Historical27, renderer parity, FPS, audio and full-level completion
remain open.
