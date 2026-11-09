# LBreakout2 first-level attempt: caller readiness blocker, 2026-11-09

No new brick, score, return, or first-level completion was observed. The accepted
score **2000** and brick removal in
`lbreakout2-sustained-first-level-20261108.md` remain accepted. This attempt stopped
at its first concrete failure without original input, an original screenshot,
continue, retry, or guest quit.

Evidence: `scratch/runs/20261109-lbreakout-first-level-clear-2335/`.
Tested main commit: `e7e033634d67bc4b947e1ed2a91631ea10868be7`.
The exact relevant dirty source and task-local helper patches are retained there;
Git remains the source archive. Original media was referenced by existing path
and SHA/size, not archived. The registered `lbreakout2_251` manifest/cwd/DLL route
was retained. The loaded module recovered from both native sessions was
`3e491c0840bb7771328738a0d160b4bbaa3d7ab72074cbd38a7b41e5d7e8ec18`.

## What failed

The worker composed the released ReVolt terminal-safe caller with the original
LBreakout2 app route. That was an incorrect helper choice: its `bound-input.cjs`
requires a D3D render Worker endpoint before binding. The accepted LBreakout2 SDL
route renders through the page's Canvas 2D and permits the absent endpoint.
The original guest Worker became ready at 23:35:08Z, but this task-local chain
could never satisfy its renderer requirement. At **23:36:09.256Z** it recorded
`actual owning renderer readiness timed out` and immediately sent native SIGTERM
to its owned Chrome, with the terminal protocol guard active. Chrome exited 0 at
23:36:09.394Z; terminal cleanup was published at 23:36:09.491Z.

An independent native cancellation at 23:36:15Z found Chrome already absent and
terminated the lingering Node consumer. Its parent retained actual wait `-15`
and separate stdout/stderr EOFs. No later browser protocol, input, capture, retry,
quit, or deadline extension was sent. The original command directory was empty.
No death/lives-lost image was returned in this attempt. No emulator regression
or unusable original framebuffer was established.

## Checks and limits

Before allocation, the actual generated consumer's functions were executed with
an offline transport peer: reviewed short Left DOWN/UP, reviewed passive capture,
missing-review refusal, explicit terminal visual decision, sticky command
refusal, and protocol/input/capture/quit rejection after terminal all passed.
This used a VM transport peer, not Chromium. `tools/native-key-controls.test.cjs`,
`tools/verify-lbreakout2-251.js`, and the locked `tools/build.sh` passed.

One native production Worker fixture passed before the conditional original.
Both fixture images were separately model-reviewed. Its ordinary Left 100ms
pulse had two trusted native events and acknowledged independent UP; Chrome and
the fixture consumer exited 0 with separate EOFs. This fixture had a D3D render
Worker, so it did **not** cover the SDL absent-endpoint condition. The offline
and fixture results therefore did not justify the original readiness assumption.
No local Chrome or nested worker was used. No production source changed.

## Evidence and shutdown

All 819 remote runtime pins remained unchanged. **69 artifact references / 56
unique contents** were independently retrieved and SHA-256/size verified before
the sole delegated normal stop. Loaded modules, browser logs, fixture reviews,
failure, cancellation, and separate launcher EOF/wait records are retained.
The independent watchdog was prearmed before allocation with immutable UUID
`4eeaa250-66b6-4ea5-b9dd-f80ef13ac7f3` and deadline
**2026-11-09T23:58:12.830Z**; initial box expiry was 23:58:12.286Z.

Box **`bx_cyusa9uf`** is **archived**, current expiry **null**.
Stop receipt **`stop_1bacc5ba982c03f5`** completed at
**23:36:42.402Z**, `forced: false`. Independent API reads confirmed both the
archived state and exact operation receipt. The watchdog exited 0; its supervisor
retained actual wait and separate stdout/stderr EOFs, and the final deadline
hash matched its initial immutable receipt. `/home` remained above 5.5 GiB free.

Next: in a separately assigned attempt, retain the accepted LBreakout2
Canvas-2D identity chain while adding terminal review guards, and exercise that
exact absent-render-Worker consumer offline before allocating. No live repair
or second original attempt was made here.
