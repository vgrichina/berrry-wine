# Original Deus Ex surface identity diagnostic (offline)

The black image after `c4ea72e5b` remains unexplained. No publication defect is
demonstrated. This change adds read-only owning-Worker evidence to the existing
natural Draw observer; it does not repair rendering or establish gameplay.

I read the recovered `result.json`, `collector-status.jsonl` and both stop
replies in `scratch/runs/20261104-deusex-extended-natural-unlock/recovered/`.
They establish the natural return pair after 999,905 blocks / 22,520.175 ms,
with entry ECX `0x103ef0a0`, viewport argument `0x19309380`, and saved caller
`0x1134426e`. The stop results equal the frozen result. They contain no reads
of Engine.Render, viewport player, viewport ScreenPointer, bitmap or COM surface
identity. Both object identities are null and lifetime/binding are unknown.
The recorded black host PNG cannot fill that gap. No old object address is
dereferenced in this offline task.

`lib/deusex-draw-observer.js` now adds `identityObservations` at entry, natural
Lock/Unlock/tail callee and return boundaries, epilogue and saved caller.
It uses only the owning instance's current frame and checked guest reads;
message-supplied pointers or snapshots are unused. Each observation reports
errors separately, so an unavailable diagnostic field does not change the
existing execution/return-pair contract. No additional execution boundary,
callback, guest call, guest write, input, repaint, pulse or forced Draw is added.
Limits, readiness, module ownership, original Render ESP alias guards and
terminal status are unchanged. The top-level lifetime/binding and legacy null
identity fields deliberately retain their existing meaning.

The offsets are derived from the original installed PE files, not pointer
searches. The test seals each listed byte sequence against file instructions;
the observer checks those sequences again in the relocated LIVE modules.

| Original instruction evidence | Read interpretation |
| --- | --- |
| Engine `0x1038ea2e`: `mov edi,[esi+0x30]` | viewport player/actor pointer |
| Engine `0x1038ed86`: `mov ecx,[edi+0x48]` | Engine.Render pointer |
| Core exported GetIndex/GetFlags/GetClass jump targets `0x1010aca0`, `0x1010abd0`, `0x1010abb0` | UObject index `+4`, raw flags `+0x1c`, class `+0x24` |
| Core IsValid `0x1014fafb`: `mov ecx,[GObjObjects]` | relocated exported TArray at Core RVA `0x19e4f8` |
| WinDrv Lock `0x1110cb60`: load `+0x130`, store `+0xb0` | locked descriptor pixel pointer to viewport ScreenPointer |
| WinDrv Lock `0x1110cb4c` through `0x1110cb5a` | pitch divided by ColorBytes `+0x78` to stride pixels `+0xb4` |
| WinDrv Unlock `0x1110cd9b` and `0x1110ce5c` | flags `+0x180`: DirectDraw bit 8, DIB BitBlt bit 4 |
| WinDrv `0x1110ce6c`, `0x1110ceb0`, `0x1110cef9` | window wrapper `+0xf0`/HWND `+4`, bitmap `+0xf8`, width/height `+0x70/+0x74` |
| WinDrv `0x1110cda9`, `0x1110cdef` | locked/back COM surface `+0x108`, primary `+0x104` |

WinDrv's presence alone does not type a viewport. The observer first requires
its vtable Lock/Unlock targets to equal the original WinDrv thunks
RVA `0x1145/0x11ea` or implementation RVA `0xc9b0/0xcd20`; it checks the thunk
jumps and relevant implementation bytes. Unsupported subclasses remain errors.
Core and WinDrv use bounded LIVE lifecycle table lookup, original preferred
image-base/version checks, and generation/address rechecks after capture.
Engine identity is also rechecked. These are version guards, not full loaded
file hash assertions.

Object evidence includes address, vtable, class pointer, index, raw flags,
bounded array slot value, reciprocal membership and observed changes since
entry. An out-of-range index, empty/replaced slot or changed class is visible.
There is no inferred allocation generation, destroyed-bit interpretation, name
search or claim that reciprocal membership proves a live object. Free/reuse
that restores identical bytes entirely between boundaries is undetectable;
`lifetime` remains `unknown`, including the positive fixture.

Surface evidence reports route flags, guest pixels and translated storage,
geometry, viewport HWND, bitmap, COM surface pointers and the owning instance's
`get_dx_present_hwnd()` value. Natural Lock/Unlock call observations also record
ECX, its equality to the viewport argument, and Unlock's stack presentation
argument without calling either method. The generated region map supplies all host table
bases. DIB candidates require the exact bitmap handle and BITMAP tag in the
declared GdiObject table (48-byte records); pixel storage equality is reported
separately. DirectDraw candidates require an aligned wrapper in the declared
primary/aux wrapper pools and a bounded slot in DX_OBJECTS (32-byte records),
then report type, pixel storage and geometry. No wild-slot clamp is copied from
the guest COM dispatcher. Canonical GDI window surface descriptors (32-byte
records) are selected only by the exact viewport HWND. Retired and mismatched
records never become a binding claim. Surface reuse with identical bytes has
the same unresolved ABA limitation as UObject reuse.

The source publication path is concrete:

