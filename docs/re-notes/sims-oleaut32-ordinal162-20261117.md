# Sims OLEAUT32 ordinal 162, 2026-11-17

Evidence: `scratch/runs/20261117-sims-oleaut32-ordinal162-native-typelib-install/result.json`.

The pinned genuine OLEAUT32 (`baeb2f7c1b8be56738d34e1d1ddf8e0eebd3a633215dc1575e14656be38b939d`)
exports LoadRegTypeLib at ordinal 162, RVA `0x124df`. Both the native system
ordinal resolver and host fallback now bind it to existing API 3317. Aliases
and unsupported-ordinal failure retain their existing behavior. No provider
implementation was copied. The handler consumes five four-byte stack slots
plus the return address and preserves the native HRESULT/output contract.

The focused regression loads actual x86 PE fixtures importing only OLEAUT32
ordinal 162, including a stripped OriginalFirstThunk case and mixed DLL case.
The guest import call site jumps through the loader-populated IAT. Public
LoadLibraryA/GetProcAddress resolves ordinal and named thunks to the same API;
distinct thunk addresses are allowed. Real native calls cover registered Sims
SLTG (87 types), genuine recovered BW2 MSFT (209 types), builtin stdole 1/2,
Sims' imported IUnknown reference, exact locale and missing-locale behavior,
neutral registry fallback, missing versions/library/files and null arguments.
Checks include output clearing, HRESULTs, stack canaries, exact stdcall ESP,
AddRef/Release, and ITypeInfo keeping ITypeLib alive until its last release.
Each PE gets a fresh emulator process instance: reusing an initialized instance
for a second load_pe was rejected as fixture contamination. Genuine Automation
providers are absent from the execution VFS; host inputs remain unchanged.

The first published binding is `6e5d1e31daa7eb8e10729b9d68caaccba9ce1198`.
Its native proof and locked canonical build pass. Unchanged reader/Invoke,
783 continuation (14 native cases), input guards and BW2 parser evidence is
reused only after exact hash verification, without blanket reruns.

## Single normal original and final ABI correction

The one authorized original used compatibility module
`a419f7b62708714ba5486d8364280049efccf4f6326fa0d9e56109a2a8e7df92`.
The independent deadline watchdog was armed before launch; exclusive native
listener identity was checked before HTTP. Normal media, real ticks, registrar
and embedding sequence were retained. The registrar exited 0 and merged 293
keys. Activation succeeded, and native LoadRegTypeLib calls reached S_OK.
There was no ordinal fallback trap. Automation method 4 returned E_NOTIMPL
(`0x80004001`) with `D:\Setup\data1.hdr` in its response packet, and the
parent displayed a support-file error with that HRESULT. The exact cause of
this method failure is not established by the response packet alone.

The complete error image was personally reviewed and bound. The next fresh
complete image was entirely teal, so the run became terminal UNKNOWN before
any physical input. No later HTTP requests occurred. Host cancellation then
completed actual parent, registrar and embedding waits with exit 0 and both
EOFs; all five main/worker provider exit audits are present. No forced child
kill or missing exit-only provider audit is claimed. Host cancellation is not
native Quit or successful installation.

Offline logs also exposed real ordinal calls with version stack slots
`0x074f0001`/`0x074f0000`. Their upper halves are unspecified for the API's
WORD parameters. The original handler compared full dwords, incorrectly
returning TYPE_E_LIBNOTREGISTERED. The final repair masks both versions to
16 bits before the unchanged native loader. Disassembly of the pinned genuine
export confirms a word access to the version argument. The expanded native
regression first fails against the original-run module, then must pass against
the final module, with exact observed upper halves on both static and dynamic
paths. Final publication/build identities are recorded in result.json.

The final WORD correction was not tested in another original: the single
allowance is spent. Actual Sims installation, native Quit, the separate
non-Automation provider issue and full T-db74d863 (including full BW2/IS11
setup) remain open. No workers, boxes, deployment, media copies or source-tree
archives were created. Foreign WIP, including the ThunkConnect32 comment, is
preserved and excluded from publication.
