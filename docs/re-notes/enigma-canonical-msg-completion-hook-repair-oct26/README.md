# Enigma canonical message completion repair — offline candidate

This task branch implements explicit invocation-owned Win32 GetMessage/PeekMessage
completion wiring. It is ready for independent source/build acceptance; it does
not establish canonical-module runtime acceptance, initializer execution,
application handling, gameplay, or a Start Game repair. Main is forbidden and
untouched. No Wasm compilation, guest/browser execution, Boat operation, service
change, deployment, agent or other worker was launched. No box was assigned;
external lifecycle stays with the coordinator.

The canonical A/W wrappers capture API identity at their own entry. A bounded
host-owned token accompanies the invocation; a call explicitly parked on its
intact frame retains that token for retry. Hook creation explicitly binds the
token to the existing typed continuation context. Keyboard and WH_GETMESSAGE
continuations consume that binding, restore the caller result/ESP/EIP and hook
ownership, and complete after final guest MSG mutations, before returning to
guest execution. Keyboard completion can transfer the same token to a later
WH_GETMESSAGE continuation. Nested wrappers save/restore the outer active token.
No guest stack/context fields, MSG bytes, pump/dequeue/Dispatch behavior or hook
ordering were changed. A no-argument API exit remains explicitly unqualified.
Frame identity is used only to resume an explicitly parked invocation; register
or return-address coincidence never creates a completion.

Five default-off imports, per-instance globals, one main-instance setter and
disabled shared-host defaults provide the wire. The generated worker import
table contains 295 imports: all 290 original signatures unchanged plus the five
new signatures. The exact installed canonical generator parser was applied to
every import declaration extracted in include order from the verified 127-part
source closure. Its full tool/parser hashes and closure hashes are retained.
This is source signature checking, not compiled import validation. The setter is
deliberately absent from worker inheritance. It is installed before the real
runner's initializer path, but that real path has not executed in this task.

The JS observer reads the final MSG only on a meaningful return: GetMessage >=0
(including WM_QUIT), PeekMessage !=0; failed/empty returns carry null MSG.
GetMessage has no remove flags; its removal behavior is explicit. Existing
128-record/64KiB output limits, reserved saturation marker and paused/armed
budget remain. A fixed 128-slot/6144-byte metadata table holds scalar ownership
only. Exhaustion/collision reports a diagnostic gap and suppresses further
ownership claims. Original callback errors propagate; diagnostic sink errors
are contained. With the canonical switch off, no completion imports/events run.
Status distinguishes installed wiring from `canonicalRuntimeQualified:false`.

Focused verification passed:

- Actual production runner installation/qualification excerpts first, including
  omitted installation, setter and qualification wires and an older module.
- Byte-exact canonical functions interpreted by the deliberately uncompiled
  fixture: all four A/W APIs, immediate/park/retry, stale/unrelated exits, final
  WH_GETMESSAGE mutation, keyboard-to-message-hook handoff, nested deferred and
  synchronous callback ownership, empty/error/WM_QUIT results, duplicate tokens.
- Independent no-op omission challenges for actual immediate completion,
  keyboard bind/resume/complete, message-hook bind/resume/complete, and the real
  canonical park wire's retry identity.
- Diagnostics-on/off memory, stack, result, control and callback-order equality;
  original pump exception identity and failing observer/sink containment.
- 96 comparisons against retained exact original production functions, across
  A/W, immediate/park/keyboard/nested, hooks and result values. These compare
  guest memory, caller state and continuation order with diagnostics off.
- Output/ownership bounds, explicit saturation, source-fragment balance and the
  exact canonical import-signature delta. Affected legacy diagnostic production,
  limits and noninterference groups also passed after their harness gained the
  real installation dependency. Earlier renderer/dequeue/Dispatch evidence is
  reused by hash; it is not new runtime evidence.

The function fixture explicitly supplies pump/hook dependencies. It does not
compile, instantiate or qualify the canonical module, and it cannot prove
thunk/decoded dispatch or real guest callback execution. Those gates remain.
The unchanged emitter functions and earlier real renderer evidence are bound in
reused-evidence.json. Per-group receipts and checkpoint.json name exact fixture,
function and source hashes and remaining work.

Inputs are immutable source239 revision
`754c97d3ff22ce0a0cd06d08ac06dc0446fbcbb2` plus partial JS parent
`40699f72bef9b5339c5371d9bdc0dd6e0efb8b25`. Only selected source, local commit/tree
objects and required parent blobs were recovered. No missing blob was retried,
no broad checkout/assets or donor alternates were used. This evidence-parent
branch adds source files that its ancestry lacked. **Do not replace main with
these donor whole files.** Decompress completion.patch.gz and apply/reconcile
the minimal delta against the separately reconciled production tree. The WAT
and host baseline is source239; the JS baseline is the partial parent. Its
earlier diagnostic delta remains a separate prerequisite. Generated signatures
must also be regenerated against the final reconciled closure.

Reproduction uses the retained ops.tar.gz supervisor scripts. `python3
ops/run-group.py GROUP` supports production, continuations, challenges,
noninterference, limits and baseline-semantics; it acquires one shared light
permit before supervision. Installed Node24.18.1 uses heap64, DATA/AS unlimited,
physical aggregate128MiB including supervisor/descendants, CPU90, wall120,
file24MiB, output2MiB, excerpt8192. Git acquires two permits before the exclusive
Git lock; its DATA512MiB applies only to the Git subprocess and its physical
aggregate is256MiB. Trusted SSH identity/known-host settings are unchanged.
Startup inherited limits, actual executable and launch flags are retained.
Passing sampled peaks include baseline132173824B and limits127864832B; these
are sampled measurements, not continuous maxima.

Two real physical-memory stops remain: first signature preparation144498688B,
and repeated baseline AST preparation (exact measurement in its receipt).
The former was split into closure hashing plus small exact import declarations;
the latter caches immutable parsed functions. Coverage and physical limits were
not reduced. The unchanged first reproducers and failures are preserved. An
owned disk-projection error double-charged bytes already deducted from current
free; its rejection and correction remain. Full measured own allocation stays
within96MiB, including selective Git/source/evidence/publication, launcher,
session, positive WAL growth once, future16MiB and reserve8MiB. Current free
subtracts remaining growth; the 2982150144B floor is unchanged. Actual other
resident clients are already reflected in MemAvailable; future64MiB each is
reserved once, with host768MiB and shared execution256MiB. There is no individual
client RSS stop. Original platform denials, guest timeouts and the coordinator's
old erroneous128MiB individual-client policy are retained in historical evidence.

Next gate: independent review of this exact delta, followed by a separately
authorized coordinator-owned Boat build on the reconciled source: run
`node tools/gen-host-import-sigs.js --check` and `bash tools/build.sh`, then qualify
the exact resulting module/runner through real initializers and thunk/decoded
CALL/JMP, immediate/park/retry, keyboard/WH_GETMESSAGE and nested callbacks.
Include omitted-completion controls and the existing step-completion gate before
any Enigma input. No such command or runtime is authorized by this result.
