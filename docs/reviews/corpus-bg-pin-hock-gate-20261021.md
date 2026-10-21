# BG original-package contract and Hock consumer acceptance

Base: `2e2c363e8a6229ce6938b4284cb57c119809f62f` (remote main verified).
Hock overlay: `a6da8ba20500eb8dd73170499edee5dcc8796dde`.
Task branch: `task/corpus-bg-pin-hock-gate-oct21`; independent review required,
no main merge. The only functional change is the corpus runner's BG contract.
Neither manifest nor extractor is changed; Hock registration remains separate.

## Provenance decision

Commit `d9708d80275fe5978c39206edcec9de9788b948b` deliberately replaced the
unavailable bg-demo ISO (SHA-1 `3796defce51a3e867aa216bc27f0be0689fdadf0`)
with the original Forgotten Realms Archives Silver Edition demo-CD ZIP
(SHA-1 `df6c2f77e4879bd25955a63d40e9b3a5bbc4c1b7`). Its message records a
different disc dump with the same original demo executable. Its patch changes
the package and extraction recipe together: raw MODE1/2352 BIN into `cd`,
`cd/DATA1.CAB` MinimumData extraction, original `cd/BGDEMO.EXE`, and fifteen
uppercase CD source paths mapped to mixed-case installed companions.

The retained 2026-10-11 03:04/03:14 acquisition board receipts report fresh
fetch and original executable hash verification on bx_zd7xmafa. The later
22:22 receipt and independent reconciliation `139c70f99` record successful
recovery after the separate header-case repair `47a5c9ab`. That repair is
already merged and is untouched. The October 18 fixture-link receipt records
304 files / 520592465 bytes, explicitly presence-only. This task independently
hashes the retained BGDemo.exe to the existing test pin
`ed7f1efd9df8d9a62c1a32f2598e8cc19e5dc601689aeebb72a3bc835db343d9`.

These mutually consistent records establish the intended package contract;
restoring the obsolete ISO pin in the manifest would pair different media
with an incompatible extraction recipe. The old acquisition run directory
`runs/20261011T0305Z-bg1-demo-source-w4` is not retained here; the historical
board reports are not a newly executed acquisition. No current download,
whole-CD rehash or BG extraction is claimed. Exact URL/SHA-1 enforcement is
preserved, and raw-image, installer-group, executable and all fifteen
companion mappings now have explicit assertions in the real consumer.

## Tests

Replay from the task checkout:

```sh
python3 docs/reviews/corpus-bg-pin-hock-gate-replay.py /home/user/wine-assembly ../replay-evidence
```

The script restores every temporary overlay and removes temporary fixtures.
It invokes the actual runner, without mocks, source slicing or disabled checks.
Full commands and exits are in `corpus-bg-pin-hock-gate-evidence/checks.json`.

| State / command | Exit | Result |
| --- | --- | --- |
| Unchanged base, BG `--list` and `--dry-run` | 1 each | exact-package assertion fails |
| Unchanged Hock candidate, Hock `--list` and `--dry-run` | 1 each | same assertion before selection |
| Corrected base, BG `--list` and `--dry-run` | 0 each | LOCAL; dry-run 1 local, 0 skips |
| Corrected runner + exact Hock manifest, Hock `--list` and `--dry-run` | 0 each | LOCAL; dry-run 1 local, 0 skips |
| Nine pin/layout mutations, each through both modes | 1 each | 18 assertion failures |
| Hock retained-intake regression and actual fetcher `--prepare` | 0 each | sealed original extraction and preparation |
| Runner syntax and diff whitespace | 0 | pass |

Controls reject wrong SHA-1, obsolete ISO URL/hash pair, wrong BIN name,
missing raw-CD conversion, obsolete CAB path, wrong installer group, wrong
launch executable, missing companion and wrong destination case. The Hock
regression also checks the sealed outer/nested archives, 39 original files,
38 browser companions, real CLI planner/VFS resolver and its 50 negative
controls. The prepare fixture is staged from the verified nested archive;
outer SHA-1 and SHA-256 are independently checked. An initial replay-script
development check incorrectly compared the nested ZIP against the outer
package pin; it failed before preparation and was corrected to verify the
outer archive. The final full replay passes.

Evidence includes logs, historical patch/receipts, executable hash and a
SHA-256 inventory. The correction is 23 added / 2 removed runner lines;
the remaining changes are this report, replay and evidence. No broad build,
download, runtime, deployment, workers, root WIP or fleet/config edits.

Dry-run proves consumer acceptance and local executable discovery, not
registered guest gameplay, scoring, audio or FPS. No box was allocated or
accessed. bx_c6f3np32 remains coordinator-reported snapshot-stopped at
2026-10-21T06:53:53.444Z, former expiry 08:14:54.696Z; lifecycle belongs to
the coordinator. Main remains unchanged pending independent acceptance.
