# GL fan, edge and query contract repair

Run: `scratch/runs/20261116-gl-fan-edge-query-contract-repair/`.

Status: all 40 required checks pass in both final source views, including all
26 fresh browser cases in each. The scoped repairs are qualified for this
publication. The run result records the actual commit, strict push and closure.
The chronology below retains earlier failures and their contract repairs.

At initial preservation the inherited point repair was uncommitted. Its twelve
code files and note matched the predecessor pins. Recovery patch SHA-256
`ba023bd8e893a6d6b8cf6d652062bd2b55c88368ca3a98ad27d132bb0eb915c8`
passes `git apply --reverse --check` and is retained before any edits, along with
the initial Git SHA, tracked binary diff and patches for owned new files.

The predecessor independently observed flat fan sample (0,7) as native white
and software red. Its complete 8x8 frame contains a red/white diagonal inside
the left half of the drawable. The independent edge-flag quad has a white left,
top and bottom boundary, with its right boundary and triangulation diagonal
suppressed. Both smooth and flat native witnesses agree. These complete frames,
a projective fan and translated edge variant are frozen in the new test before
production edits. Four negative controls reject the two reported failures,
an extra right boundary and an invented triangulation diagonal.

The primary specification is [OpenGL 2.1](https://registry.khronos.org/OpenGL/specs/gl/glspec21.pdf),
sections 2.6, 2.14.7, 3.4.1 and 3.5.1. Integer storage coordinates do not replace
the specification's polygon fragment centers or line diamond coverage.

The published [migration contract](../gpu-stream-v2-migration.md) assigns queries,
error state and validation to WAT in G1. Commit
`0ef0432486d9cdfcd0cc984ddcab614f94f6e797` removes the ten native query opcodes
from host barriers and records; G2 commit
`92556add400fed44b91a13686200d79980b80526` assigns texture conversion and pack
copyback to WAT on the existing transport.
Contextless texture queries consume the call without writing the output. A
current public context owns native synchronous state queries. Actual framebuffer
readback still requires ordered completion and G2 staging copyback. Migration
must preserve context/error/invalid-pointer/trap and packet/lifetime checks;
changing the barrier table to satisfy the obsolete reference is not a repair.

Static review also identifies both names in the old unsupported-proc loop as
documented exports: `glMap1d` in [the evaluator family](gl-evaluator-family-20261103.md)
and `glClearIndex` in [the color-index family](gl-color-index-family-20261103.md).
The replacement check must verify their actual resolver/ABI and retained state,
and keep an unsupported-name negative control. It must not manufacture nonzero
proc addresses or discard the surrounding native state and canary checks.

The current coordinate hypothesis is specific and falsifiable: a bottom-row fan
fragment center (0.5,0.5) lies to the right of the shared diagonal x=y/2 and
therefore belongs to the white triangle. The integer-row walker instead rounds
the boundary to column 1. The boundary line's window X=0.5 is likewise rounded
to column 1, while the independent native witness lights column 0. Actual fresh
before/after frames remain required before calling either implementation fixed.

The coordinator subsequently published merge `1afae7796c3dff9e5f97c9230f36cdd2bcd30aeb`
and tracking commit `1deb961f3182353690bdefbec424d635f508ef71`, adding opt-in
G3a hooks to the raster source. Twelve of the thirteen inherited file pins still
match the initial preservation; only that merged raster source changed. The
current Git base, all file pins and a fresh binary diff are recorded in
`post-root-merge-pins.json`. The historical recovery patch remains retained;
its old reverse check is not a claim about the new base.

The independent query-reference migration has three separate obligations:

- Contextless native queries leave output canaries unchanged, return the
  documented contextless result and emit no host query record. They must not
  accidentally flush a pending private encoder prefix.
- Ordered framebuffer output remains a real synchronous barrier. Its output
  canary and preceding copied/borrowed inputs must be checked independently
  of native state queries; host mocks must reject obsolete native query replay.
- The public native-state probe must resolve and invoke the actual exposed
  evaluator and color-index thunks, verify retained state with byte canaries,
  and retain an unsupported proc-name control. Existing public native query
  and delayed-worker checks remain mandatory.

New authored-only controls pass for seven frozen frames (including varying
positive clip W for both fan and boundary edges), four rejected bad frames and
refusal before runtime helper imports without the release flag.
The serial phase runner is authored and syntax checked, but remains unrun. It
requires both personally verified final releases and uses the retained
independent prearmed deadline guard with actual child waits and both pipe EOFs.

At 06:57–06:59 UTC, newly authored run scripts and the predecessor deadline
guard disappeared unexpectedly. No deletion was performed by this worker.
`unexpected-file-loss.json` records the three missing authored scripts and hashes
of all retained artifacts. The frozen test, note, blind native draw inputs, exact
predecessor recovery patches and three unapplied candidate patches remain
recoverable. No existing source edits or native/browser execution took place.
The missing scripts are no longer treated as available. Small JSON inputs now
retain replacement guard, qualification, independent EGL witness and offline
provider-recovery source. Their Python syntax checks pass; qualification and
provider recovery remain unrun. The nine retained provider binaries match their original pins. Recovery
must reinstall the pinned metadata offline with scripts disabled and verify all
162 provider files before loading anything. The removal cause remains unknown;
fresh evidence must be checked for retention, without treating lost inputs as a
pass.

SimsProvider published its final release at 07:04 UTC. Personal verification
found all 1,446 surviving artifact hashes, all 317 actual child waits with both
pipe EOFs, and absence of all 455 recorded PID groups/sessions. Its missing
historical inputs and unqualified checks remain explicit. GTA2USER's final
release is still required before shared source, build or emulator admission.

At 08:18 UTC the coordinator explicitly authorized standalone native EGL/OpenGL
references from new owned code and inputs under owner199's parallel directive.
A separate reference-only admission preserves the shared runtime gate. Both a
normal guard child and a forced deadline control passed actual child/watchdog
waits, both pipe EOFs and process-group absence. No shared helpers, emulator
modules, builds or browser endpoints were used.

System EGL/libGL on llvmpipe (LLVM 20.1.2, Mesa 25.2.8) matches all seven frozen
fan/edge frames, all 64 exact RGBA pixels per frame and zero GL errors. It also
matches a separately frozen full-viewport smooth planar gradient at every
pixel. The alternative unapplied raster draft samples covered fragment centers
when endpoint color clamping or nonpositive reciprocal W would distort a span.
Neither raster draft has been compiled or run in the emulator.

Native evaluator coefficients, order, domain, copied-input lifetime and invalid
order error pass. The first additional native clear-index assumption failed:
setting -12.5 reads back -12 on this RGBA, zero-index-bit context. That failure
is retained. [OpenGL 1.1, section 4.2.3](https://registry.khronos.org/OpenGL/specs/gl/glspec11.pdf)
specifies fixed-point conversion with implementation-dependent precision.
The revised independent probe records this native value separately and proves
that clear-index state leaves all 64 RGBA clear pixels unchanged. The proposed
emulator test retains its published floating-point state oracle; native
equivalence for that state is not claimed.

A separate independent native probe exercises all ten G1 query families with
literal values, output canaries, texture upload ownership, deletion and an
unshared second context. Its complete twenty-check result retains nineteen
passing checks and one failed negative assumption: on an invalid pname,
`glGetTexLevelParameterfv` reports `GL_INVALID_ENUM` but writes four zero bytes
to its output. Other invalid-output checks preserve their canaries. Both the
initial failure and a diagnostic continuation remain nonzero failures; the
continuation records the exact changed bytes and finishes the lifetime/context
checks. The emulator's invalid-output preservation oracle is unchanged. These
native observations do not qualify the pending emulator or packet migration.

No original games/input, hardware, full-27, gameplay, FPS or audio qualification
is authorized or claimed. No workers or boxes are created.

## Admitted implementation and fresh evidence

After GTA2USER's 08:34 final release, personal verification matched 8,105 retained
artifact hashes, 1,212 actual child waits with both EOFs, and current absence of
569 recorded process groups/sessions. Both locks were free. All inherited pins
and foreign WIP were preserved before source adoption. The earlier paragraphs
describe the staged historical investigation, not the current admission state.

Fresh pre-repair normal and compat modules disagree with the eight independently
frozen frames: four fan pixels, fourteen boundary pixels, and all 64 planar
gradient pixels. The candidate preserves continuous window coordinates until
fragment coverage, evaluates triangle attributes at covered fragment centers,
and floors projected line X for the independently observed half-pixel boundary.
Fog, projective texture coordinates and reciprocal-W spans use the same center
coordinates; varying packed colors and unsafe extrapolated reciprocal-W endpoints
are sampled per covered fragment. The shared D3D raster walker is unchanged.
All eight complete 64-pixel RGBA frames then pass exactly in both module variants.

The full encoder command now passes with the independent reference's literal ten
G1 query opcodes handled natively. Contextless output canaries and pending
prefixes remain untouched; obsolete host-query records are rejected. Private
160 readback retains its real ordered barrier and copyback assertion. The public
double-state test resolves and invokes the actual Map1d/ClearIndex thunks,
retaining an unsupported-name control, evaluator ownership, errors and canaries.
Its direct 162 checks pass.

The first ten checks of the shared qualification view pass. Check eleven
`test-headless-gl.js` fails because the actual D3D9 shader capability probe
constructs a device without the native canonicalization exports now required by
the published shader path. The scoped repair passes the bridge's real exports
and memory to that device. Its fixture boots the real module and retains a
missing-export refusal/context-release negative control; success still requires
the actual textured indexed draw, retained pixel assertion and clean GL error queue.

A coordinator review identified a separate subpixel winding gap. The continuous
CCW triangle at window coordinates (.10,.25), (.20,.10), (.90,.85) strictly
contains (.5,.5), but its rounded vertices collapse to integer area zero. Four
additional complete frames were frozen and independently matched by direct
llvmpipe OpenGL before changing culling: both windings, with CCW and CW front-face
settings. These expected frames do not alter any of the earlier eight or the
browser sample positions. A homogeneous pre-rounding winding repair is prepared;
normal and compat emulator frames now pass all twelve complete cases exactly.

The shared run subsequently passes its first 23 checks, then fails the old
far-plane strip assertion in `test-gl-software-raster.js`. Independent native
reproduction retains all six original eye-space vertices and the exact
`Frustum(-1,1,-1,1,1,100)` projection. Every vertex has Y/Z=.02: the strip is
projectively degenerate. Native OpenGL leaves all 4,096 blue background pixels
unchanged, with zero GL error. The old integer-row walker invented a yellow row.
The original failed assertion and full diagnostic evidence remain retained.

The test contract repair keeps those exact vertices as a zero-coverage negative
control. It adds a separate genuine floor at constant eye Y=-9 from Z=-50 to
Z=-200, crossing far=100. Before changing the test, its complete expected frame
was frozen geometrically: yellow ranges [28,36), [27,37), [26,38) on top-down
rows 35, 36, 37; all other pixels blue. Independent native OpenGL matches all
4,096 pixels exactly. This positive test catches drawing beyond the far plane
as well as dropping its visible part. Existing point-matrix, primitive sample,
fan, edge and gradient positions and expectations remain unchanged.

The first shared browser matrix subsequently stops before completing any case:
the second `gpuPresent` reaches its fixed 3,000 ms deadline at sequence 27.
The endpoint becomes permanently UNKNOWN, sends no later requests and closes
Chrome with actual wait and both output EOFs. Its earlier first GPU frame took
roughly three seconds. This is a retained deadline failure, not evidence that
the raster sample passed or that a particular production component caused it.

A fresh fixture adds observation of actual shader compilation, link, draw,
readback and finish phases and the public operation names. It adds no GL work,
warmup or deadline extension. With unrelated WIP excluded, a distinct HEAD
whole-owned build passes all 40 checks: the full encoder command, actual delayed
Worker and 17 focused checks, public native 664-call/36-observation normal and
compat probes, all 41 point preservation cases in both module modes, twelve
independently frozen fan/edge/gradient/subpixel complete frames in both modes,
line/projective/texcoord4/bitmap/user-clip checks, direct and Worker state probes,
seven Node startup controls, all 26 browser cases and eight browser startup
controls. Source auditing verifies what this view actually reads and executes.
The old shared endpoint remains closed; the passing new view does not erase it.

The direct independent reference uses llvmpipe. Browser WebGL uses
ANGLE_SWIFTSHADER, irrespective of a worker's spoofed unmasked renderer string.
The point matrix is literal preservation evidence, not all-41 native conformance:
earlier native drivers differ on several cases. One independent invalid texture
query probe also retains a Mesa output-canary difference (GL_INVALID_ENUM and
four zero bytes); the emulator's established error/canary oracle is unchanged.
No hardware, full-27, original-game/input, gameplay, FPS or audio claim follows.

Final qualification uses HEAD `915b0036d4b00301b2d1e402860c39532e31543b` plus
all twenty whole-owned source/test/doc files, then the shared view based on
`6f6289091fdfeab5de8868b9d2d60506386a6af1`. The latter retains foreign WIP
without adopting it. Each runs the complete 40-command plan, including a fresh
`flock /tmp/wine-build.lock bash tools/build.sh`, the full encoder command and
all 26 browser cases. All pass. Actual source audits cover 3,752 and 3,816
files respectively with zero mismatches. No production file changes between
these tests and publication; only this final documentation is updated.

The shared build restores normal module SHA-256
`692766434b357897de3ad9310edaab8432f9438806183f024b478e3faed9a271`
and compat `c8252a2f476fc80ce3900aa9ed6df2c912d899aaf6005ad996123be85cbeff34`.
Both browser processes are actually waited, both output streams reach EOF,
and the native child/watchdog process groups close. The twelve selected full
screenshots across the three passing browser runs are individually named and
hashed in the final run result. Earlier UNKNOWN endpoints remain permanently
closed. Their failure is retained without claiming that the separately
published doorbell-generation repair caused or cured the old cold-frame delay.
