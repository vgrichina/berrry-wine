# Stronghold native fade/draw: preserved-runtime preflight blocker

The authorized original attempt was **not launched**. The mandatory preserved
closure fails before the actual start caller can reach its plain Puppeteer
mock. Both modules at the recorded paths have changed. No observer, scene
recognizer, admission contract, runtime pins or gameplay controls were changed.
The next condition is recovery of the exact pinned runtime at an authorized
serving location, or explicit authorization for a named replacement runtime
with its source/module amendment and fresh preflight. Updating every manifest
hash to current files would conceal this prerequisite failure.

References: `e45845319f55ce083e4928b23da1ac0e0f3fd48d`,
[original fade investigation](stronghold-setup-render-completion-20261104.md),
`d5d2e95aaf2d7b05a36e28a9f1e727d3322410c8`,
[last original attempt](stronghold-setup-transition-onward-20261104.md), and
[original-game notes](stronghold-crusader-demo.md).
Evidence: `scratch/runs/20261104-stronghold-native-fade-draw/`.
Audit checkout: `be8b46aab93b0e205dd64196d1304b5b32976933` on shared main.

## Exact closure result

The preserved input is the existing
`scratch/runs/20261104-stronghold-setup-transition-onward/runtime-pins.json`,
SHA-256 `812aadea4a2b23a899919dc95b40b4d628a3836cedc0ae1e1844c966b284b7ef`,
recording launch commit `69713b13c8415407f4603e8297532a738c1dde5d`.
All 2,429 filesystem rows were checked without rewriting that manifest.
All 1,856 original media rows still match. These are the four differences:

| Existing path | Preserved SHA-256 | Actual SHA-256 at audit |
| --- | --- | --- |
| `src/09ab-handlers-d3dim-core.wat` | `36caf8bdafc93653fb32a794c1bf0b8487969515e7d2f4144212398d49892079` | `5c892770004355099d016e301ff73366a560237d681faf0cd3c6bd3aa8e4fc07` |
| `build/wine-assembly.wasm` | `78a0b1d61b23428a1ae909d739440ae0de059bbbd84a69a2ad3e4c37471ad664` | `018c94ffbde8c857587c25c860db988d603d0662df9a18901f00c183af7493cd` |
| `build/wine-assembly.compat.wasm` | `99b579cd17b57f94145df92ae6d28110f24fc284d13a1b2c0ebe3596bd10a77f` | `4e684af48e4ec06ae8aada0d5cd2b522345a7a51b8ed89988d4d8fa0d75ea7c2` |
| `tools/stronghold-local-runtime.cjs` | `e902678d5115a0ce3726ccdbf04acce4fd90c25cf10db72632aa68065f290d83` | `112cb1900ee910a6862d3af00b8757ffdc26bcc60d0ea7c1d7947f24b926f426` |

The helper difference is the predecessor's published partial-image repair;
it does not explain or authorize the unrelated module changes. The shared
D3D repair was published as `9422cf64c`; no other agent's source or build output
was restored, overwritten or copied for this task.

`preflight.cjs` runs the actual `route.prepare({run,pins})` start preparation
with an independent `child_process.spawn` prohibition. It rejects with
`current source pin mismatch src/09ab-handlers-d3dim-core.wat`.
The independent `local.binding(run,pins)` check rejects with
`candidate module mismatch`. A plain Puppeteer mock is constructed, but the
full pinned caller never reaches it. This is a rejected preflight, not a
successful full mock entry. Zero spawn attempts and zero Chrome launches occur.

A real temporary static server checked all 1,016 HTTP paths from the existing
preflight selection. All responses have the required status/cache/isolation
headers; both module bodies disagree with their preserved hashes. The other
1,014 match. The server on port 39627 closed normally. The first audit-script
failure, which stopped before writing its report, is retained separately;
the corrected audit records preparation rejection and finishes every row.

## Observation and presentation remain unqualified

No new native history or pixels were collected. The proposed passive draw
entry/update/late-clock/return observer and independent native/pixel rejection
controls were not implemented after the required first preflight failed.
The preserved 50M/360s continuous-history limits, 16ms clock, 512/544 input
guards, first-fault stop and existing unknown-scene rejection remain unchanged.
No frame hash was added. Fade zero and direction zero grant no preset input.

Static examination of the original executable adds a useful limitation:
`0x467b90`, called by the main loop at `0x576e30`, contains multiple conditional
surface calls and early exits. The call through vtable offset `0x14` at
`0x467d1d` returns at `0x467d20`; another occurs at `0x467db1`, with further
conditional calls at `0x467e48` and `0x467f55`. The routine can also return
without those calls. Consequently, its return alone cannot certify pixels
were presented. The actual taken surface operation, owner/surface identity,
successful result, host presentation completion and resulting capture must
still be paired to the same native completed draw. The static disassembly
is retained; no actual presentation fence is claimed from it.

## Validation and handoff

`test/test-stronghold-local-runtime.js` passes in this task's fresh evidence
directory: 41 admission negatives, retained partial-image mutation/unrelated
scene tests, terminal/cap/readiness checks, normal-close controls, and the
actual composed entry using a two-module **current-build fixture**. That entry
uses a plain Puppeteer mock plus independent spawn prohibition, one launch
sentinel, zero Chrome/spawn attempts, a private ancestor flock and normal HTTP
server closure. Its two fixture pins do not satisfy the rejected 2,429-row
preserved runtime closure. No production code changed; no build or original
native execution was needed for this documentation-only blocker.

Git SHA, relevant binary diff, new-note patch and full path/hash audit are
retained. No source snapshot, archive, media/module copy, npm, deployment,
other game, worker or box operation occurred. No shared heavy runtime flock
was acquired and no original attempt was consumed. The MDK release at
23:07:51Z and corrected input summary at 23:08:37Z were read; serialization
release does not repair the closure mismatch.

Box ID/state/expiry: NA. Coordinator retains shutdown ownership. Hand back the
unchanged runtime helper and test files. Stop after publishing this blocker;
recovery or an explicitly named runtime amendment plus successful exact-entry
filesystem/HTTP/mock preflight must precede any later original attempt.
