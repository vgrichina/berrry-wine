# REJECTED: optional Morrowind Name observer quiet startup

Candidate `efa0f32e9dbe7fac2c863737810755473cb458c6` against
`6ca7f90522100f3474de6b5264364b7f96110b09` fails its production source wiring gate.
With `--observe-morrowind-name --quiet-api` and no other tracing consumer,
`test/run.js:3319` computes `apiLogOff=true` because its consumer predicate omits
the Name observer. Attachment at lines5584–5603 calls `set_api_log(1)`, then the
unchanged production startup statement at line6640 calls `set_api_log(0)`.
The observer still emits `installed` and has EIP tracing armed, but ordinary COM
entry and API completion imports are guarded by `$api_log_on` in the exact
`src/09b-dispatch.wat`. Consequently the enabled observer cannot obtain its
required invocation-owned poll completions after this startup reset. This is a
concrete missing observation, not a fabricated historical text-loss cause.

The first independent behavioral group executed the exact pinned production
IMPORT/ATTACH, API hooks, quiet consumer predicate and later reset statements in
source isolation. It reused only the predecessor fixture scaffold, exposing its
VM context in one documented scaffold transformation. No production source was
changed. Candidate tree blob IDs independently match the bytes exercised.
The original EXE was read and SHA-checked in place at the canonical recovery path
`/home/user/wine-assembly/test/binaries/candidates/morrowind/installed/Morrowind.exe`;
the supplied /tmp donor EXE path was absent. No original executable ran.

Controls in the same group establish disabled-default attachment (no installed
record and no observer arm), enabled nonquiet arming retained at1, enabled quiet
arming overwritten1→0, and a predicate-only in-memory mutation adding the missing
observer consumer retaining1. The mutation is a discriminating test control,
not a production repair. The default quiet logger reset to0 is legacy runner
behavior; the defect is failing to account for this newly enabled consumer.
The source guard checks establish suppression, not an executed WAT dispatch.
The unchanged counterexample and all four outcomes are retained alongside this
report. The test exits0 when it has decisively demonstrated REJECTED.

Reproduce within the assigned supervisor and resource controls:

```
/usr/bin/node --max-old-space-size=320 \
  test/morrowind-observer-independent-accept-oct28/quiet-api-counterexample.js \
  /READ_ONLY/CANDIDATE_REPO /READ_ONLY/installed/Morrowind.exe
```

This is a bounded source-contract rejection. The whole runner, canonical module,
guest initializers, original game, browser and native runtime were NOT executed.
Initializer ordering is source-backed only (attach ends5603, callDllMain route5810).
No whole-runner ready claim is made. The predecessor32checks,20anchors/22controls
and17message transport were not rerun or independently accepted here.
At the first demonstrated rejection, broader invocation/HRESULT/count, nested or
unexpected API, device/thread/target/generation/ESP, token invalidation, callback,
setter/ret0x10, bounded-overflow and sink/read-failure acceptance stopped. Those
remain unqualified by this independent review, even where predecessor source
contracts passed. The observer's documented lack of arbitrary destruction/reuse
and first arbitrary later writer coverage is compatible only with its bounded
builder-generation/sample diagnostic claim; this review proves no such causal
association and does not turn those limits into tested coverage.

No production repairs, merge, main push or deployment. Only this independent
review/reproducer is published. Next substantive gate is a bounded production
arming repair with this unchanged rejection test and independent invocation
correlation acceptance, followed separately by source-matched canonical module,
full original runner including initializers, and authorized gameplay acceptance.
No boxes were assigned; no lifecycle action. Coordinator retains ownership.
