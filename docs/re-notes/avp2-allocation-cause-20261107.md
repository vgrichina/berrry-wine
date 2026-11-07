# AVP2 Marine allocation boundary and fresh world observations, 2026-11-07

The historical Out of memory failure is localized to a sparse-heap backing
commit refusal, but its cause remains unresolved. The one fresh box reached the
original Marine world without reproducing OOM. No WAT/JS allocation disagreement
was demonstrated, so this task changes no emulator code and claims no allocation
fix. Ordinary movement is visible; aimed mouse attack input was delivered and
released, but neither an attack animation nor a hit is established.

Evidence is retained in `scratch/runs/20261107-avp2-allocation-cause/` (below,
`RUN`). Earlier evidence and controls are described in
[the aim/texture note](avp2-aim-textures-20261107.md) and
[the async recovery note](avp2-async-recovery-20261107.md).

## Historical failure: what is known

`RUN/retained-allocation-boundary.json` records the source path, SHA-256 and
numbered excerpts from the retained aim/texture `remote-webgl/console.jsonl`:

| UTC | Observation |
| --- | --- |
| 22:41:32.954 | 1,048,576 bytes, sparse arena reserved range could not be committed (reason 3) |
| 22:41:32.961 | 87,048 bytes (`0x15408`), bump/low reserve/sparse paths refused (reason 1) |
| 22:41:32.964 / .972 | Same two failure sizes and reasons recur |
| 22:41:34.472 | Original game's Out of memory message box |

In `src/10-helpers.wat`, `$heap_sparse_alloc` emits reason 3 when
`$virtual_map_commit(new_top, chunk)` fails and empty-arena reclamation either
cannot help or its retry still fails; it releases the reservation and returns
zero. Here the minimum chunk is 1 MiB. `$heap_alloc` then emits reason 1 for the
87,048-byte request. This identifies a backing-commit refusal after reservation,
not a proven guest-address-space exhaustion, DIB exhaustion, GPU texture heap
exhaustion, or host OOM. The adjacent worker-exit records do not recover the
allocation caller's stack. The 42,842 CreateSurface entry logs and flat textures
alone do not connect a surface request to that refusal.

Missing evidence is the failed commit's allocated-region map, arena/live-object
occupancy and caller at that instant, plus the relevant API return chain. The
historical run cannot supply these retrospectively. The fresh run supplies those
observations only for successful allocations and unsupported surface requests.
Consequently this is a concrete blocker to selecting a defensible emulator fix;
it is not evidence sufficient to prescribe the next code change.

## Fresh bounded observation

The checkout identity recorded during preparation is
`05babd650578b76572ca8f39ca975ce6f78e9d17`, with `RUN/runtime-relevant.patch`
preserving relevant uncommitted hunks. The runtime reused the predecessor's
immutable 619-file pins, whose source identity is
`1db931c53342c3bfc6b088fed1cecdf4fd238aa6` plus that run's
`runtime-relevant.patch`; those references and hashes are in `source-provenance.json`.
The runtime pins are in `runtime-pins.json`; the standard module is 2,182,500 bytes, SHA-256
`f9650607181301b5d2a9990420f437bd9f1ca10d40ac73067339f07499d53121`.
`media-refs.json` references existing game files by path, size and hash. No source
or media archive was made. Original 18-file recovery and the original launcher
route were retained; no guest patches, settings changes or clock manipulation
were used.

The run-specific observer used existing import trace hooks for HeapAlloc,
VirtualAlloc, CreateSurface, SetTexture and heap OOM. It preserved original hook
calls and returns, retained bounded descriptor/stack-argument/caller/output
records, and read RegionMap's allocated bases rather than assumed offsets.
`allocation-boundary-summary.json` gives compact return records; raw snapshots
are under `remote-evidence/remote-webgl/allocation-*.json`. `analyze.py` produces
`allocation-analysis.json` by unioning backing intervals and reporting gaps,
overlaps, DIB usage and arena live bytes. These are read-only samples, not an
atomic stop of every worker; count stability is retained with each sample.

The first captured successful CreateSurface at 23:01:39.904 returned HRESULT 0
and output object 136454192 to caller return address 18825922. The recorded
last-error value 183 is not a failure indication for a successful HRESULT API.
The first captured SetTexture7 at 23:01:54.072 returned HRESULT 0, last error 0,
with device 136454224, stage 0, surface 136457920 and caller return address
18833772. This is the first observed startup binding, not a claim about the first
Marine-world texture binding or correct texture contents.

The bounded failed CreateSurface records return `0x80004001` (`E_NOTIMPL`), output
zero. For example, at 23:01:39.917 caller return address 18850365 requested a
16×16, 32-bit surface with descriptor size 124, caps `0x1000`, caps2 `0x40090`,
caps3/caps4 zero; last error was 2. The WAT v4/v7 descriptor guard rejects the
unsupported caps2 bits against allowed mask `0x2009c` before allocating. This is
an intentional unsupported descriptor result, not an allocation failure. The
late failure guard counted 39,374 such results and captured no HeapAlloc or
VirtualAlloc failures. No WAT/JS semantic defect was established from this path.

