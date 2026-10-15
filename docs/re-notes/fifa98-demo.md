# FIFA 98: Road to World Cup demo

Source-only recovery, 2026-10-15, task `USER-FIFA-DEMO-20261012`, owner
`/root/new_game_refill_after_lords`. No runtime or gameplay claim.

## Original package and eligibility

Existing corpus entry `fifa98-demo` records the original Windows demo:
`https://archive.org/download/FIFAWC98/FIFAWC98.zip`, archive SHA-1
`922b626954495cc441cbe9bd9f88f6727bdf69ac`. The historical board records
16,109,580 archive bytes. The archive is not present in this checkout and its
hash was not reverified today. Recovery uses the existing corpus fetcher on a
granted remote host: `node tools/fetch-candidate-corpus.js --id=fifa98-demo`.
Do not download on the coordinator host.

The ready-to-run original tree is
`test/binaries/candidates/fifa98-demo/installed/fifa98`. The committed
[inventory](../fixtures/fifa98-demo-inventory.json) pins all 231 observed files,
23,411,290 bytes, including `FIFARTWC.EXE` (1,436,160 bytes), `EACSND.DLL`,
`UK.SKU`, and complete AUDIO/COMMON/FEPACK/INGAME trees. Both executable and
DLL pass PE32/i386 signatures. The existing browser manifest has 230 payload
entries; the registry supplies the executable separately. Their union exactly
matches the tree. No README, text licence, or installer exists in this tree.
The existing corpus licence classification remains proprietary, local-only,
with no redistribution grant; no publication is authorized.

The October 12 w4 claim is historical. Root explicitly reassigned it after the
Claude fleet stopped; prior WIP was untouched. Registration recovery commit
`949333e1f4e7f71d1461c7f774f4b0ba21d11827` expressly states no new gameplay
qualification. Audit of current `DESKTOP_APPS`, TODOS, full-text board,
reverse notes and retained run filenames found no FIFA 98 gameplay evidence.
It is absent from the public desktop list. This is an eligible unqualified
Windows demo, distinct from the separately requested console FIFA Street.

## Repeatable read-only preflight

```sh
node tools/fifa98-preflight.js /absolute/path/to/test/binaries/candidates/fifa98-demo
```

This reads and hashes the original files, rejects missing/extra files,
symlinks, duplicate paths, inconsistent VFS paths and size/PE mismatches, then
compares every byte hash with the committed inventory. It neither modifies
the fixture nor launches anything. `--inventory` prints an inspection report;
it is not permission to replace the committed original pins after a mismatch.
Manifest SHA-256:
`31400c955692e4323ae363a895d2e53879a596eb868ee1640e918334fe4ad909`.

## Next serialized runtime action

No runtime was granted to this lane. On the next coordinator grant, inventory
the remote candidate first and reuse it only if the full preflight matches.
If absent, transfer the pinned original tree and existing manifest or recover
from the corpus recipe; verify hashes before launch. Keep all runtime work on
the designated temporary box with independent idle/resource checks.

The existing private app `fifa98_demo` launches original `FIFARTWC.EXE` with
working directory `c:\fifa98` and guest EXE path
`c:\fifa98\FIFARTWC.EXE`; `requiredFiles` is true. Use the registered app,
not a bare EXE with missing assets. First bounded startup command:

```sh
node test/run.js --app=fifa98_demo --no-build --wasm=/home/user/wa-fifa98-startup/build/wine-assembly.wasm --quiet-api --max-seconds=90 --max-batches=6000 --batch-size=100000 --png=scratch/runs/UNIQUE-FIFA98-RUN/startup.png
```

The outer remote controller must preserve stdout/stderr, exit status, actual
source/WASM hashes, manifest/fixture identity and environment in that run's
folder. This first command deliberately sends no input: capture the actual
startup checkpoint before selecting controls. Inspect any original licence
screen and stop for the existing user decision policy rather than accepting
it. A runtime contract failure is a concrete blocker to report, not permission
to change guest state or bypass it.

