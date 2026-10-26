# Independent bounded-read acceptance, 2026-10-26

**ACCEPT** exact repair `45b0448b97a325afafa5afc6c9aebf79a9946c03`,
relative to accepted ancestor `9148ceb18768955f647130c2e936228429892477`.
This accepts the file-content read/resource repair and preserved wire behavior.
The ancestor is not current main. Coordinator reconciliation with current main
and the separately owned parser change remains an integration gate.

Only new independent tests and this evidence directory are owned by this review.
`lib/file-bundle.js`, `host.js`, supplied regression tests, all donor repositories,
and root Git index/refs/tracked files remained read only. No implementation
repair, main merge, service restart, deployment, guest, Boat, SSH guest access,
canonical compile, wasm arena, or runtime/gameplay claim occurred. No box was
assigned; lifecycle ownership remains with the coordinator. No workers spawned.

## Exact inputs

| Input | SHA-256 |
| --- | --- |
| Repair `lib/file-bundle.js` | `787087d08300316ef4a9981da74fcf51e17a70db3a633e6316999c9c55184086` |
| Supplied eight-test suite | `830f505cce6c03baa981cd8652c46a9698ea560a55804067fc26245dff660df0` |
| Pinned `host.js`, unmodified and not checked out | `03eb8a7ab8dfae1f6e2a16c7943be2ed582a3f463029ae950043f0b2c0569ee4` |
| Independent behavior/allocation suite | `1de60518bf41701269faf7dc53702cd0905a5a4203b431c8fc8bc58a61d67855` |
| Rejecting-control suite | `f68723d0eb8284ecb2997e5bcfcb1596ea292d3fa3c98b9d91c78f72da9235ec` |
| Reused unchanged baseline source | `9a358b80d9c46ab5249e92c4c3835fd36ac744f5aacfc22c7879b37a95cdcf7c` |
| Reused baseline-fail receipt | `c9c0cbd16e8138e933bf2dc97b4851c9b7a8b379f43dfcbc1d088ec6d2b61572` |
| Reused predecessor repair-pass receipt | `61b09f0d08d07d7ef0e5bf19a5ab511563302db3f91464a3a5c436617de0695a` |

`pins.json` also records Git blob IDs. All fifteen predecessor payload hashes
were independently rechecked unchanged; `reused-evidence.json` binds them. The
unchanged baseline failure was reused rather than redundantly rerun.

## Executed checks and resource conclusions

The supplied eight regressions passed. Eight new independent groups passed:

1. Huge opened-file metadata rejects before any data allocation, concatenation,
   or read. Injected directory/FIFO/socket/device metadata rejects without data
   reads; each successfully opened handle closes once.
2. After seven bytes accepted from an eleven-byte budget, a growing file consumes
   exactly five bytes (four remaining plus probe). Its allocations are four and
   one bytes. Partial-read errors and overflow do not consume later capacity.
3. An exact-fit 65,543-byte synthetic file read one byte at a time allocates
   buffers of 65,536, seven and one bytes. Its per-file concatenation receives
   exactly two chunks, independently checking backing-store retention rather
   than only successful returned bytes.
4. EOF three bytes into the second chunk frames the actual length, without
   padding or uninitialized tails, and keeps every request within 64 KiB.
5. At zero remaining budget, empty files succeed; growth consumes only the
   one-byte probe; positive metadata rejects without allocation.
6. Open/stat/partial-read/probe/close and resolver failures preserve 404 results,
   cleanup, response order, and subsequent capacity.
7. Tiny real files grow, shrink, or are replaced after opened-handle metadata.
   Growth consumes budget plus one; shrink returns actual bytes; replacement
   reads the original opened inode. All handles close.
8. Unicode and duplicate names, mixed 404/413 results, body order, exact WAB1
   framing, overridden Content-Length, no-store and custom headers are preserved.

Five deliberately damaged ephemeral source copies were rejected by the oracle:
removed metadata rejection, ignored cumulative remaining budget, removed fixed
chunk ceiling, removed short-read fill loop, and ignored overflow probe result.
Each targeted child produced an assertion failure and exit 1; all five outer
control checks passed. These copies were temporary fixtures, never source repairs.

For accepted content S and total cap B, the next read receives B-S. Actual file
bytes consumed are at most B-S+1, regardless of metadata underreporting or growth.
Individual data buffers are at most min(64 KiB, remaining) plus a one-byte probe.
Short reads fill existing buffers, preventing one retained allocation per byte.
Accepted bodies total at most B. Buffer concatenations still make bounded copies;
this is O(B) content storage, not a claim of a 64 MiB process-RSS ceiling. Framing,
JSON/names, allocator overhead, unreachable buffers awaiting GC and independent
concurrent requests are outside the file-content cap. No full-size RSS stress
test was authorized or run. Regular-file checking occurs after open; this does
not establish a timeout for blocking open/read/close or filesystem operations.
Direct `readBundle` callers must retain their own finite name list; both pinned
HTTP call sites use `bundleNames`, whose existing limit is 256.

All tests used installed Node v24.18.1 with `--max-old-space-size=192`; suites
had external 30/45-second limits and controls had per-child 15-second limits.
The largest supplied fixture was 131,079 bytes; independent fixtures were
65,555 bytes or less, with real files only tens of bytes. No 64 MiB fixtures,
full checkout, large arena or heavy build. Local Git used existing read-only
flat donor object leaves in place: link targets were inspected and no objects
were copied or dereferenced into materialized duplicates. No mount argv existed
for this offline task, so the conditional guest mount parser was inapplicable.

## Evidence qualifications and recovery

The predecessor accidentally dereferenced loose-object symlinks and materialized
201,434,854 bytes during setup. It removed duplicates before tests/publication.
Its incident is preserved unchanged in `reused-evidence.json` and `incidents.json`;
acceptance does not retroactively claim that setup respected its allocation.
This review did not repeat that operation. Its own first control run inherited
Node's internal nested-runner context and failed the controls because child tests
were suppressed. `oracle-controls-first-failure.tap.gz` preserves the raw first failure, including
Node diagnostic whitespace. Removing only
`NODE_TEST_CONTEXT` from the test-child environment resolved it in this task.

`checkpoint.json` records each completed group, candidate and source/evidence
hashes. `prepublication-admission.json` records exact focused/task-session bytes,
shared DB/WAL positive growth accounting and reserve, host free space, and RAM.
The 56 MiB projection includes an 8 MiB reserve inside the 64 MiB hard limit.
Standing installed Node and donor objects are recorded separately. The initial
fleet snapshot conservatively matched a transient shell too; the corrected
snapshot uses actual executable argv tokens. A small evidence-script syntax error
was corrected before publication, without changing source or rerunning tests.

Recover by fetching the published acceptance branch into a separate sparse
checkout with these two independent test files, the supplied regression file,
`lib/file-bundle.js` and this evidence directory. Run:

```sh
timeout 30s node --max-old-space-size=192 --test test/file-bundle-bounded-read.test.cjs
timeout 30s node --max-old-space-size=192 --test test/file-bundle-bounded-read-independent.test.cjs
timeout 45s node --max-old-space-size=192 --test test/file-bundle-bounded-read-independent-controls.cjs
```

Before integration, reconcile accepted ancestor/candidate against current main,
review overlaps with the separately owned parser repair, and rerun affected
checks if relevant inputs change. This review authorizes no merge or deployment.
