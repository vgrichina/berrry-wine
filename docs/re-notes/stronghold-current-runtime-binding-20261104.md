# Stronghold current runtime binding, 2026-11-04

The selected local entry now binds the complete preserved 2,429-row runtime
closure to the explicitly accepted `9422cf64ca9d0bf868becb64e7209fb5feb670b3`
raster source/module pair and published
`a6d78555bfd5c076d87e4d8ed340c7c91bb4873d` passive observer/helper. This fixes
the prerequisite described in [explicit raster runtime](stronghold-explicit-raster-runtime-20261104.md).
The [host presentation link](stronghold-host-presentation-link-20261104.md)
retains its structural-only interpretation and grants no readiness.

Evidence: `scratch/runs/20261104-stronghold-current-runtime-binding/`.
The owner renewed only this local assignment: Chrome cutoff
`2026-11-05T00:55:00Z`, cleanup `00:58:00Z`, unchanged 720s Chrome,
60s bootstrap, 40s command/review and 180s cleanup reserve. MDK2 assignment
`mdk2-accepted-runtime-binding-2350` has first runtime priority until its exact
normal cleanup; the Stronghold entry requires its assignment-bound heavy and
file releases and an ancestor-held external `/tmp/wine-local-runtime.lock`.
Box ID/state/expiry: NA; coordinator owns shutdown.

## Exact amendments

The preserved manifest remains unchanged at
`scratch/runs/20261104-stronghold-setup-transition-onward/runtime-pins.json`,
SHA-256 `812aadea4a2b23a899919dc95b40b4d628a3836cedc0ae1e1844c966b284b7ef`.
`acceptedRuntimePins()` authenticates that original manifest, retains every
historical row and permits exactly these five replacements. It rejects any
other changed dependency. All 1,856 media rows remain unchanged. No source,
module or media is copied or restored, and no Git-object mapping is necessary:
the existing accepted source and module paths currently match.

| Dependency | Old SHA-256 | New SHA-256 | Published provenance and reason |
| --- | --- | --- | --- |
| `src/09ab-handlers-d3dim-core.wat` | `36caf8bdafc93653fb32a794c1bf0b8487969515e7d2f4144212398d49892079` | `5c892770004355099d016e301ff73366a560237d681faf0cd3c6bd3aa8e4fc07` | `9422cf64c`, accepted fractional raster source |
| `build/wine-assembly.wasm` | `78a0b1d61b23428a1ae909d739440ae0de059bbbd84a69a2ad3e4c37471ad664` | `018c94ffbde8c857587c25c860db988d603d0662df9a18901f00c183af7493cd` | `9422cf64c`, exact canonical correspondence |
| `build/wine-assembly.compat.wasm` | `99b579cd17b57f94145df92ae6d28110f24fc284d13a1b2c0ebe3596bd10a77f` | `4e684af48e4ec06ae8aada0d5cd2b522345a7a51b8ed89988d4d8fa0d75ea7c2` | `9422cf64c`, exact compat correspondence |
| `tools/stronghold-owning-callback-observer.cjs` | `a4f1b0767a8c0168a70f0720941d8396d4618683e56ee39beb2ee8ff84dd7ffe` | `a931b3dc3656e4409de1748d0a0557fff9b70914e23f04067961fa41fbc282bd` | `a6d78555b`, published passive native/host observer |
| `tools/stronghold-local-runtime.cjs` | `e902678d5115a0ce3726ccdbf04acce4fd90c25cf10db72632aa68065f290d83` | `1a4173f177077ccafafb884c545a901a4cd253271834dd446e7581b853944b5d` | `a6d78555b` helper SHA `5d747c5cb67cc8d2f62a7d1b15b67c1c520e721fed3ccd53a19f0cb8805b877f`, plus this explicitly authorized binding/assignment patch |

`runtime-pins.json` and `binding-ledger.json` in the run record these exact
old/new identities, provenance and reasons. The helper's new source is
recoverable from this publication and the retained binary patch. Binding and
preparation revalidate the entire amended closure. Module admission also
requires the named accepted hashes independently of the supplied manifest.
The existing real HTTP server retains its per-response exact pin check.

## Offline verification

The full composed route/local entry runs with a plain Puppeteer object, both
public `child_process.spawn` and native `ChildProcess.prototype.spawn`
forbidden, a private fixture flock and a fixture-only release/clock. The real
entry checks all 2,429 filesystem rows, starts its actual HTTP server and reads
all 2,429 responses through its normal response guard. The mock stops at the
launch boundary, verifies zero child/Chrome spawns and closes the actual server.
This now tests the full accepted closure, replacing the predecessor's two-pin
fixture limitation; it grants no original/native witness.