At final observation (23:12:55.990), the main worker had equal entry/return
counts: HeapAlloc 252,598, VirtualAlloc 496, CreateSurface 259,902, SetTexture7
380,231, with no observed heap OOM. Counts establish observation coverage only.

| Resource | Final observed occupancy |
| --- | --- |
| Wasm linear memory | 536,870,912 bytes, fixed |
| Virtual backing pool | `[0x08000000, 0x1a000000)`, 301,989,888 bytes |
| Allocated backing | 207 entries, union 157,487,104 bytes, no overlaps |
| Free backing | 144,502,784 bytes, one contiguous largest gap |
| DIB backing | 16,965,632 / 66,060,288 bytes |
| Surface objects / texture-capable objects | 1,316 / 1,127 |
| Surface vidmem accounting ledger | 5,642,016 bytes |
| Heap arena live-byte accounting | 103,313,752 bytes across 166 arenas |

The surface ledger is not GPU heap occupancy. GPU texture heap occupancy and
host allocation refusal were not measured or established. Fresh healthy
occupancy cannot be substituted for historical failure occupancy.

## Reviewed world and native input

Actual rendering was WebGL 2.0 through ANGLE on Intel UHD Graphics 620, Mesa
23.2.1 (`forward-world.json`); retained renderer counters show zero fallbacks.
The original Marine selection and Unwelcome Guests/Normal launch were reviewed,
followed by loading, the Marine introduction, then the first-person world.
`intro-progress.png` shows corridor, teammate and 100/050 HUD. The earlier
`menu-entry.png` is a logo and loading-bar captures are not world evidence.

The passed immutable input/collector controls and corrected same-Mouse aim
helper were reused. D for 300 ms produces visibly changed corridor geometry in
`after-strafe.png`; A for 600 ms gives `corridor-return.png`; W for 600 ms gives
`forward-world.png` with teammate and illuminated floor. Each has trusted screen
DOWN/UP events and final physical/async/high-bit state false in its input ACK.

Two MouseLeft pulses at client `(430,450)`, 1,200 ms and 300 ms, have trusted
screen DOWN/UP events and cleared final physical/async/high-bit state. The
read-only capture helper took `knife-edge.png` shortly after the second DOWN;
its state saw the high bit true. Its separate `physical` probe read the wrong
mouse slot and was false; that field is not evidence of a missing press.
`knife-during.png`, `knife-edge.png` and `after-attack.png` show the knife HUD and
a dark wall after aiming changed the view. They do not establish a swing, target
reaction, damage or a hit. No attack success is claimed. All commands completed
with known acknowledgements, no UNKNOWN or replay; every press received an
independent UP. The final input terminal has held `[]`, gate failure null.

## Diagnostic limits, validation and shutdown

The first startup navigation trapped before any native input because the new
observer passed a SharedArrayBuffer-backed view to Chromium's TextDecoder. Its
logs are preserved under `remote-evidence/startup-observer-failure/`. The original
driver/browser were closed, with ports/profile/process cleanup verified. The
observer was corrected to decode copied bytes and fail open; the original was
restarted on the same box. Thus there were two startup navigations, one completed
world run, and no second box or unknown-input replay. This diagnostic repair is
not an emulator allocation fix. All ten worker observers were removed before
normal application shutdown (`allocation-final.json`).

Validation retained in RUN:

- Required locked `tools/build.sh`: pass (`build.log`, `build.exit` 0).
- `node tools/verify-avp2-recovery.js`: original 18-file recovery pass.
- `node test/test-virtual-commit-over-pool-size.js`: pass.
- `node test/test-heap-arena-slots-reclaim.js`: pass, including reclaiming 129
  freed arena slots and subsequently fitting 1,024 live 600 KB blocks.
- `node RUN/observer.test.cjs`: pass for descriptor/caller/return capture,
  failure occupancy, original hook/results preservation and observer removal.
  This is diagnostic validation, not an emulator fail-before/pass-after test.
- Own run metadata/reference and document whitespace checks pass. The repository
  evidence checker also reports unrelated historical errors/missing/invalid
  records; those were not changed by this task (`evidence-check.json`).

Only box `bx_rnbsqq9m` was created, UUID-idempotently at 22:56:18.395 UTC. Its
initial expiry was 23:31:18.412 UTC. Before launch, an independent observable
detached watchdog was armed for 23:21:18.562 UTC, alongside the normal-stop
delegate. Launch free-space floors exceeded 5 GB locally and remotely.
`retrieval-verified.json` confirms 208 artifacts / 141,153,874 bytes retrieved
and SHA-256/size verified before requesting stop. Cleanup verified both ports
closed, no live owned processes, browser profile absent and held inputs empty.
Normal delegated shutdown completed at 23:13:43.516 UTC, receipt
`stop_c52b02c8efe15cb9`, forced false, no error. Final box state is ARCHIVED,
`archiveAfter: null`. Both lifecycle children exited 0 and supervisor remaining
children is `{}`. No resume, deletion or public deployment occurred.

Next work requires a separately authorized reproduction of the historical
failure with the failing sparse commit's caller and live backing/arena snapshot.
Until that exists, there is no justified allocation patch or regression to land.
