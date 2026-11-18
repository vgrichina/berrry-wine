# NFS III native scene latency, 2026-11-18

Evidence: `scratch/runs/20261118-nfs3-reviewed-frame-native-scene-latency/`.
Earlier original/UNKNOWN scopes remain closed. No original has yet been
launched in this investigation.

The authored Device2 control creates its native UI on a separate thread and
uses normal guest Workers and a real software render Worker. The frozen c9
browser source, exact repaired b8c8 module, native wait source and Flip
association repair are retained. Diagnostic transport tags record producer,
send and page receipt clocks without renewing any sample. Bounded page long
task records distinguish delivery delays from gaps between native producers.

At eight draws per frame, 103 received samples had a maximum 1.85 ms Worker
queue delay and 60.89 ms transport delay, with no receipt over 250 ms old.
The largest producer gap was 683 ms. Its screenshot took 89 ms. That PNG was
subsequently removed externally before personal review; its pixels are not
claimed as reviewed evidence.

At 64 draws per frame, the old runtime produced gaps as large as 4592.71 ms.
The maximum queue delay was 0.35 ms and maximum transport delay 49.44 ms;
none of its 41 retained receipts was late. Page long tasks did not explain
those multi-second gaps. A native scene 362 ms old correctly refused binding.
A separate passive preparation wait expired after three seconds. This is
not a sufficient repair and did not authorize a screenshot or input.

The normal free-run scheduler stopped giving sibling Workers slices when
250 ms passed without a new host step, even while the current host step was
still awaiting a long main-Worker slice. Rendering backpressure can hold that
slice for seconds. A responsive page and live native UI therefore lost their
ordinary scheduling chain until the next host step.

The correction gives that awaited parallel rendezvous an explicit activity
token. The token pins the backend and checks the running host's pause, stop
and frozen state. The host releases it in its existing finally block. Both
normal free-run redispatch and satisfied-wait offers recognize the live token.
Outside it, the old 250 ms stale-step cutoff remains unchanged. No timestamp
is renewed, no native poll or wake is forced, and no guest clock, focus,
window state, rendering or input guard is changed.

A final old-code replay of the authored control verified all four actual
Worker module readbacks before applying pressure. At 20 presents its native
scene was 267 ms old, readiness and binding were false, and the producer gap
reached 8071.28 ms. The main slice was still pending while the old scheduler
reported a 498.93 ms-old host step. Maximum queue and transport delays were
1.46 ms and 30.06 ms. No physical input was sent. Both comparison scopes
completed actual native/watchdog waits with both output streams at EOF.

The corrected 64-draw control completed 20 presents with 408 native producer
samples. The largest producer gap was 266.74 ms and transport delay 56.64 ms;
none arrived late. The main actor's longest synchronous render kick lasted
5637.14 ms, while the separate UI continued its ordinary native waits. Its
151 ms whole-page screenshot ended with a 30 ms-old ready native scene.
Actual guest and render Worker byte readbacks matched b8c8. The whole authored
blue rectangle, white page and host strip were personally reviewed. The PNG
hash equals the earlier authored baseline, `2542b8560f3c313664235302d608184480f0a03929cb8a0caa509421e2ec063a`.
These are control pixels, not game progress or proof of observer neutrality.

Focused lifetime tests cover ordinary redispatch, satisfied waits, pause,
stop, backend replacement, completion, nested acquisition refusal and
idempotent release. Capture preparation only observes the existing guard
within three seconds and pins owner/generation references; its negatives
include timeout, endpoint/Worker/window/process replacement and retirement.
The existing native producer, input, physical release, generation and legacy
graphics guard regressions remain applicable without weaker bounds.

Shared external deletion removed retained PNGs, WASM, EXE and authored C
inputs during this task. Exact b8c8 was recovered from the recorded Git base
and patches, first reproducing 7d347 and then verifying the repaired hash.
The authored C was extracted from this worker's own persisted command output;
recompilation reproduced the original 64-draw EXE hash exactly. Missing visual
evidence was not recreated by reopening a closed runtime.

Focused scene-latency, host-step lifetime, 59 scheduler cases, native source
attribution, legacy input and independent physical release checks passed.
The locked full build passed. Evidence logs and exact source patches are
retained in the run directory.
