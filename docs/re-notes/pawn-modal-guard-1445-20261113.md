# Pawn: qualified modal helper and authentic second-move save

Evidence: `scratch/runs/20261113-pawn-modal-guard-1445/` (ignored). Parent:
`ea908859f`, `scratch/runs/20261113-pawn-native-save-1405/`.

The parent Save confirmation refusal was caused by a real, undelivered
`WM_MOUSEMOVE` left by the helper's own preceding filename-focus click. It
was not evidence of a stale renderer owner. The helper always sent motion
before DOWN/independent UP, then required an empty renderer queue before the
next action. Production native common-modal controls accept direct clicks,
but their modal pump does not consume that ordinary motion queue. This made
the helper's sequence prevent its own next strict guard from passing.

## Qualification and scoped correction

Reviewed the exact parent helper, source, trace, geometry, ACKs and captures;
verified 149 parent seals, four gzip streams and six media hashes. The parent
pending motion targeted edit HWND 65545, with screen position (553,338),
`lParam=589908`, alongside postqueue length 3. The owner remained the healthy
software D3D9 WorkerConsumer instance.

`qualify.cjs` exercises actual production renderer, common-modal WAT and
control-server/guarded-input transport. Test-only WAT exports expose the
existing modal pump and ordinary GetMessage for controlled comparisons:

- Motion remains queued through 100 actual common-modal pump turns, with
  zero host input polls. A separate ordinary GetMessage control consumes the
  exact motion and its two native posts without manually changing queues.
- A real queued key-up is likewise deferred by the modal pump and consumed
  by the separate GetMessage control. These controls do not establish that
  Pawn's original modal loop naturally dequeues either edge.
- Direct native edit click plus WM_CHAR leaves the renderer queue empty;
  direct Save produces the actual OFN result `C:\fixture.gam`.
- Transport QUEUED ACK precedes handler execution. CONSUMED ACK acknowledges
  handler consumption, while the event can still remain in the renderer
  queue. The parent's unguarded scheduled-input ACK likewise does not prove
  guest dequeue.

Production `src/09c3a-dialog-runtime.wat`'s `modal_pump_step` paints and checks
completion; it does not poll ordinary host input. Renderer motion enqueues
WM_MOUSEMOVE and posts WM_NCHITTEST/WM_SETCURSOR, whereas native common-modal
click/character handling directly updates WAT controls.

The correction is confined to run-local `ui.py`, `ui_guard.py` and the
read-only `turn-probe.js`. A reviewed `nativeCommonModal:true` action may omit
only the redundant preceding motion, after freshly proving a visible modal
window belongs to the same instance with native proc `0xffff0002`, class 12.
Ordinary clicks retain motion. Strict fresh owner, known live terminal,
empty renderer queue, released mouse and drained rendering predicates remain
required. Existing pending events still refuse input. Independent UP and
one-request/noReplay behavior remain intact. No queue purge, forced guest
call/tick/Present, state/configuration/clock/AI edit or production source fix
was used.

Qualification passed four production-path cases, 15 strict helper guard
cases and five stream/ACK/EOF controls. Results are in `qualification.json`,
`ui-guard-tests.json`, and `stream-tests.json`. The temporary qualification
module is reproducible using the exact commands and manifest in
`qualification-module.json`; only that reproducible temporary artifact was
removed after use. No production code was changed or committed, so this
documentation-only publication does not claim a new locked build.

## One fresh original and native witness

The one original used frozen Git
`4faf5236902aa78025790af65e45611eaeaf33d9`, actual WAT SHA-256
`6888cc5e4ec7693a8a317fe29147994c7f88fe43afe3109fe6ab0e3e349eec9f`,
software D3D9, 1024x768 and the original Pawn media. Published changes since
the parent were documentation only. The separately owned WebGL1435
`lib/d3dim-gpu.js` WIP was inspected read-only and captured as a diff before
freeze; it was neither edited nor published here. All 321 frozen source,
module and media pins and 16 helper hashes remained unchanged at postcheck.
Git SHA, relevant binary diffs, new helper patches and media path/hash pins
are preserved, without source archives or copied media.

Launch held `/tmp/wine-heavy-runtime.lock`, verified actual child
serialization and fresh free space 1,512,968,192 bytes, and prearmed an
independent observable deadline/disk watchdog before the original child.
Personally reviewed the starting board and settled e4/Nf6 board before
legal d2-d4. Then reviewed d4/e4/Nf6, native Save As, and the exact filename
`pawn-1445-secondmove.gam`. The same live owner was freshly verified across
native modal windows. Filename focus and Save confirmation omitted only
redundant motion. Save confirmation passed with renderer queue zero; native
postqueue length one was observed and retained before confirmation. DOWN
and independent UP were acknowledged, and the modal dismissed.

Retrieved the authentic VFS file `C:\pawn-1445-secondmove.gam`, 100 bytes,
and independently verified SHA-256:

`811659988ee98f19ca08615f1191431993f5d51646ea41efed5fdb6f0ff5cf77`

The initial read-only extraction failed because `require` was unavailable
in that evaluation context. A separately recorded read-only observer
`read-save.js` returned the bytes for host-side hashing; no input was replayed.
Commitment remained UNKNOWN until file retrieval and offline history decode.

Bounded native disassembly shows the save routine at `0x40e6a2` writes
DWORD magic 77 and then six little-endian DWORDs per record from globals
`0x4231b0/b8/c0/c8/d0/d8`, using the four-byte WriteFile helper at `0x41b500`.
It stops when the next origin is -1. The authentic file contains:

| Record | Six raw DWORDs | Endpoint interpretation |
| --- | --- | --- |
| 1 | 36,56,7,15,56,0 | e2-e4 |
| 2 | 98,77,7,15,0,0 | g8-f6 |
| 3 | 35,55,7,15,55,0 | d2-d4 |
| 4 | 0,44,7,15,0,0 | invalid origin 0, destination c3 |

Mailbox coordinates (a1=22, file +1/rank +10) are inferred and crosschecked
against the reviewed boards. This authenticates d4 in native serialized
history. The fourth record's meaning and cause remain UNKNOWN; a valid
second reply or subsequent turn transition is unproved. Do not infer an
input/search/turn stall cause. No third move or replay was sent. Next work
is to explain this fourth native record and the second-reply transition.

## Closure

After unique file retrieval and hash verification, normal control shutdown
completed. Native PID 1093027, watchdog 1093026 and supervisor 1093022 each
have actual wait 0 and both EOF; outer tool session 42260 completed exit 0.
All three PIDs were absent, the heavy lock released, and the watchdog did
not fire. Four compressed streams decode and match raw SHA seals; six
independent-UP children each have wait 0 and both EOF. See `postchecks.json`
and `native-history-witness.json`. No box was created: ID none, state
NOT_CREATED, expiry null, stop receipt N/A.
