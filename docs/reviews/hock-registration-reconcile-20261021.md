# Hock original registration: preserved, integration blocked

Base/main: `2e2c363e8a6229ce6938b4284cb57c119809f62f`.
Reviewed saved candidate: `86ffa2074da9d809cd371192d5adc98da3dc647f`.
Branch: `task/hock-registration-reconcile-oct21`.

The Hock recipe passes sealed original-package extraction and focused real
consumer checks. Integration is withheld because the actual corpus runner
fails its global Baldur's Gate assertion before selecting Hock. Unchanged main
fails identically. `--list` and `--dry-run` both exit 1, expecting
`https://archive.org/download/bg-demo/BG%20Demo.iso` / SHA-1
`3796defce51a3e867aa216bc27f0be0689fdadf0`, while main's
`baldurs-gate-interactive-demo` entry uses the Forgotten Realms Archives ZIP /
SHA-1 `df6c2f77e4879bd25955a63d40e9b3a5bbc4c1b7`.
No unrelated catalogue or assertion change was made. A separately authorized
reconciliation of that consumer/pin disagreement is needed before rerunning
the end-to-end registration acceptance gate. Do not bypass the assertion.

## Reconciliation and checks

Only the Hock object was appended to main's manifest; unrelated entries are
byte-preserved. The original patch did not apply directly because the manifest
tail changed. Package fields are identical to the saved candidate; notes now
link the existing canonical Hock note and distinguish accepted explicit-EXE
scoring from unqualified candidate-route runtime. The duplicate proposed
`hock-a-loogie-1995.md` is consolidated into `hock-a-loogie.md`.

- Saved regression passes with mandatory retained intake, including the
  inventory seal, outer SHA-1/SHA-256, actual nested extraction, 39 original
  payload hashes and 38 browser companion mappings. Its 48 negative controls
  cover metadata, corruption, missing companions and wrong VFS destination.
- Additional checks call the actual `lib/candidate-cli.js` launch planner and
  `lib/vfs-host-files.js` resolver against the extracted package. All 39 files
  match pinned bytes; empty and EXE-only include controls fail. The resolver
  returns relative paths; `test/run.js`'s `addFile` roots them at `C:\`.
  The existing default guest EXE/cwd behavior matches the intended root layout.
- The actual fetcher command `--id=hock-a-loogie-1995 --prepare` passes with
  the hash-verified retained inner archive staged under `distribution`.
  It extracts 39 files and generates the browser manifest. No network fetch.
- Actual corpus `--list` fails on unchanged base; `--list` and `--dry-run`
  fail identically with Hock added and its fixture present. This is a failed
  acceptance gate, not a passing registration test or missing-media skip.
- Syntax and whitespace checks pass. No build or guest execution occurred.

The recipe enables fetcher preparation, generated browser inventory and a
candidate CLI launch plan. It does not add a `lib/apps.js` app-selector entry,
install durable local assets, qualify registered gameplay, or establish audio,
completion, FPS or Windows parity. Local-only is metadata, not a new access
control. Fetcher download verification uses SHA-1; the regression additionally
enforces SHA-256. Existing-schema registration needs no functional correction
on the evidence observed here.

Accepted original explicit-EXE gameplay/scoring remains in report `54b0ee54`,
integrated at base `2e2c363e8`; its evidence was reused, not repackaged or rerun.
TG103 remains open. Root TODO/STATUS/WIP remain untouched because no accepted
registration has been integrated. No public deployment or Telegram send.

Evidence/check logs and recovery: `scratch/runs/20261021-hock-registration-reconcile/`.
Compact check receipts are in the adjacent `hock-registration-reconcile-20261021-evidence/`.
No runtime allocated or accessed. `bx_c6f3np32` remains coordinator-reported
snapshot-stopped at 06:53:53.444Z, former expiry 08:14:54.696Z; lifecycle remains
with the coordinator. No workers, runtime lifecycle calls or shared config edits.
