# OrganicArt current-main rectangle investigation, November 7

This attempt stopped at a capture-adapter error before the ordinary browser
`scr_oasaver /s` launch. **Current-main reproduction remains unverified.** No
emulator defect was demonstrated, no rendering/configuration/media change was
made, and no repair or scene-parity claim is justified.

Evidence is in `scratch/runs/20261107-organicart-visible-rectangle/`. Work began
at 04:56:53 UTC; the first failed launch adapter was submitted at 05:00:06 UTC.
Its detached process was absent at the 05:00:26 process inspection, with an
empty log and no Chrome identity, response records, or scene captures. Static
inspection then identified the cause: run-local `capture.cjs` ends by requiring
`tools/web-input-probe.js`, whose `main()` executes only under
`require.main === module`. Requiring the CLI does not invoke its workflow.
This was the worker's harness error, not a guest failure. There was no terminal
receipt from the detached process; no input or original launch was replayed.
The software capture workflow did not start and WebGL was not attempted.
Per the task's first-blocker rule, the adapter was preserved without a retry.

## Historical evidence reconciliation

[The Plus! 98 note](plus98-dx-screensavers.md) records butterflies and “stray
white box gone” after `8b227b5c` at one software capture point. It also explicitly
identifies scene slot 6 and blank primary slot 38 for that historical run.
Neither a single absent rectangle nor another primary/offscreen texture proves
a repair. Surface selection must follow the actual owning displayed layer;
this attempt obtained no scene and therefore diagnoses no surface.

The October 30 paired browser report used module
`d83e413fbc38ca5aa5447a7be62d10010783fd5490c98ec07c076553897950e5`,
source-fix reference `de2e338c4`, with complete compiled-source identity unknown.
It showed the rectangle over animated scenes on both routes. Later
[OrganicArt notes](organic-art-screensavers.md) and the October 31 sections of
[the corpus](../gl-d3d-corpus-status.md) already narrow the historical rectangle
to the native logo path: `CALogo.gif` lookup fails, native logo-disable and
substitute-image diagnostics change that area, and the enabled original can
also lose the rectangle naturally. Thus the older disappearance is compatible
with scene/logo timing and does not establish a permanent renderer repair.
Those are prior documented findings, not new current-main observations; their
named original run folders were unavailable in this checkout during this task.
Authentic logo/installation metadata remains the documented missing input.
No logo disable, replacement image, guest patch, or crop was applied here.

## Exact scope tested

- Source pin: main `59e41298aebfeab4ebd704e01a3835c29ce4ea4b`, with per-file
  source hashes in `source-pin.json`, relevant tracked diff in
  `relevant-source.patch`, and the existing untracked runtime dependency
  `lib/wininit-boot.js` preserved as `new-wininit.patch`. No source tree archive.
- `flock /tmp/wine-build.lock bash tools/build.sh` passed. Built standard WASM
  SHA-256 `e41511fe861363fbe1639d80f20cbcdd7240f46937c93a801eaa256ca094c467`;
  compat `04acbb89f66ad9814836b5e2c34de659b518f4e1994f50c4ee8069c991f02f72`.
  These were staged artifacts, **not observed loaded guest modules**.
- All 85 registered executable/scene inputs were hashed, transferred individually
  and unchanged in pre/post checks, along with DLLs and runtime files: 1,159
  staged file hashes matched. Complete manifests are `fixture-pins.json` and
  `runtime-pins.json`. Original `OASAVER.SCR` SHA-256 is
  `470e28bcbc3cf92c514cd8e8bbf9eae399c59f79ed2adbf7bf2b91d25cfb477c`;
  real Microsoft `d3drm.dll` is
  `fd80f3839a035b6b52362735b22eb8d2523d3434bf18afb3e0f1b5ace84357b0`;
  `d3dxof.dll` is
  `1f2d0683668b3039d451d88ed449fd9d49371fab3fadb991636cd6bfb0aa6eee`.
- Fresh-box Puppeteer import and Chrome `151.0.7922.71` smoke page passed.
  The recovered smoke screenshot was inspected and shows only “Browser ready”;
  it is not an OrganicArt capture. Installed dependency inventory contains
  2,306 hashes, not an actual guest-loaded dependency trace.
- No owning guest/render backend, draw/fallback/error counters, viewport/clip/
  clear/presentation trace or natural mid-scene capture was obtained. These
  remain unknown, not zero. Eleven remote artifacts were recovered with all
  SHA-256/size checks matching. No access operation was flagged or retried.

The one fresh box was `bx_cyncwrg6`, created with a persisted UUID
Idempotency-Key at 04:57:42 UTC, original expiry 05:32:42 UTC. Cleanup verified
the smoke Chrome PID 6141 and adapter wrapper PID 7900 absent, no owned runtime
process, no temporary Puppeteer profile and no owned browser/server listener.
Normal shutdown was explicitly delegated and requested once at 05:01:25 UTC
with `forced: false`; stop completed at 05:01:25.794 UTC and the box is
`archived`, with no active expiry. Final state is recorded in the run's stop confirmation.
No `a403` box was resumed. Local work created only a messageboard watcher;
its cleanup is recorded in `local-cleanup.json`. Free `/home` stayed above
2 GB. The final `result.json` is published after recovery and closeout.

Next: fix the run-local CLI invocation before another authorized fresh-box
attempt, then perform the required software/WebGL original captures serially.
Do not infer current reproduction, absence, or an emulator cause from this run.
This does not qualify FPS, complete scene parity, or the historical 27-app goal.
