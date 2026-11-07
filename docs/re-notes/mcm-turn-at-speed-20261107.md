# Motocross Madness simultaneous steering — 2026-11-07

**Original steering remains unproved.** The run-local freshness and simultaneous
input controls passed, including the actual offset/scaled browser fixture.
The sole original stopped at the video-memory prompt: its first Enter was
refused before dispatch because the inspected capture was older than 12 seconds.
No name, menu, quarry, throttle or steering input was accepted in this run.
No emulator defect was demonstrated and no emulator code changed.

Evidence: `scratch/runs/20261107-mcm-turn-at-speed/`.

## Harness changes and controls

The generated property-sheet input now uses the same `scene-guard.cjs` admission
as the original, with the expected app identity parameterized. It checks capture
age both before and after the live app read, admitting only 0–12,000 ms. Local
controls refuse the prior 22,542 ms stale case for both apps without dispatch,
test the exact boundary, and refuse a scene that ages out during the read.

`ordinary-keys.cjs` adds only Up+Left and Up+Right combinations. All keys and the
unchanged integer 50–2,000 ms duration bound are validated before effects. Key-up
cleanup runs in `finally` for every attempted key, in reverse order, and continues
through a release error. No failed key-down is replayed. Production renderer
controls establish overlapping physical held states, success and partial failure
release, and zero events for invalid combinations/durations. The numbered client
refuses dependent requests after UNKNOWN, failure or refused admission. Exact
request/scene-step controls establish successful ACK before retrieval and no
result retrieval after a refused ACK.

All three actual Chrome sessions also tested trusted native Up+Left/Up+Right
overlap and release after an injected failure following delivery of the second
key-down. Their final held sets were empty. These browser controls preceded app
selection; they do not prove original guest steering consumption.

The actual generated COMCTL fixture used a screen at CSS origin (137,83), scale
0.8, measured 819.2×614.4. Both mouse inputs used personally inspected captures
and guarded admission ages **8,523 and 9,222 ms**. The first click mistakenly used
normalized Y 0.545, selecting blank canvas below the sheet. The resulting image
was inspected; corrected Y 0.4541 clicked ordinary OK, and disappearance was
personally reviewed. This was a known balanced click, not an UNKNOWN retry.

The generated WebGL prerequisite passed with advancing owner completions, error
0, no guest fallback, and no software-draw fallback. Actual owning endpoint 1 was
**legacy/WebGL**, provider **ANGLE Vulkan SwiftShader Device (Subzero)**, WebGL
2.0. This fresh box differs from the preceding run's Intel provider.

## Original boundary

One fresh box **bx_68rmxf9k** was created at 07:34:53 UTC after persisting its UUID
Idempotency-Key. No creation retry, second box, resume or second original occurred.
Three transport probes and a complete pin check passed before the sole production
`?debug&threads&d3d-renderer=webgl&app=mcm` launch at **07:37:34.944 UTC**.

The original video-memory prompt was personally inspected. Capture `fresh-memory`
was timestamped **07:37:51.701 UTC**. The Enter request's remote command began at
**07:38:04.073 UTC**, already **12,372 ms** later; its reply completed at
07:38:04.140. The unchanged 12-second guard correctly returned
`refused-before-dispatch`, `effects:0`, `refreshRequired:true`. No input admission
record or resulting `name-entry` image exists. The checked scene step exited 3
without retrieving a result. The original attempt was terminated at that boundary;
there were no accepted original inputs, UNKNOWN inputs, held-key retries or
dependent gameplay commands. The operator allowed capture age to exceed the bound;
this is a harness/workflow failure, not game or emulator failure.

For terminal cleanup only, a separately recorded lifecycle request used the
underlying numbered ACK publisher because the stricter ordinary client rejects
all requests after refusal. It asserted the prior zero-effect refusal and absence
of an input-admission/result image, then sent only `quit`; normal close received
ACK 2. It did not bypass admission for guest input.

The original guest Worker executed SHA-256
`e41511fe861363fbe1639d80f20cbcdd7240f46937c93a801eaa256ca094c467`,
2,182,493 bytes, endpoint 1/CPU slot 0. **Original renderer backend and provider
are UNKNOWN**: no render Worker existed at the prompt. Requested WebGL and the
separate generated owner's result must not be substituted for original identity.
Chrome was **151.0.7922.71**, V8 **15.1.206.10**.

## Provenance, recovery and next step

Staged source commit was `524cc8138d2d92c4e94506f2b35ca2776c65d9de`, with
tracked binary diff and untracked wininit-boot patch retained. This records source
inputs, not fresh-build provenance for the retained module. All **937 runtime
pins** matched before launch and at cleanup. All **311 authentic media files,
45,460,823 bytes**, matched the prior authentic inventory; installation-root paths
and working directory were preserved. All **1,491 complete HTTP 200** responses
matched staged pins, with no unmapped success.

All **137 remote artifacts** were recovered or deduplicated against identical
owned bytes and hash-verified before explicitly delegated normal nonforced box
shutdown. Terminal observation confirmed six PIDs absent, six ports refusing,
three profiles absent and three writer locks absent. Stop
`stop_0409b76963bacf06` completed at **07:39:02.135 UTC**, error null; box state
**archived**, active expiry null. The local watcher was stopped and free home was
above 2 GB. No source/media archive, public deployment, guest configuration or
physics forcing, FPS, audio or full27 claim was made.

The next authorized original needs a newly captured and personally reviewed
scene immediately before admission, with operator/tool latency kept inside the
same 12-second bound. Keep progress commentary and unrelated work outside that
interval. The qualified combined action can then support the still-outstanding
quarry baseline → throttle-only → throttle+steering → settled player trajectory
comparison. This run supplies no evidence about the cause of original steering.
