# Boids visible-flock recovery, 7 November 2026

The interrupted preparation was recovered without duplicating an allocation or
an original launch. The fresh Worker observation shows two moving colored birds
and cyan terrain at 30, 60 and 120 seconds. The serial cooperative run shows
moving terrain without birds at those checkpoints. All retained complete
geometry frames submit all 13 birds: the Worker has 11 wholly outside the
homogeneous frustum and two intersecting it; cooperative has all 13 outside.
Every submitted bird position, depth and reciprocal W matches the raw renderer
input exactly. A clustered visible flock and correctness of the upstream model
transformation remain unqualified. No emulator defect or fix is demonstrated.

Evidence: `scratch/runs/20261107-boids-visible-flock/`.

## Interruption and preflight recovery

The predecessor launcher 1940025 and child exited 143 at 10:43:47 UTC, according
to the recovery assignment. It produced neither a final response nor result.
Its local fixture had already captured scene15/30/45 and failed its nonempty
geometry assertion at 10:43:42.395. This failure preceded the launcher
interruption; it was not caused by the interruption. `allocate.py` and
`launch.py` were prepared but never executed. Event inspection, absent
allocation/lifecycle/provision files and the live box inventory agree.
The old board watcher, fixture parent and Chrome PIDs were absent; both ports
were closed and the private profile removed. BG2 and Heretic were untouched.

The observer had attached to the render endpoint's `D3DIMRenderWorker` wrapper,
which has no `_draw`, `_clear` or `stats`. Its natural GPU hooks belong to the
underlying `D3DIMGpu`. The run-local repair uses the existing diagnostic factory
attachment to reach that exact GPU owner, checks the methods, implements the
required receipt method, and retains a bounded rolling 512-draw history.
It adds no draw, flush, readback, fence, guest scene write or GL retirement work.

The exact Worker driver then passed generated public-COM production
GuestWorker/render-Worker execution, scalar readiness controls and final
full-compositor captures at 15/30/45 seconds. It observed 25 raw draws and 25
completed submissions, with translated production image metadata. The initial
recovery attempt also exposed the wrapper's required receipt method; that
failure is preserved. The focused draw-trace test passed. All 315 relevant
source pins reconstruct exactly from the recorded Git SHA plus patches.

## Worker geometry and pixels

One UUID-idempotent box, `bx_z65jbe9z`, was created at 10:48:27.947 UTC. Its
immutable deadline is 11:23:27.605 UTC and initial service expiry
11:23:27.788 UTC. The original Worker launch ran once, with native 640×480
render target and the unchanged full 1024×712 compositor capture. No gameplay
input, camera, clock, original configuration or viewport override was used.
The driver observes natural wall-clock checkpoints, without pinning guest time.

`recovered/case-worker/scene-{30,60,120}.png` were personally inspected. Two
separated purple/red triangular birds move over cyan terrain boundaries;
no clustered flock is established. The owning backend reports WebGL 2 on
ANGLE Vulkan SwiftShader (Subzero), forced by the provider Chrome wrapper;
`/dev/dri` is absent. This is not physical-GPU evidence.

Each geometry checkpoint retains seven complete 67-draw frames: 50 terrain
strips, 13 birds of ten triangles each, and four obstacle draws. Each bird
batch's 13 source spans and 130 completed triangles preserve all X/Y/Z/rhw
values exactly. Six homogeneous D3D clip halfspaces classify 11 birds entirely
outside and two intersecting the frustum in every complete retained Worker
frame. The analysis has positive, outside, behind-eye and crossing-plane
synthetic controls. Counts do not substitute for pixels. The compositor and
geometry reads are sequential, not frame aligned; the final geometry repeats
the terminal window and is not an independent sample.

The observed API-to-GPU packet path loses no bird geometry in these windows.
The current record lacks an independent projection of the original model
through the original guest matrices, so it cannot rule out an upstream
transformation defect or establish raster/reference parity. The earlier
October 31 source/geometry findings in `dx-sdk-d3drm-samples.md` explain that
ordinary time-seeded initialization can place the flock outside the camera;
they are historical context, not a current-build oracle.

## Source and validation