* WinDrv Lock calls the back surface's COM Lock, saves the returned pixel
  pointer at viewport `+0xb0`, and computes its stride. Engine executes the
  render route against that viewport. WinDrv Unlock first calls the base
  viewport Unlock. With flag 8 it COM-Unlocks `+0x108`, then conditionally
  Flips primary `+0x104` when its original argument requests presentation.
* With flag 4 and a true presentation argument, WinDrv obtains the viewport
  HWND's DC, SelectObjects viewport bitmap `+0xf8` into the client's memory DC,
  BitBlts width/height with SRCCOPY `0x00cc0020`, then releases the DC.
  Engine's saved Unlock argument, not the Draw return alone, controls that
  conditional publication. This task does not assume which branch ran.
* Emulator `src/09a4-handlers-gdi.wat:$handle_BitBlt` resolves source/destination
  descriptors, calls `$gdi_raster_bitblt`, and on success calls
  `$gdi_geometry_present`. Window storage is established by
  `src/10f-gdi-dc.wat` through `host_gdi_surface_create/attach`.
  `src/10g-gdi-raster.wat:$gdi_write_surface_upload` publishes dirty writes.
* `lib/guest-rpc.js` brokers host imports from the owning Worker to the page.
  `lib/host-imports.js` owns `surfacePresentations`, canonical storage views,
  `gdi_surface_upload`, target HWND attachment and upload write sequences.
  `_flushGdiSurfacePresentation` decodes dirty canonical pixels into a canvas.
  The renderer then composites the attached window canvas. The DirectDraw
  path also has `_presentBestDxOffscreen` and front-buffer rebinding;
  `host.js:_presentDxIfDirty` observes shared dirty/lock state and schedules
  presentation. None of these page-owned presentation objects can be read
  from this owning Worker as though they were local state.

Thus the previous readiness `dxWriteSeq=32` proves some presentation activity,
not a match between this Draw's source pixels, the published target surface,
and the host capture. A black frame is also legitimate data. No branch,
descriptor, upload, palette or compositor mismatch is demonstrated by the
retained evidence, so changing those paths would be speculative.

Validation uses `node test/test-deusex-owning-draw-observer.js` with the actual
WASM interpreter and shipped Node owning Worker. Existing original virtual
CALL, original SEH epilogue, full original EXE/Engine loader/prologue and Render
save/restore instruction fixtures remain. New tests load actual original Core
and WinDrv PEs and exercise the diagnostic with synthetic objects and surfaces:
reciprocal membership; stale index; cleared destroyed slot; changed reused
class; identical-address ABA; unmapped player; retired Core; wrong Engine field
instruction; foreign viewport vtable; DIB/DirectDraw storage match; mismatched
storage; retired bitmap; invalid wrapper; mismatched HWND. Positive fixtures
still leave lifetime/binding unknown. These are isolated instruction/structure
fixtures, not a game run or an executed native UObject destructor/GC cycle.
Worker tests retain the intervening-command refusal and frozen stop checks.
The focused suite passed in both local and owning-Worker modes. The required
`flock /tmp/wine-build.lock bash tools/build.sh` passed; its logs and fixture results live
in `scratch/runs/20261104-deusex-surface-binding-diagnostic/`.

Provenance is Git SHA plus relevant binary diff and the owned new note patch.
`existing-input-paths-sha.json` references the existing original media and
build modules by path/SHA/size; none were copied. Disassembly text is retained
for the relevant original instruction ranges. No source archive was made.

Next runtime prerequisites, requiring separate runtime authorization:

1. Stage this published observer and its generated-region dependency graph,
   pin the actual tested module and original media paths/SHA, and regenerate
   the served manifest. Pass actual Worker/helper and CJS/ESM, cache graph,
   HTTP/isolation and exact terminal collection preflights before any browser.
   Collection must preserve the raw `identityObservations`; legacy assessments
   that retain null top-level identity fields must not discard the new data.
2. Preserve the measured native original-EXE/GIsRunning/visible HWND readiness
   gate and exact owning endpoint/slot/thread selection. Start the existing
   observer with explicit extended 10M blocks/120s when authorized; defaults
   remain standard 50K/1s. Require natural original Draw/Lock/Unlock/return and
   Render ESP guards. No injected Draw, input, repaint or publication pulse.
3. At the corresponding natural publication boundary obtain the missing
   observation: use the captured Unlock presentation argument and observe its actual branch, source descriptor
   and canonical destination ID/storage; then page-owned presentation
   ID/storage/target HWND/upload sequence, attached canvas and fresh host
   capture from that same publication. The new Worker evidence supplies the
   object/route/storage candidates, not proof of page upload or composition.
   If lifetime qualification is needed, observe native allocation/free/GC or
   a real allocation serial through the interval; module generations and
   reciprocal slots cannot substitute for that evidence.

`bx_jaqh7yas` is coordinator-reported verified STOPPED, snapshot verification
`2026-11-04T08:32:47.605Z`; its former expiry was `08:39:09.654Z`. This task did
not access, resume, allocate, stop or otherwise change it. Custody remains with
the coordinator. No browser, game runtime, boat access, subworker, successor,
Heroes II or public deployment occurred. This single task ends after publishing
the tested diagnostic.