Negatives reject stale original manifests, removed/duplicated/changed rows,
wrong canonical and compat modules, changed D3D source, changed unnamed Worker
dependency and changed observer. Reads are injected for these negatives; shared
files are never modified. Existing process/nonce/deadline/ACK/input/review,
bootstrap-order, terminal, passive host-controller and pixel-readiness tests
remain in force. The focused local, route and observer tests and required
`flock /tmp/wine-build.lock bash tools/build.sh` are run by this worker. The
build reproduces both accepted module hashes. An intermediate test overlapped
that build's output replacement and correctly rejected a changing module;
its failed log is retained and the stable final closure is checked again.

Binding implementation was published as
`9ac356cab12a5417487fa86a434c45cac4d3e7ff` before the original. After exact MDK2
heavy/file releases, this worker independently verified its recorded Node,
flock and Chrome PIDs/start ticks absent, three ports refusing connections and
the exact profile absent. The final published full-entry preflight again passed
all 2,429 filesystem rows and all 2,429 HTTP responses with public/native spawn
forbidden and zero Chrome. An independent current load sample found no active
heavy process; no other Chrome was present. The external runtime flock was
then acquired atomically for exactly one original.

## One original: operator sequencing failure, normal closure

Actual Chrome `1518358`, start ticks `188495984`, launched at
`2026-11-05T00:15:50.605Z`; Chrome version `151.0.7922.108`. The page's actual
compile/instantiate/slot0 module-send receipts name canonical SHA
`018c94ffbde8c857587c25c860db988d603d0662df9a18901f00c183af7493cd`,
2,148,848 bytes. All 1,038 actual served responses matched their exact pins.
Compat was verified offline and at its existing path, not selected by Chrome.
Every fresh original image was personally viewed before the next operator
controls. The ordinary title and Crusader flow reached ChooseType at step
8768, frozen 16ms, with empty input queue, null active input and mouse mask 0.

The first fault was **operator client sequencing**, not a game/source fault.
After submitting `install-route` command 8, I attempted `route-review-choose`
while command 8 was waiting for its capture-bound ChooseType review. The client
correctly refused with `original mailbox not ready: pending command 8; review
choose-type route-install-checkpoint.png receiptPresent=false`. Command 9 was
never written. Under the owner's first-post-Chrome-fault stop rule, I stopped
at this protective refusal, personally viewed the pending checkpoint for
evidence and supplied no further control/review continuation. Consequently the
pending command reached its unchanged review deadline at `00:19:40.586Z`.
The automatic first-command-failure path requested normal `Browser.close` at
`00:19:40.593Z`; the actual child exited code 0, signal null at
`00:19:40.687Z`. There was no actual retry.

`first-client-failure.json` distinguishes the initial protective client refusal
from the later `reply-8.json` command/review deadline. The offline operator-plan
repair (`next-action.cjs`, four passing cases) requires personal view/review,
then successful ACK, then consideration of the next existing command. It
returns a plan only, cannot submit input and verifies command 9 remains absent.
The production mailbox guard already behaved correctly and is unchanged.

At `00:19:55.881Z`, independent cleanup verified original Chrome PID/start
ticks absent, Node `1518341`/start `188495874` absent, external flock parent
`1518340` absent, HTTP `36195` and DevTools `35603` refused, no process using
the exact profile, profile removed after process exit, and external flock free.
Box ID/state/expiry remain NA; coordinator owns shutdown. The heavy release is
on the messageboard; final file release follows evidence publication.

The native and page presentation observers were **not armed**: no Custom Game
hover/press, draw/update/late-clock/return, taken surface source/target/HRESULT,
normal page upload/renderer completion or fresh-pixel witness was obtained.
Unique operation ownership and fresh pixels remain unknown; no readiness,
preset, Start, world or gameplay is claimed. The next original needs a fresh
assignment after this offline operator sequencing repair; this assignment ends
at its first concrete causal failure.

Original assets/configuration, active0
full rest, 16ms, 512/544, continuous 50M/360s, owner/record/byte/input/ACK and
frozen-review guards remain unchanged; no resets, cap increases, forced render
or timer driving are introduced.

Git is the source archive: evidence records exact Git SHA, relevant binary
diff/new-note patch and existing input/module/media paths with SHA-256. No
snapshots, archives, npm, boats, subworkers, public deployment or other games.
