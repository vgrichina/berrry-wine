# Local save-sync normalized-destination regressions

Nine integration groups pass against remote main `e745cc29a1a3b859625aa0cd335abee0b185da71` with **only** the accepted `ef3fdad258660c3b838e0836aff32b3ef4a4f8b3` save-bundle delta overlaid. Independent acceptance is `b4db7dc62304d30807e4126afe3494712163f11d`; that read/import acceptance was reused, not rerun. This branch includes the exact accepted delta to make its tests runnable. There is no new implementation repair. Main integration remains a coordinator gate; this task does not integrate main.

`pins.json` records both bases, every focused main blob/byte count/SHA-256, resulting exact source SHA-256s, and immutable fixtures. Main save-sync is blob `3168327d3079b7552093384bbba89d44de75574d`, SHA-256 `87bc3878b4700b64f93a82f8920977677e9caeb2bbfcbecd1a572eb750d2dced`. It retains the latest owned-upload fixes, rather than using the older candidate ancestor. Main save-bundle is blob `3e557cfb3429e80ca41426cf79797b2326dca3bc`; the overlaid accepted source is blob `b6bf55a0dd8750c75e3fab524841275fdca7e259`, SHA-256 `4ac22b490b0c201d5c4d7ee0047882522eeb4690d93b095e4eb755d84590f3ee`. Main's bundle blob exactly matches the accepted repair's parent bundle blob; the overlay is exactly its one-file delta.

The tests invoke actual `SaveSync.push`, `pull` and `sync`, with invocation-local in-memory HTTP-shaped transport, registry/INI storage, and actual small VirtualFS instances. No real fetch, server or guest runs. SaveSync returns validated download bytes; its caller must import them. The test's explicit `syncAndApply` adapter imports only `action: 'pulled'`, exercising that documented application contract without claiming that SaveSync itself writes the VFS.

Coverage:

- Both orders of distinct case-colliding ZIP members and repeated manifest destinations reject direct push and sync **before any transport call**, preserving caller bytes, remote record, VFS files/directories and registry/INI state.
- Direct pull and sync reject conflicting downloads in merge and replace, with no local or remote mutation. The sync cases include no local bundle and a newer valid local bundle that would otherwise overwrite remote state. GETs are observed; no POST is allowed.
- Successful direct upload and each sync upload branch (absent metadata, absent record, newer local capture) send the exact validated snapshot after mutation of the original caller Buffer. Device state remains untouched.
- Mixed-case valid downloads apply expected normalized paths, all attributes/FILETIMEs, nested directories, different drives and registry/INI values in merge and replace. Existing matching saves survive only merge; unrelated files survive both. Empty payload files are distinguished from an empty save bundle.
- A genuine ZIP from the pinned pre-repair main writer is uploaded, downloaded, applied, and re-exported byte-identically, including zero-byte file and registry/INI state. Empty bundles transfer and replace correctly. Equal capture times and absent/zero-length remote records do not apply state.
- A valid downloaded ZIP outside the running app's allow-list is rejected before VFS/directory/store mutation.

## Actual filename consumers

Bounded searches of production JS/HTML found `tools/save-bundle.js` as the concrete `.path` presentation consumer. Its text output uses `f.path`, JSON invokes `inspectBundle` (path plus member), and extraction uses `f.member`. The regression runs the actual pinned CLI in finite Node children. For accepted `046-api-case-delta.zip`, text and JSON show `c:\save\slot.sav`, JSON also retains `vfs/c/Save/Slot.sav`, and extraction writes the original `vfs/c/Save/Slot.sav` spelling with the correct payload. No invented display-case repair or renderer/dashboard edit is needed. This is bounded source/CLI evidence, not browser UI acceptance.

## Controls and incidents

`integration.tap` reports **9 pass / 0 fail**. The unchanged collision groups, with current save-sync retained but main's pre-repair save-bundle loaded through a process-local module-cache override, report **0 pass / 2 fail**, both missing expected rejection (`reject-pre-repair.tap`). This is an integration regression control, not repetition of independent read/import acceptance.

The first new integration run was **7 pass / 1 fail**: its assertion incorrectly expected payload `[17]` for `044-distinct.zip`, which actually contains explicit `[0]`. The immutable ZIP was inspected and only the oracle was corrected to `[0], [], [2], [3], [4]`. First test and TAP are preserved under `first-oracle/`; no production defect was inferred. A direct push/pull success group was then added, producing the final nine groups. Initial bounded discovery also named nonexistent renderer/UI paths; the read errors were resolved with a bounded tracked-source search. One initial combined source excerpt exceeded the requested 8192-byte excerpt target; subsequent reads were narrowed. No mutation/access denial occurred and no gate was waived.

Each completed passing group atomically writes a source/test/fixture-bound checkpoint; the final checkpoint is retained. These results are offline JS application evidence only. No network/server/browser durability, guest, gameplay, canonical build, service restart, deployment, main merge or box access is claimed. No box was assigned; state/expiry are not applicable, and lifecycle remains coordinator-owned. Root tracked files/index/refs and all donor repos remain read-only; root messageboard is append-only.

## Recovery

From a focused checkout of this task branch, run:

```sh
timeout 35s node --max-old-space-size=192 --test --test-reporter=tap test/save-sync-normalized-destination.test.cjs
```

Required sources are the paths in `pins.json` `mainFiles`, with the accepted save-bundle overlay, plus this test, this directory's `pins.json` and seven tiny ZIPs. No dependency installation, full checkout, network, wasm arena or compiler is required. `SAVE_SYNC_EVIDENCE=/tmp/unique-owned-directory` enables durable group checkpoints. Original accepted ZIP bytes are copied verbatim and checked by SHA-256 on use. The legacy writer fixture uses pinned main's save-bundle with the test's writer VFS, capture time and commit, and store `{'reg:legacy': {value: 7}, 'ini:legacy.ini': {Save: {Slot: 'one'}}}`.

For the rejecting control, load main's pinned save-bundle source into a Node `Module` with filename equal to the checkout's `lib/save-bundle.js`, set its module search path to the checkout's `lib`, then place it in `require.cache` under that filename before running the unchanged test with `--test-name-pattern=conflicting`. Exact source and control receipts are retained; the passing source must remain unchanged on disk.

Object recovery used regular immutable loose-object leaves from read-only donors, verifying Git object SHA-1 before copying, with missing focused blobs recovered from matching regular working leaves. Only main commit, tree metadata and required focused blobs were materialized; no history fetch or full checkout. The main boundary is marked shallow for task publication. Existing Node/donor bytes are standing inputs; task checkout/Git, test temp, publication evidence, launcher/session/future positive shared-WAL allowance and 8 MiB reserve are included in the bounded allocation. Admission and exact object recovery recipes remain in the task's sibling `ops` directory.
