# Lazy DirectDraw Lock synchronization audit

2026-09-29, main `f3ec3a2f` plus the shared working tree. The experiment is
disabled by default. **Do not enable it globally yet.** This audit adds a
diagnostic reproducer; it does not change runtime behavior.

Follow-up: wide/x87 reads and SetSurfaceDesc backing replacement now have
runtime fixes and focused regressions. See the matched before/after results
in [lazy-sync-synthetic-results.md](lazy-sync-synthetic-results.md). The
retained-GDI finding remains an unsupported limitation; default stays off.
The cross-instance correction is described below.
The findings below describe the original audited revision.

## Default promotion (2026-11-26, gps/d6)

D3DIM lazy Lock is now the WAT default on every host, matching Glide and
D3D9. The retained-DC case below is fixed: `$gdi_surface_descriptor` settles
an armed entry over a DX surface's bits before GDI reads or writes them
(`test/test-d3dim-gps-lazy-discard.js` case 5 fails without it). Opt out
with `--no-d3dim-lazy-sync` / `?no-lazy-sync`.
The access-path reproducer this audit used, `tools/audit-d3dim-lazy-sync.js`,
predated GPU stream v2: it faked readback through `gpu_gl_call`, so its
first eager control assertion failed. It was deleted on 2026-11-27 (gps/d7);
`test/test-d3dim-gps-lazy-discard.js`, `test/test-d3dim-surface-fence.js`
and `test/test-dx-flip-lazy-flush.js` cover these paths against the real
GPS readback. Recover the tool from git history (before gps/d7) to rerun
the original audit.

Browser smoke of the default (2026-11-27, gps/d7). The setup was Threads
mode, `tools/dev-server.js --isolate`, SwiftShader WebGL and
`tools/web-input-probe.js`, with sessions of 45-71 s and no page errors.

| App | Readbacks |
|---|---|
| dx_flip3dtl | 0 per frame |
| gta2_demo menu | 1 lazy first-touch per frame (the guest touches its locked back buffer) |
| gta2_demo gameplay | 2 in about 600 frames |
| nfs2se_glide_demo | 0 |
| quake2_demo | 0 |

Evidence: `scratch/runs/20261127-gps-d7/browser/`.

## Shared-thread correction (2026-09-29)

Pending Lock range and deferred-work state now live in the allocated
`D3DIM_LAZY_SHARED` region, with no active data initializer that could reset
them when another instance starts. All guest DIB translations consult the
shared range, including CPU-only threads that never enabled lazy sync.

```text
Lock owner                 Shared state                CPU thread B
submit buffered draws ---> renderer completes batch
publish Lock range ------> armed range ----------------> first access
                                                      acquire mutex
                           range remains armed <------- request fence
renderer fences ALL legacy/D3DIM endpoints
  -> owning GPU reads pixels into shared backing
  -> completion --------------------------------------> clear range
                                                      release mutex
                                                      perform read/write
Unlock observes shared range was touched
```

The process renderer is independent of the parked guest. Publication waits
for batch consumption without requesting pixel readback; a scoped fence from
another producer reaches the owning GPU endpoint even if the caller has no
GPU of its own. The mutex coalesces simultaneous first accesses and remains
held until readback completes. Reentrant owner readback helpers and the native
renderer instance bypass this client-side barrier to avoid self-deadlock.
An unsuccessful fence traps instead of returning stale pixels; mutex waiters
trap after a 30-second timeout rather than waiting indefinitely.

Only transports advertising shared-surface publication can arm the range.
Private executors keep eager Lock behavior. This does not disable guest
threads. Ordinary direct-window heap/code translation is unchanged; DIB
translation now reads a shared atomic range flag. Mutex work happens only
while a range is armed, or when draining deferred GPU work.

Scope remains properly ordered guest surface access through translated
pointers during Lock. Concurrent unsynchronized drawing to a CPU-locked
surface is not made valid by this change. Retained GDI/native pointers remain
unsupported as described below. The gameplay benchmark still restricts its
measurement to its existing single-producer route; it is not a whole-corpus
multithreaded performance measurement.

Run `node tools/audit-d3dim-lazy-sync.js` (deleted in gps/d7, see above). It compiled the canonical source,
uses real WAT access paths, and substitutes a deterministic GPU readback
(two RGB565 pixels, red/green). It reports observed hazards rather than
asserting that the current bugs are desirable. Eager and ordinary same-instance
lazy reads are asserted as controls. This is a unit-level access-path audit,
not another real-game performance run.

## Findings

### P1: ownership is local to an instance, but pixels are shared

`src/09ab-handlers-d3dim-core.wat`, `d3dim_lazy_*` globals and
`d3dim_lazy_unlock`; `src/03-registers.wat`, `g2w_slow`.

Instance A arms a surface. Instance B, instantiated over the same memory,
reads stale zero and writes `0x1234` through ordinary `gl16`/`gs16`. A still
reports an untouched Unlock. A subsequent readback replaces B's write with
`0xf800`. Both instances have the option enabled; B simply has no pending
range of its own. No concurrent scheduling is needed to reproduce this.

