# Independent parser decision: REJECT

Candidate `d0cda4dbe6d788694b98009f9897faf5c12c837e`, based on accepted ancestor `9148ceb18768955f647130c2e936228429892477`. The ancestor is not current main.

The real full `host.js` is evaluated in a fresh Node VM; no parser copy or emulator is constructed. Implementation and server files remain unchanged. No runtime, gameplay, deployment, service or test-box action was performed. Coordinator retains lifecycle ownership; no box was assigned.

## Defect

At host.js:815-830, `typeof entry.f` permits an inherited name. Counting two own keys does not establish that one is `f`. In a VM with `Object.prototype.f = "inherited-name"`, the wire descriptor `[{"size":1,"extra":"unexpected"}]` plus body `x` returns a Map containing `inherited-name -> x`. The wire descriptor `[{"status":404,"extra":"unexpected"}]` returns an empty Map. Both should return null: neither has an own name and both have an unexpected field. These are two manifestations of one missing own-name validation defect.

This requires pre-existing prototype contamination in the parser realm; ordinary JSON.parse does not introduce that contamination itself. No exploit or default clean-realm failure is claimed. Clean-realm controls reject both payloads; descriptors with own f remain valid in the contaminated realm. Inherited size/status and a JSON own __proto__ key do not bypass their checks. Every test uses a separate VM for contamination.

## Evidence

* Reused unchanged donor baseline: 3 pass / 5 fail, donor repair: 8 pass / 0 fail. All eleven donor evidence payload hashes and three pinned inputs reverified.
* Supplied focused suite on exact repaired source: 8 pass / 0 fail (`focused.tap`).
* Independent first run: 6 pass / 2 fail (`independent.tap`), preserving both rejecting assertions and actual Maps.
* Added targeted controls only: 1 pass / 0 fail (`controls.tap`). Final independent test file has nine groups; combined executed groups are 7 pass / 2 fail. The first eight groups were not rerun. Checkpoint records initial and final test hashes.

Passing groups cover actual unchanged server readBundle/writeBundle responses (binary/empty/missing/resolver exception/read error), zero-copy Uint8Array views at offsets 0/1/7/255, successful files after errors, server-compatible 413 descriptors, special/Unicode/comma/empty names, whitespace, negative zero, malformed JSON top-level and descriptor shapes, truncated bodies/headers, unsigned uint32 framing boundaries, duplicate status/success permutations, invalid sizes/statuses, malformed UTF-8 and trailing bytes. No 64 MiB allocation was made to elicit an actual server 413: that status is tested using its documented wire representation. The parallel server repair was not consumed.

Run from this sparse repository:

```sh
timeout 30s node --max-old-space-size=192 --test test/file-bundle-parser-framing.test.cjs
timeout 30s node --max-old-space-size=192 --test test/file-bundle-parser-independent-accept.test.cjs
```

The second command intentionally fails on this candidate. Retained controls were run separately with `--test-name-pattern='name-inheritance controls'`. Baseline evidence is reused, not regenerated. Full source/test hashes are in checkpoint.json and all retained payload hashes in evidence-hashes.json.

## Remaining gate

Do not integrate this candidate as accepted. A separate authorized owner must repair descriptor own-name validation and requalify affected checks. Then reconcile with current remote main, including the separately owned lib/file-bundle.js bounded-read repair, before any merge. No merge or loader API change is made here. The donor recorded remote main b06ab7a2c7f30c3b67555ff11cdab1dbd3d5eef9; that historical observation is not asserted to be current.

## Controls and incidents

Sparse isolated task branch; donors and root tracked files/index/refs read-only. Only new independent test/docs paths changed. Trusted dedicated Git SSH configuration is retained in preflight.json. Mount validation is inapplicable: no filename-bearing mount command or guest execution was used. Node heap capped at 192 MiB and each suite wall time capped at 30 seconds; no heavy build/wasm arena. Focused resource receipts include the 8 MiB reserve and conservative shared WAL charge once, launcher/future growth, installed Node and donor standing separately. Final measured accounting is in publication receipt.

Initial combined instruction output exceeded the 8192-byte excerpt limit; subsequent reads were bounded. Initial dispatch path lacked the sibling -dispatch suffix and was corrected locally. First suite shell sequence retained TAP but did not separately save individual exit statuses; TAP records 8/0 and 6/2, and the later controls command returned zero. No failures were discarded. Preflight measured before checkout; the precise updated checkout manifest was recorded before the added controls/publication, after initial suites rather than immediately before them. No retrospective claim of that checkpoint timing is made.
