# CMR3 first-failure validation preparation

The controller `tools/cmr3-free-list-validation.js` is source preparation only.
No native test or original replay has run for this controller. It requires an
explicit root runtime grant before any remote invocation, expressed as
`CMR3_RUNTIME_GRANTED=yes` and the exact pushed 40-character source commit in
`CMR3_VALIDATION_COMMIT`. These variables record authorization; they do not
obtain it. Kkrieger 93374 currently owns the sole box `bx_9ef2wdsw`.

After the grant, verify no runtime survivors, then run the controller externally
with `stage`, `validate`, and finally `replay`, as separate bounded exec API
operations. No Boat SSH is needed. Stage creates the fresh
`/home/user/cmr3-free-list-validation`, comparing actual donor/target bytes
and copying physical canonical 937466 only after production WAT/compiler/build
equivalence. The donor is `/home/user/cmr3-software-lines` at 750bc13fd.
Dependencies come from the successful previous `/home/user/cmr3-lines-gameplay`.
All production differences other than the diagnostic adapter are rejected;
the permitted docs/tests/CMR3-Kkrieger route tools do not enter that build.

Validation runs real native lifetime and software-backend suites, then an
in-memory adapter mutation that reports reason zero. The mutation must fail
specifically at the lifetime assertion expecting reason five, with `0 !== 5`;
an arbitrary assertion/setup failure does not count. The unmodified lifetime
suite runs again. Canonical hash checks follow every process. The harness
compiles extra-WAT test modules in memory and never writes canonical wasm.
Each test has a 240-second process bound. Preserve receipts/logs before replay.

Replay derives the established bounded 540-second guest / 590-second controller
route, requiring every injected source anchor exactly once. Original302,
native12, registry972 and profile identities, real PNG preflight and tracked
source/module pre/post checks remain intact. Control port is 8137. Use the
previous screenshot-informed Escape/Return/Stages/1-player/Ford/automatic/
Right-to-UK/Warwick route, inspecting each screen before the next input.
No automatic batch-based menu progression is introduced.

A 100 ms log monitor preserves the first invalid-free-list line and full
log immediately, requests a frame, then quit; a seven-second owned-child
SIGTERM fallback bounds a stuck control request. The adapter already captures
the twelve passive fields synchronously at rejection. A monitor read failure
is explicit and does not turn an incidental startup read into a game kill.
This does not guarantee zero duplicate lines between rejection and shutdown.
Reason three alone would not establish the reclamation cause: a quiescent
arena/mapping observation is still missing unless separately captured through
an existing read-only facility. Never repair/discard the chain to progress.

After termination, record sanitized process inventory and establish no runtime
survivors; copy and hash-verify evidence into the shared run directory before
box expiry. Preserve stage receipt, exact source/module/fixture identities,
native test logs, first error fields, screenshots and cleanup results. Report
stage loading separately from driving/audio/FPS; none is newly qualified here.

Source checks passed: Node syntax, diff whitespace, generated replay syntax,
and ten missing/duplicate injection-anchor negative controls using JS mocks
without compiler, VM, browser or remote execution. Preparation receipt:
`scratch/runs/20261015-cmr3-free-list-validation-prep/generated-controller-check.json`.
