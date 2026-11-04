# Stronghold passive draw observer, offline 2026-11-04

Implemented passive original draw/fade observation in the existing owning
callback observer. No original game, Chrome, boat, shared heavy runtime lock,
worker session, deployment, admission renewal or runtime manifest amendment was
used. The existing local runtime helper composes this observer automatically;
its source remains unchanged. The legacy-owned D3D source is untouched.

Evidence: `scratch/runs/20261104-stronghold-passive-draw-observer/`.
Read together with [setup completion](stronghold-setup-render-completion-20261104.md),
[native fade/draw](stronghold-native-fade-draw-20261104.md), and
[explicit raster runtime](stronghold-explicit-raster-runtime-20261104.md).

## Native observation contract

Original executable path is
`test/binaries/candidates/stronghold-crusader-demo/installed/App_Executables/Stronghold Crusader multiplayer demo.exe`,
SHA-256 `9024c533095f2227b0105b7e8a9e4cf28ec4fb206b165629787b2c97cf99f13f`.
Byte pins include scene registration, draw entry and complete fade arithmetic,
refresh clearing, late clock/store, epilogue ending in RET `0x42a20e`, and four
conditional surface-call argument construction blocks. Existing callback,
manager, setup and descriptor pins remain mandatory.

Every emitted native/host row now samples fade `0x692e18`, signed direction
`0x690e54`, timestamp `0x6921b8`, refresh `0x175f9fc`, and input suppression
`0xd138b0`, alongside scene/request, mode and manager state. Rows retain the
original owner/instance/epoch, monotonically counted boundaries, command and
sequence. No per-boundary trace array is retained.

Draw events cover entry `0x4292c0`, entry clock return `0x4292cd`, pre-update
`0x429306`, post-update `0x4293c2`, late clock return `0x429aee`, and stored
timestamp after the helper return at `0x429b0e`. The late EAX must equal the
stored timestamp. Refresh-clearing block observations are retained when seen.
An ordered byte-pinned epilogue block (`0x42a1fd` or `0x42a207`) and subsequent
saved caller/ESP return establish the **block-level return interval** through
`0x42a20e`. The existing hook reports decoded block entries; it does not provide
a direct instruction-entry sample at every MOV or at that RET. Missing phases,
wrong stack, foreign draw scene ownership and a new draw before return reject.
Stopping mid-draw retains the incomplete draw in `pending`.

The four taken conditional surface-call blocks starting at `0x467cfd`,
`0x467d91`, `0x467e28`, `0x467f35` are recognized only when the next executed
block enters the exact vtable target with the matching saved return and object
identity. Records retain actual call PC, target, object/vtable, source surface,
manager and preceding completed draw record sequence. Matching stdcall return
stack and EAX/HRESULT are retained, including failure results. A preceding draw
sequence is a temporal candidate association; it does not establish surface
ownership by that draw. Unsupported target/stack observation fails closed.
The routine `0x467b90` returning alone creates no presentation event.

`presentation.status` remains `pending`, `hostRelation` is null and
`readinessGranted` is false. No new pixel identity, generalized fade recognizer,
preset/Start permission or presentation fence exists. Unknown pixels still
reject even when supplied synthetic fade-zero/direction-zero draw state.

## Offline fixtures and limits

The existing OS Worker fixture now executes original entry/prologue, both fade
arithmetic branches, refresh clear, late clock/store and original epilogue.
Only the synthetic caller, initialized data/clocks, background dependency stub
and explicit jumps around composite UI work are substituted. These are native
instruction fixtures, not a full original draw or recovered historical state.
The independent oracle uses division/truncation rather than the executable's
signed multiply-high sequence. Cases include 0/16/32/39/40/80/1280 ms, negative
endpoint, positive clamp, refresh skip, inactive direction and timestamp wrap.
Four original surface-call instruction blocks execute against initialized
synthetic COM objects; a stdcall stub supplies both zero and failing HRESULTs.
An original `0x467b90` early-return path executes separately and produces no
presentation record. There are no real surfaces or presented pixels in these
fixtures.

Both current canonical and compat modules are exercised with observation off,
trace only and observation on. Registers, whole linear-memory SHA-256, return
and slice results, and the common Worker command prefix must match. Extra
negative-fixture commands occur only after the parity snapshot. Controls cover
missing clock/return, terminal reuse, wrong owner, stale epoch, changed original
draw bytes, record/count/byte limits, plus existing callback/ACK/input/deadline
and discovery negatives. The default observer test includes these draw tests;
`--draw-only` provides a focused entry.

One interim parity run rejected different module hashes between arms while
another shared build changed the paths. Each variant is now read once into
process memory for all its arms, without saving/copying/restoring a module.
Each arm reports that exact SHA. This makes the offline fixture reproducible
within the test while explicitly leaving published source/module correspondence
unqualified. Earlier failed development logs are retained.

The exact local composed entry uses a plain Puppeteer mock, independent
spawn-FORBIDDEN guard, private fixture flock, real temporary HTTP server and
normal cleanup. Its two current-module pins establish **fixture identity only**,
not the complete preserved filesystem/HTTP closure. After the historical
deadline expired during this task, the offline mock child uses its existing
fixture date explicitly. Production admission, authorization and deadlines
are unchanged; no expired authorization becomes usable for a real launch.

Continuous 50M boundaries / 360s, owner, record/byte, input, ACK, frozen review,
16ms clock and 512/544 guards remain unchanged, as do original assets/config.
No cap increase, count reset or actual attempt occurred. The earlier isolated
render cost supplies no completion/headroom inference.

## Validation and outstanding witness

Focused observer and local runtime tests and
`flock /tmp/wine-build.lock bash tools/build.sh` pass. Logs/results include
exact tested module hashes, fixture pins and source identity. Evidence retains
Git SHA, relevant binary diff (including the concurrently dirty D3D hunks) and
this new file as a patch. Existing executable/modules are referenced by path
and SHA only; no source snapshots, tar, module/media copies or npm installs.

Still missing: an actual same-history native draw/update/late-clock/return
sequence and its taken native surface operation/result, proof connecting that
surface operation to normal host presentation completion, and independently
reviewed fresh pixels from that same draw. No actual witness is invented here.
Fade completion alone would still leave independent preset readiness guards.
Future original execution first requires stable **published** source/module
correspondence and complete explicit filesystem/HTTP/actual-entry preflight,
outside this assignment. Box ID/state/expiry: NA; coordinator owns shutdown.
