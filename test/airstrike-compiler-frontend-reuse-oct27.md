# Bounded compiler frontend reuse candidate — 2026-10-27

Source donor: `0bbff116aa79f55e7a8ba9afaf3122e5f0a0a110`. No main integration.

The repeated stage is streaming `scanWatxTopLevelForms` plus `watxTopLevelHead`.
Its successful output contains only source-relative integer ranges and string
heads, independent of VFS, filename and compile options. Freeze every returned
range and the list. A private Map owned by one `compileWatx` invocation keys
exact strings (no hash collisions). No global cache, persisted cache, mutable
AST, descriptor, location, include set, macro, type map or allocator state is
shared. Failed scans are not retained: rerun with current source and filename.
Include lookup/order/deduplication and all later stages still run per compile.
Compatibility still uses `applyToVfs(new Map(closure.vfs))`; changed text misses.
The optional named artifact shares only this lexical index; shake/name options
remain per-call. `WINE_WAT_FRONTEND_REUSE=0` selects the original independent
scan path. Default standalone `compileClosure` callers retain no reuse.

Run the portable regression:

```
node --max-old-space-size=512 test/watx-compiler-frontend-reuse.test.js --evidence=/absolute/owned/output
```

The FIRST behavioral checkpoint preloads only `watxSourceClosure` to supply a
complete small fixture to the actual production CLI. Neither compiler nor
compatibility transform nor result/validator is mocked. The fixture includes
the byte-exact production-suite banner fixture and all real trampoline anchors.
Tail/compat/named files are exactly equal to no-reuse output; failure stderr
matches exactly. Full CLI validation remains enabled on these tiny modules.
The regression then compares entire compile results (binary, stages, diagnostics,
error line/column, region output) in both modes, repeated/reversed orders,
changed includes, missing/readded/removed in-place VFS values, distinct aliases,
duplicate declarations, multi-form macros, syntax/type errors, source-location
changes, name and shake options. Equal alias text still rejects duplicates.
A filename-only unsafe cache is deliberately rejected when appended source
would otherwise disappear. Frozen ranges reject mutation.

Final acceptance: **68 comparisons pass**, plus exact CLI bytes/failures,
immutability/rejecting controls and deterministic actual-stage work counts.
Four fixture compilations: fresh per-call caches scan20 files/4460 code units;
one shared scope scans8 files/1866 code units (12 hits). Cache and no-cache
bench samples run in reversed order: no-reuse CPU24.917/37.734ms versus reuse
19.256/17.892ms; RSS samples90.20–90.59MB with cumulative peak90060KiB.
These noisy same-process tiny-fixture observations are bounded comparisons,
**not a full-build speedup estimate or established bottleneck**. Final outer
supervisor peak199,774,208 bytes; its CPU2.747028 is retained conservative
supervisor accounting, not whole-invocation unique CPU.

Existing `watx-compiler-production.test.js`, macro-body regressions and sealed
provenance verify pass. Complete fixture JSON and initial/final outputs remain
outside Git under `/tmp/airstrike-compiler-frontend-reuse-oct27/ops/`.
Full-tree test-tier gate was not run on this sparse checkout; the new .test.js
uses the existing default unit classification. No full canonical closure build,
full-module instantiation, guest/browser, Boat, controls edit or CPU diagnosis.

Independent acceptance of this real source reduction is justified. A changed
full build may be considered only after that acceptance, separate authorization
and fresh admission under unchanged controls. Savings sufficient to pass are
UNKNOWN. Historical105.48018>90 rejection and modules UNQUALIFIED remain binding;
whole-invocation CPU UNKNOWN is not replaced by these fixture measurements.

Canonical external handoff: `ops/receipt-manifest.json`, `checks-checkpoint.json`,
`publication.json`, `recovery.md`, compiler pins and distinct supervised receipts.
Prior accepted66-payload manifest SHA816275611a937312706474d76217d074632fa6f195dff098063ee27cefec387a
is reused, without payload replay. Setup/instruction-output incidents are
retained in `ops/incidents.md`. No box assigned; coordinator owns future lifecycle.
