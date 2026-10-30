# Complete-module callback trace qualification

Candidate `207d55bed24c2ef1cd822a0d365b20207359cb14` passes actual production
audio callback admission, synthetic x86 `RET 20`, and `CACA000A` restoration.
The complete canonical module SHA256 is
`b239bf69a08c38e6d2edbe63ce356e338da67cd480936f3a3d72266591a94fe9`.
Compilation uses production `compileClosure(watxSourceClosure(), {tailCalls:true})`,
whose pinned implementation enforces standardWat=true, strictDeclarations=true,
runtimeBuiltins=false. No selected-function extraction or production edits.

`callback.js` loads one minimal synthetic PE using production `load_pe`, resolves
its real midiStreamOpen thunk, and calls it through exported `run` and production
Win32 dispatch. The real audio host registers the callback and produces three
open notifications. Its cooperative pump admits callbacks through actual Wasm
exports. Each callback executes the PE's `C2 14 00` bytes, reaches a thunk whose
tag is asserted to be CACA000A, and dispatches that continuation in a separate
bounded `run(1)` slice.

`lifecycle-report.json` records two traced invocations with distinct serials 1
and 2. Each returned serial equals its admission serial. EIP=0x401000,
ESP=122679420, EAX=0x11223344 and all exported wait-context fields are restored.
The second invocation preserves supported yield reason/flag 1/1; wait handle,
handles pointer and wait-all are zero, timeout is -1, stack bytes 12. This is
synthetic supported context, not an actual semaphore/wait operation. The third
callback runs with tracing disabled and leaves the complete trace unchanged.
Nested admission returns zero without changing trace, registers or wait state.

The executable negative control withholds the actual CACA000A dispatch after
the second actual RET20, then applies the unchanged restoration oracle. It
fails because active serial 2 remains nonzero. Dispatch then occurs and the
same oracle passes. No source, trace export or host implementation is stubbed.

The first attempt passed both traced callbacks but failed before the third
API call: the synthetic caller retained restored yield flag 1. The fixture
correction clears yield state when beginning each new synthetic API call.
`first-fixture-failure.json` preserves that first failure. Only the callback
group was repeated because its process owns initialization and registration;
the passing compile/startup groups were reused. The final report is from the
corrected executable bytes pinned in `artifact-manifest.json`.

The fixture has 512MiB shared host memory, a synthetic clock, recording TinySynth
and AudioContext backend, no audio hardware, and fail-closed unavailable host
imports. It uses the real production audio host, without a fake ThreadManager.
It does not qualify original Enigma, gameplay, a browser, semaphore behavior,
physical audio, or an original guest binary. No Mad Bomber MIDI suite replay,
public deployment, main integration, or unrelated regression work occurred.

Before provisioning, all 165 source pins and the canonical receipt were checked:
128 recursive files, 13,499 available inherited index objects. All 165 pins
were checked remotely before compilation and again when collecting evidence.
Publication repeats the local source and complete-index availability checks.
Native API transfers use 49,152-byte chunks with exact archive hashing; there
are no mount/runner argv or checkout operations to parse. `input-manifest.json`
enumerates every archive member without comma-delimited filename parsing.

See `recovery-recipe.md`, `artifact-manifest.json`, the runtime/supervisor reports
and `boat-final-state.json` for reproduction and retained snapshot details.
