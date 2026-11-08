# TR2 post-fence native joins — 2026-11-08

A new generic production integration repair prevents the native DX presenter
from invalidating its own immutable source while reading through the actual
production export facade. The new fixture failed with qualified0 before the
repair and qualifies one exact red RGB565 DX display source afterward.
Original native qualified joins and reviewed movement/weapon consequences
remain open. No second original was run.

Evidence: `scratch/runs/20261108-tr2-postfence-native-joins/`.
The native source closure was pinned to published Git
`9c58912738497385991635add21c89a3ea02fd87`, including repair `2483eec51`.
595 individual files, eight HTTP pins, helper syntax/dependencies, driver
preflight and existing media path/hash checks passed before creation.
112 accepted references were independently reread; accepted controls were
reused without standalone reruns. Only the new published d3d-render-worker
and final render-worker differed from the earlier accepted runtime source.
Peer WIP was excluded. Recovery uses Git SHA, relevant binary diff and small
owned-file patches, with existing media references and no source archives.

The sole UUID-idempotent fresh original used bx_rymyd398. The independent
observable 25-minute deadline watchdog was armed before creation. Disk was
above 5 GB. The box was identified before startup. A subreaper custodian held
its own remote lock before browser startup through descendant drain; the
local runtime lock was never held during remote provisioning, supervision,
retrieval or analysis.

All six blank-page trusted native 500 ms key preflights passed. Graphics was
visually reviewed with Hardware 3D Acceleration, fullscreen 640x480 High Color
and default focused OK. Graphics Enter was admitted at approximately 8,553 ms,
below 12,000 ms; its independently released physical hold was exactly 500 ms.
The next reviewed capture shows Lara in Venice. Actual owning WebGL, CPU/render
module and endpoint binding passed, with module SHA-256
`6cf120d0d3b3db1823a8105eb26ef52a9093a7f871c37a46117475e213fda1c0`.
The full 4096 journal armed. Before observation, raw is null/unobserved.

Retirement gives **151 raw = 0 qualified + 151 discarded**: 71 overwritten
and 80 coalesced sources. All 151 sources sealed. Before-fence active counts
were one for 54 sources, two for 95 and three for two; every before-swap,
seal-entry and seal-exit sample was stable, sole and unpoisoned. This confirms
that the post-fence repair removed the earlier combined writer rejection in
this run. Read-only inspection found one visible owning 640x480 native DX
layer, but no canvas version or layer proof. No in-game Up, Space or Control
was sent, and no FPS is inferred from empty joins.

The first concrete new integration defect is self-invalidation by the actual
export facade. Earlier fixtures supplied unobserved decoder export stubs.
In production, getter entry/exit advances the writer epoch; gamma_ramp_wa was
also conservatively classified as a host mutation even when the native WAT
only atomically reads a zero ramp pointer and returns zero. The decoder took
its read stamp before palette/gamma/clip queries, guaranteeing that its own
queries could destroy that stamp or source host version.

`lib/host-imports.js` now completes those existing queries before opening the
pixel-read stamp and reuses the exact results for the synchronous decode.
There is no export call across that stamp. `lib/render-worker.js` retains
writer entry/exit and epoch advancement for every getter. Only the audited
zero-ramp return avoids a fabricated host mutation; nonzero ramp translation
retains host-version invalidation inside exclusion, and exceptions poison the
epoch. The atomic gamma generation and native clip query use the existing
watched-getter path. Arbitrary standalone mutators still invalidate before
their calls. Source host-version equality, page watches, writer exclusion,
poison, owner/request and scene checks are unchanged. Nonidentity gamma and
underlying GDI remain refused.

The extended `test/test-d3dim-publication-directx-layer.js` uses the real WAT
exports through the actual production facade, real dispatcher/swap, native
RGB565 decoder and actual compositor. The before-repair failure is retained
in `baseline-observed-exports.log`; corrected observation qualifies1 and checks
the red display pixel. All 20 existing guards also pass through this facade,
including overlap, host/page mutation, poison, stale request, wrong owner,
covered GDI and unsupported composition. Additional getter checks retain
active exclusion, changed-epoch refusal, nonzero-ramp invalidation, arbitrary
host-mutation invalidation and exception poisoning.

All seven focused tests passed, including source lifetime, DX layer, CLEAR,
transient writer/scene, broad identity and command handoff. The required
`flock /tmp/wine-build.lock bash tools/build.sh` passed; WAT module hash stayed
unchanged. Callback census was reviewed and passed. The initial build refusal
before updating the two whole-file census hashes is retained separately.
Local runtime locking covered only local focused execution.

Four numbered commands have exact successful ACKs and no UNKNOWN. An initial
arm request omitted waitMs and failed budget validation before creating an ID
or queue entry; its failure is retained. A distinct valid arm request followed.
The initial drain check preceded the custodian terminal file and failed;
a later distinct read-only check verified all recorded parent/descendant,
launcher and custodian PID/start identities absent, all descendants reaped,
HTTP/DevTools ports closed, profile/writer absent, input released and remote
lock free. There is no unverified descendant exception. All 78 artifact
references were retrieved and independently reread for size/SHA-256 before
normal stop. PNG CRC validation is recorded locally.

Normal stop `stop_89ff01d03fedeb21` completed at **11:36:53.300 UTC**,
forced=false, error=null. Final box **bx_rymyd398** is **archived**, stopped at
11:36:53.283 UTC, active expiry **null** (initial expiry 11:58:57.897 UTC).
The normal/watchdog delegates exited and the supervisor has no children.
The initial failures, unique captures, journals and custody evidence remain.

Next is a separately authorized native observation of this new repair,
requiring exact actual DX display joins before reviewed Up/Space/Control.
Full27, parity, audio, game FPS and simulation FPS remain open.
