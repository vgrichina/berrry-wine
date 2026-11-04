# Stronghold explicit raster runtime: new module mismatch, stopped offline

The named runtime amendment cannot be used at the permitted existing module
paths. Both files changed again after the preceding closure audit and differ
from the explicitly authorized canonical/compat pair. The task's **unknown
mismatch STOP offline** condition applies. No amended launch manifest was
installed, source mapping implemented, runtime launched or original attempt
consumed. The helper and test remain unchanged. This is a new prerequisite
failure after the named authorization, not the predecessor's unresolved request
for permission to amend the four known rows.

Read together with [native fade/draw](stronghold-native-fade-draw-20261104.md)
and [setup render completion](stronghold-setup-render-completion-20261104.md).
Evidence: `scratch/runs/20261104-stronghold-explicit-raster-runtime/`.
Audit checkout: `6fab31b059cabce5c66940d3a0fdaf0b35da4b71`, shared main.

The unchanged preserved manifest is
`scratch/runs/20261104-stronghold-setup-transition-onward/runtime-pins.json`,
SHA-256 `812aadea4a2b23a899919dc95b40b4d628a3836cedc0ae1e1844c966b284b7ef`,
recording `69713b13c8415407f4603e8297532a738c1dde5d`.
`audit.cjs` checked all 2,429 filesystem rows against both the original pins and
the four named authorized replacements. All 1,856 media rows still match.
The only mismatches outside the deliberately dirty D3D source are the two
modules. The audit records old/new hashes and reasons without applying them:

| Path | Preserved SHA-256 | Authorized SHA-256 | Reason |
| --- | --- | --- | --- |
| `src/09ab-handlers-d3dim-core.wat` | `36caf8bdafc93653fb32a794c1bf0b8487969515e7d2f4144212398d49892079` | `5c892770004355099d016e301ff73366a560237d681faf0cd3c6bd3aa8e4fc07` | Accepted `9422cf64c` fractional raster repair; immutable Git mapping allowed for dirty source |
| `build/wine-assembly.wasm` | `78a0b1d61b23428a1ae909d739440ae0de059bbbd84a69a2ad3e4c37471ad664` | `018c94ffbde8c857587c25c860db988d603d0662df9a18901f00c183af7493cd` | Named canonical module, existing path only |
| `build/wine-assembly.compat.wasm` | `99b579cd17b57f94145df92ae6d28110f24fc284d13a1b2c0ebe3596bd10a77f` | `4e684af48e4ec06ae8aada0d5cd2b522345a7a51b8ed89988d4d8fa0d75ea7c2` | Named compat module, existing path only |
| `tools/stronghold-local-runtime.cjs` | `e902678d5115a0ce3726ccdbf04acce4fd90c25cf10db72632aa68065f290d83` | `112cb1900ee910a6862d3af00b8757ffdc26bcc60d0ea7c1d7947f24b926f426` | Published `d5d2e95aa` observation-only helper |

At `2026-11-04T23:19:36.700Z`, the filesystem audit instead read:

| Existing path | Actual SHA-256 |
| --- | --- |
| `build/wine-assembly.wasm` | `768d0903e055b775e9d06afdf1236e6fd927f48a9ebfdd887a60232c889b5765` |
| `build/wine-assembly.compat.wasm` | `811397fad786c75f852f5fbb6c0e6df9da729d56047c34ca976d23fb8960e5c8` |

An earlier direct probe during this task read canonical
`cdc72a0a996f57b5c105c95c4b9953914cb19329141e911ad3b6ccbe8665076f`
and compat `609c2da0fa6e02a27137053366e6976fae89716083ad828129e26437a391a029`.
These observations show changing shared outputs; no unknown module is approved
by either observation. The legacy worker owns the source. Nothing was restored,
rebuilt, copied or selected from another location to circumvent the mismatch.

The accepted source was read directly from Git revision
`9422cf64ca9d0bf868becb64e7209fb5feb670b3`, blob
`67c610dd63e9a1cac66fd750cc5ed8eb93d8813f`; its SHA-256 matches the table.
The current dirty source's observed SHA-256 is
`4894ca161e3b132e7e813f5d878c8c8f0fce69e49783e88c377683424618ee68`.
The published helper blob also matches its named replacement exactly.
The retained fractional-clipping `publication.json` and `result.json` bind
`9422cf64c` to the authorized module pair and passing public draw/Lock tests;
their paths and hashes are in the audit. That establishes the recorded accepted
pair's provenance, not correspondence of today's different outputs. A small
immutable source HTTP mapping would address dirty source only, so implementing
it cannot repair this module prerequisite.

The actual `route.prepare({run,pins})` still rejects the original manifest at
the D3D source, and independent `local.binding(run,pins)` rejects the modules.
An independent `child_process.spawn` prohibition records zero attempts; the
plain Puppeteer mock is constructed but never reached. No full preserved or
amended caller mock passes. HTTP preflight and runtime remain unattempted after
the explicit mismatch stop. No heavy runtime flock was taken.

The existing focused `test/test-stronghold-local-runtime.js` passes, including
41 admission negatives, partial-image pixel/scene regressions, input/readiness,
terminal and normal-close guards. Its complete actual composed entry uses a
two-module current-files **offline fixture**, plain Puppeteer mock, independent
spawn prohibition, private ancestor flock and real temporary server. It records
one mock launch sentinel, zero Chrome/spawn attempts and normal server closure
on port 46857. This fixture does not qualify the rejected full runtime closure.
No code changed, so no build was run; rebuilding would also replace the shared
outputs involved in the failure. Documentation diff checking passes.

No native fade/draw or presentation observer was implemented after this first
prerequisite failure. No fresh capture, reviewed pixels, draw return,
presentation result, parity claim, fade completion, preset readiness or game
progress is asserted. The required taken surface operation/result and host
presentation still need pairing with completed native draw and fresh pixels;
`0x467b90` return alone remains insufficient. Original assets/configuration,
16ms clock, 512/544 controls, continuous 50M/360s and all ownership/input/ACK/
record/byte/frozen-review guards remain unchanged. Fade zero/direction zero
would still grant no preset permission. The MDK heavy release at 23:07:51Z and
correction at 23:08:37Z were read; its successor remains offline only.

Evidence preserves the Git SHA, relevant binary diff including the observed
dirty D3D hunks, this new note as a patch, audit inputs by existing path/hash,
and logs. No source/module/media snapshot or archive was made. No npm, worker,
boat, deployment or other game operation occurred. Box ID/state/expiry: NA;
coordinator retains shutdown ownership.

Next prerequisite: the explicitly authorized module hashes must be available
at the permitted paths, or the owner must explicitly name a different pair
and its source correspondence. Do not copy modules or restore the legacy
source. A fresh full filesystem/HTTP/actual-entry mock must pass before the
single original attempt and native observation. This assignment stops with
the concrete unknown-module failure; no runtime retry occurred.
