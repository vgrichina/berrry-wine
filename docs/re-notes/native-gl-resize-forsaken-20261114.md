# Native canvas resize repaired; Forsaken input admission blocker, 2026-11-14

Resize repair **6a742b727** is tested and published on main. The failure is an
asynchronous native drawable resize, not a guest-pixel or blend defect. One fresh
original Forsaken reached its native Single Player menu, but production input
admission rejected its live synchronous D3DIM executor. No gameplay input,
living traversal, identified target, aimed weapon consequence or native Quit is
claimed. Full27 remains unproved.

Evidence: `scratch/runs/20261114-native-gl-resize-forsaken/`. Start with
`resize-controls.json`, `test-headless-gl.log`, `baseline-new-tests-rejection.log`,
`validation.json`, `build.log`, `input-causal-blocker.json`, `postflight.json`
and `result.json`. Git plus `repair-source.patch` and `new-runtime.patch` is the
source archive; there are no source/media/module copies or frame series.

## Cause and repair

The retained [predecessor](forsaken-native-d3d-gameplay-20261114.md) failed the
unchanged test's32→64 far-right blue assertion:0 expected255. Our first unchanged
run passed; `baseline.log` retains that lucky result without treating it as a
repair. Fixed-size native control cohorts then reproduced stale pixels under
the heavy lock, using eight cold contexts and seven dimensions per context.
Every sample asserts its own result; none retries a failed draw until green.

| Native resize control | Stale-pixel cases /56 |
| --- | --- |
| Existing setters and single swap |26 |
| Framebuffer size query before swap |23 |
| glFinish, size query, swap |19 |
| Two swaps |11 |
| Wait for matching native extent, no swap |32 |
| Wait for matching native extent, then swap |0 |

The provider's width/height setters update JavaScript fields immediately after
requesting a native resize. Those fields are requested dimensions, not completion
evidence. In33 size-query samples the native framebuffer still reported an old
or intermediate extent. For example, requested9×60 reported96×48. Swapping then
can refresh Mesa to that stale extent. GL completion does not synchronize native
window configuration. Conversely, observing the new extent without refreshing
the driver drawable also leaves stale pixels. The X11 event-completion boundary
and subsequent driver refresh are both necessary in these controls.

`resizeContext` now pumps native events and checks **both** native framebuffer
dimensions. It waits only while the specific resize remains outstanding, with
a monotonic one-second deadline and native event waits capped at5ms. After
completion it selects the owning context again and swaps once, then updates
the viewport. There is no global sleep, pixel probe/redraw retry, assertion
relaxation or guest-pixel change. Failed completion returns failure; RasterCanvas
releases that context and reports resize failure rather than silently replacing
the owner's existing GL resources. Failed readback likewise remains visible.

Lifetime controls also exposed shared ownership: the provider returns one
dispatch object, and the previous per-context tags overwrote one another on
that singleton. Each canvas now owns a distinct facade, document, alpha contract
and idempotent destruction callback. Calls select that document when needed.
Destroying one facade cannot release another canvas's window, and use after
destruction is rejected.

## Validation and identity

The original32→64 assertion remains intact. Added native coverage checks every
pixel across four independent grow/shrink lifetimes, both axes, odd row strides,
resource retention, compositor copying, delayed native completion, no premature
swap, bounded timeout without swapping, and interleaved opaque/alpha contexts
with independent resize/readback/release. The exact old Git source loaded only
in memory fails the expanded matrix at9×60 pixel0, RGB0 rather than magenta.
No source snapshot was saved. Two test-authoring failures are retained separately:
native texture queries return equivalent wrapper objects rather than identical
JS objects, and addon methods cannot be monkey-patched. The final delayed control
loads exact production code with an explicit forwarding provider.

All eleven focused scripts pass: headless GL, raster canvas, GPU backend, D3DIM
presentation, native16 default/error boundary, passive target inspection,
readback stop lifecycle, CLI input owner, guarded input and control-server
progress. Headless GL includes actual shader drawing, alpha/row orientation,
PNG/compositing, native D3D9 programmable capability/device release and WGL
readback. `flock /tmp/wine-build.lock bash tools/build.sh` passes under the heavy
lock. Eight controller cases, four supervision cases and actual outer-wait
controls pass, including delayed150ms delivery of a60ms pulse and sticky UNKNOWN
without replay. Fixtures do not establish original-game input acceptance.

