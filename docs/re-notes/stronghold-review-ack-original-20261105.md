# Stronghold review then ACK, 2026-11-05

This assignment follows published `9ac356cab12a5417487fa86a434c45cac4d3e7ff`
and `3d7ab1734d73e35c27dede0a6d01ab2df733a23e`.
Evidence: `scratch/runs/20261105-stronghold-review-ack-original/`.

The previous original stopped because the operator tried `route-review-choose`
while `install-route` command 8 still awaited its capture-bound review. The
production guard correctly refused and wrote no command 9. The operator plan
now explicitly selects personal view/review, then waits for successful ACK,
then permits consideration of the next existing command. A rejected ACK is
terminal. The existing mailbox and production review guards are unchanged.
The local contract tests reproduce command 8 through pending review, review
receipt without ACK, successful ACK and rejected ACK. No fixture sends controls.

The new assignment requires both final code/build releases before runtime
admission, plus the prior exact MDK heavy/file release and ancestor-held
exclusive `/tmp/wine-local-runtime.lock`. Chrome cutoff is 2026-11-05T01:20Z,
cleanup 01:23Z, with unchanged 720s runtime, 60s bootstrap, 40s command/review,
and 180s cleanup reserve. Box ID/state/expiry: NA; coordinator owns shutdown.

The historical 2,429-row manifest remains authenticated and preserved. Only
named final corrective source/module and passive helper amendments are allowed;
all 1,856 media rows remain unchanged. Final legacy publication is
`17e09475ecaeaa47de76684df0a0518124a6e387`, superseding the initial packing
error in `8808ec112`. The run's binding ledger records exact historical and
prior-binding old/new SHA-256, published provenance and reasons. Shared modules
are used at existing paths and are never restored or copied.

Preparation remains offline until the final dependency releases. Verification
and the one-original result will be recorded here before final publication.

Git is the source archive: exact commit SHA, relevant binary diff and new-file
patches are retained. Existing game/media/module inputs are referenced by path
and SHA-256. No snapshots, tars, module copies, npm, subworkers, boats, public
deployment or other games are used.

The explicitly admitted final identities are:

| Path | Prior `9ac356cab` SHA-256 | Final corrective SHA-256 |
| --- | --- | --- |
| `src/09ab-handlers-d3dim-core.wat` | `5c892770004355099d016e301ff73366a560237d681faf0cd3c6bd3aa8e4fc07` | `dbcf489a787b4f399eadc926e13336976d6eb0cc30ffed5c8c360af5b496a75a` |
| `build/wine-assembly.wasm` | `018c94ffbde8c857587c25c860db988d603d0662df9a18901f00c183af7493cd` | `e620f3adfc2850580004e204bc1fea495844e942806866f8ada24c215212e412` |
| `build/wine-assembly.compat.wasm` | `4e684af48e4ec06ae8aada0d5cd2b522345a7a51b8ed89988d4d8fa0d75ea7c2` | `66b37bd76da5a7b49c063b4eb0d44c898aaf00ff41e000a6fbd87c01edc136c8` |

All three come from the named final corrective publication: anchored subpixel
RGB placement with the original literal SIMD packing policy. The unchanged
passive observer remains from `a6d78555b`; the local helper is the published
`9ac356cab` implementation plus this assignment's review/ACK plan, final-release
checks and finite authorization. Its exact old/new hashes are in the ledger.
The MDK2 validation tools do not occur in the preserved Stronghold manifest or
its sealed retained-helper closure; their release serializes the shared build.
No unrelated JS file is silently admitted or rehashed.

Both final dependencies are now released: legacy `17e09475e` and MDK2
`2c8c7cc1fd353af2df2f7c1b3d3240bb40c69c1b`. This worker's subsequent required
locked full build passes and reproduces both literal final module hashes.
The local, route-recognition and passive-observer suites pass; the full
composed local entry checks all 2,429 filesystem rows and actual HTTP responses
with plain Puppeteer and independent public/native spawn prohibitions, zero
Chrome. Nine public-entry stale-manifest, prior-pair and changed-byte negatives
reject before launch. The final-input local test uses the actual current
release rows and an explicit private fixture flock. This is offline evidence,
not original presentation or gameplay evidence.
