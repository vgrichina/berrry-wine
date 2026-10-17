# Outlaws original demo: PM/Pro loader boundary

Source-only diagnosis, 2026-10-15, base `8597f63298412b1d2aaa7cb15f10473f97c263ed`.
No emulator, full build, native fixture, browser, remote command or game rerun
was performed. No production behavior changed. This is a substantial missing
Win32-to-Win16 facility, not a missing UTRegister stub.

## Evidence identity and limits

The preceding original startup is controller 173098, documented in
`docs/outlaws-oemkeyscan-native.md` on commit
`76db09760c71373f2291774dcf8ef004045bdc3d`. It reached the PM/Pro KERNEL32-link
dialog at batch 29 and required its existing watchdog. No menu or gameplay.
Its independent postflight found no active process and unchanged inputs.

Only the original Outlaws copies were inspected here:

| File | Bytes | SHA256 |
| --- | ---: | --- |
| pmpro62.dll | 18890 | 7e2b17e61e7e4808a50478ddcac06f65fcf9f3ffd741d747c8cb75e20cb05db9 |
| pmpro62f.dll | 28672 | b3d0c91bb701f5ff9707702a63d5b7eaab4bfdd19086b4d251dbefe9a60bd4a8 |

Recovery: shared
`scratch/runs/20261015-outlaws-oemkeyscan-native/original-loader-fixtures/`.
The original remote payload and acquisition recipes are retained in the prior
report. Hexen II's trace-only restriction was read and respected: no Hexen II
binary was examined. Its similar dialog is only historical context.

## Exact failing branch

Addresses below are **preferred PE virtual addresses**, not the relocated run
addresses. PMPRO62F has image base 0x400000 and entry RVA 0x10000.

1. Attach routine 0x410f63 calls 0x410f45. That helper reads GetVersion and
   tests whether the low-byte major version is at least 4. The true branch
   calls 0x41112f; the false branch at 0x41107e calls imported UTRegister.
2. At 0x411136 it passes the string KERNEL32 to GetModuleHandleA.
3. It calls its own function 0x4110d8 three times, with that handle and
   ordinals 35, 36, 37. This helper directly reads MZ, PE, export-directory
   RVA, NumberOfFunctions and AddressOfFunctions, subtracts one from the
   ordinal and returns the selected EAT address. These three lookups do
   **not** call GetProcAddress.
4. At 0x411176 it calls GetProcAddress(handle, "QT_Thunk"). It requires
   the handle and all four resulting pointers to be nonzero. Any failure
   returns zero at 0x4111b0.
5. The caller's zero branch at 0x410fae displays the exact observed string
   at 0x4200ec, "Unable to link to KERNEL32.DLL!".

The three ordinals correspond to LoadLibrary16, FreeLibrary16 and
GetProcAddress16 in the [Wine KERNEL32 export specification](https://github.com/wine-mirror/wine/blob/master/dlls/kernel32/kernel32.spec).
Their subsequent uses independently agree: 0x410fcd loads PMPRO62.DLL;
0x411001 resolves FLATTHUNK; failure/detach uses the free function.

After successful linking, 0x411039 invokes helper 0x4111c0 with operation
1000. That helper reserves 0x40 stack bytes, saves EBX/ESI/EDI, pushes the
operation, puts the far FLATTHUNK target in EDX and calls QT_Thunk. The
caller consumes AX as a shared-memory segment and shifts it left four.
Detach invokes operation 1001 before FreeLibrary16. None of these subsequent
operations was observed to execute in the failed run.

## Current source mismatch

`src/09a0-handlers-base.wat:$handle_GetModuleHandleA_locked` explicitly
represents native KERNEL32 with the main executable's image base. That makes
the direct EAT walk inspect the executable, not a KERNEL32 module image.
Adding ordinal handling only to GetProcAddress would leave this path broken.

QT_Thunk is absent from `src/api_table.json`. The current GetProcAddress
fallback returns NULL for unknown names, which independently makes this
link check fail. Exact values in the three EAT output slots were not captured;
do not claim that all three were individually observed to be NULL.

UTRegister and UTUnRegister are also absent, but they are used by the other
version branch. Adding them cannot repair the observed branch. Changing
GetVersion would change the selected compatibility path and is not a fix.

`lib/dll-loader.js:loadWin16Dlls` only stages modules for an already Win16
task (`is_win16()`), and `src/08c-ne-loader.wat` supplies NE segment loading.
Existing `src/09e-win16-api.wat` generic thunk helpers are the opposite
direction and specialized W32INST helpers; they do not supply QT_Thunk or
Win32-callable NE module lifecycle. Merely permitting NE bytes through the
PE loader would not provide module initialization, far export resolution,
selector/stack context, or return handling.

## Next implementation and validation boundary

Implement and test the general facility in stages before another game run:

1. Give emulated KERNEL32 a stable, readable PE module identity and real
   export table consistent with GetModuleHandle/LoadLibrary/GetProcAddress.
   Cover direct EAT reads and executable export separation with a synthetic
   PE fixture. Preserve existing imported API behavior and module lifetime.
2. Implement LoadLibrary16/FreeLibrary16/GetProcAddress16 on the NE loader
   with initialization, reference counts, named/ordinal far exports and
   failure cleanup in a Win32 process. Test synthetic NE modules, duplicate
   loads, unload/reload, failed initialization and missing exports.
3. Implement the QT_Thunk calling ABI and restore the complete 32-bit caller
   context after 16-bit execution. Test EDX far target, stack arguments and
   cleanup, AX/DX results, nested callbacks, segment state and failure paths.
   [Wine's thunk implementation](https://github.com/wine-mirror/wine/blob/master/dlls/krnl386.exe16/thunk.c)
   is a reference for the ABI, not code copied into this repository.
4. Only then assess the NE partner's real shared-memory and subsequent
   hardware-service needs. The present finding does not establish that
   thunk support alone will make the renderer run.

No success-return stubs, excluded DLLs, OS-version substitutions or fabricated
export addresses are appropriate. Runtime validation requires a fresh root
grant and sole-box preflight. Before that run, update the bounded startup
controller to recognize `Error: DLL initializer did not return` (currently
not matched by its crash regex); retain a hard watchdog since cooperative
quit already failed in this state. Pin the new source/module independently.

## Reproduce the static checks

From the repository root, with the recovered original copies above:

```sh
sha256sum scratch/runs/20261015-outlaws-oemkeyscan-native/original-loader-fixtures/pmpro62*.dll
objdump -h scratch/runs/20261015-outlaws-oemkeyscan-native/original-loader-fixtures/pmpro62f.dll
objdump -d -M intel --start-address=0x410f45 --stop-address=0x4111e0 scratch/runs/20261015-outlaws-oemkeyscan-native/original-loader-fixtures/pmpro62f.dll
strings -tx scratch/runs/20261015-outlaws-oemkeyscan-native/original-loader-fixtures/pmpro62f.dll
rg -n 'QT_Thunk|UTRegister|UTUnRegister|LoadLibrary16|FreeLibrary16|GetProcAddress16' src/api_table.json
```

The final search has no matches at the diagnosed source revision. SHA256,
section layout, branch disassembly and exact strings were checked locally;
`git diff --check` validates this documentation change. No conformance or
runtime test is claimed for an unimplemented bridge. There is no Outlaws
candidate-corpus entry, so no result was attributed to another candidate.
