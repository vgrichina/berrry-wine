# Half-Life release preparation, 2026-11-05

Status: release `9a5d48035` deployed to https://wine-assembly.berrry.app;
remaining gameplay verification and long-session failure recorded below.

Branch `release/2026-11-05-half-life` starts at
`c84edcd8db6f7d55de822e4c395ff8eb1fa12a0d`, the committed Half-Life
implementation. Checkout: `/private/tmp/wine-release-20261105-half-life`.
Ignored binary/dependency assets were linked with
`bash tools/make-test-worktree.sh --link-only <checkout>`.

## Included scope

- Desktop entry `halflife_uplink`, titled **Half-Life: Uplink Demo**.
  OpenGL is the initial registry setting; the original installer remains local.
- Prior committed rendering, menu/cursor, Direct3D allocation/light/scheduling,
  empty nonclient paint and dirty-uniform/presentation fixes through `c84edcd8d`.
- Selected SEO integrations `9cd701049`, `7462d9282`, `4a48b4385`,
  `003a6e730`. Later main changes are not merged, including compatibility pages
  `4141b7292` and unrelated runtime fixes.
- The x87 dispatch experiment remains reverted. Its benchmark results are
  diagnostic evidence, not a release optimization.

The ShowWindow/startup candidate from
`/private/tmp/wine-uplink-startup-20261030` is now being qualified with a renderer
owned-popup ordering fix. The original dirty checkout is preserved. The latest performance notes,
including CPU profiles, hot-loop investigation, reverted x87 dispatch experiment
and the inconclusive wasm3 microbenchmark, are included in this branch.

## Asset checks performed on this checkout

Registry-derived Half-Life assets: **65 unique files, 93,140,232 bytes**;
all exist and all appear in `desktopAssetPaths()`. The installer is absent
from that publication set. Deployment permits only this demo's `installed/`
directory, including its original readme, rather than its installer siblings
or other Half-Life editions. No new claim about redistribution rights was
established during this audit; preserve the original package/provenance record.

Verified pins:

- `hldemo.exe`: `e459ef7d19bc0690d2e2d6dca9af1d773b49f8172096e49a694f897119bc4dc1`
- `valve/pak0.pak`: `c9eac1391845d6fabd93d7a1cc48281275410d35e01b74bd7f02325c65c99a42`

`node tools/check-browser-cache-versions.js --self-test` passes (98 page
scripts, 11 worker scripts). `node test/test-deploy-morrowind-local-only.js`
passes (1,231 release assets, retail exclusion intact).

The initially missing `build/nfs2se-browser.json` fixture was restored by linking
the existing root checkout's manifest and `build/nfs2se-demo` directory into
this checkout. `test/binaries/SOURCES.md` records the original `nfs2sea.zip`
demo URL; `docs/nfs-renderer-benchmark.md` describes the manifest construction.
All 73 files exist and resolve under `nfs2se-demo/`. No retail fixture or newly
invented manifest is substituted. Manifest SHA-256:
`7022d85d9b8fd801ca391c6bbf0219a2cb5a1bbc8b11ec4d966c2eddfcc750b0`;
`NFS2SEA.EXE` SHA-256:
`7e357542a3f7a3a67f6fac06c299e6bdc23529f0b9a16d9e7639079e56c039d9`.
`node test/test-deploy-build-outputs.js` now passes; the retail exclusion test
also passes with the restored fixture (1,304 release assets).
An existence audit of all 1,304 registry-derived assets reports no missing
files. The final offline dry run passes: **2,744 files considered**, including
both WASM builds and eight Uplink PAK parts. Log:
`/private/tmp/wine-release-20261105-final-dry-run.log`.

## Final build and startup checks

Built from this release source with `bash tools/build.sh`:

- Native WASM: `999a42bfe60981e6e40cb1f41d7f1b9676229eeb5552849fc7d58e521cd57e22`.
- Compatibility WASM: `5c263f5d9477ed64c49bacadbbbd11c4884f987178433c8ad17f6ff7af4e5084`.
- Region layout: `624d2388f3d5dc0b`.
- Region mirror SHA-256: `d1536918090e3f535393296e9b51787745c7e7af6d046756e4d8e74dfda8551f`.

Hidden indirect dialogs retain their template visibility. Explicit ShowWindow
delivers WM_SHOWWINDOW before visibility/activation using an invocation-owned
guest frame. Its continuation handles stdcall and authenticated legacy cdecl
returns. Showing an owned popup promotes its subtree above sibling popups,
while raising only the owner preserves sibling order.

Fresh visible Chrome diagnosis `20261105-uplink-startup-resolution` confirmed
the mode dialog was visible but covered by Video (shared owner65566,
mode65586 z1078, Video65579 z1079). The fixed release build exposes the mode
controls after advice OK in cooperative and isolated Worker modes:
`20261105-uplink-release-qualification` and
`20261105-uplink-release-worker`. Intro and main menu were captured;
the cooperative native screen capture shows the pointer in Video Modes.

Focused owner/modal/letterbox tests and startup continuation, async show,
secondary/child sizing, dialog promotion and owned-form activation regressions
pass. Paint Attributes passes unchanged with WINE_ASSEMBLY_WASM pinned to the
final native build; earlier 120-second failures were automatic compilation
timeouts. The callback census and build gates pass.

## Remaining verification and known limitation

- A prolonged Worker session in the Content Control menu exhausted guest
  sparse commitment: a 1 MiB commit failed, followed by a 110,456-byte
  allocation and CMemoryException. Subsequent failures created 1,408 error
  dialogs. `20261105-uplink-release-worker` is marked failed with the screenshot
  and allocator log. Unlike the older oversized GetObject allocation fault,
  these are ordinary-sized requests. Root cause remains open; repeated
  ShowWindow calls completed and do not establish callback recursion.

- Finish New Game, textured gameplay/HUD, pause/resume, resolution changes and
  repeated Software/OpenGL/Direct3D switches on this exact artifact. Earlier
  committed-module switching passed (`20261103-uplink-switch-review`).
  The latest scripted navigation accidentally opened Content Control;
  it does not qualify gameplay. One earlier Worker attempt accidentally
  selected Quit and was relaunched; this was test input, not a crash.
- `test-callwindowproc-dialog-modal.js` traps on a legacy cdecl callback
  during synchronous activation. The same failure was reproduced on an
  isolated clean baseline `f2c5ff493`; it is not introduced by this release.
  Log: `/private/tmp/wine-uplink-cdecl-baseline-20261105.log`.
- Safari is explicitly skipped. Compatibility WASM was built and validated,
  but this round of visible Chrome tests loaded the native artifact.
- No new FPS claim is made; existing measurements are sensitive to host load.

The user authorized committing and deploying with these remaining checks
explicit, then merging into origin/main and continuing verification.
All ten deployment batches returned HTTP 200. Live verification byte-matched
both WASM files and ten build/runtime files, including region mirror and app
registry. Live stamp: `9a5d48035+ 2026-11-06 04:16`; the plus reflects the
untracked dependency symlink, with tracked release sources committed. Verification
log: `/private/tmp/wine-release-20261105-live-verification.json`.
See [Half-Life investigation notes](re-notes/half-life-uplink.md) for the
completed CPU, hot-loop, x87 and wasm3 investigations.
