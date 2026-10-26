# Independent rejection-diagnostics acceptance: REJECT

Candidate cd4a60e378464ff6247007353b0428d9c1a210f2, source-tested tree 9be6db3325d2e3b439dd76994c2f919fff5c60cf. No candidate implementation or original oracle changes. No main integration.

All 41 existing groups passed unchanged: 14 focused (511 combinations), 13 latch, 6 snapshot, 7 adapter, 1 exact AST comparison. Independent controls: 6 groups pass, 13 cases fail (12 malformed native contexts, 1 contradictory pinned return). Source AST tests exercise actual transformed historical pinned source, never a compiler or Wasm engine.

## Findings

1. The adapter snapshots native fields with `>>> 0` before validating diagnostic context. NaN, undefined, or 4294967296 in errno, caller, token or event become zero. A synthetic reason-1 rejection then reaches `readLive` and `persist`, writing normalized zero fields and a decoded rejection, before throwing the ordinary status rejection. Every such case must close before either callback. This normalization pre-existed; the new decoder relies on its sanitized result, leaving the assigned fail-closed boundary incomplete. These cases do not demonstrate a real Wasm module returning malformed i32 values.
2. The new decoder checks only that rejectExpectedRet is nonzero. A reason-4 diagnostic claiming expectedReturn=1 and observedReturn=0x7a3362 is accepted and persisted, although the independently binary-pinned original return is 0x7a3362. Its reported first failure contradicts the immutable actual production predicate. The test expects diagnostic rejection before callbacks, but receives the ordinary status rejection after publication. This is a synthetic contradictory-record challenge, not a claim that the emitted helper produces that record.

## Passing independent controls

Each of 9 actual generated completion failures records exact metadata and stays immutable across later completion/CALL/RET/start hooks. Twenty-one even, signed and large mode cases normalize correctly. Six status values preserve inert guards. All nine missing diagnostic exports reject construction. Seventy-two malformed diagnostic scalar cases close before callbacks even with unchanged native snapshots. All-absent legacy exports preserve callback order and valid captured errno zero.

The existing fixtures additionally preserve complete start/CALL/RET/accepted behavior, captured nonzero sentinels, legitimate status4/event3 errno0 and later-hook persistence. Exact AST comparison preserves old predicates/order, accepted writes, start/CALL/RET/address helper and original exports; nine new readonly scalar exports only. No new guest reads or scheduling/callback effects in generated completion logic were found.

## Reproduce

Use installed Node with 128 MiB heap, 60 s CPU/wall, 24 MiB file cap, 128 KiB combined output, 8 KiB reads; TERM/KILL/reap within 5 s. From the isolated candidate checkout, set MNE_REVIEW_REPO to that checkout, MNE_SOURCE_ROOT=/tmp/maelstrom-native-latch-rejection-reason-oct26/ops/pinned-source, MNE_ORIGINAL_ROOT=/tmp/maelstrom-frozen-original-recovered-capture-oct25/vfs/maelstrom and MNE_CRT=/tmp/maelstrom-frozen-original-recovered-capture-oct25/runtime/system/msvcrt.dll. Run `node --max-old-space-size=128 docs/reviews/maelstrom-rejection-diagnostics-independent-oct26/independent.cjs`. Expected exit 1; output JSON is written beside fixture. The ops/run.py supervisor is retained separately. Fixture bytes are identical to the independently executed ops copy.

Standing source identities: the task admission verified 12 immutable b41a7c5 source inputs and the predecessor 69-file evidence manifest; reused in place. See /tmp/maelstrom-native-latch-rejection-reason-oct26/ops/{source-inputs.json,evidence-manifest.json,result.json,RECOVERY.md}. Do not substitute current production src. Original binary pins, production AST provenance and historical capture/module bytes are unchanged. Authentic status5/event0 at batch36170 remains UNKNOWN; mode values were absent and its zeros are not errno/caller evidence.

First fixture attempt lacked evaluator i32.lt_u; corrected fixture passes that group. Attempts and initial output-inspection qualifications are retained in ops/incidents.json. No candidate repair, seal repackaging, native/build/browser/guest/Boat/deployment/service activation, workers or successor selection. Prior 26 native cases do not qualify the changed output/new exports. Future exact canonical/static ABI/layout/native qualification and genuine capture remain coordinator-owned.
