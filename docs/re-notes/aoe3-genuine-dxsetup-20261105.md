# AoE3 genuine DirectX setup — 2026-11-05

The one genuine February 2010 `DXSETUP.exe /silent` session failed before runtime
installation because `GetProcAddress(advpack, "IsNTAdmin")` returned zero. The
missing export is repaired and covered by a regression. Setup has **not** been
repeated with the repair. Usable setup-produced DirectX state and original AoE3
player-controlled gameplay remain unproved.

Evidence is in `scratch/runs/20261105-aoe3-genuine-dxsetup/` (ignored). No source
archive or repeated game-media copy was made. Initial source was
`02ca36bb2eb5683e81a6a094acddf3d848831449`; the actual setup used main
`1f024a6be1c0d08ef8b0c8b5a62c7178f87fb941`, with empty relevant tracked-production
`runtime-relevant.binarydiff`. `source-head.txt`, tested-module hashes and the
repair binary diff/new-file patches identify the exact evidence inputs.

## Gate and inputs

Conan1840 FINAL 17:28:50Z, Aranna1850 FINAL 17:33:51Z, and legacy1915 FINAL
17:43:35Z were observed in that order. Independent `release-gate.json` passed:
316 processes absent, 132 ports refused, 33 profiles absent, four locks free,
no heavy processes. Our runtime claim was 17:44:13Z. No boxes or subworkers were
created, resumed, stopped or deleted; box ID/state/expiry are N/A.

The [input note](aoe3-genuine-dx9-inputs-20261105.md),
[prerequisite note](aoe3-recovered-runtime-prerequisite-20261105.md), and
[supporting recovery note](aoe3-supporting-input-recovery-20261105.md) retain
canonical media, registry, DLL and game pins. The genuine redist remains
`scratch/game-media/aoe3-dx9c-20261105/directx_feb2010_redist.exe`, 109072752 bytes,
SHA-256 `f6d191e89a963d7cca34f169d30f49eab99c1ed3bb92da73ec43617caaa1e93f`.
Historical integrity/crypto are verified; current trust/revocation are unknown.
The six selected files were inspection outputs, never an installed runtime.
No download or repeat whole-package 208-member inventory occurred.

After the runtime gate, stock 7z expanded the complete setup only to
`scratch/game-media/aoe3-dx9c-20261105/feb2010-complete/`: 146 files, 111905086
bytes, including XP `dxnt.cab`. `complete-expansion.json` records each expanded
file hash and minimum free space 7909466112 bytes. Cheap boot/system-file and
native-DLL closure checks preceded a successful serialized full build.

## Actual session and state

`setup-process.json` records the exact ordinary production-runner command and
PID 3175661, 17:45:10.821489Z–17:45:11.777968Z. It used the XP profile, complete
cabinet root mounted as C:\\, genuine DSETUP.dll/dsetup32.dll, original launch
registry imported once before execution, writable overlay, and documented
`/silent` option retained in the input note. Silent license handling was not
visually observed. No registration/version/capability/AttemptToRun fabrication,
guest patch, installed-state borrowing, or postsetup registry import occurred.

The run-owned adapter invokes current `test/run.js` and records initial frozen
and final file/registry inventories. It suppresses only bulk VFS export copies;
the production writable overlay journals actual writes. It changes no guest
behavior. The exact original tested modules are retained as
`setup-tested-wine-assembly{,.compat}.wasm`; hashes are in `tested-modules.json`.

`setup-output.log` API 1595 loads advpack.dll; API 1596 fails to resolve
IsNTAdmin. Actual setup-created `DirectX.log` (308 bytes, SHA-256
`2bd8fb69a5d2ec956ebbe62d24f303bc132788550fb9760a75df13e1aac4d13a`) and
`DXError.log` (464 bytes, SHA-256
`ae179d83770c5d4e3a9ff22e47380e493d5b7aec8e896eeed7d8b7a2d5eff355`)
report failed GetProcAddress, error 2, then missing administrator privilege.
Their preserved bytes are available directly and in `target-overlay/blobs/`;
`target-overlay/index.json` retains actual file metadata. Guest log dates use
the emulator's pinned June 1999 clock; host timestamps above identify execution.

The guest called `ExitProcess(0xfffffff1)` (-15); runner exit zero does not mean
setup success. The counted genuine DSETUP!DirectXSetupA entry was never reached
(count zero). Only C:\\Windows\\Logs and these two logs were created; no files
were deleted. Baseline and final registry both contain 73 identical entries.
There was no registration/pending/restart delta and no restart request performed.
`setup-state-audit.json` and `setup-file-delta.json` preserve the comparison.

I personally viewed `setup-final.png`: a uniform teal 640×480 desktop, without
an installer dialog or gameplay. No provider check or original AoE3 session
ran, because setup did not complete.

## Repair and validation

`IsNTAdmin(DWORD, LPDWORD)` now uses the existing TOKEN_QUERY handle and
GetTokenInformation(TokenGroups) implementation to test the enabled
BUILTIN\\Administrators SID, rejecting deny-only membership. It closes its
transient token on every query path and performs two-argument stdcall cleanup.
The existing elevated process identity is unchanged; this adds a query export,
not elevation or a protection change. Allocation failure returns false.

The export contract and process-token group query follow
[Wine's advpack implementation](https://raw.githubusercontent.com/wine-mirror/wine/master/dlls/advpack/advpack.c);
enabled-versus-deny-only membership follows the
[Microsoft token membership documentation](https://learn.microsoft.com/en-us/windows/win32/api/securitybaseapi/nf-securitybaseapi-checktokenmembership).
Microsoft does not publicly document IsNTAdmin itself there.

`test/test-isntadmin.js` loads a deterministic PE through the real loader,
resolves advpack/IsNTAdmin dynamically, and exercises the production dispatcher,
stdcall cleanup, last-error preservation, repeated handle lifetime, actual token
pool exhaustion (false/error 8), and recovery with one free token slot. Unknown
exports stay absent. Standard and compatibility modes pass. The exact retained
regression modules and compilation manifests are in the evidence directory.

The existing token-security and token-privileges tests initially fail before
compilation because their test wrapper export names duplicate current shared
production exports. `run-token-regression.cjs` renames only local wrapper names
and matching JS references in memory; unchanged assertions and production APIs
then pass. Both original failure logs and adapted passing logs are retained.
The postrepair `flock /tmp/wine-build.lock bash tools/build.sh` passes, including
API/ESP/stub checks and both shipped modules (`repair-fullbuild.log`).

The precise remaining blocker is unvalidated setup progression after this
repair. There was no second setup attempt and no gameplay claim. A future
separately authorized runtime should start from the preserved genuine target
state, exercise the repaired preflight, and preserve the next actual outcome;
provider/restart/gameplay remain conditional on real setup completion.

Final independent cleanup (`cleanup.json`) passed: ten owned process IDs absent,
control port 19725 refused, no browser profiles created, four runtime/build locks
free, no heavy process, and 7886786560 bytes free on /home. Lifecycle is unchanged.
The shared runtime and every owned source/test/media/note path are released by
the corresponding exact FINAL messageboard entry after publication.
