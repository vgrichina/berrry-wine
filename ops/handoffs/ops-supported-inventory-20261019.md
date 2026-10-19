# Supported inventory with a pinned emulator

TG98: Outlaws was absent because the live dashboard read its supported app
registry from the older emulator checkout, while the data checkout's candidate
manifest also predated Outlaws. Current source at a53f43dba includes both
`outlaws-demo` and `outlaws_demo`.

The reader now accepts `inventoryRoot` / `WINE_INVENTORY_ROOT`, defaulting to the
data root, for the candidate manifest, app registry and picker labels. It checks
local launch routes against `emulatorRoot` alone. No current registry ID is
silently dropped when the served emulator is older. A missing inventory manifest
still leaves registry-only rows visible with a warning. Registry edits refresh
on polling. The manifest source endpoint follows the inventory root.

Read-only validation against the actual data and served roots on 2026-10-19:

- Data: `/home/user/wine-assembly` (existing tasks, reviews, evidence, fixtures).
- Inventory: `/tmp/wa-ops-supported-oct19` at a53f43dba plus this change.
- Emulator: `/home/user/wine-dashboard-b0b9bc090` (unchanged).
- Result: 351 candidates; all 347 current registered app IDs represented;
  `outlaws-demo` associated with `outlaws_demo`, no local or production routes.
  No registry/manifest warning. This is inventory evidence, not gameplay evidence.

Validation: the new integration test uses the complete current registry/manifest
against a stale data manifest and older served registry. It checks coverage,
Outlaws Games-view scope, missing served apps, missing served files, a positive
served route, registry refresh and missing-manifest fallback. Together with
emulator-server and gameplay-coverage suites, 21 tests pass. Existing ops.test.js
has 31 passing tests and one pre-existing category coverage failure: 104 editorial
assignments versus 142 manifest rows. The category file and manifest are unchanged
from a53f43dba. Manifest `kind: game` entries without editorial categories still
classify as Games via inventory scope, covered by the new test. Explicit existing
non-game categories (such as collections) retain their classification. Syntax
and diff checks pass.

## Prepared rollout; not performed

At the next authorized Ops-only restart, use the updated Ops server with the
existing `--port 8098 --root /home/user/wine-assembly`, preserve
`WINE_EMULATOR_ROOT=/home/user/wine-dashboard-b0b9bc090`, and set
`WINE_INVENTORY_ROOT` to a maintained current checkout containing `lib/apps.js`,
`index.html` and `test/candidate-corpus/manifest.json`. Verify `/api/state` includes
Outlaws and every ID from that registry, with Outlaws still unavailable on the
old emulator. Do not overwrite the shared manifest or change public hosting.

The running process was not restarted or modified. This source change cannot
alter its already-loaded reader code. Outlaws remains absent on the live service
until that separate Ops rollout. No emulator build, browser or guest execution
was performed.
