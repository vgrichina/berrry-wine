# Owning Worker execution collector for original Deus Ex Draw

This change installs the missing execution mechanism in `lib/guest-worker.js`.
It is disabled by default. The collector runs bounded natural execution in
the actual owning WASM instance and reads that instance's registers, stack
and live DLL table. It accepts no caller-supplied snapshots, module identities
or checkpoint events. It never invokes Draw, writes guest memory/registers,
simulates a return, requests input, or forces repaint.

Basis: `df4fe5ab2` and
[the original Draw audit](deusex-original-draw-completion-20261104.md).
Original binary remains at
`test/binaries/candidates/deus-ex-demo/installed/system/engine.dll`, SHA-256
`3606d3177b4473d1a56405c3e0b372e44dfde475705460be8d68846f6d16a8d0`.
No binary/media/source archives were copied into evidence.

## Actual Worker API and execution boundary

Before implementation I read the current Worker slice, command queue, DLL
loader lifecycle/table, callback fences, timer pump, `run` export and existing
breakpoint/count implementation. WASM `set_bp` halts before a basic block;
passive address counts cannot associate an invocation. The existing `run(1)`
budget returns at a complete decoder block, drains a pending decoded
continuation within that call, and exposes call targets/return landings.
The collector uses this existing facility without changing WAT, commandeering
the single breakpoint, resetting counters or enabling a shadow call stack.

On the existing owning `WorkerLink`, use its normal request transport:

```js
await link._ask({ t: 'drawObserver', action: 'start',
  options: { maxBlocks: 50000, maxMs: 1000 } });
// Allow ordinary scheduler slices to run; this request does not run Draw.
const receipt = await link._ask({ t: 'drawObserver', action: 'status' });
await link._ask({ t: 'drawObserver', action: 'stop' });
```

Replies have `t: 'drawObserverResult'`, `active` and `result`. Start can reject
unsupported/unmapped images or an occupied callback context. The two bounds
default to 50,000 blocks/1,000 ms and clamp to 100,000 blocks/2,000 ms. The
block budget includes the search for a natural entry. A Worker timer expires
an idle observer; the synchronous runner checks time/block bounds itself.
The wall bound is checked at available execution boundaries; it cannot
preempt an existing blocking host import or execution nested inside one
interpreter block. Such hidden nested execution does not supply checkpoints.
One observation ends after its first completed or rejected invocation.
Status/stop do not resume execution. Ordinary slices retain their existing
`run(steps)` path unless an active observer is present. There is no new
per-instruction dispatch check or cost with the diagnostic disabled.

`lib/deusex-draw-observer.js` discovers `Engine.dll` from the owning exports'
real `get_dll_table` and export-directory name, requiring LIVE lifecycle state
and a stable load-address/generation pair. Preferred base comes from the
mapped PE header (`0x10300000`); checkpoint addresses relocate from that
actual load address. Module identity is re-read during observation, including
on unrelated callee blocks. Ambiguous/missing/retired/replaced rows fail
closed. The original four-byte Draw prologue is a limited version guard,
**not** a full loaded-image hash verification. A module load generation is
never reported as a viewport/pawn allocation generation.

At natural body entry `0x1038e9e0`, the collector retains actual ECX/ESP/EBP,
`[ESP]` saved caller and the original viewport `[ESP+4]`. It does not reread
the viewport argument after original Draw overwrites its high byte. It then
requires this ordered execution in the same exports object/thread:

1. Natural callee entry with Lock landing `0x1038ed6e` on its stack; return to
   that landing in the retained Draw frame with nonzero EAX and matching ESI.
2. Natural callee entry with Unlock landing `0x1038ef7a` on its stack; return
   to that landing in the same Draw frame.
3. Natural callee entry with tail landing `0x1038ef82` on its stack; return to
   that landing in the same Draw frame.
4. Common epilogue `0x1038efc9`, with the original saved return still present.
5. Actual saved-caller landing with ESP=entryESP+20 and restored caller EBP.

These are measured call-stack/landing pairs. A direct jump to a checkpoint
cannot satisfy a missing callee observation. The collector does not claim
individual observation of the `ret 0x10` instruction inside the epilogue
block. Nested Draw conservatively ends incomplete; it cannot mix invocations.
At most nine compact checkpoint records are retained, without a guest-memory
dump. Enabled diagnostics reduce scheduling quanta and can affect timing;
they are not performance measurements.

