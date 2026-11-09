# QuakeII REP native_store repair, 2026-11-09

Run: `scratch/runs/20261109-quake2-rep-store-observer-repair-1365/`.
Source base: `4309e5043513f8e71e4d30ae734a7811db886310`. Git plus the run's
small binary patch is the source recovery recipe; no module/media/source
archive is stored with evidence.

The exact original EXE instructions at publication `0x403527` (REP MOVSD),
frame clear `0x403342`, and client clear `0x409221` (REP STOSD) changed the
watched bytes while the original module reported zero native_store epochs.
The updated witness requires 60 overlapping dword completions for each.
All three assertions fail with zero on the old CPU and pass on the repaired
shipped CPU. Client clear writes a larger region; 60 is the count overlapping
the 240-byte watched current frame, not its full instruction count.

`src/05b-string-ops.wat` routes armed MOVS/STOS memory helpers through their
existing element loops and existing gs8/gs16/gs32 completion API. Unarmed
copies/fills retain the bulk paths, with one additional boolean guard. There
is no new guest read or host observer callback. Same-byte writes count.
Synchronous mode-5 filters reenter run(), which clears its observer PC at
exit: the outer REP diagnostic PC is now restored only for the same armed
generation with a clear invalid flag. Guest registers, EIP targets, memory
ordering and fault continuation are unchanged. The census updates only that
producer's fingerprint and review reason; ownership remains pending.

Actual paths inspected: threaded byte/dword REP use these shared helpers;
threaded word REP in `src/05-alu.wat` already stores through gs16. Precise
faulting and explicit REP stepping paths already use gs stores. The observer
arms instruction_watch/dbg_tier_guard, which disables block/uop execution and
loop matching. `src/07d-uop-engine.wat` slow COPY/FILL calls the helpers, but
armed optimized-tier or MMX/qword execution is not claimed or tested here.
Neither 05-alu nor 07d required a source change.

Validation:

- Locked `flock /tmp/wine-build.lock bash tools/build.sh` passes.
- `tools/quake2-frame-writer-witness.test.cjs`: 15 real-CPU OFF/ON cases,
  exact pinned original-EXE bytes; identical architecture/lazy flags,
  frame/ring bytes, 13,068 guest reads in the same order, and unchanged
  production reader predicates. Original acceptance remains rejected where
  it was rejected; native qualification remains false.
- `tools/quake2-rep-store-observer.test.cjs`: 66 shipped-CPU cases, B/W/D,
  MOVS/STOS, DF both ways, zero count with absent pointers, direct-window
  page straddles, same bytes, ordered overlap in both directions, two ranges,
  last PC/address/element width, epoch overflow, cached rearm and sticky reset
  invalidation. Independent element-order byte expectations and OFF/ON
  architecture/memory parity pass.
- `test/test-rep-movs-fault-restart.js --matrix --observe` with modes 3 and 5:
  80 MOVS cases each. `--matrix --observe --stos` with modes 3 and 5:
  40 STOS destination-fault cases each. Cold/cached, both DF directions,
  all widths, zero/three elements completed, source/destination holes and
  straddles. Mode 3 observes the epoch at handler entry before repair;
  the failed element contributes zero. Final counts include the actual
  guest handler's sentinel byte stores as well as seven REP elements.
  Existing saved CONTEXT, flags, guards, repair and non-recopy checks pass.
  Mode 5 checks final count/PC/width and existing pre-repair guest snapshots;
  no intermediate host boundary inside its synchronous filter is claimed.
- Existing native-write-core, native-write-epoch, BW REP copy (16 cases), and
  full REP fault/restart regression (182 cases plus zero-count/code writes,
  including actual unarmed uop deoptimization and block decline) pass.

The first build after the PC preservation change refused its stale callback
census fingerprint. The existing lifetime was reviewed and the precise
fingerprint/reason updated; the full locked build then passed. Initial test
fixture setup/count assumptions were corrected: init_thread requires set_eip,
beep lifecycle imports are inert, and repair-handler sentinel writes count.

Limits remain explicit: peer CPU instances, raw host writes, aliases,
reset ABA, parse generations, locked/other bulk stores, all-writer coverage,
and the historical native gameplay cause are UNKNOWN. This repair supplies
bounded same-instance REP completion evidence; it does not qualify native
execution or authenticate caller-supplied reader boundaries. Fault mode 0
lost writes to absent mappings, unhandled mode-5 lossy fragments, callback
rearm/reset, count-wrap, code16 and armed optimized tiers are not qualified
by these tests. No predicate relaxation or parse-generation claim was added.

No box, browser, local Chrome, game startup or native runtime was created or
contacted. Q31345's staged module and runtime inputs were untouched; this
rebuilt module is not evidence for that runtime. New box ID/state/expiry and
stop receipt: not applicable (no new box).

Next: any additional writer/path coverage or a gameplay claim needs its own
scope and evidence. This worker stops after publishing this repair.
