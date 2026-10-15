# Original Kkrieger gameplay capture preparation

Prepared controller; subsequent partial run and user pause are recorded below.
Parent must grant the sole sandbox slot
after combined renderer validation and queued CMR3 registration. Root pins the
actual main commit and matching canonical module receipt; `6b269258` is a
candidate, not an assumed final main. No build or remote runtime was performed
for this preparation. Keep the source-only controller separate from the tested
checkout; `WA_TEST_ROOT` selects the pinned checkout. No fixture copies needed.

The prior `42b0be` original run reached menu by375s. Five-second held Enter at
about525s produced a first-person level by555s; short down/up was consumed
together. Actual messages reached HWND0x10001. No input fix is justified.
Evidence: `scratch/runs/20261015-kkrieger-menu-input/`,92 verified artifacts.
Movement, combat, audible audio and logical FPS remain unqualified.

## Runtime recipe, only after parent grant

Retain preflight process list, full source hash manifest, clean tracked status,
canonical build receipt, module SHA256 and three fixture pins. Minimum free
disk2GiB. Verify the granted box has no surviving runtime before starting.
Controller checks sourceHEAD/clean tracked status, module and all three fixtures
before and after; it also hashes the actual loaded WASM response. Parent retains
full source manifest pre/post as an additional guard against restored edits.

```sh
WA_TEST_ROOT=/absolute/pinned-checkout \
WA_RUN_OUT=/absolute/fresh-evidence-directory \
WA_EXPECT_COMMIT=ROOT_PINNED_40_HEX \
WA_EXPECT_WASM_SHA256=ROOT_PINNED_64_HEX \
timeout --signal=TERM --kill-after=5s 905s \
node /absolute/prepared-source/tools/kkrieger-gameplay-capture.js
```

The owner has an absolute900-second deadline from before browser/server launch,
including inputs and shutdown; its watchdog kills its own Chrome. Normal capture
stops by870s to allow cleanup. Never pause, extend or retry this run. An outer
wrapper is cleanup insurance, not extra guest time. Save terminal status and
postflight process list even on timeout, and terminate only verified survivors
belonging to this controller. The browser endpoint is diagnostic metadata, not
permission to launch another observer. No EIP trace or guest write is installed.

Watch `scene-N.png` (every10s plus capture overhead), beginning around300s.
As soon as Start menu is visually confirmed, atomically write the following JSON
to `menu-confirmed.json` in this run's output, replacing the example values:

```json
{"stage":"menu","screenshot":"scene-37.png","reviewedAt":"2026-10-15T00:00:00.000Z"}
```

`reviewedAt` must be the real inspection time after this owner started. This is
an operator observation, never a timer-based assumption. The controller checks
the screenshot exists in this run and then sends ordinary Enter down, waits5s,
and releases. It captures both sides. Do not use the old broad-trace observer.

Continue inspecting new scene images; when first-person level and weapon/HUD
are visible, write `level-confirmed.json` with stage `level`, actual screenshot
and current review time. This phase requires160s remaining before the owner's
cleanup margin; late confirmation fails closed. At900s there is no extension.

The controller preserves viewport1100x800 and normal input routing. It records
focus/main HWND, activeElement, pointer-lock status, running state and optional
WinePerf snapshots. It moves the ordinary mouse to(550,400), waits3s, then
captures four sequential20-second windows with before/after images:

1. Idle baseline: no keys or mouse movement.
2. Forward: W held5s, released, remainder idle.
3. Strafe: A held5s, released, remainder idle.
4. Look: ordinary mouse move(550,400) to(710,400),16 steps, remainder idle.

Each event is written immediately. All held keys are released in cleanup.
If absolute mouse movement does not produce look, report that result; do not
force pointer lock, patch camera state or fabricate a successful response.
No firing is scheduled: combat remains unverified unless separately authorized
and captured within this same bound. Background/weapon animation alone is not
player control. Inspect stable world geometry and directional viewpoint changes
against the idle pair, and retain ambiguous results rather than treating any
pixel change as movement. Sequential windows are not identical-world resets.

## Measurement and acceptance

