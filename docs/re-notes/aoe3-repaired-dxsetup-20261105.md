# AoE3 repaired DirectX setup — 2026-11-05

The one genuine setup session **progressed past the repaired administrator
query and entered genuine DSETUP**, then failed because
`kernel32!GetNativeSystemInfo` was absent. That export is now implemented using
the emulator's existing native x86 system model and covered by a regression.
Setup has not been retried with this second repair. Completed DirectX
installation and original player-controlled AoE3 gameplay remain unproved.

The [predecessor](aoe3-genuine-dxsetup-20261105.md) repaired the earlier missing
export, `advpack!IsNTAdmin`, in
`fb256f9f6456e1d790e9fe0813adaec28cdadc35`. Its genuine setup failed before
DSETUP entry, wrote two logs, and left 73 registry entries unchanged. There is
no setup-produced installed DirectX state to borrow or claim.

Evidence is `scratch/runs/20261105-aoe3-repaired-dxsetup/` (ignored). The single
XP-profile `DXSETUP.exe /silent` session reused the existing complete 146-file
setup at `scratch/game-media/aoe3-dx9c-20261105/feb2010-complete/` and the
predecessor's actual final registry and three-record overlay. Only its two
tiny actual logs and directory metadata were seeded into the owned overlay;
the base media was mounted in place. No extraction, download or repeated
whole-media verification occurred. The redist pin remains
`f6d191e89a963d7cca34f169d30f49eab99c1ed3bb92da73ec43617caaa1e93f`;
current trust/revocation remain unknown.

## Gate, closure and actual module

Preparation remained source-only until Conan1935 FINAL 18:16:14Z, Aranna1945
FINAL 18:31:58Z and legacyADD1955 FINAL 18:41:45Z. Independent
`release-gate.json` passed: 353 recorded PIDs absent, 145 ports refused, 38
profiles absent, four locks free, no heavy processes and free disk above 5 GB.

Cheap current boot/font/native-DLL closure checks and the exact import audit
preceded a successful full build under `flock /tmp/wine-build.lock`. The three
setup-module hashes match the existing pins. COMCTL32 ordinal 17 retains its
`InitCommonControls` mapping. The stricter import audit found two unsupported
dsetup32 static imports omitted by the predecessor's summary:
`GetPrivateProfileSectionNamesA` and `SystemTimeToTzSpecificLocalTime`. These
remain explicit gaps; neither was the observed terminal failure. The initial
overly strict audit assertion and the corrected audit are both retained.

`isntadmin-repair-source.json` proves the handler exactly matches `fb256f9f…`;
the fresh include closure also contains its dispatcher call, and both retained
shipped binaries contain the correct API hash/ID row. Actual setup used main
`d356b2505f99499673b4652bde6adb7afdf642fc`, with an empty relevant tracked
production diff. The standard module was 2173611 bytes, SHA-256
`144d156bec9e4be2654fafeb67d9bf9b6746d514ee83348e2f401547aa7ff4a4`.
`tested-modules.json`, `runtime-source-hashes.json`, the relevant binary diff
and small untracked-source patch identify the inputs. Git is the source archive;
no source-tree archive or repeated media copy was made.

## Genuine progression and first failures

`setup-process.json` records the exact production-runner command, PID 3240945,
and host execution 2026-11-05T18:43:55.531196Z–18:43:56.300699Z. The run-owned
adapter records frozen baseline/final inventories and suppresses bulk VFS
export copies; the production writable overlay journals actual writes.
The predecessor's 73-entry final registry was imported once before execution,
never restored afterward. `/silent` is the previously documented option;
silent license handling was not visually observed.

Both actual administrator queries return true. The passive counter records
one hit at genuine DSETUP!DirectXSetupA `0x0118806d`, compared with zero in the
predecessor. Actual logs show DSETUP's entry and `SetupForDirectX()` starting,
then the installer's own `Installing on WinXP SP2` branch.

The first new lookup failures are SFC ordinal 8, ordinal 9 and
`SRSetRestorePoint` (API calls 2013–2015). Setup logs `LoadSfcDLL()` failure
and continues. Those are preserved as the first observed misses; no SFC or
restore/protection behavior was changed. The subsequent terminal failure is
API 2375: `GetProcAddress(kernel32, "GetNativeSystemInfo")` returns zero.
The actual error log reports error 127, then `IsIA64(): Unable to initialize
CKernel32`. Setup finalizes phase 0 with value -9, internal/unsupported error.
The guest calls `ExitProcess(0xfffffff7)` (-9); host runner exit zero is not
installation success.

