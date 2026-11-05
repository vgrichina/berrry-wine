# Stronghold native draw bypass qualification, 2026-11-05

Both accepted shipped modules demonstrate an observer contract error: original
draw branches can complete without the late clock call. The old observer
unconditionally required that call and rejected both branches at `429b0e`,
phase 3. This change accepts an omitted late clock only after observing the
original comparison and its immediate native successor in the same draw frame.
No original browser/game run was performed.

The input is published `60c888e0492b08bdaac640fae3a900a35eb6fe6a`,
`stronghold-repaired-capture-onward-20261105.md`, and retained run
`scratch/runs/20261105-stronghold-repaired-capture-onward/`. Its actual command
14 failed at phase 3, but its native fault report was unavailable. The actual
branch taken by that original remains **unknown**. The earlier scripted replay
established a sufficient mechanism; it is not the evidence authorizing this
repair.

Shared mutation and module execution waited for ReturnFire0150 FINAL
`e2cfd9ad95b136e4d6110bf63f437b84e9141ca6` and MDK0200 FINAL
`71985c4506f6dd6caa374357e5812350cf1ced1d`, including runtime/file releases and
ALLBUILDSFINISHED. Independent cleanup verification preceded the first edit:
the recorded ReturnFire normal Chrome exit was 0/null; exact PID/start-tick
owners were absent, both ports refused connections, its profile was removed,
no Chrome/MDK test/build process remained, and runtime/build locks were free.
The initial worktree base was MDK commit `71985c4506f6dd6caa374357e5812350cf1ced1d`.

The source has two bypasses. The comparison at `42971d` (in the original block
beginning `42971b`) tests `dbbd30` against zero; JNE `429723 -> 429b04` selects
the alternate route. Otherwise the comparison at `42976a` tests refresh
`175f9fc`; JE `429770 -> 429af5` selects the refresh-zero route. Both bypass
`429ae8/429aee` and preserve stored timestamp `6921b8`. A nonzero refresh on the
ordinary route executes the late clock and stores its result.

The observer retains every existing native pin and adds the original branch
and late-call prefix bytes. It records a pending comparison with its operand,
value, and expected successor. The very next native boundary must agree with
that decision, unchanged bytes/operand, zero EBP, saved caller, frame ESP, scene,
and current owner/epoch. Earlier entry-clock/update phases remain mandatory.
Only this verified same-draw provenance permits timestamp preservation at
`429b0e`; it emits a bypass/preservation record without synthesizing a late
clock event or value. Normal draws still require the late call and stored
result. Native clock targets additionally preserve CALL/RET stack evidence;
API thunks retain the preceding pinned CALL-block witness because thunk
dispatch precedes `log_block`. Epilogue and final return remain mandatory.

The real OS-Worker fixture now executes intact original windows
`[42971b,4297b0)` and `[429ad4,429b0e)` in both modules. It checks their bytes
against the existing executable before and after every positive case. A real
synthetic caller CALLs the original prologue, the original clock CALLs return
normally, and the original epilogue/RET returns to that caller. Queued slice
checkpoints span entry/update, branch, clock or preserved timestamp, epilogue,
and return. Checkpoint reports retain their exact prior prefixes, owner, epoch,
and fixed monotonic deadline; no observer history is seeded. Breakpoint
skip-once state is consumed by resuming the same breakpoint for one native
block before moving it.

Fixture substitutions remain explicit: synthetic clock/data/caller, small
return stubs for unrelated background/UI dependencies, and jumps
`4293c2 -> 42971b`, `4297b0 -> 429ad4`, `429b0e -> 42a207` omit unrelated UI
work outside the tested windows. Synthetic COM/DIB objects cover existing
surface checks. These substitutions do not establish an actual game draw,
surface-to-canvas relation, fresh pixels, readiness, or gameplay progress.

Final qualification used the exact published old observer read directly from
Git into Node's module cache, hash
`a931b3dc3656e4409de1748d0a0557fff9b70914e23f04067961fa41fbc282bd`.
All four module/bypass combinations failed with exactly
`draw clock/update/return history missing at 429b0e phase 3`; the normal
late-clock control returned first. Each rejected bypass independently had one
guest clock CALL and unchanged timestamp 1000. This is executed original
branch evidence, beyond the prior scripted replay. Earlier fixture development
failures (Buffer/Uint8Array comparison and breakpoint skip-once handling) are
retained but superseded by these final four reproductions.

With the repair, each module passes 14 complete draws: two ordinary late-clock,
ten refresh-zero, and two alternate. Cases include arithmetic boundaries,
positive/negative clamps, inactive direction, wrapping prior timestamp, refresh
2, and a high-bit alternate operand. Independent guest counters prove two
clock CALLs for ordinary draws and one for bypasses; timestamp assertions are
separate from observer records. Unobserved, trace-only, and observed arms have
identical results/registers, complete linear-memory hash, and common Worker
commands. Both observed arms retain 683 boundaries and 155 records, with
presentation pending and readiness false.

Each module also passes 30 draw negative controls, including missing earlier
phases, wrong branch bytes/pins/successor/operand, wrong caller/ESP/owner/epoch,
stale history, skipped CALL/RET, changed preserved timestamp, fixed-deadline
expiry across checkpoints, and record/byte/block overflow. New terminal checks
preserve the first failure and reject later execution. One case uses the actual
serialized production attachment after valid draw history: after a native
provenance fault its real `assert-live` operation prevents sending the next
slice; PC, ESP, clock count, timestamp, and submitted-message count stay fixed.

Validation: the full `test/test-stronghold-owning-callback-observer.js` suite
passes, including callback/scene/setup parity, actual surface thunk checks, and
24 host-pipeline structural join negatives. The final
`flock /tmp/wine-build.lock bash tools/build.sh` passes. Both module hashes
remain unchanged:

- `build/wine-assembly.wasm`: `e620f3adfc2850580004e204bc1fea495844e942806866f8ada24c215212e412`
- `build/wine-assembly.compat.wasm`: `66b37bd76da5a7b49c063b4eb0d44c898aaf00ff41e000a6fbd87c01edc136c8`

Evidence is retained in `scratch/runs/20261105-stronghold-native-draw-bypass/`:
`final-red-summary.json` and its four logs, `focused-final.json/log`,
`qualification-final-summary.json`, `build-final.log`, and dependency-cleanup
evidence. Recovery uses the exact Git base plus relevant binary diff and a
new-note patch. Modules/media are referenced by existing path and SHA-256;
there are no source snapshots, archives, or media/module copies. The existing
Stronghold executable remains at
`test/binaries/candidates/stronghold-crusader-demo/installed/App_Executables/Stronghold Crusader multiplayer demo.exe`,
SHA-256 `9024c533095f2227b0105b7e8a9e4cf28ec4fb206b165629787b2c97cf99f13f`.

The local runtime helper and its accepted old observer hash are deliberately
unchanged. Its dependency guard rejects this repaired observer until a
separately authorized, named binding update and explicit preflight are made.
That is the next prerequisite before any separately authorized original run.
The 50M-boundary, 360-second, 2048-record/1MB caps, frozen 16ms clock, full-rest,
ACK, input, and readiness contracts are unchanged; no headroom claim follows
from this fixture. No runtime boxes were used (ID/state/expiry N/A); shutdown
ownership remains with the coordinator.
