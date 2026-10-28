# Original Morrowind Name observer

Source-only implementation on predecessor `6ca7f90522100f3474de6b5264364b7f96110b09`.
No original guest, browser, Boat, canonical module build or transport replay ran.
No historical Codex-to-cox cause is inferred.

`test/run.js --observe-morrowind-name` enables the optional observer. Without
that exact flag the module is not loaded, no EIP wrapper is installed, no API
logger is armed and no observer output is produced. It rejects parallel workers
and an existing EIP trace. The supported execution context is the main instance;
worker-instance observations are not implemented. This flag is instrumentation,
not authorization to execute original media.

The import wrapper is installed before WebAssembly instantiation captures its
function references. Attachment follows `stageAndLoadPe` and precedes DLL guest
initializers. Attachment checks the complete original EXE size/SHA-256, six
relevant interpreter source blob identities and loaded instruction anchors.
Relocation is deliberately fail-closed: only verified preferred base `0x400000`
is supported. These source checks do not prove a prebuilt wasm module's provenance;
a separately admitted full-runner acceptance must bind that module to this source.

The actual production COM ordinal decoder calls the observer after resolving
the API name. Every API entry/exit has a per-thread nested frame (depth limit32).
Matching `IDirectInputDevice_GetDeviceData` requires return `0x406926`, stride20,
flags0, input count1 and the original caller's exact output stack layout. Each
frame retains its unique invocation ID, thread, device, return boundary and
builder generation. `pollCallerReturn` distinguishes UI poll caller `0x58072b`
from other original callers such as `0x5adc52`; only the UI caller can authorize
the translation/Name callback chain.

`09b-dispatch.wat` calls `log_api_exit` after result storage and nonvolatile
restoration, before `06b-core-handlers.wat` returns to the run loop. This is the
output snapshot, before the next guest instruction. HRESULT and returned count
are always recorded; the five20-byte-event dwords are read **only** for HRESULT0
and count1. The subsequent `log_eip(0x406926)` confirms the same ESP/result before
the guest's HRESULT test. Repeated return-boundary hits cannot reuse a delivery;
a new poll entry invalidates the old token even if another diagnostic disables
the API logger. Trace arming forces block transfers through the run-loop desk
and disables tiers that would hide those block boundaries.

Builder return `0x5e672d` captures EAX before the guest copies it into EDI.
Translation `0x5807c2` captures EAX, UI destination, shift and modifiers.
Callback `0x638050` additionally requires the same thread, poll token, character,
key event ID and Name target pointer. A callback consumes that token. A new
builder generation or observed submission terminates the old association.

The interior CALL at `0x6385e6` is **not** a block-entry hook. The supported
pre-write observation is setter entry `0x5726c0`, requiring ECX=Name target and
saved return `0x6385eb`. It occurs before any setter guest instruction and labels
both its actual PC and logical callsite. The post-setter snapshot at `0x6385eb`
requires the same callback and setter ESP plus20 (`ret 0x10`, not `ret 4`). Raw
text object/pointer/length, up to31bytes and a bounded cursor position are read
directly. No guest text getter, write, input injection or replay occurs.
`0x6385ff` is a shared epilogue, reached both from rejection branches and after
a successful setter; its record explicitly does not alone prove rejection.

Limits are127 ordinary records plus one explicit overflow record, then no more
observation. Bad reads or diagnostic sink failure stop observation without
propagating an exception into guest execution. The API nesting limit also stops
observation explicitly. There is no unbounded record queue.

## Verification and limitations

Run the focused contracts with the original read-only executable:

```sh
node --max-old-space-size=320 tools/probes/morrowind-name-observer-contracts.js \
  /READ_ONLY/installed/Morrowind.exe
```

The test executes the exact production IMPORT/ATTACH regions, complete `h.log`,
`h.log_i32` and `h.log_api_exit` function source in isolation, recording the runner
and transformation hashes. It checks initializer-route ordering, uses the real
ordinal name decoder and tests actual installed hook functions. These are
synthetic source contracts, **not full-runner or original game execution**.
Controls cover disabled defaults, matching/nested/other-caller invocations,
wrong thread/target/generation, failed HRESULT/zero/excess count with stale
outputs, loaded-code/source identity, relocation, pointers/length/truncation,
overflow, shared epilogue and return-token invalidation. A mutant accepting
failed HRESULT records is rejected. Delivered five-character, missing-d and
complete-then-changed fixtures retain distinct records.

Reuse predecessor20static anchors and22negative controls unchanged from
`scratch/usage-watch/morrowind-name-consumer-cause-oct28/receipt.json`; the static
probe and report were not edited or rerun. The old17-message transport group was
not run. Exact final contract hashes/results and resource/cleanup/publication
receipts live in the task canonical receipt.

Two observation limits remain. Builder generation and observed submission do
not prove arbitrary destruction/reuse lifetime; no destructor hook exists in
this observer. The next poll can sample text changed since the last setter,
but the available hooks cannot retain the **first arbitrary later writer** or
its PC. A changed sample reports `firstWriter:null`; an overwrite restored
before the sample is invisible. No synthetic control claims otherwise.

The first still-unobserved original boundary is the matching buffered keyboard
completion at `0x406926` itself. Next gate: independent acceptance on the exact
production runner and source-matched retained module, including initializers,
before any separately authorized original-game run. Full runtime readiness is
not established by this source-only task. A writer diagnostic or destructor
coverage needs a separate bounded assignment if required by that gate.
