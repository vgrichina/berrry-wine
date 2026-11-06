# Half-Life release preparation, 2026-11-05

Status: branch prepared; **not release-qualified or deployed**.

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

The dirty ShowWindow/startup candidate in
`/private/tmp/wine-uplink-startup-20261030` is deliberately excluded. Its WAT,
tests and ownership census are preserved there. The latest performance notes,
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

`node test/test-deploy-build-outputs.js` fails because the registry names
`build/nfs2se-browser.json` but this checkout lacks that generated local fixture.
The earlier implementation checkout lacks it too. This is a current packaging
gate failure, not a Half-Life missing asset; restore/generate its reviewed
fixture and rerun before a full release. Do not silently publish a partial
asset set. No full deployment dry run has passed for this new checkout.

## Required before cutting the release

1. Resolve the intro geometry decision. The committed base still exposes the
   small/offset intro backdrop. The dirty candidate fixes that visually but
   fails Video Modes navigation after dismissing driver advice. Do not include
   it until both normal startup and mode navigation pass in the same build.
2. Build native and compatibility WASM from the final clean branch, together
   with the generated region mirror; retain their hashes. **Do not copy the
   latest dev-server module `13e7c0acf67521ac91fb8462896c80b1cdfc3ac98c527398272a4186e9a08650`:**
   it includes the excluded dirty startup candidate and is not this commit's
   reproducible artifact.
3. Requalify that exact final artifact in visible Chrome: normal intro/main
   menu, visible pointer, New Game, textured gameplay/HUD, pause/resume,
   resolution changes and repeated Software/OpenGL/Direct3D switches. Earlier
   committed-module switching passed (`20261103-uplink-switch-review`), but
   cannot qualify a different final binary. Safari is explicitly skipped.
4. Complete build/deployment asset gates and a full dry run with original
   readme and split PAK parts retained. Record exact final artifact identities,
   selected scope and known limitations before any publication.

No new browser run, build, push or deployment was performed during branch
preparation, to avoid competing with the wasm3 microbenchmark. Existing FPS
results are host-contention-sensitive; neither this branch nor its checklist
establishes a new FPS gain. See [Half-Life investigation notes](re-notes/half-life-uplink.md)
for reviewed runs and detailed limitations.
