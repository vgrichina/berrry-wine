# Boids original-model transform comparison, 7 November 2026

The original registered `dx_boids` model, captured world/view/projection
matrices and viewport reproduce all 4,680 submitted X/Y/Z/reciprocal-W
components exactly across 39 naturally completed bird draws. Each of the
three consecutive observation windows contains all 13 birds, wholly outside
the homogeneous frustum. The personally inspected compositor capture shows
cyan terrain without a visible bird. The captured guest transforms explain
this terrain-only phase; no mismatch or emulator repair is demonstrated.

Evidence: `scratch/runs/20261107-boids-model-transform/`, especially
`oracle.json`, `oracle.py`, `recovered/original/upstream-transform.json`,
`boids-disassembly.txt` and `review/startup.png`.

The unchanged executable is SHA-256
`b9327e6fb2758e232d0ca0fb410b11097fd557dc59b3d405167d976db208b8d9`.
Disassembly at `0x40da21` supplies primitive 4, vertex type 1, the original
16-vertex array at `0x420520`, the 30-word index array at `0x41fa80`, and
calls Device2's indexed-draw method at vtable offset `0x78`. The initialization
and scaling writes to this model are also retained in that disassembly.
At the qualified owning GPU's natural `_draw` boundary, the observer copies
those original initialized model/index bytes using the runtime image base and
translated guest pointers. All 39 model copies have identical SHA-256
`8fc924ccf9febcd27bddad760ee88fbdce1215582a88efe35ef558b56d4b96c2`.
Their extents are X ±0.5, Y ±0.150000006 and Z −0.5 to 0.5.

Each raw draw also retains its immutable 4 KB command-state snapshot: world,
view and projection at offsets 0/64/128, recorded composite at 192, viewport
rectangle/scale/origin at 3088/3104/3120 and clip normalization at 3904/3928.
Completion sources/spans correlate by exact command sequence and ordinal,
including the first bird submitted separately from the following twelve.
The first observation window begins partway through terrain; these are bird
draw windows, not three independently captured complete compositor frames.
The screenshot and geometry are sequential observations, not frame aligned.

The independent Python scalar oracle multiplies the three matrices from
their raw values, projects the original indexed model and applies the captured
viewport. It does not use the recorded composite as its input. Its composite
has zero differing float32 components; all 1,170 submitted vertices then
match exactly in all four position components. A separate 60-digit Decimal
calculation applies world, view and projection successively without a rounded
composite. Its largest differences from submission are 0.000488733 X pixels,
0.000512035 Y pixels, 2.113e−7 depth and 4.227e−8 reciprocal W, consistent
with float32 rounding. Identity, translation, known perspective and deliberate
wrong-world controls pass. Independent homogeneous classification from the
Decimal clip coordinates places all 13 birds outside in each window.

This excludes a model-to-submitted-position transform discrepancy in these
draws. It does not independently validate the original x86 simulation or
camera-matrix construction. The historical SDK source describes time-seeded
scattering and camera motion; this run neither fixes a seed nor reproduces an
earlier phase. Native Windows parity, lighting, rasterization, full-flock
convergence, FPS and historical27 completion remain unqualified.

Before the original launch, the actual observation branch passed on production
guest/render objects: 25 raw draws and 25 completed submissions with state and
translated model copies. Existing owner/module/freshness rejection controls,
independent native-release controls, exact Arrow/quit ACKs, deferred-observer
negative/positive tests and actual-driver 25-minute deadline controls passed.
The focused draw-trace suite passed. No production code changed, so no repair
regression or new full build was required.

One UUID-idempotent box, `bx_2svdb5d8`, was allocated for 40 minutes at
13:09:35 UTC, with immutable driver deadline 13:34:35.276 UTC. The inherited
Globe staging omitted `boids.exe`; this was caught after allocation but before
any original launch. `manifest-http-preflight.json` records the correction,
all 38 registered executable/media inputs and 60 exact local HTTP bodies.
Only the missing executable and completed manifest were supplemented on that
single box. Its 526 pins and all 60 HTTP bodies passed before Chrome/original
execution; 269 subsequently served pinned bodies match. There was one original
launch, no lane retry, no old-box resume and no public deployment.

Runtime source is Git `fe76b23838365466dab8e0f93513bffd5a0e3527` plus
`source-recovery.patch`; `source-recovery-verification.json` reconstructs every
pinned source input through a temporary Git index. Existing media remain path
and SHA references. The executing guest/render module was recovered and
SHA-verified as `e41511fe861363fbe1639d80f20cbcdd7240f46937c93a801eaa256ca094c467`.
This records tested inputs, not a fresh compilation provenance claim. No
source-tree/media archive was made. Chrome reports version 151; its advertised
Intel WebGL renderer is not hardware evidence: the provider wrapper forces
ANGLE SwiftShader and `/dev/dri` is absent.

No original input, scene/camera/RNG/clock/configuration edit, guest execution
probe, added fence, flush or readback was used. Only the already-qualified
image-base and address-translation getters resolve passive copies. Natural
submission hooks preserve batching and renderer results. The browser closed
normally with exact quit ACK and zero native events. An immediate read-only
terminal inventory safely rejected while closure was settling; a subsequent
distinct inspection confirms both PIDs absent, both ports closed, profile and
writer absent and no held input. Nothing was replayed.

All 35 remote artifacts (18,664,226 bytes), including the live module and raw
transform observations, were retrieved and SHA/size verified before the
explicitly delegated normal nonforced stop. The service confirms archived at
13:12:34.198 UTC, expiry cleared, stop completed and `forced=false`.
Local fixture PIDs, ports, profile and writer are clear; home free space stayed
above 2 GB. The global evidence audit retains the pre-existing Alice error;
this investigation has no candidate-corpus entry and attaches to none.
