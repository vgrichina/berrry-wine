# Heretic II exit API audit: handler exit does not establish guest completion

2026-11-12. Local evidence: `scratch/runs/20261112-heretic2-exit-api-2130/`.
**Native ExitProcess(8) after ordinary `load crate0400` remains unexplained.**
This audit identifies a specific missing runtime observation: the retained API
observer labels the post-handler hook `return` without recording whether the
operation parked for lazy I/O or completed to its guest caller. No production
patch is justified. Fresh runtime observation is held by actual `/home` free
space below 1,500,000,000 bytes.

The [original exit witness](heretic2-exit-witness-2055-20261112.md), published
in `6e8c88fa2`, already recovered the exact final completed 640×480 owning-WebGL
frame 5 ms before native API entry. Its native console/Paused-over-black image
has no visible diagnostic. That objective is complete and was not repeated.
The [living SoftwareGL control](heretic2-runtime-boundary-20261112.md) remains
the qualified prior HUD31/backward/released counterpart; this audit is not a
new pair. Runtime baseline `8a834a3dc7affc8c6e53245beab56e87a32b81e8`, exact
renderer provider `4235d20d7fc2404b38f6e4f7f80c92d5f94f1513b4d6d7dcf04be34162a4b087`
and actual CPU/owning-renderer module
`04c534192ee3fe39e388536c2ce710c12c47a5cd2ca4d95c19f9d00b1e8f0a17`
remain inherited controls, unchanged here.

## Distinct retained API finding

`audit.py` reads only the recovered original `webgl/console.jsonl`, checking
both gzip and raw SHA/size against parent2055's manifest before parsing it.
It examines 27,236 selected API records, including 614 ReadFile post-handler
records, and the separate 512-entry all-API exit tail. There are no recorded
API observer errors. **All 54 ReadFile post-handler records with EAX 0 are
immediately followed, within the ReadFile stream, by identical five-argument
re-entry and EAX 1 with a byte count.** No native call was performed for this
audit, and no file payload was extracted or interpreted. `audit.json` preserves
each timestamp, five public API arguments and observed byte counts.

The exact baseline source explains why these rows cannot be treated as 54
guest-visible read failures:

- `src/09a7d-handlers-shell-file.wat:915` calls `host_fs_read_file_result`.
  An internal status 997 sets EAX 0 and invokes `$io_block(24)`.
- `$io_block` at line 377 restores the call's stack frame, keeps its thunk as
  the next EIP, sets yield reason 12 and stops the current slice. The host's
  yield-12 path in `host.js` fills the pending provider read before retry.
- `src/09b-dispatch.wat:1837` dispatches the handler, then invokes
  `host_log_api_exit` without requiring completed guest return.
- Parent2055's frozen `api-observe.js` records EAX and transferred bytes at
  that hook, but neither yield reason nor yield flag. The baseline already
  exports read-only `get_yield_reason` and `get_yield_flag` in
  `src/13-exports.wat`.

The sequence is consistent with internal lazy-I/O parks followed by successful
completion. **Actual park state for each of those 54 original hook events is
UNKNOWN**, because it was not retained. Re-entry alone does not prove its cause.
This is an observer interpretation limitation, not a proved ReadFile defect or
an explanation of native exit. The same post-handler semantics mean an
ExitProcess `return` log does not establish that execution returned to its guest
caller; the baseline ExitProcess handler forwards the supplied code to host
exit and clears EIP/steps.

The all-API tail spans only **36 ms**, from 21:11:11.001Z to .037Z, because
drawing calls occupy most of its 512 slots. Its final swap returns 1 and native
exit takes argument 8; it supplies no durable complete history of other API
outcomes during loading. The separately logged 12,248 VirtualAlloc outcomes
are all nonzero. These observations neither establish general allocation
correctness nor exclude failures in other allocation APIs. Prior optional
asset/model misses, startup GL error reads, and the final-frame finding remain
qualified as before; none is promoted to a cause.

## Next observation and concrete blocker

The next focused experiment should distinguish post-handler parking from
completed API return at the existing general runtime boundary, retaining
thread/call correlation and existing yield state, plus the original filesystem
import status for a parked read. Forward original calls once and preserve
returns, exceptions and timing policy; do not call GetLastError or any GL query
to manufacture missing state. Qualify passivity and freeze all helpers/source
before any original, with the existing identity, freshness, containment,
independent-release, strict 30-second and lifecycle controls. This is a proposed
observation, not an implemented or qualified observer. Reuse unchanged prior
SoftwareGL evidence by SHA; label a new pair only if both arms actually run.

Actual free space at the audit was **1,480,626,176 bytes**, below the sole disk
floor; subsequent samples are retained in `capacity.jsonl`. No new allocation,
one-shot runtime API call, native input, box, watchdog, console command or guest
state write occurred. No inherited box was touched. There is no new box ID,
expiry or stop receipt; parent2055's `bx_42896ath` remains last recorded archived,
expiry null, receipt `stop_620e557b0869ed60`. Its inherited lifecycle unknowns
and all earlier unknowns remain unchanged.

Validation: local hash-verified API/source audit, documentation link checks and
`git diff --check`; no runtime code changed, so no build or matched-original
repair claim is made. Recovery uses exact Git objects, relevant binary diff,
the owned audit-helper patch and existing parent media paths/SHA references.
No source/media archive, guest RE/disassembly/private structures, extraction,
guest patch or substitute DLL was used. Full27/parity/FPS/audio/general crash
claims remain open. Resume only after actual headroom permits the distinct
runtime observation; exit cause stays **UNKNOWN** until causal evidence exists.