After an ordinary menu is visible, read its controls/options and use ordinary
clicks/keys to start a match. Exact menu coordinates and player controls are
unknown; do not prelabel guessed inputs as pass/shoot/sprint. Require a live
pitch/HUD, an identifiable controlled player or ball responding to input, an
idle comparison, then a second input response. Save before/after captures and
input receipts; distinguish AI motion or camera changes from player control.
Only then add verified touch controls and record reviewed match gameplay.
Record FPS separately if measured. Startup/menu screenshots cannot complete
this task. Publish `result.json` last using the ops evidence schema and exact
candidate ID `fifa98-demo`; no fixture or bulk screenshots enter Git.

## Validation

Source preparation passed original 231-file hash/manifest/PE validation and
JavaScript syntax checks. No build, browser, VM, install, media download,
remote execution, or gameplay capture occurred. Runtime compatibility and
ordinary menu/input routes remain unknown.

## Prepared remote controller

`tools/fifa98-remote-startup.js` pins source
`7405b3f4803855e6d2e25506c74afab0d2184af9`, the actual build source of admitted
module `04ede400070b3acbdcc2ad5f3c033bcf051e3d2da9a4d28a449324d23ab0ba17`.
It creates its own `/home/user/wa-fifa98-startup` checkout from the remote IW
donor, never changes the donor, and uses that source's region-map mirror.
Every physical source file is checked against `git ls-tree -r SOURCE` before
and after launch, independently of the mutable index. All six retained donor
modules (937/a948/04ede/0dbf/e26/ca90) are hash-checked before preparation and
before/after execution, including the NE arena module at
`/home/user/wa-ne-arena-native/build/wine-assembly.wasm`. Dependencies reuse
the Darkstone node_modules tree; all 2,394 file hashes are checked against its
retained preflight receipt, itself pinned to SHA-256
`52d6d80b272fa670ef0a6c781bb4f3e7d8484d333bf0b2199a9ed106178faa30`.
No dependency installation or compilation is permitted by this controller.

Stage the three tools and committed inventory with relative layout preserved
under a separate controller directory, using scoped Boat exec/file APIs only.
After the root grant and independent idle/TTL check:

1. Run `node tools/fifa98-remote-startup.js --prepare` on the remote box. It
   refuses an existing destination, checks the admitted donor module, creates
   the exact source checkout and copies that module. No game runs here.
2. On the coordinator, `node tools/fifa98-transfer-fixture.js FIXTURE_ROOT`
   is a local plan only. With a transfer grant, append `--upload`: it uses
   `/home/user/.ascii/boat exec bx_9ef2wdsw` and explicit Node file operations
   to copy the 232 pinned files (231 payload files plus browser manifest).
   Chunks are bounded at 48 KB, final file hashes are verified, matching files
   are reused and mismatches stop without overwrite. Interrupted partial files
   remain visible for review rather than being silently replaced.
3. Run `node tools/fifa98-remote-startup.js` remotely under an outer
   `setsid --wait timeout 180s` envelope. It refuses pre-existing evidence,
   verifies idle/source/module/dependencies/fixture/free-space, then launches
   the registered game with explicit `--no-build --wasm=...`, a 90-second CLI
   guard and 120-second process-group timeout. The child starts in its own
   process group; its exact PID/PGID and terminal status are retained. Timeout
   or controller termination sends group SIGTERM, then SIGKILL after three
   seconds. Normal parent exit also cleans up surviving group descendants,
   with a bounded final process-group census. Independent idle is still
   required before releasing the lane. Inherited WINE/WA/NODE runner overrides
   are cleared and the matching region map is explicit. No inputs are sent.
4. Run `--postflight` in a separate remote invocation after the controller
   terminates. Recover `/home/user/fifa98-startup-evidence-1` before releasing
   the slot; inspect startup PNG/log and retain terminal failures. Publish ops
   `result.json` only after review. The controller leaves review pending.

Source checks passed JavaScript syntax, plan-only original inventory, and an
actual execution of the transfer helper with the Boat API mocked to isolated
temporary files: all 232 files transferred identically across multiple chunks,
the second pass reused them, and a changed existing file stopped transfer.
Actual small Node subprocess tests additionally passed normal exit-status
preservation, timeout of a TERM-resistant parent/descendant group, and cleanup
of a surviving descendant after normal parent exit. A mocked immutable-tree
test accepted original source and rejected changed physical bytes without
consulting the index.
No remote preparation or launch has occurred. Root must approve this immutable
controller revision before granting execution; a source-prepared route is not
an admitted live run.
