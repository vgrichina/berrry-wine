# ACCEPT: bounded VFS persistence restore repair

Accepted candidate `69a838665969d09be78f3b6ba8f7f13ae49a7cf8`, parent `061461fb3e2bd088ccb6ec464ecbe958c83d46ca`, tree `ecbed7904c0b8d5ede6ca6a2ea1988eaa3e0a34d`. Trusted dedicated SSH confirmed the exact published repair branch. Production source remained read-only.

Unchanged supplied fixture: **17 PASS / 0 FAIL** at Node 16 MiB. Independent fixture: **14 PASS / 0 FAIL, 550 bounded restore calls**, also at Node 16 MiB. Both completed within 30-second guards. No huge string, heap exhaustion, native compilation, guest, service, browser or test box was used.

The independent fixture loads the actual production module and calls exported `attach()`, whose restore runs synchronously. It uses real Node WHATWG `atob` and real `Buffer.from(..., 'base64')` through entry spies. Both branches satisfy the same expected bytes, counters and metadata assertions. The supplied test's Buffer branch uses an atob-backed decoder stub; the independent fixture closes that parity gap without claiming a real-browser result.

Boundary caps1..12 and adjacent decoded lengths cover every mod3 class, padded/unpadded strings, all five HTML whitespace characters, empty data and noncanonical unused pad bits accepted by atob. Oversize input cannot reach the allocating decoder, including equal encoded-length quanta and malformed suffixes after the early cutoff. Malformed padding/alphabet before cutoff logs and never decodes. Mixed oversized, malformed, inaccessible and valid records preserve subsequent restore, timestamps, attributes, names, directory creation, restored count and zero pending/flush writes. Final postdecode guard and storage/decoder error containment pass. See source-review.json for exact option normalization and error precedence; this does not promise arbitrary invalid configuration has a finite byte cap.

Reuse only: pinned baseline **9 PASS / 8 expected FAIL**, existing persistence and restore receipts at16MiB, and Darkstone at64MiB after the original retained16MiB OOM/admission. Their committed blobs and hashes are recorded in reused-receipts.json. Those suites were not repeated. No additional parent comparison was justified by a discovered concern.

Reproduction from this review commit:

```
timeout 30s node --max-old-space-size=16 test/vfs-persistence-bounded-restore-oct26.test.cjs
timeout 30s node --max-old-space-size=16 test/vfs-bounded-restore-independent-oct26.test.cjs
```

Set VFS_ACCEPT_CHECKPOINT to an owned path to retain an atomic candidate/source/fixture/result checkpoint after each independent group. The retained independent-checkpoint.json includes every completed group. Evidence hashes are in evidence-manifest.json; later publication identity is in sibling ops/result.json to avoid self-referential commit hashes.

Acceptance scope is source/test behavior on the exact candidate. Remaining gates: coordinator review; separately owned integration onto then-current main with affected merged tests; actual browser atob/storage implementation, persistence across reload/restart and real IndexedDB durability/failure paths; application/gameplay acceptance. This task performs no main integration, production fix, renderer/input work or browser-focus acceptance. No test box assigned: ID/state/expiry not applicable; lifecycle ownership remains coordinator. No successor task or worker launched.