The controller chains the existing `onGuestFrame` hook used by
`profile-web-frames.js`. It records at most20000 timestamp/kind/slot rows and
keeps total/dropped counts. For each window calculate count delta divided by
the actual page timestamp delta; preserve raw rows and split by source/slot.
These are guest presentation events/s, not logical game FPS, browser rAF rate,
or unique displayed frames. WinePerf's page FPS and PRESENT/s remain separate.
Missing hooks, overwritten hooks, dropped rows or missing sources must be
reported; no unsupported logical-FPS estimate is permitted.

Audio snapshots read existing host voice metadata and AudioContext state/time
only. They do not call cursor APIs, resume audio, scan PCM, or install the
1ms underrun probe (which would perturb this short movement capture). A running
context or nonzero data does not establish audibility. No audio recording is
produced; audible sound remains unverified in this recipe.

Acceptance is staged: (a) original intact route reaches menu, (b) ordinary Enter
reaches level, (c) reviewed matched evidence supports W movement and A strafe,
(d) reviewed geometry supports mouselook. Mark each independently. Completing
the controller sequence is not a pass assertion. Preserve startup failure,
late/absent visual gates, lack of control response and partial evidence.

After terminal/postflight, copy artifacts with size/SHA manifest and verify every
copy. Retain controller source, build/source receipts, logs, events, snapshots,
images and terminal records in a unique `scratch/runs/` directory. Publish
`result.json` last using candidateId `kkrieger-beta`, actual UTC times/build,
environment and exact qualified scope; inspect images before `reviewed` and run
`ops/check-run-evidence.js`. Do not infer playability, combat or audio from a
successful exit or screenshot. No public deployment.

## Interrupted capture and build-delivery failure (2026-10-15)

Root granted one run on exact main `7aa74110e53e547c6bcf33cdd92e25df9dea9712`
with canonical file SHA256
`d463bdae09d9a4e8926c31f0a594535331a2a85d39d494c0e281b920ce9f0fa5`.
Owner76858 began10:41:07.272Z, with fixed900s deadline10:56:07.272Z. All6490
remote tracked-file hashes independently match local Git blobs for that commit.
No build command ran. The three original fixture pins matched before and after.

**This does not validate the canonical module.** The isolated checkout used a
build-directory symlink to the existing canonical build. The static server
refused the outside-root target with HTTP403. `browser.log` explicitly records
`unable to load build/wine-assembly.wasm; compiling WAT sources`. The browser
therefore compiled the pinned current-main WAT source; its actual module hash
was not captured. The source/module-file checks passed, but the loaded-response
check was deferred until finalization and was never reached. A future execution
must have the canonical module physically inside the served root and verify
successful WASM delivery before accepting runtime evidence. No retry was made.

The user requested wrap-up and pause while this run was active. No menu or level
confirmation was submitted and no keyboard/mouse input phase began. The scoped
`boat exec --kill 76858` stopped the entire owned process tree, terminal143 /
SIGTERM at10:47:47.205Z. Read-only postflight10:48:11.684Z found no survivors,
clean tracked status, unchanged6490 source hashes, module-file and three fixture
pins. The normal owner finalization was interrupted; its initial `meta.json` is
preserved unchanged. `process-76858.json` and `receipts/postflight-pause.json`
are the authoritative stop/cleanup records.

Latest saved `scene-39.png`,10:47:44.592Z / page396412.5ms, shows rendered3D
and title-intro text. It does not show the Start menu or first-person weapon/HUD.
Audio metadata reports a running context and stereo44.1kHz PCM16 ring; there is
no recording and audible quality remains unknown. Matched gameplay windows and
the gameplay Present hook never started. Movement, mouselook, combat, gameplay
presentation rate and logicalFPS are all unverified.

Evidence: `scratch/runs/20261015-kkrieger-gameplay-paused/`,92 remote artifacts,
9269914 bytes, every size/SHA verified; local audit/process receipts added.
Archive7774275 bytes, SHA256
`18c9bfc8fffc990d369f706ed91e7d36b453ee48ca0bf071d8be313f14bc3d26`.
`result.json` was published last with `harness-error` and the user-pause reason;
own schema/containment/missing-artifact checks pass. Summary receipt:
`docs/kkrieger-gameplay-paused-result-20261015.json`. Runtime released; no further
guest work, build, input, deployment or new experiment is authorized by this note.
