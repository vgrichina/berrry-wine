# GLTron repaired live backends — 2026-11-04

Input: `e9aaa463459513cc24ba4938eb038960a6ad7c2f` and
`gltron-locked-live-interval-20261104.md`.
Run: `scratch/runs/20261104-gltron-repaired-live-backends/`.

Software completed 62 entered nonzero-dt original updates in
5,511.359999895096 monotonic ms: **11.249491958641809 updates/s**. Personally
viewed the exact active-before and after-measure capture paths returned by
successful command ACKs. Both show the yellow player alive with its trail;
the second shows the changed path and direction after ordinary native turns.
Player one stayed alive throughout all interval samples and retained steering
samples. The round, player data, owner, generation and original counter marker
remained unchanged. This includes observer, marker and steering overhead.
These are entered updates, not completed updates, display frames, presents,
physics substeps or physical GPU FPS.

The software browser closed normally before the sole WebGL browser started.
WebGL reached the personally viewed main menu, Game menu and paused arena.
The first shot named paused-arena still showed the preceding menu while the
original state had already entered the paused callback; a later read-only
paused-confirm capture showed the actual arena before unpause. No input was
sent from the stale menu image. The subsequent drive command's ACK client
faulted while reading reply 6: `SyntaxError: Unexpected end of JSON input`.
That same producer reply later contained a complete successful ACK. The
active-before shot and measure command were never queued. The sole subsequent
command was ordinary quit. The entire pair stopped, with no original or
backend retry. WebGL therefore has **no measured update interval** and no
personally reviewed active before/after pair. Its 18 retained steering samples
were all living and include a native turn's direction/trail acknowledgement;
that alone is not a rate measurement or personal live-image review.

## Actual renderer and runtime bounds

Software's actual owning `OpenGLHostBridge` context reported `software: true`,
with no observed WebGL context. WebGL's actual owning bridge reported
`WebGLBackend`, WebGL 1.0 and unmasked renderer:
`ANGLE (Intel, Mesa Intel(R) UHD Graphics 620 (KBL GT2), OpenGL 4.6 (Core Profile) Mesa 23.2.1)`.
This is the browser's reported renderer, not an independently verified physical
GPU performance result. Launch argv also contains SwiftShader flags, which
are not substituted for reading the actual renderer. No WebGL rate comparison
is claimed.

The exact Stronghold render-sized local heavy release at 20:58:26Z preceded
this pair, after MDK's 20:53:05Z local release. One inherited external
`/tmp/wine-local-runtime.lock` covered both original backends. The helper now
also requires that anchored current Stronghold release; the predecessor
accepted the earlier MDK release alone. Actual predecessor-parser mutation
accepts that insufficient prerequisite; current parser rejects it, waiting
lines, quotes, foreign senders, stale and future releases.

The helper reserves 720 seconds browser plus 180 seconds cleanup **per
backend**, bootstrap 60 seconds and commands 40 seconds, absolute browser end
23:50Z and cleanup end 23:53Z. Each backend checks its full reserve before
starting. Original media/dependency/served-path hashes, trusted native input,
owner, native/tier, liveness, frame, scene, visibility, frozen/host-step,
reset/wrap and read-bracket guards remain. No guest state, code, configuration
or pacing writes, host stepping, freeze or time exclusions occurred.

## Tested causal repairs

The actual writer published JSON directly to final paths. Another process
could see file existence between truncate/create and completion. This explains
the observed empty-JSON client failure; the transient bytes were not retained.
The repaired writer publishes a sibling temporary file, then renames the
complete JSON to its final path. This applies to ACKs and associated capture,
proof and lifecycle records. It does not retry, ignore parse errors or resend
input.

The executable regression runs the actual ACK client against the actual
producer in a separate Node process, with a deterministic 250 ms empty-file
write window. The predecessor writer exposes reply-0.json and the client
fails with the same SyntaxError. The repaired writer exposes only the
unpublished temporary path; the unchanged client waits and accepts the
complete ACK after rename. Both fixture children exit normally. There was no
post-repair original launch.

The prior ACK steering decision also accepted partial acknowledgements: either
direction or trail index changing permitted another native turn. It now waits
for both original fields to advance. Executable old/new tests cover each
partial change, complete acknowledgement, unchanged pending turn and dead
player. Actual loop bodies replay the prior retained narrow-corridor sample:
the old 300 ms cooldown emits nothing, the repaired loop emits S. Offline
checks do not prove future native delivery or survival.

The initial full-page historical relay passed at 4,774 ms. After release,
full-page offline reviews rejected at 5,507 and 5,462 ms. The first operator
shell used a newline and invoked --run after the failed review; the real
handoff gate rejected before backend creation/server/Chrome. The second used
the new atomic --review-run entry and never entered runPair after rejection.
Both failures remain recorded. No original backend had started in either.

The actual capture producer now captures the complete visible game canvas
instead of the surrounding console and browser controls. The real callback's
executable test validates canvas bounds and rejects an off-viewport canvas
before screenshot. Exact capture path, hash, epoch, successful producing ACK
and personal VIEW are still required; the five-second guard is unchanged.
The smaller complete historical-canvas fixture (an old completed-round image,
explicitly not live gameplay) passed personal VIEW-to-review-only at 3,768 ms.
The real pre-Chrome consumer accepted that fresh proof before the sole pair.
The real software counter armed within the unchanged five-second live review
limit (4,046.9500000476837 ms). The new --review-run CLI also has an executable failed-review
fallthrough mutation test with all process/server/Chrome entry paths trapped.

## Closure and evidence

Software Chrome PID 1152472/start 187351034 exited 0/signal null at
21:05:44.156Z. WebGL Chrome PID 1153482/start 187355340 exited 0/signal null at
21:06:38.617Z. Node PID 1152459/start 187351003 and wrapper exited 0. Exact
owned PIDs and owned-profile processes are absent. HTTP/DevTools ports
38651/45535 and 38653/35657 refuse connections, servers closed, flock is free,
and profiles were removed only after those checks. No foreign kills. Total
browser lifetime was 97,519 ms. Local heavy release posted at 21:07:48Z.
Box ID/state/expiry N/A; coordinator owns box lifecycle and shutdown.

Validation: 80 focused checks passed, both unchanged compiled modules executing
original branches under all four tiers and native input/owner/liveness/scene
negatives, locked full build, syntax and diff checks. Preparation checks all
production media/dependencies and 1,010 offline HTTP routes; actual served
responses are checked against exact path/hash pins: 234 requests per backend, all matching. Final counts and detailed
outcomes are in the run result.

The prior 18/117,776-byte, 82/1,539,457-byte and 103/3,854,998-byte seals
remain intact. All 88 prior locked-run artifacts retain their contents; its
still-running board watcher appended lines, and its original hashed prefix
remains unchanged. Evidence records exact Git SHA, relevant binary diff and
owned new note patches. Existing media/modules are referenced by path and
SHA-256; no source/media/module snapshots or tar archives.

Next: the repaired ACK publication has offline regression coverage. A fresh
original WebGL interval requires separate authorization, a fresh complete
handoff and all existing runtime guards. This assignment stops after
publishing the bounded software result and tested first-fault repair.