Both audited catch targets, failed Lock, bad order, bypass, wrong frame,
foreign instance/thread, module replacement, trap, stop, teardown and expiry
end observation without qualification. An outward stack unwind or wrong
caller return is incomplete. No claim of complete instruction-level SEH/EH
coverage is made: unobserved paths that do not return to the required
checkpoints remain incomplete or expire. WASM traps are forwarded to the
existing slice trap reporting; observer-read failures end the diagnostic
without inventing a guest trap. Pending yields are never cleared by the
collector. Existing thread-send frames skip the normal slice unchanged.
Other guest-executing commands (including loader/sends/exported mutators)
cancel observation before running; the multimedia callback pump also cancels
it before servicing callbacks. This deliberately sacrifices an observation
when continuous ownership cannot be retained.

The best status is
`render-route-return-candidate-unverified-lifetime`. All results retain
`engineRender:null`, `viewportPlayer:null`, `lifetime:'unknown'` and
`viewportToHostSurface:'unknown'`. A successful route need not include visible
world draw, GPU completion or host publication. Viewport/pawn lifetime,
address reuse and the platform viewport-to-HWND/surface binding have not been
observed by this collector and are not inferred from readable pointers.

## Offline validation and evidence

`node test/test-deusex-owning-draw-observer.js` executes synthetic x86 through
the actual compiled WASM and the shipped Node `guest-worker.js`. It builds a
small PE fixture and uses the real DLL loader/lifecycle table. A natural
CALL supplies Draw's four arguments; actual callee CALL/RET instructions
produce the checkpoint stream. No fake exports/register snapshots drive
these fixtures. The fixture builder writes synthetic code; the production
diagnostic itself performs no guest writes.

The suite covers both actual relocation signs, default-disabled execution,
normal return across one-block Worker slices, disabled/failed-Lock bypasses,
both catch entries, skipped checkpoints, direct jumps without calls, foreign
viewport register, stack argument high-byte corruption, wrong return cleanup,
outward unwind, loops/block expiry, actual illegal-instruction traps, no entry,
module-generation reuse, mixed real instances, pending loader yield,
preservation of installed breakpoint/count facilities, stop without register
changes, wall expiry, exported-command interruption and endpoint retirement.
Caller-supplied fake module/snapshot options cannot fabricate completion.

The predecessor's 290 checks and all ten immutable capture tests remain
unchanged and pass. Worker DLL-registry, critical-section continuation,
host shutdown, browser cache graph and test-tier checks pass. The full locked
build passes, and the collector fixtures pass again on its fresh WASM.
Four in-memory weakened collector variants (callee observation, Lock result,
checkpoint order and instance identity) are rejected by the actual WASM
fixtures; the predecessor's four weakened variants are also still rejected.
Final results are retained in the run directory.
Two exploratory untracked existing tests failed: the older
`test-worker-dynamic-loader.js` VM fixture lacks the already-required
ThreadSendWaits constructor; `test-debug-breakpoint-retarget.js` fails its
existing retarget-first-hit assertion. Neither test nor the WAT breakpoint
implementation was changed. The collector does not rely on retargeting;
its actual-WASM breakpoint/count preservation checks pass.

Evidence: `scratch/runs/20261104-deusex-owning-draw-observer/`, with exact Git
SHAs, relevant binary diffs, owned new-file patches, logs and SHA-256 seals.
Git is the source archive. The initial build attempt stopped at the census
gate for the new observer/changed Worker and concurrent host/renderer edits;
each owner reconciles their own rows before publication. No claim about
unowned rendering work follows from these tests.

No box is assigned (ID/state/expiry not applicable). No box/browser/native
game/heavy CLI session, allocation, resume, runtime lifecycle, subworker,
successor, deployment or Heroes II action occurred. Coordinator shutdown
ownership is unchanged. Next work is a separately authorized natural native
Draw observation using this installed mechanism, followed by actual object
lifetime and platform viewport/surface correlation. This task provides no
native-game/full-capture proof.
