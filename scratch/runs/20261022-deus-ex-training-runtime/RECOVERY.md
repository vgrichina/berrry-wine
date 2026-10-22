# Bounded Training run handoff

Result: blocked by incomplete native support staging before menu/control.
This recipe preserves the failed attempt; it does not authorize another run.
No screenshots exist because the renderer/control phase was never reached.

Accepted main: `c26252c4a95babe583ade1d1c6e2da0c050be45c`.
`source-mapping.json` proves identical src/lib/tools tree IDs against qualified
`ce4ce4f95eacaedff1b3e386f3ce3ae5d85bd16c`; the selected lib/tool hashes also
match the qualification source manifest. `source-manifest.json` identifies all
192 final selected files by blob, size, and SHA-256. Read those blobs from the
accepted Git object donor, not a dirty root checkout. No compiler is needed.

The reusable module is `build/wine-assembly.wasm` inside the already committed
`scratch/runs/20261022-mm-timer-canonical-qualification/qualification-artifacts.tar.gz`.
Archive SHA-256: `3e308c0012e996070a01c1f77d6f399e9aaf7adb2d2620b27af018a80d29e248`.
Module SHA-256: `f644bbb26edc077239dac17b8b2cfda482aafd9eb44af4c4776d4fe153d5a1a7`.
The read-only object/archive donor used here is
`/home/user/wine-assembly-mm-timer-qualified-integrate-oct22`.

`assets.json` records all 112 original registered app files, pins, declared
sizes, VFS paths and INI mount transformations. Assets remain read-only under
`/home/user/wine-assembly/test/binaries/candidates/deus-ex-demo/installed`.
Do not download media, alter original bytes, or make a local 224 MB duplicate.
`stage.py` demonstrates streaming/chunked Boat exec transport; every complete
stream hash and remote file hash was checked. The final source manifest also
contains the three prelaunch static-import additions and the one api_table
correction. `support-stage.json` and `retest-support-stage.json` preserve their
actual separate transfers. The initial `runner.tar.gz` excludes those latter
test helpers and api_table; reconstruct from the final manifest instead.

Remote staging is still `/home/user/deus-ex-training` on assigned `bx_2gnkcnac`.
It contains `wine-assembly.wasm`, selected runner/source support, node_modules
(pngjs and wabt from `npm ci --omit=dev --omit=optional --ignore-scripts
--no-audit --no-fund`), the game files, stdole2.tlb, all evidence, and original
stream archives. Nothing is publicly hosted. No test process remains.
The coordinator owns shutdown; expiry is 2026-10-22T03:44:34.864Z and checkpoint
03:34 UTC. Do not stop/recreate/resume the box as part of this recipe.

Before any newly authorized attempt, resolve the **native support** omission:
the runner reports missing msvcrt/comctl32/shell32/ole32. The first two are
available locally with hashes in `missing-native-support.json`; the latter two
are not at the checked paths. Determine the actual required/transitive support
closure before transfer. Do not claim that the 112-path game check covers it,
and do not assume that all warning-only DLLs are fatal. No third attempt or
production repair was performed by this worker.

Historical launch is `sh evidence/launch.sh` on the assigned box, using the
unchanged registered app. First detached PID was 32653; retest PID was 32889.
Both exited 1. The first log is the missing src/api_table.json staging error;
the retest log is the `_vsnwprintf` trap during Render.dll initialization and
rollback failure. Commands/timestamps/Boat IDs are in launch receipts and
`input-log.jsonl`. No menu navigation was issued.

If separately authorized and prerequisites pass, the original documented
route is step 3000, Esc, step 200, inspect the menu, select Training using
ordinary menu input, then inspect world/HUD and hold Up across 150 steps.
Fullscreen keyboard navigation is documented as Down x3 then Enter with short
holds. Choose input only after inspecting the actual menu. Preserve original
before/after PNG frames and the input log; distinguish intro from gameplay.
`control.py` and `fetch.py` use only Boat exec and record command/retrieval
identities. They do not alter lifecycle or circumvent access restrictions.

`evidence-artifacts.tar.gz` is a verified copy of the remote evidence folder
and dependency log, including original errors, exit files and timestamps.
SHA-256: `6f4928e32bb6421e6f24b709cea0c12dda292796dce8b4fc96063bd4dbb12cfd`.
It contains no game binaries. `run.log` and `first-run.log` are byte-identical
separate copies for easy review. `seals.json` covers the published evidence.