The shared uop epoch invalidates cached windows, but cannot make B see A's
instance-local range. Promotion needs shared ownership and a way for another
thread to synchronize the owning GPU executor, or an enforced runtime
restriction that drains/disables lazy sync before another instance can access
the memory. A benchmark assertion is not that restriction.

### P1: first-byte translation does not cover wide accesses

`src/06-fpu.wat`, `fpu_exec_mem` group 5/reg 0 and `fpu_load_mem`;
`src/07b-loop-match.wat`, `x87_pipeline_load`.

A real x87 `FLD m64` at `surfaceStart - 4` translates that starting address
once, then loads eight bytes directly. The surface start is page-aligned,
but this path never translates the second page. Lazy mode reads zero with
no fence and reports an untouched Unlock; eager mode reads bits
`0x07e0f80000000000`.

Thus the alignment fallback does not cover every scalar accessor. This is a
constructed overlapping access, not a measured MW3 pattern; it matters for
aliases/subranges of larger guest-owned buffers. Audit all raw wide loads,
x87 environment loads and folded paths. They need full-width span/access
validation, including a page-correct fallback, before default promotion.

### Known limitation: retained native/GDI pointers bypass the barrier

Disposition (2026-09-29): document this as an unsupported use of the opt-in
experiment; no GDI runtime fix is planned in this change. Keep lazy sync off
for workloads that access GPU-pending surface backing through a retained DC
or another native pointer that bypasses guest translation. This is a usage
restriction, not an enforced runtime exclusion or a claim that the corruption
has been fixed. No real corpus game has been confirmed to hit this sequence.

`src/10f-gdi-dc.wat`, `gdi_surface_descriptor` loads backing directly from the
surface entry; `src/09a4-handlers-gdi.wat`, `GetPixel` and `SetPixel`.

A previously bound surface DC reads stale black while a lazy Lock is armed.
SetPixel writes blue (`0x001f`) without any fence; Unlock still reports
untouched, and later GPU readback replaces it with red (`0xf800`). A new GetDC after Lock is safe:
GetDC performs a global fence. The reproduced case retains the DC from before
the arm. The emulator accepts that state; this audit does not establish that
holding a DirectDraw DC across Lock is a valid Windows application sequence.

If support is added later, either reject/exclude incompatible outstanding-DC states at Lock, or fence
native GDI reads/writes by their actual backing range before rasterization.
Also audit selected DIB aliases and host-side consumers, which do not have
to pass through guest address translation. A write notification after drawing
is too late: readback must happen before the first partial write.

### P2: benchmark thread checks do not enforce the stated scope

`tools/bench-d3dim-gameplay.js`: startup enable at instantiate, thread checks
before and after measurement windows.

`--lazy-sync-startup` enables before the first thread check. A thread can also
start, touch memory and exit between samples; `.every(state === 'exited')`
then accepts the run. These checks detect some unsupported runs, but do not
prove that an accepted sample stayed single-threaded. Record thread creation
over the entire run and reject any such run, or enforce the restriction in
the runtime. Existing MW3 results are evidence for the observed route, not
a thread-safety proof.

## Paths reviewed without a new failure

- Same-instance `gl16`/`gs16`, full-span translation and partial-write ordering
  have focused coverage. The audit's ordinary read control synchronizes once.
- CRT `memcpy`/`memset` and kernel `RtlMoveMemory` use guest bulk helpers that
  validate complete spans through `g2w_affine_span`.
- Uop windows re-prove spans after the shared epoch changes on arm. This helps
  same-instance cached windows; it does not solve the ownership finding.
- Nested Locks drain before replacing the single range. New GetDC, ReleaseDC,
  Flip and final surface release retain global barriers. Texture Load fences
  source and destination. These observations are not an exhaustive lifetime
  proof: SetSurfaceDesc can change backing/pitch without draining first.
  The subsequent [browser synthetic suite](lazy-sync-synthetic-results.md)
  confirms a failure after an untouched Lock/Unlock: replacing the backing,
  reusing the old allocation and then fencing overwrites the reused bytes
  with old GPU contents. External backing aliases/free paths need further coverage.

## Order of work

1. Validate shared-thread synchronization and retain the fixed wide-access /
   backing-replacement regressions. The previously proposed blanket
   multithreaded eager fallback was not implemented.
2. Extend real-game measurement coverage beyond the existing single-producer
   benchmark route, with complete producer/thread history and counters.
3. Keep retained native/GDI access documented as unsupported. External backing
   aliases, lifetime and reentrant consumers still need further coverage.
4. Any default promotion must account for these limitations; documenting them
   alone does not make unrestricted enablement safe.

2026-09-30 rollout decision: shared-WebGL guest workers now default to lazy
synchronization, with the retained-pointer limitation explicitly accepted.
The debug toolbar's **Lazy sync** checkbox switches live workers and future
threads; `?no-lazy-sync` opts out at startup. Software/cooperative/private
executors remain eager. This does not fix or claim coverage for the unsupported
access patterns above. See [game measurements and rollout checks](lazy-sync-game-results.md).
