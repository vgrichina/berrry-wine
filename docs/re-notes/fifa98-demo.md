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
node test/run.js --app=fifa98_demo --quiet-api --max-seconds=90 --max-batches=6000 --batch-size=100000 --png=scratch/runs/UNIQUE-FIFA98-RUN/startup.png
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
