# Bounded saved-file hydration

Pinned parent: `061461fb3e2bd088ccb6ec464ecbe958c83d46ca`.

Persistence previously decoded `saved.data` before enforcing `maxFileBytes`.
The repair validates the base64 alphabet, padding, encoded digit count and
decoded byte count without producing a stripped string or calling a decoder.
It admits empty files, padded and unpadded data, and atob-compatible ASCII
whitespace. The existing check of actual decoded bytes remains authoritative.
Rejected payloads cannot replace mounted files or create parent directories.
Save, sync, bundle and filesystem behavior is unchanged.

Exact SHA-256 identities:

- Baseline source: `b8a7803f2b0b8880f5b02a673f241f2e6b036c4468b950cf7b43ed38a289dca9`
- Repaired source: `2224f8b74469606696065ea799931bc192982a608dc2a7ec0e9a690d20a4552e`
- New test: `dcf619fbe4fca841148f7da93225ad0797e34884848c4d397db9be09e9460544`

The retained baseline failed eight admission groups and passed nine controls;
the unchanged repair passed all 17 groups at a 16 MiB Node heap. These exact-hash
checkpoints were reused after the previous session ended on model capacity.
The tests exercise decoder sentinels/call counts for both atob and Buffer paths,
all byte-cap remainders, malformed inputs, empty/binary files, old valid inputs,
metadata, storage/decoder errors, and the final actual-byte rejection.

Remaining existing suites passed:

- `test/test-vfs-persistence.js` (16 MiB heap).
- `test/test-vfs-persistence-restore.js` (16 MiB heap).
- `test/test-darkstone-save-persistence.js` (64 MiB heap).

Historical failures are preserved in the checkpoint and logs. The focused
checkout initially lacked browser-shell, then the Darkstone test lacked apps.
Unchanged fixtures and their require closure were recovered from immutable Git
blobs at the pinned parent; their recovery receipts identify every copied file.
The real-size Darkstone test exhausted 16 MiB old-space. A fresh resource gate
admitted a single 64 MiB process, which passed without source or test changes.
No task core file remained; further tests disabled core output explicitly.

## Recovery and reproduction

The evidence manifest records SHA-256 hashes of every evidence payload. The
baseline source is retained as `baseline-vfs-persistence.js`. In a complete
checkout at the pinned parent, overlay only the repaired source and new test.
For a focused checkout, recover the existing tests and their actual library
closure using `git show 061461fb3e2bd088ccb6ec464ecbe958c83d46ca:PATH`.
`input-hashes.json` enumerates those paths and exact identities. The immutable
local recovery donor was `/tmp/file-bundle-bounded-read-accepted-integrate-oct26/repo`.

Run each test sequentially under `timeout 45s node --max-old-space-size=16`;
use `--max-old-space-size=64` for the Darkstone suite. To reproduce the failing
baseline, set `VFS_PERSISTENCE_SOURCE` to the retained baseline source while
running the new test. The complete argv and exit codes are in `checkpoint.json`.

Publication uses a temporary Git index initialized from the pinned parent;
only the repaired source, new test and this documentation directory are inserted.
The absent unrelated tracked paths in the focused checkout are preserved in the
committed tree. Recovered fixtures are excluded from the changed-path list.
Main integration requires coordinator review against current main separately.
These are Node behavior checks; no runtime or gameplay qualification is claimed.
No test box was assigned; lifecycle ownership remains with the coordinator.
