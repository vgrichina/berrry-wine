# Original Deus Ex surface correlation: terminal readiness failure

The sole fresh browser stopped before the natural Draw collector started.
The first failure was `Error: unmapped guest dword` from the readiness
inspector's `resolveModule`, at **2026-11-04T08:59:26.739Z**.
Chrome closed normally at **08:59:27.236Z**. There was no second browser,
reload, input, injected Draw, repaint, publication pulse or breakpoint takeover.
The prior black capture remains unexplained. This run supplies neither new
natural identities nor a fresh original window/surface PNG; object lifetime,
page binding and visible gameplay remain unknown.

Evidence and the small tested helpers are in
`scratch/runs/20261104-deusex-natural-surface-correlation/`.
The assigned runtime root was `/home/user/deusex-natural-draw-runtime` on
`bx_8x4ucqbp`; the checkout path was never assumed to exist there.

## What was prepared and tested

I read the published `cbcfd14c1` surface diagnostic and `c4ea72e5b` extended
natural Unlock notes. The new collection and analyzer preserve raw
`identityObservations`, including their errors, fields, object records, surface
candidates and Unlock presentation argument. They retain unknown lifetime and
binding assessments. Legacy top-level nulls no longer discard the raw evidence.

The run-owned page helper observes actual host import calls for surface
create/attach/upload/delete and DirectDraw tracing. It records before/after
canonical bitmap, window and DirectDraw descriptors, storage offsets and byte
summaries, presentation object and canvas identities, target HWND, upload
arguments/write sequence, and equality with the window's attached canvas.
It reads the saved raw canvas reader, bypassing the lazy flush wrapper. The
surface PNG encoder also bypasses that wrapper and requires the exact natural
Unlock HWND. It calls no guest export, writes no guest memory, and requests no
flush, repaint or upload. Its hooks preserve import arguments and return values.
These hooks were **not reached in the actual browser**, because installation
requires readiness first. They are tested diagnostic helpers, not runtime
binding evidence. Hash summaries and temporal proximity would still not prove
allocation lifetime or establish which native instruction published a frame.

Before Chrome, all **499 actual input pins** passed, including the generated
region map and complete existing media paths. The source revision recorded by
staging is `bf257f136ffaa4cddb89a7335a090e983f6e4fab`; only four changed small
source/test files and the new helper closure were transferred. The existing
module already matched SHA-256
`129a71a01a5fbc8b07d6fa242a5a3ebc6a29f5aed9fb4b6a47d9318a764c1f52`,
so no module transfer or build was needed. The historical
`build/wine-assembly.historical-7ca6bf69.wasm` and media remained in place.
No module/media evidence copies or source archives were created.

The published original owning-Draw suite passed with actual WASM and the
shipped Node owning Worker, including original EXE/Engine/Core/WinDrv/Render
instruction fixtures, natural return guards and Render ESP aliases. The full
next driver passed modeled DOM/readiness plus actual WorkerLink/WASM execution;
its modeled page fixture was extended only with the page presentation shape.
New collector/correlation tests cover raw preservation, source storage and HWND
matches, mismatched storage/HWND, stale attached canvas, invalid storage, wrong
Worker, absent map and exact terminal limits. Positive cases still leave
lifetime and binding unknown.

Actual Puppeteer 25.7.0 CJS/ESM imports, driver/helper imports, the cache graph
(98 page / 13 Worker scripts), all 144 served HTTP resources with exact
SHA/isolation/no-store checks, selector negatives and native-readiness fixtures
passed. `qualified-pass.json` at **08:58:48.252165Z** seals the exact manifest
SHA before launch. Earlier checks were repeated after the final helper change.

## First actual failure and offline repair

Chrome/151.0.7922.71, PID 12933, ran **08:59:14.268Z–08:59:27.236Z**.
The exact original EXE was measured. The last successful owning inspection at
08:59:26.620Z selected slot 0 / thread 1 and LIVE Engine index 2, base
`0x10f82000`, generation 1. Native `GIsRunning` was still 0 and no visible
source-bearing top-level window met readiness. Those guards were not bypassed.
At 08:59:26.728Z the console recorded a newly instantiated secondary Worker;
the next inspection failed before the driver could record its slot or filter
for slot 0 / thread 1. No collector start was sent and the authorized extended
10M-block/120s interval was not consumed.

The inherited inspector resolves Engine on every candidate Worker before its
caller checks slot/thread ownership. This ordering is a demonstrated helper
defect: a new secondary instance shares the loaded module table while its own
image-base translation is still uninitialized. The strict published reader
correctly rejects that instance's unmapped address. The error must not be
swallowed or treated as an owning Engine mapping.

`owner-inspect.cjs` now returns an explicitly ineligible result for any slot
other than 0 or thread other than 1 **before** attempting module reads.
`next-driver-fixed.cjs` uses this inspector. Genuine owning-instance mapping
errors remain fatal; native GIsRunning, visible HWND, original signatures,
Worker endpoint, terminal, limits and ESP ownership checks are unchanged.
The browser-tested namespace and its pins remain unchanged.

`test-owner-inspect.cjs` loads the actual original EXE and Engine with the real
WASM loader and creates a second actual instance sharing that memory. The main
instance resolves Engine; the historical inspector on the uninitialized second
instance reproduces exactly `unmapped guest dword` with image base 0. The
repair rejects that secondary instance and a wrong thread before scanning.
A broken owning translation still fails closed. This reproduces the ordering
defect, but the runtime exception did not retain its failing slot/address, so
it does not conclusively identify which instance caused that particular throw.

The repair also passed the complete original owning-Draw/instruction suite and
full fixed-driver actual WorkerLink/WASM integration on the assigned runtime,
with no browser, in the separate `surface-correlation-offline-fix` namespace.
The pass timestamp is **09:02:57.447618Z**. No production renderer, observer or
WASM source changed; there is no demonstrated production publication mismatch
and no speculative rendering repair. Only this note is committed; run-specific
helper code, tests, patches and logs remain in ignored evidence.

## Recovery and custody

The browser namespace was closed and **86 artifacts / 4,940,782 bytes** were
recovered or matched to identical local helper inputs with full SHA/size
verification, remote snapshot **08:59:45.103305Z**. Chrome and Node driver were
absent, HTTP port 8123 was closed, and all 499 pins remained unchanged.
`analyze.cjs` validates the recovered hashes, served inputs, prebrowser order
and exact first failure. The offline repair has its own pins and closed recovery
manifest. `artifact-seal.json` covers the final local evidence. Git SHA,
relevant binary diff, owned small-helper patches and the new note patch provide
provenance; Git remains the source archive.

`bx_8x4ucqbp` is left RUNNING, API idle, healthy/hydrated, expiry
**2026-11-04T09:30:59.000Z**. Coordinator retains shutdown ownership and receives
custody. No lifecycle, allocation, resume, source-box access, local heavy
browser, subworker, successor, Heroes II or deployment action occurred.

Next work, under a separate authorization, is a fresh namespace using the
repaired inspector, complete prebrowser checks, and the still-unused extended
natural observation. Preserve the raw identities and correlate actual storage,
upload, target HWND and attached canvas at natural publication before reviewing
fresh host/surface PNGs. Reciprocal object slots, module generations and
`dxWriteSeq` alone remain insufficient. This single assignment stops here.
