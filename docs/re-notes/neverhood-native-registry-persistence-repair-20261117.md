# Neverhood: trailing-separator registry data loss

Evidence: `scratch/runs/20261117-neverhood-native-registry-persistence-repair/result.json`.

The generic registry backend could erase an existing key's values when an
ordinary caller created the same key with a trailing backslash. Existence and
raw reads treated the separator as part of the key, while the write path
canonicalized it away. `reg_create_key` therefore reported a new key and wrote
an empty value map over the existing canonical record. Subsequent writes
through the trailing handle could also replace earlier values.

The retained original transcript was checked in full: 241 public registry
operations, eleven recorded raw `RegSetValueExA` returns (all zero), and two
deletes of unrelated missing DirectX keys. It contains no product-key delete
or child-state merge. Lines 61, 5727 and 5791 record the path writes; line 8365
then creates the product key with a trailing separator and reports it as new.
The original's final export retains `KBPS` and `Installed`; `KBPS_CD`, PID and
the installation paths were lost. Untraced native return values remain unknown.
The exporter simply serializes the backing store; the destructive operation
precedes export. The original recipe pins Git `fa5ed3fc81352fb039ef370889c089019f6189af`
and module `cff5da9a64e3df960918df28ae7e06bd1db7cfae49d189f4281d82ea09e7f274`.

`lib/storage.js` now strips trailing separators in the shared physical-key
normalization used by existence, read, write, delete and import operations.
There are no product-specific keys, replacement values or installer fixups.
The public Win16 bridge reaches the same Win32 helpers and host storage as
ordinary Win32 callers; neither bridge nor guest binaries were changed.

On published baseline storage, authored actual x86 Win16 calls and a separate
actual CPUWorker QT case reproduce the erasure. The Worker case verifies the
actual ANSI argument ends in a backslash. With the repair, 92 native cases
pass, including Win32 trailing-key creation reading a Win16-written DWORD,
Win16 strings/binary/default values, shared-core overwrites, close/reopen,
actual CPUWorker calls, and an actual OS child executing the same native
callers before production export/completion/merge. Stale and tampered child
completion controls leave the parent unchanged. Existing native actor,
generation, freed-selector, cancellation, teardown and error controls remain.
Storage tests additionally check space-containing names, ANSI data, default
values, types, disposition, JSON export/import and legitimate deletion. Their
old registered-factory fixture was updated to use the current owner-side
resolve-only contract; a fabricated pointer is not a callable QueryInterface.

Read-only recovery found 24 retained product-registry candidates. Only the
already known original final export has authentic original-run provenance;
the others are stage-verifier fixtures. None was adopted, modified, or used to
reconstruct missing installation paths. The earlier verifier's recovery checks
still verify all 65 overlay records/58 blobs, full 257-member CD and genuine
shortcut target `setup95.exe`, with zero writes and tamper refusal.

The canonical locked build and focused tests pass. This is a registry repair,
not evidence of an authentic completed installation or a gameplay result.
The fresh installer remains unlaunched: the shared USER native confirmation
repair is still uncommitted and its direct-Get/cached-Peek qualification is
pending. Exact published Git-only full-runtime/input qualification therefore
has not passed. No original input, old-endpoint query, reinstall, direct NHC
substitution or restart was performed. A fresh installer can proceed only
after those gates pass, under the separately specified finite pipeline guards.

No box, browser, native original, or original watchdog was created. Native
authored tests have independent deadlines and actual wait/EOF receipts. Source
recovery uses Git plus relevant binary patches; no source-tree or media archive
was made.
