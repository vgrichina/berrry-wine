# Owning black-frame storage and presentation

The accepted original run does **not** demonstrate a viewport-to-host binding
defect. The observed RGB565 storage was zero before host upload. A bounded
checkpoint diagnostic now composes with the exact original driver to narrow the
next natural attempt. No released renderer, interpreter or game file was changed.
The cause of zero pixel production remains unknown.

Evidence is in `scratch/runs/20261104-deusex-black-frame-binding-repair/`.
`recovered-analysis.json` is reproducible offline with:

```sh
node tools/deusex-black-frame-binding.cjs --analyze scratch/runs/20261104-deusex-black-frame-binding-repair/recovered-analysis.json
node tools/deusex-black-frame-binding.cjs --check
```

## Exact recovered trace

The sole original attempt is Git `ca5e30e544f5104296ad21cc77ea680d87af4976`,
recovered under `scratch/runs/20261104-deusex-owning-original-native/`.
Compressed reports and raw inputs are read through a gzip fallback without
rewriting them. Their decompressed sizes/hashes and the exact nine relevant
production source pins are recorded by the analysis. Those current source files
still match the inherited original source hashes: Worker, RPC, Draw observer,
DirectDraw implementation, renderer, GDI surface, host imports, region map and host.

The original adapter is recovered **in memory from Git**
`36661cb71b738cf08d91ad51edf55e97084423af`, SHA-256
`c33adc61c76406e896e9a0cb2dc373fdffd4c3c330ed758121bc48a63b017092`.
The test verifies that the actual retained producer embeds those exact bytes.
The incompatible current adapter is neither substituted nor repinned. All twenty
original helper pins and the original driver SHA remain required.

The complete entry / lockCall / lock / unlockCall / unlock / tailCall / tail /
epilogue / savedCaller sequence retains one viewport `422613888`, thread 1,
slot 0, endpoint 1 and HWND `65539`. Entry ScreenPointer maps to `474845184`;
successful Lock changes it to `475484160`, guest `1347899392`. At Lock and
unlockCall this exactly matches DirectDraw slot 2's 640×480×16, pitch 1280
descriptor. After Unlock, ScreenPointer remains at that address while slot 2's
descriptor points at `474206208`.

That last mismatch is consistent with Flip, not evidence of a broken binding.
Original WinDrv Unlock tests route bit 8, calls the locked surface's virtual
slot `+0x80`, then primary Flip `+0x2c` when its presentation argument is nonzero
(`windrv-unlock-disassembly.txt`). The exact pinned WAT Flip rotates `misc1`
storage associations while retaining COM roles, then presents the front buffer.
It emits the recovered `dx_trace(6,1,2,475484160,474845184)`, followed by
`dx_trace(5,1,16,475484160,0)`. Page events 11–13 create/rebind surface
`2097153` with exactly that storage, attach HWND 65539 and upload 640×480.
Its canonical bytes are zero before and after this upload. The page publication
report did not hit its event cap and reports no errors; this only covers its
installed interval.

The pinned host imports reuse the DirectDraw presentation's canvas while
rebinding its canonical storage to the newly presented DIB, mark that storage
dirty, and recheck the current front-buffer pointer before composite upload.
The forced-upload and rAF regressions exercise the corresponding host path.

The producer's nine Engine checkpoint storage reads, including the checkpoint
immediately before Unlock, report zero nonzero bytes in the same 614,400-byte
storage. The later raw file has SHA-256
`34c69899504b36f13e8b22120cf0fd894e61fcd6b046fb8535b79cc491fa3b3f`,
also entirely zero. Thus a host conversion/upload failure is not needed to
explain this observed black frame. This is not proof of allocation lifetime,
absence of transient interior writes, or absence of another presentation defect.
The later tiny blue PNG fragment is not an atomic readback of this raw capture.

## Original SoftDrv fragment discrimination

The retained consumer uses EDI `1347899392`, the viewport's actual guest pixel
pointer. Original SoftDrv RVA `0x36570` stores AX at `[edi+esi*2]`; the observed
ESI values address pixels within that storage. The original instructions from
RVA `0x36509` through the store are retained in
`softdrv-output-disassembly.txt`, derived directly from media SHA-256
`25d14f3b6cca27053aa05b191424f4c0c0dffe0837406b44eb606cb9d8aeae18`.

