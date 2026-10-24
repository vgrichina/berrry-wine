# Airstrike ordinary manifest integrity repair — 2026-10-24

This candidate repairs the ordinary-loading gap that rejected producer
`fdd1e48dbccb1cfe15c78b8b9f772bd13cc60e7d` in review
`3899d8f323e20f9c10f044c66dc319590388f645`. It starts at main
`3f75d7afdfc93819d4874b2cf126ca83e66d5bd2`. This is a tested task branch
for independent review, with no main integration or deployment.

## Production boundary

Airstrike's registry entry now declares `localManifestIntegrity` containing
the repository-relative inventory URL and SHA-256 of its exact JSON bytes.
The inventory remains the producer's unchanged 89-file pins, independently
compared to the game subset of the accepted 261-file runtime manifest.
The untrusted local manifest cannot supply or replace these pins.

`lib/app-files.js` shares one manifest interpretation between synchronous
CLI and asynchronous browser adapters. It requires exactly the 88 companion
rows, each with its exact `game/` URL, guest path and size; row ordering is
immaterial. Duplicates, omissions, extra files, alternate guest aliases,
optional flags, INI transformations, external/traversal URLs and installer
registry additions fail closed for this opt-in policy. All 89 files,
including the original EXE and all eight authentic DLLs, must pass size and
SHA-256 checks before any destinations are modified.

The actual `test/run.js` registered route performs this preflight at the
start of `main`, before build/PE loading/VFS writes. Both `--app` and a
canonical-path-matched registered `--exe` select the policy. The validated
byte snapshots feed EXE reads, DLL seeds and the ordinary VFS mount paths.
An arbitrary external, unregistered `--exe` retains its existing explicit
input contract; this change does not infer a game identity from a filename.

The actual browser source is `lib/browser-shell.js`. It resolves and checks
the media before `wine.init`, then gives the validated EXE bytes to
`wine.loadExe` and cached bytes to its ordinary DLL resolver. Since
`host.loadFiles` fetches URLs rather than reading a `bytes` member, companion
mounts use temporary Blob URLs of the verified snapshots. The ordinary
host loader consumes these immutable bytes; `finally` revokes the URLs.
`host.js` itself is unchanged. The pinned policy is checked on every launch,
including when the generic `_localFilesResolved` flag was already set.

Apps without this opt-in policy retain generic manifest merging, registry
overrides, installer registry metadata and CD track sizes. No binaries,
configuration, sound, image or DLL payloads are committed or redistributed.
The six other registration files are byte-exact copies of the rejected
producer; its `lib/apps.js` changes are retained with the added policy.

## Acceptance and regression evidence

`test/test-airstrike-ordinary-manifest.js` requires genuine retained inputs;
it has no SKIP or synthetic substitute. It runs byte-exact source extractions
of the production CLI selector, resolver, initial preflight and early VFS
mount loop, and the production browser resolver, DLL resolver and snapshot
handoff. It also executes the actual `host.loadFiles` method with a minimal
VFS and Blob transport, without instantiating the emulator.

The positive case verifies 89 identities / 4,072,418 bytes, 88 exact companion
destinations and all eight browser DLL results. The negative cases reject
both reviewer tamper conditions, twelve structural/mapping changes, every
one of 89 individually mutated identities, every one of 89 missing files,
and an inventory hash mismatch on both routes. Failed preflight leaves
destinations/app file state unchanged and cannot reach the mounting blocks.
Reads outside the approved fixture/inventory are forbidden by the test.
It also changes source bytes after validation to prove the CLI mount/read
snapshots and the browser's actual host/DLL loading retain genuine bytes.

Existing Silver CLI launch, candidate browser-manifest writer, local
proprietary dropdown and genuine Airstrike registration tests all pass.
The latter retains its 89 missing-file and five changed-identity controls,
real corpus writer/VFS closure checks and eight DLL seed checks. All Node
commands use old-space 256 MiB, fresh MemAvailable above 805,306,368 bytes,
and CPU/wall limits of 60 seconds. Syntax checks pass for all four changed
production JavaScript files. Final ordinary regression completes in about
two seconds. Full commands, memory readings, exit codes, source/excerpt
hashes and results are adjacent.
The authoritative final regression is `ordinary-tests-publish.json` with
`ordinary-test-publish.log`; earlier passing iterations remain retained.

The independent `reproduce-manifest-gap.js` is retained byte-for-byte.
Its unchanged execution against five exact `fdd1e48` source blobs returns
exit **0 with verdict REJECT** and both `ordinaryLoaderAccepted: true`:
this is the expected **gap-present finding on the rejected producer**.
It is not a repaired-candidate pass. The candidate's separate ordinary
regression explicitly records both acceptance conditions as **false** for
both routes. The donor's sparse filesystem initially lacked `test/run.js`;
the retained external failure log documents that lookup, after which exact
Git blobs were materialized only in this task's private rejected-source
snapshot. No donor was modified and the independent script was not adapted.

To rerun the candidate regression from this checkout:

```sh
timeout 60s node --max-old-space-size=256 test/test-airstrike-ordinary-manifest.js \
  /tmp/airstrike-original-private-oct23/docs/re-notes/airstrike-original-20261023/release/airstrike-pre6a \
  /tmp/airstrike-legacy-zlib-private-oct23/docs/re-notes/airstrike-legacy-zlib-20261023/zlib.dll \
  /home/user/wine-assembly/test/binaries/dlls/msvcrt.dll
```

Fresh resource/memory admission and CPU limits remain required. Tests remove
their task-owned temporary genuine closure in `finally`.

## Limits and handoff

This is production-function JavaScript/filesystem qualification, not a full
CLI process launch, real browser process, WebAssembly build/instantiation,
guest execution, registered gameplay, audio or full-game qualification.
Those remain untested here. The browser adapter relies on normal WebCrypto
and Blob URL support. The existing accepted historical movement/fire scope
is unchanged. No public hosting, deployment, packages, build or box operation
occurred. Box ID/state/expiry are N/A; lifecycle remains coordinator-owned.

The private checkout and evidence are retained at
`/tmp/airstrike-ordinary-manifest-boundary-repair-oct24/`. The measured
62 MiB admission includes the 8 MiB reserve, transport, temporary media,
launcher/session/SQLite and future growth inside 64 MiB. The later ledger
conservatively charges the entire current SQLite files rather than only
positive growth. Internal tool capture is conservatively charged separately
from full retained launcher/session history. Final resource, publication and
cleanup receipts live outside the commit because they bind its resulting
identity. Strict SSH task-branch publication records the actual remote task
and main refs under the shared lock; main is not written. Root tracked
files/index/refs and all donors remain read-only.
