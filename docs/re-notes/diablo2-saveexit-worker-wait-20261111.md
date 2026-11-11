# Diablo II native SaveExit worker wait, 2026-11-11

Run: `scratch/runs/20261111-diablo2-native-saveexit-worker-wait-1910/`.
The runtime stall is unresolved. No speculative guest, save, scheduler or sound
change was made. This note records the narrowed causal boundary and the exact
comparison that replaces the parent's invalid mixed fixture.

## Identity and comparison

The source/host closure at `a70573e009ca17e46b74de8b3e548a70ba7442cd`
produces the published repair's standard module
`1165f15cb29fa4ff4b67621f3ce66f8df68fb50baea929d0b76e9b2f66118135`.
The locked build passed. Relevant tracked runtime sources match repair
`7c985edcc8eb8c23e7f2b64ba8b0d6f2eb177bad`; the closure manifest also pins
untracked `lib/wininit-boot.js`, recorded as a patch rather than a source archive.

Rebuilding with only `src/09a8-handlers-directx.wat` replaced by its Git
`3dc8bb1103f960b476021e4e5da18f11f452e6d3` version reproduces the exact
baseline standard module
`5512a65e2ce88cc76b39b3246d35f13919d9df060d3670a9a85cae9c4100f638`.
The unchanged surface ABI test, consuming each exact standard module through
`bootRenderHarness({prebuiltModule})`, fails on baseline at “final Release makes
wrapper space reusable” and passes on repair. Source-compiled surface ABI and
wrapper-pool sizing tests also pass. This validates wrapper reuse, not a
SaveExit repair. No native before/after SaveExit claim uses the mixed fixture.

## Causal boundary

The parent's stalled main EIP `0x0143b310` relocates to Storm
`0x6ffc9310`: an infinite WaitForSingleObject on a job-completion event.
`0x0e000f58` is in the host's generation-tagged synchronization handle domain;
it is not a worker-thread join handle. The originating Storm path creates a
manual-reset, initially nonsignalled event. In the new run, passive import
traces show main creating/waiting on these events and worker1 signalling them
from `0x01437c5e` (`Storm+0x15c5e`). Full sequences are retained in
`successful-event-chains.json.gz`, with original-byte hashes in
`own-closed-compression.json`.

The parent's worker1 exit had EIP zero, previous decoded blocks
`0x01438da1` / `0x01438d90`, EAX/ECX zero, ESI `0x0923016c`,
EDI `0x0923018c`, and ESP `0x7effffa0`. Disassembly identifies the block
as Storm's streamed-audio `IDirectSoundBuffer::Lock` call: it loads
`[ESI+0x28]` into EAX, its vtable into ECX, pushes eight arguments and calls
`[ECX+0x2c]`. The stack depth and registers fit a null buffer call before a
COM handler is entered, rather than evidence of a wrong Lock epilogue.
This is a leading hypothesis from the captured registers and unedited DLL
bytes, not proof of the pre-call values: an API call can change EAX, and a bad
return or interpreter corruption is not excluded. The parent did not capture
the pre-dispatch object memory or any writer clearing its buffer field.

The worker also services file jobs. Its loss can strand a later completion
wait, explaining why saved files can coexist with a frozen options screen.
It does not establish which write invalidated the sound-buffer pointer, or
whether the wrapper repair indirectly affects timing. Artificially signalling
the event would falsely report an unfinished job complete and is not a repair.

Enter/LeaveCriticalSection and sound-buffer calls were observed during the
third native cycle; primary sound-buffer pointers, not texture aux views,
were used by the streamed Lock path. The DirectSound Lock ABI consumes its
normal 36-byte frame. The aux repair only reclaims wrappers whose owner type
is zero under LOCK_DX; its new writes target the dedicated aux/refcount arenas.
These inspections do not exclude a lifetime or synchronization race elsewhere.

Passive pre-detach and post-slice worker observers preserve the stack, object,
buffer and sync ring on a recurrence. Their instrumentation can perturb timing.
The second observer setup installed successfully but failed while writing an
already-existing evidence filename; a separate read-only check confirmed both
observers armed on all three guest workers. It was not replayed.

## Native checkpoint and limits

The complete inherited XP296/life46 four-file set and the separate older
XP260/life66 set remain byte-identical. Akara healed the XP296 character through
native input. Four SaveExits completed normally; five same-process Loads
reached camp. Native character panels after the fourth and fifth Loads verify
XP296/life66. Additional sound/critical-section logging was removed before the
fourth SaveExit; passive sync and exit observers remained enabled.
The new complete `healed296-save/` set has a 753-byte D2S with SHA-256
`e51c394a482f65de379192b28bf5de45bea1798ac37537f56a42c1e0eec17fd9`.
The later complete `field296-save/` set has the same D2S and a 7,830-byte
`samehero.ma0` (SHA-256
`04a751c98f3a497536db8784217729e62a2ebde7aa033ccbed911665d3da6e9c`).
Native Blood Moor exploration added map coverage; no further XP or Den entry
was achieved. The fifth Load verified this latest checkpoint.
Each native full image was inspected after its delivery finished and before a
separate input call. Three stale-scene inputs were refused before dispatch with
zero effects; fresh captures were reviewed before separately named inputs.
A final capture request omitted its required label and was rejected by the
client validator before publishing any command. A new capture succeeded.
The parent's image-review batching deviations remain explicit in its
`review-corrections.json`; this run does not retroactively qualify them.

Final native route, checkpoint, recovery and box-stop results are recorded in
the run's `RESULT.md` and `RECOVERY.md`. The next causal experiment needs the
writer/lifetime transition of the streamed job's buffer field before the null
call, alongside the exact completion handle and section owner. A passing
repeat alone must not be called a causal SaveExit fix.