The focused test executes all sixteen recovered samples at their exact guest
addresses through the shipped queued Worker and actual WASM. Loaded/relocated
code must equal each retained byte sequence. Output pixels and all eight MMX
registers match both the retained result and the independent integer oracle.
Seven discriminating controls exercise palette only, light only, both together,
nonzero texture mask, changed shift, oversized shift and negative light. The first
three produce `0, 0, 65535`: the original instruction path can produce a nonzero
RGB565 pixel when both inputs change. This does not establish why those sampled
inputs were zero or prove complete rendering history. Capped cache zero-record
reports remain bounded observations, never full history.

## Bounded diagnostic for the next attempt

`installPixelBinding` runs only inside the already selected owning Worker after
readiness and before the unchanged producer/collector. It wraps the production
Draw observer's existing `captureIdentity`, so reads occur at the nine existing
checkpoints and travel back in the original queued result. It adds no slices,
guest calls, breakpoints, writes, scheduler commands or restoration.

The probe records viewport, descriptor and window storage separately: exact
dimensions/depth/stride/pointer, full bounded storage FNV and nonzero byte counts,
RGB pixel counts per row and up to sixteen nonzero coordinate/value samples.
RGB32 ignores alpha when counting color. It preserves both viewport and rotated
candidate identities after Flip and reports layout equality separately from
storage equality. Limits are nine checkpoints, 4 MiB per storage, 36 MiB total
read, dimensions ≤2048 and stride ≤8192. Unavailable/invalid reads stop further
probe reads and remain explicit in the result. These limits apply only to this
diagnostic; original natural observation limits remain unchanged.

Instance, endpoint, slot, thread, memory, Draw object/frame and Engine generation
must stay bound. Original guarded surface/module checks still run first.
Identical-address ABA cannot be resolved from these interfaces: allocation
lifetime stays unknown and no read is called atomic. The probe is a storage
diagnostic, not an acceptance criterion for gameplay or scene authority.

Generate a future driver without starting a server or runtime:

```sh
node tools/deusex-black-frame-binding.cjs --generate STAGED_OUTPUT/next-driver-with-binding.cjs
```

The generated body retains the original input preflight, readiness selection,
cache limits, sole natural collection, raw-before-PNG order and cleanup. An
operator must first reconstruct the exact accepted source/helper closure using
the preceding run's Git base plus
`scratch/runs/20261104-deusex-natural-bound-cache/production-reconstruction.patch`
and original input pins. A current-checkout preflight must still reject the
incompatible adapter. `--check` validates offline composition and helper/Git
adapter identity; it does not certify current checkout bytes for a runtime.
The coordinator owns any fresh allocation and absolute runtime deadline.
The closed original attempt must not be resumed.

## Validation and limits

Focused tests use the actual production queued Worker start/slice/status/stop
path, real loader and original instruction fragments. Synthetic route/data
fixtures exercise nonzero red/green/blue RGB565 and RGB32, stale pointer,
mismatched/retired surface, foreign endpoint/slot/thread/memory, invalid
size/depth/stride and unchanged-address lifetime controls. The test extends the
existing instruction fixture in memory; neither its source nor the production
Worker is copied or edited. Tests also retain the real terminal/module retirement
and trap controls. Original production files remain unmodified.

Both shipped test modules passed: normal
`3dcd13cc618fe85624f92a88065daff44afc6f8f8c41eda0f6d82f1c6ccee9c5`, compatible
`c9d364cf43cf055d3abcd4a056eb8dcdce5f1b918c6aad332dbd0816ec83a699`.
These are local fixture modules, **not** the original run's served
`4417305d…` / `07fb4e75…` modules. Readiness/negative owning identities, cache
loader binding/whole-state parity, queued bootstrap retirement, forced DirectDraw
upload, host rAF ordering, immutable capture and browser Worker presentation
regressions passed, as did `flock /tmp/wine-build.lock bash tools/build.sh`.

Evidence preserves exact Git SHA, relevant binary diff and owned new files as
patches, source/media/module path/hash references and small diagnostic results.
No snapshots, tars, source/media/module copies, browser, game runtime, box API or
closed-attempt resume were used. Box ID/state/expiry are **NA, offline**.
No native Windows, gameplay or FPS claim follows from these fixtures.

Next: a separately authorized fresh original attempt with this bounded probe,
then follow the first demonstrated zero-production or presentation transition.
No dependency repair is claimed without that evidence.
