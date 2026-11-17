# Boids current rendering attempt, 16 November 2026

This attempt establishes no rendering defect, recognizable flock, or backend
parity. Four preparation/observation attempts ended without a usable image or
outgoing draw capture. The newly written harness was insufficiently qualified:
its first owner lookup was wrong, and its later readiness check admitted an
instance before a live app window existed. These are investigation failures,
not evidence against the renderer. No production rendering code changed.

Evidence is `scratch/runs/20261116-boids-current-original-flock-rendering/`.
No endpoint was retried. No original input, camera, configuration, clock,
media, or executable change was made. No box or additional worker was created.

## Existing results remain intact

The November 7 Worker readiness serialization repair is closed. Its Tunnel
and Twist motion observations are not repeated here. The corpus status also
records later Boids results that must not be lost: `794273255` observed all
13 birds/130 triangles reaching completed geometry, and `bae5dfb76` matched
4,680 submitted position components with an independent transform oracle.
Those results explain sampled off-frustum birds without establishing native
Windows reference parity. This attempt neither supersedes nor extends them.

## Attempts and actual limits

| Attempt | Observed result |
| --- | --- |
| Software, cooperative | Main instance loaded. Capture rejected `Immutable capture owner does not match a live window`: the harness incorrectly used an absent app-record HWND. No image. |
| WebGL, cooperative | Navigation exceeded 30 seconds. HTTP records show no Boids executable request and no module observation. Original execution and actual backend are unproved. |
| Software, guest Worker requested | The independent Git-source compilation did not finish inside the native 300-second bound. Native process received SIGTERM and was awaited at −15. No browser or original launch. |
| WebGL, guest Worker requested | Main and actual guest Worker modules matched the compiled module. Console reports guest main running in a Worker. The harness immediately required a live window after instance readiness and rejected `ambiguous or missing live app window` during startup. No image, rendering endpoint, or actual WebGL backend proved. |

The corrected owner selector rejects missing, foreign-instance and ambiguous
windows in focused controls. That does not qualify the complete original
capture branch. The new `tools/boids-current-*` and focused test remain
uncommitted WIP; their final contents are retained as new-file patches. The
first two attempts lack contemporaneous harness-file hashes. Runtime Git,
served observer suffixes, module observations, and media pins are retained;
do not describe that as complete controller provenance.

## Source, tests and closure

Each attempt prepared immutable source from Git
`3e3dca2e1a2c7cf671d80804d6805a8eca504d32` in memory, without a checkout,
source archive, media copy, or WASM archive. The three completed compilations
produced 2,279,037-byte module SHA-256
`83703369cc49c3e16077a4abd43def27262487f83dd52583d1b433adf7095f5f`.
CDP module-bytecode observations match in software/cooperative and in the
WebGL/Worker page and guest Worker. A compiled module alone does not prove
execution in the navigation-timeout attempt.

All 38 registered executable/media files were pinned before each attempt.
Completed harnesses rehashed media afterward; a separate terminal postflight
also covers the compilation-deadline case. The executable remains SHA-256
`b9327e6fb2758e232d0ca0fb410b11097fd557dc59b3d405167d976db208b8d9`.
Foreign D3DIM/render-worker WIP was not adopted or edited. The immutable
runtime used committed code; the required canonical build checks the shared
working tree separately and cannot qualify these original attempts.

Focused observer controls, current-display endpoint tests (16), existing
D3DIM draw tracing, GPU-stream decoder and dump tests passed. The native
GPU-stream WebGL test skipped because optional native GL dependencies are
absent; it is not a passing native reference fixture. No mismatch justified a
generic rendering fix.

The required `flock /tmp/wine-build.lock bash tools/build.sh` passed with
actual tool exit 0; its standard output module is 2,279,283 bytes, distinct
from the immutable module used above. The build window is released.

All four native parents and independent watchdogs have actual waits with both
pipe EOFs recorded. Three browser parents closed with code 0; browser close
is host shutdown, not a native guest exit or ordinary Quit. The compilation
deadline is retained as a timeout, not success. No full-frame, motion, flock,
input, gameplay, FPS, audio, hardware, or historical27 claim is supported.
All recorded runtime PIDs are absent, three HTTP ports refuse connections,
and three browser profiles are absent. This is not a sampled inventory of
every transient Chrome descendant. Box ID and expiry are null, state is
`NOT_CREATED`, and no box stop receipt applies. `/home` has 5.6 GB free.

The next necessary work is native qualification of the exact owner/window
readiness and public completed-display branch using authored asynchronous
startup, before any newly authorized original run. The four endpoints here
remain closed. Only after obtaining actual public draw/transform/viewport/clip
evidence should a native/reference mismatch motivate a rendering change.