Runtime pins record Git `dfcb4dada4e06862b8d6ed26ae567a77f50cbb50`, with
`relevant-source.patch` and `untracked-inputs.patch`. The live standard module
is SHA-256 `e41511fe861363fbe1639d80f20cbcdd7240f46937c93a801eaa256ca094c467`;
the retained compatibility module is
`04acbb89f66ad9814836b5e2c34de659b518f4e1994f50c4ee8069c991f02f72`.
The source pins describe the tested checkout inputs; no fresh compilation or
new module-build provenance is claimed. Forty original media/input pins are
referenced by existing path and SHA, with no copied media/source archives.
No production code changed; no full build was required for this evidence note.

## Serial cooperative observation and closeout

After the Worker runtime was closed and its evidence retrieved, a separate
run-local cooperative capture path was qualified locally on the real production
module and in-page GPU owner. Its absent-app and not-ready controls reject via
the same scalar readiness helper; the final 15/30/45-second captures and 17 raw
draws/completed submissions pass. An intermediate control accidentally returned
the GPU object through CDP and failed with an internal serialization error;
returning a scalar fixes that generated-only control. Both failures and the
successful final proof are retained. The five supplemental run-specific input
files are separately SHA-pinned and verified before the original launch.

The original cooperative scene launched once at 10:54:34.900 UTC, after the
Worker parent and Chrome were gone. Its full-compositor 30/60/120-second images
were personally inspected: cyan terrain changes, with no visible bird. The
three geometry windows retain 6, 7 and 6 complete 67-draw frames respectively;
all 13 birds are wholly outside the homogeneous frustum in each. All 130 bird
triangles reach completed submissions with exact X/Y/Z/rhw preservation,
depth testing/writes enabled and no culling. Both paths report zero GPU errors
and zero fallbacks. The in-page context's actual queried identity is WebGL 2,
ANGLE Vulkan SwiftShader (Subzero), with a native 640×480 16-bit target.
The two runs have different naturally seeded phases; they are not matched-time
renderer parity tests.

`closed-terminal-retrieval-verification.json` verifies 90 remote paths,
74 unique files and 435,344,228 unique bytes, including six original compositor
captures, full geometry, logs and both standard/compatibility modules, before
the one delegated normal nonforced stop request at 10:57:30.749 UTC. No source
or media archive was created. An earlier read-only terminal inspection guarded
on a still-open cooperative port just before ordinary closure completed; it
failed safely, preserved its outcome and dispatched no input or lifecycle
operation. A subsequent distinct inspection after the recorded clean exit
confirms all four parent/Chrome PIDs absent, four ports closed, both profiles
absent and no profile process, writer lock or pending command. Native input is
empty; terminal button/queue/key samples are clear. No unknown input was replayed.

The bounded task establishes ordinary off-camera geometry at the renderer
input/submission boundary, including a current terrain-only cooperative scene.
It does not reproduce the predecessor's exact time-seeded phase or explain its
single blue object. The next discriminator for an upstream transformation
question is an original-model/guest-matrix projection oracle on naturally
completed geometry. Full flock, lighting/raster parity, FPS, audio, physical
GPU performance and historical27 remain unqualified.

The service confirms `bx_z65jbe9z` archived at 10:57:31.051 UTC, expiry cleared,
stop completed and `forced=false`; custody returns to the coordinator, with no
resume requested. Six owned local fixture parent/Chrome pairs, twelve ports,
profiles and command/writer directories are also clear. Large geometry JSONs
were individually losslessly gzipped after retrieval: each decompressed byte
sequence was SHA-verified before unlinking the plain file. This reclaimed
400,353,973 bytes. `geometry-lossless-compression.json` and the retrieval
receipts preserve raw/compressed hashes and sizes; `gzip -dc` recovers the exact
original bytes, and `analyze-geometry.py` reads the compressed files directly.
The source remains Git plus recorded patches. Local free space was 2.84 GB
after this owned cleanup.

The global evidence checker retains the pre-existing Alice outside-run error.
This run's artifact containment/existence checks pass. Boids is absent from the
candidate manifest, so its required `result.json` is an explicitly unattached
named-app investigation with `candidateId: null`, rather than a candidate card.
