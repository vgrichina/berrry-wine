# Legacy capability early exit: missing fixture host bootstrap

The independently proven defect was in the JavaScript fixture harness:
it omitted `init_dx_com_thunks()` after `load_pe()`. The single corrected
qualification passed all **47 calls / 45 descriptors**, with the original PE,
original oracle and original production module. No production change is needed
for this failure.

## Identity and scope

- Base: `bc4e1436eeeb02f9063d75066436b20ce2f54eff`.
- Original fixture: `b7500149f3c5ea9e2322a12928e9c79807670c4d`.
- Prior failed report: `b1024face06fd50b90de56152ac5343590fef9ff`.
- Canonical source: `1262cbfcf8b5881543f2fb18c0f80b4bd9429306`.
- Module SHA-256: `bc5412c1ba338ec5b385ff77eca1aa213c156cd5d0693e1cdcbf850867f7ecd4`.
- Guest PE SHA-256, unchanged:
  `3f9b8e369226c2c3dd88e47125b41b20f9f04f00a65ec65bdb7c4e7439224637`.
- Evidence: `scratch/runs/20261020-legacy-caps-early-exit`.
- Runtime: `bx_6czhvg6m`, Node v24.18.1, existing
  `/home/user/winhelp-qualified-fullvm`; no build or installation.

## Causal diagnosis

The diagnostic used an external observer, the unchanged original fixture and
its actual x86 instructions. It advanced `run(1)` and captured registers,
object/vtable/slot values, stack words, completion and all original oracle
inputs. No COM return, pointer, descriptor, module or guest instruction was
patched. The first three calls returned, including DirectDrawCreate HRESULT 0.
Its output at `0x410044` was object `0x08221000`, whose first word was zero.

The generated instruction sequence is:

```asm
0040306a  push 8
0040306f  push 0
00403074  push dword ptr [00410044]
0040307a  mov eax,[00410044]
0040307f  mov eax,[eax]
00403081  call dword ptr [eax+50h]
00403087  mov [00410054],eax
```

This correctly dereferences the object and vtable and selects IDirectDraw slot
20. With `lpVtbl=0`, however, the call reads address `0x50`, observed as zero.
Terminal EIP was 0, EAX 0, ESP `0x429838`, versus entry ESP `0x429848`.
The stack held `[0x403087, 0x08221000, 0, 8]`: return address, this, HWND, flags.
The last observed block began at `0x40306a`; disassembly and the pushed return
address identify its terminating call at `0x403081`. This is block-boundary
observation plus instruction/stack evidence, not a per-instruction trace.
Completion remained zero. Record four remained `0xa5a5a5a5`; it is untouched
poison, **not** a SetCooperativeLevel HRESULT.

At canonical source `1262cbfc`, both `host.js` and `test/run.js` call
`init_dx_com_thunks` after loading the PE. The DirectX implementation explicitly
documents this host initialization requirement. Its generated initializer sets
`DX_VTBL_DDRAW` using `init_com_vtable(978,23)`. DirectDrawCreate passes that
global to `dx_create_com_obj`, which writes it into the wrapper's first word.
API dispatch's worker-vtable synchronization restores existing shared registry
entries; it does not replace initial host construction of that registry.
The fixture skipped the construction step. Exact line-numbered excerpts are
preserved in `implementation-excerpts.txt`.

The [DirectDrawCreate contract](https://learn.microsoft.com/en-us/windows/win32/api/ddraw/nf-ddraw-directdrawcreate)
requires a valid IDirectDraw pointer on success and documents the explicit
LoadLibrary/GetProcAddress route used here. The
[SetCooperativeLevel contract](https://learn.microsoft.com/en-us/windows/win32/api/ddraw/nf-ddraw-idirectdraw7-setcooperativelevel)
allows null HWND with DDSCL_NORMAL. The previously recovered public headers
and independent slot/ABI review remain the slot-20 reference. No invalid
PUSH order, vtable displacement or stdcall cleanup was found in these emitted
instructions. The null pointer arose from omitted emulator host bootstrap,
before this valid public call could execute.

## Correction and regression evidence

The functional change is exactly one bootstrap call after successful load_pe
and before guest allocation/execution. Additional observation fields retain
terminal ESP, previous EIP and resolved output objects/vtables/slots. The
fixture generator, `verify()` and synthetic negative controls are byte-for-byte
unchanged; no expected mask or call/descriptor assertion was weakened.

One diagnostic and one corrected qualification were executed, each guarded
by `timeout --kill-after=5s 120s`. Diagnostic receipt `cmd_` details are retained
in `execution-transport.json`; qualification details are in
`qualification-transport.json`. Qualification ran at 13:33:01–13:33:02 UTC,
exit 0:

| Evidence | Baseline diagnostic | Corrected qualification |
|---|---|---|
| DD object | `0x08221000` | `0x08221000` |
| DD vtable | 0 | `0x0041986c` |
| Slot 20 target | 0 | `0x075001d8` |
| Returned call records | 3 / 47 | 47 / 47 |
| Completion | 0 | 1 |
| Entry / terminal ESP | `0x429848` / `0x429838` | `0x42b958` / `0x42b95c` |
| EnumDevices counts | 0/0/0/0 | 3/3/2/1 |
| Original oracle | expected failure at record 4 | PASS |

The corrected outer RET restores the expected `stack-16`; each call's recorded
ESP equals entry ESP. All 45 descriptor assertions, 55 guard pairs, public
outputs and callback contexts passed. Texture masks remain `0xf7df`, filter
masks `0xc3` / `0x030003c3`, address mask `0xf7`, and Device7 operations `0x3ff`.
The independent offline replay verifies baseline failure and corrected success
from recovered words, plus identical PE and oracle and 1,053 synthetic negative
controls. Offline controls are distinct from the two actual executions.

```sh
node scratch/runs/20261020-legacy-caps-early-exit/verify-evidence.js
node test/test-legacy-texture-caps-native.js --offline
node --check test/test-legacy-texture-caps-native.js
git diff --check
```

Preflight checked accessibility, disk, all 6,441 canonical source identities,
module hash and existing host dependencies. Postflight verified those source
files, all 29,620 files in the previous preservation manifest, original fixture
pins and archive hash; no task execution process remained. Evidence was
recovered before runtime release at 13:34:28 UTC, leaving the box running with
TTL 15:53 UTC. Local task expansion is below 6 MiB and disk remains above
2 GiB + 60 MiB. See `RECOVERY.md` for exact references without duplicate module
or archive storage.

This qualifies the public COM capability fixture on the pinned emulator
module. It does not qualify Windows-native behavior, rendering or gameplay.
No screenshot, per-instruction trace or engine-native disassembly was captured;
those artifacts are explicitly unavailable. No production changes, main
integration, workers, build/install, browser or laptop activity occurred.
