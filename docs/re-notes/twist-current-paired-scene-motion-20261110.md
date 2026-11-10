# Twist current-source paired scene motion, 10 November 2026

The registered original `dx_twist` visibly changes its textured body on both
software D3D and WebGL guest-Worker routes from current source. All six full
1024×712 compositor captures, at approximately 15, 30 and 45 seconds per route,
were personally inspected. This supplies the current paired software/source
evidence missing from the November 7 WebGL observation. No renderer defect or
production implementation change was demonstrated.

Evidence and small recovery helpers are in
`scratch/runs/20261110-twist-current-paired-scene-motion-0900/`.

## Reviewed scenes

Software initially shows the round end at the right and a yellow warning panel
across the near side. The later images expose a blue textured face, move the
round end to the left, and turn the radiation emblem toward the viewer. The
far end also changes shape and orientation. WebGL initially presents a compact
round end toward the viewer; at 30 seconds the body stretches across the window
with a narrow twisted middle and the warning panel at the right. At 45 seconds
a broad side fills the right part of the window and crosses its right clip
edge. These are substantial body, face and silhouette changes below the FPS
text. The displayed FPS values are not measurements.

Both routes show the recognizable blue/gray textured body, round end and yellow
radiation marking. The independent execution windows do not align animation
phase. Complete scene correctness, Windows-reference agreement, same-frame
backend parity, FPS, audio and historical 27-app membership/completion are not
established by this observation. No new original input, configuration, guest
state, scheduling or clock override was used.

## Source and actual backend ownership

The locked canonical build passed from main
`e2063597c70102be6f5ba5448d147f24e9f28d2e`. The relevant tracked runtime diff
is empty; the retained small untracked-source patch reconstructs the additional
pinned input. All 315 checked source inputs reconstruct from that commit and
patches. Git is the source archive. No source/media archive or evidence copy of
the original media was made. The registered Twist manifest, executable and its
37 data files match the accepted canonical inputs.

Both live guest modules are 2,186,163 bytes, SHA-256
`79f0842ea1ab5fce5b5651540e726396f4ccbfa6e3cf046e9bc42ad7c4fa650f`.
This is the output of this run's current-source build, not a compilation commit
inferred from an older module. The staged compatibility module is separately
pinned and is not identified as live. Live bytecode was recovered through CDP
and checked around each capture. Object/instance epochs, page references,
Worker targets and render ownership remain stable within each route.

Both guest owners are endpoint 1, slot 0. The actual software guest Worker
reports `d3dimGpuEnable=false`, no shared render port and no owning render
endpoint or render Worker. Its command facade exists but has not created a
render port; current production initialization leaves the compiled D3DIM GPU
flag disabled on this route. Host slice observations advance
935 → 1928 → 2830. No direct software draw-completion counter is claimed.

The WebGL guest reports `d3dimGpuEnable=true` and a shared render port. Its
actual separately identified production render Worker owns legacy endpoint 1,
has a live adapter and ready control, and uses the same recovered module.
Endpoint-published WebGL2 draw counts advance 805 → 1771 → 2994, with zero
reported errors, fallbacks, direct software draws or fallback software draws.
The endpoint's `adapterStats` property is absent; these statistics are its
production published results, bound to the actual owner, supplemented by direct
endpoint controls and software-completion counters. No backend is inferred
from the toolbar. The launcher forces ANGLE SwiftShader and `/dev/dri` is
absent; the reported Intel/Mesa string is not physical-GPU evidence.

Actual served bodies match 313 pinned responses across 182 distinct paths on
software and 323 across 184 on WebGL. Non-200 responses, including the absent
optional `stdole2.tlb`, icon, build-info/auth and font-bundle probes, are retained
explicitly; the individual fonts and registered scene media were served.
Native inner geometry stays 1024×712, outer 1024×855, without viewport
emulation. Original input recorders and sampled queues are empty.

## Harness qualification and lifecycle

Unchanged input, publisher/consumer and identity qualifications are retained
by hash reference. The changed passive harness was qualified locally against
current real production guest/render Workers and the freshly built module.
Readiness returns a boolean; absent/not-ready generated wrappers time out.
Missing and replaced owners, plus a stale reviewed capture, reject through
the actual identity/admission path. Each first error stays sticky and permits
zero later capture, input or quit protocol commands. The stale test changes
only the harness's age calculation on a generated fixture, never guest time.
The exact changed positive path produced three reviewed labeled fixture images.
`test/test-d3dim-draw-trace.js` and the locked build pass.

An initial local control failed the inherited blank-page keyboard hold guard
before guest launch. That failure is preserved. This passive harness then
reused the unchanged native-input qualifications instead of repeating their
input exercises in each cell. No hold guard or deadline was widened.

One box, `bx_bqm3jwyy`, was allocated after an independent 25-minute watchdog
was armed and observed. Its immutable deadline was 09:31:45.987 UTC; provider
expiry was 09:31:45.258 UTC. All 621 staged paths passed remote reread. Original
software and WebGL cells ran once, sequentially, with the original readiness
and 15/30/45-second capture schedule. Both controller and Chrome parents
record actual waits, zero exits and separate stdout/stderr EOF. PIDs are absent,
ports closed and private profiles removed.

One early read-only retrieval probe refused before parent completion. A
separate later observation confirmed completion; no original was replayed and
no extra scene capture was requested. All 77 remote artifact paths resolve to
64 unique files, 3,295,041 bytes, independently SHA-256/size reread locally.
All six original PNGs pass signature, chunk CRC, dimensions and decompression
checks. This completed before delegated normal stop.

The box is independently confirmed archived, expiry null, with completed
receipt `stop_0ce86ab380f4ac5f`, `forced:false`, error null, at
09:10:53.930 UTC. The watchdog and manager also have actual wait/EOF receipts.
Do not resume this box. Further scene-correctness work should use a justified
reference discriminator rather than replay these already accepted motion
cells. No public deployment or nested worker was used.
