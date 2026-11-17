# Sims terminal thunk and native null call, 2026-11-17

Evidence: `scratch/runs/20261117-sims-terminal-thunk-transfer-installer-repair/result.json`.
This continues the [slot41 frame investigation](sims-slot41-native-continuation-20261117.md).
No causal production repair is established. Full T-db74d863, BW2 and IS11
criteria remain unchanged and open; installer completion is not demonstrated.

Offline, the retained module `f3568ba6cd1c1982cf3c79eebada41823dd9c3d6a21cc6ac9e48491af4ed6c19`
and map `8e15e720bcfded5902defa7e323661b824baf53ebc25de0fdcad3e8620982bf9`
load the original iKernel PE and initialize the engine COM vtables without
executing installer instructions. Thunk `0x07501dc8` is index953, marker
`0xCACA0010`, API2105 **IStream_Read**. The original PE alone allocates only
256 entries; deterministic COM-vtable initialization supplies this mapping.
The admitted diagnostic independently reads the same two engine metadata words.

The single new passive original identifies the actual terminal operation:

| Control field | Observed |
| --- | --- |
| Slot41 target | `0x004210c4`, correct native `ret 8` unchanged |
| Earlier token1018 | S_OK, exact ESP `0x074ffe88` |
| Failing token1340 | expected ESP `0x074ffe88`, terminal `0x074ff4d0` |
| Final native block | `0x0040c749`, entry ESP `0x074ff4d8` |
| Terminal instruction | `0x0040c75b`: `call dword ptr [eax+0xc]` |
| Terminal registers | EIP0, EAX0, ECX8; ESP falls eight bytes from block entry |
| SEH | inner head `0x074ff4f8`; saved head `0x074fffe8` |
| Last API identity | IStream_Read, stale across subsequent native blocks |

Pinned PE instructions after `0x0040c749` load `[esi+0xd8]` into EAX,
push the argument, set ECX to EAX+8, load `[eax+8]`, and call `[eax+0xc]`.
The final ECX8 implies that the first native object pointer was null. EAX0
and the eight-byte ESP decrease match the argument push and indirect CALL
into zero. This is subsequent guest control flow, not the IStream_Read
epilogue, an observed exception/unwind, thread exit, or host continuation
restoration. The earlier last-thunk value alone did not identify the writer.
The producer of the null native member remains unknown; this evidence does
not establish a slot ABI, ordinal201/202, stream implementation, or marshaler
repair. No synthetic success, private seed, provider bypass or guard relaxation
was introduced.

Actual native controls compare observer off/on results and deliberately fail
the observer output sink. Correct/error HRESULT, ret4/ret12, extra argument,
callee-saved corruption, trap and retirement refusal retain parent registers,
flags, FS/SEH and empty continuation frames. New authored controls distinguish
an internal IStream_Read return, an early API return to zero and ExitThread
yield2. A further authored native function returns from IStream_Read, then
calls `[eax+0xc]` with EAX0/ECX8: it retains the stale thunk while reproducing
the final block-to-terminal ESP decrease of eight bytes. Existing fourteen
native yield12 lifetime controls and stale-token/replacement-epoch negatives
are reused. One local counterexample validator initially expected a block
boundary that the fixture did not contain; an explicit native JMP boundary
corrected the fixture. No original retry resulted.

The inherited `--trace-api-mem` restriction violation remains explicit. All
inherited trace/dump options were removed, including nested child arguments,
before launch. An early preload rejects forbidden actual process/fork
arguments; four real rejected Node spawns and ten clean actual argv records
are retained. Run-local COM protocol payload logging was also disabled while
preserving child exit/EOF records. The observer retains only a bounded window
of CPU/ESP/SEH/block/engine-thunk control metadata and an API return-control
word, with unchanged native run budgets. No inherited API-memory payload was
decoded or circulated. Genuine oleaut/stdole providers remain absent from
execution; prior registrar/media/module-map/provider-absence proofs are reused.

The selected, personally reviewed whole 800x600 screenshot still shows support
file error `0x80004001`. The installed overlay remains byte-identical. An
independent watchdog was armed before launch; both actual child waits and
both EOFs precede parent shutdown. The registrar exits0; Embedding needs
SIGKILL and lacks its final main-thread provider audit. Its incomplete state
merge is refused. Parent exits0, and watchdog/supervisor/outer actual waits
finish. This is host cancellation, not native Quit or installer completion.
All known owned runtime PIDs are absent and the endpoint refuses connections.
No box was created: ID/expiry null, state NOT_CREATED, stop receipt
NOT_APPLICABLE. No workers, archives, media copies or deployment.

Next work must identify the producer of native `[ESI+0xd8]` before justifying
a repair. The one authorized passive diagnostic is consumed. No further
original or unchanged retry was run. No production code changed, so no new
canonical locked build or repaired-installer result is claimed.