Only the inherited logs changed: `directx.log` is now 1356 bytes, SHA-256
`ef568d1aaa460494103d47cb79b98d98c31ef17969feb3a61399ab8ca0291f14`;
`dxerror.log` is 1116 bytes, SHA-256
`98f446ca7bcaa84e7c9616b3671416142c32c73095de56c1f7f598dfa0da3a5d`.
Their initial 308/464 bytes are the predecessor's unchanged failed-admin
messages; the added suffixes are preserved separately. Guest dates use the
pinned June 1999 clock, while the host timestamps above identify this session.
Overlay metadata and actual bytes remain in `target-overlay/`.

`setup-file-delta.json` records no other changed or deleted file. Registry
baseline/final both have 73 identical entries, with no pending replacement,
registration or restart delta. No restart or provider check was performed,
and no original AoE3 session ran because setup failed before installation.
I personally inspected `setup-final.png`: a uniform teal 640×480 desktop,
without a completion dialog or gameplay.

## Repair and validation

[Microsoft documents GetNativeSystemInfo](https://learn.microsoft.com/en-us/windows/win32/api/sysinfoapi/nf-sysinfoapi-getnativesysteminfo)
as a void kernel32 function, supported from XP, that fills
[SYSTEM_INFO](https://learn.microsoft.com/en-us/windows/win32/api/sysinfoapi/ns-sysinfoapi-system_info).
This emulator's installed OS model is native 32-bit x86 without WOW64. Its new
handler delegates to the existing `GetSystemInfo` behavior, including the
36-byte structure and one-argument stdcall cleanup. It does not report the
Linux/JavaScript host's architecture. API ID 4603 is appended; the explicit
kernel32 PE export is added at next-free emulator ABI ordinal 596, preserving
all existing ordinals. The kernel32 image, API hash and dispatch outputs are
regenerated through the existing tools. No version, DirectX capability,
AttemptToRun, installation or security state is synthesized.

`test/test-get-native-system-info.js` first reproduced the absent dynamic
export. A handler/table-only intermediate still failed because kernel32's
explicit PE export surface also needed the new entry; that failure is retained.
The final regression passes in standard and compatibility modes. It uses the
real PE loader, dynamic kernel32 lookup, mapped export JMP, production
dispatcher and actual x86 entry/return path. Independent native x86 structure
assertions, poisoned destinations, boundary canaries, repeated queries,
unchanged `GetSystemInfo`, unknown-export rejection and exact stack cleanup
prevent a resolve-only or constant-success implementation from passing.
The exact tested harness modules and source manifests are retained. One
artifact-preparation command initially used a relative path and was corrected
to the helper's required absolute path; no guest ran from that preparation.

The optional older `test-kernel32-image.js` excerpt fixture fails on omitted
`loadlib_builtin_only`; a run-owned selection-only adaptation exposes a second
omitted `loadlib_name_is_qualified`. Both failures are retained. Those helpers
are unchanged production code, and the shared fixture was not edited. The new
regression instead covers the full production loader and actual export entry.
The final `flock /tmp/wine-build.lock bash tools/build.sh` passed at 18:51Z,
including the API/hash/dispatch, handler-stack, kernel32-image freshness and
compiled data-overlap gates. `repair-fullbuild.log` and
`repair-tested-modules.json` retain the result and both shipped repair binaries.

The next required proof is a separately authorized genuine setup progression
with this new export, retaining the same actual target state. SFC/restore
misses and the two static import gaps remain unresolved surfaces; whether any
becomes fatal later is unknown. This task used its one setup session and did
not retry. Genuine completion, any requested restart, resulting provider state
and then original player-controlled AoE3 gameplay remain conditional.

Final independent `cleanup.json` passed: 21 recorded owned PIDs absent, control
port 19765 refused, no profiles created, four locks free, zero heavy processes,
and 7622541312 bytes free on /home. The board watcher was terminated and is
absent. Box ID/state/expiry are N/A. No box, subworker, public deployment,
protection change or laptop Heroes II operation occurred; coordinator lifecycle
ownership is unchanged. No platform rejection occurred. The repair and this
finding are published together through explicit owned paths; the corresponding
exact FINAL board entry releases runtime and every owned file after publication.