The private installation was restored from the retained Q3 package/lock using
`npm ci --offline`, with all162 pins verified before and after execution. Actual
`createRequire(lib/headless-gl.js)` resolution selects this installation; root
node_modules was untouched. Renderer is **llvmpipe (LLVM20.1.2,256bits), Mesa,
WebGL1.0, GLSL4.50**. This is native-provider software GL, not a physical GPU.
`native-recovery.json` records exact package/lock hashes. Installed Mesa25.2.8
and LLVM20.1.2 package versions/system binary hashes are retained separately;
original process memory maps were not captured, so those installed paths are
not asserted to be an observed original mapping. A queued supplemental identity
context was cancelled before execution to leave the next worker's turn intact.

The launch HEAD is `9b88fe1256e66b0bd6190b1af564aff10e0776f7`, containing the
published JS repair. The actual loaded standard module is
`dcf6e8f0ca9d361c10fa556fb30835d34cf5bfe4089f84d298cb57fd170dbd42`;
the JS repair does not change wasm bytes. All1641 pinned relevant source/test/tool
paths,105 actually observed loaded files,162 provider pins and894 original
manifest/media/standing-DLL pins match postflight. Foreign WIP was preserved.

## The single original and precise blocker

After completed LMarbles6 and SuperTux-direct turns, the sole registered
`forsaken_demo` started at14:30:11.886UTC with current native D3DIM, `--real-ticks`,
default1000 batches, unchanged media and a900s limit. An observable independent
920s watchdog was armed before launch. No relay, test delay, autoplay input,
guest call/write, state/config/AI/health/clock override or whitening patch was
introduced. The earlier [natural additive whitening analysis](forsaken-unsaturated-whitening-20261112.md)
still supplies no renderer defect.

Personally reviewed full scenes show the copyright screen, Probe logo and
ordinary main menu with **SINGLE PLAYER** selected. Actual native-context and
D3DIM observer records establish llvmpipe draws and readbacks, ending with46830
draws,3118 syncs and zero reported renderer errors/fallbacks. These counters
are not gameplay proof. The final scene is the game's natural attract sequence,
not purposeful traversal or a player-controlled game.

Production `guarded-bind` consistently rejected admission before any owner or
nonce was minted: **guarded input owner is unavailable**. Read-only inspection
establishes visible HWND0x10001, window thread1 == current thread1, matching
owner main HWND, nonzero EIP and quit0. `ctx.d3dCommands` is **D3DIMGpu**;
its `snapshot()` returns draw statistics and has **no ready property**.
`lib/cli-input-owner.js` requires `device.snapshot().ready` whenever a device
exists. That worker-style readiness predicate is false for this live synchronous
native executor, even after tens of thousands of successful draws. This is a
concrete admission-contract mismatch, not evidence of a dead renderer or resize
recurrence. No input bypass, reset/rebind of a minted owner, replay or second
original launch was attempted. A malformed read-only eval with an illegal
return was rejected before the successful expression-only inspection.

No finite original input was submitted, so capture/review freshness, independent
UP and noReplay remain fixture-tested only. The route never entered ordinary
SinglePlayer/Normal/VOLCANO. Target/weapon consequence, white-scene recurrence
and actual native Quit remain unproved. Repairing the synchronous executor's
input-owner contract is the next dependency; it was not hot-patched into this
single original.

## Shutdown

The blocker ended this run after **109.904s**, using supervisor-requested
SIGTERM and the CLI's orderly cleanup, not guest Quit. Actual native, independent
watchdog and supervisor/outer-child waits all return0 with separate stdout/stderr
EOF records. Watchdog reason is `actual-native-wait`, unfired. Invoking exec
session28882 also completed0; its child wait is recorded separately. All recorded
original/watchdog/supervisor PIDs are absent, and the heavy lock was released.
Active guest-thread diagnostics at host shutdown are retained without claiming
guest shutdown completion. Disk remained above1.5GB.

Box ID **none**, state **NOT_CREATED**, expiry **null**, stop receipt **N/A**.
No box, deployment, other worker or foreign WIP was touched. Only this run's
reproducible installed private-provider directory is removed after pin checks.
