# AoE3 native system information setup progression — 2026-11-05

The one genuine XP-profile February 2010 `DXSETUP.exe /silent` session
**resolved the repaired `GetNativeSystemInfo` export, then failed on the next
missing export, `kernel32!IsWow64Process`**. That API is now implemented and
tested against the emulator's native x86 process model. Setup was not retried.
Installation, restart/provider verification and original AoE3 gameplay remain
unproved.

The [previous session](aoe3-repaired-dxsetup-20261105.md) entered genuine
DSETUP and failed at the absent dynamic export. Its actual final overlay and
unchanged 73-entry registry are the starting state, with no installed DirectX
state inferred. The existing 146-file setup remains mounted at
`scratch/game-media/aoe3-dx9c-20261105/feb2010-complete/`; no media copy,
download or extraction is authorized or needed.

Evidence is `scratch/runs/20261105-aoe3-native-system-info-setup/` (ignored).
No media copy, extraction, download, source archive, box, subworker, public
deployment, protection change or laptop Heroes II operation occurred.

## Gate and tested setup identity

Preparation stayed source-only until Conan residency1825 FINAL 19:17:29Z,
Aranna loader1840 FINAL 19:27:34Z and AoW2 browser1850 FINAL 19:35:35Z.
Independent `release-gate.json` passed at 19:36:10Z: 394 recorded PIDs absent,
157 ports refused, 44 profiles absent, four locks free, no heavy processes and
free disk above 5 GB. No shared source/test edit, build, test, browser or guest
execution preceded that gate. The 45-minute execution limit began there.

Current boot/font/native-DLL closure and exact import checks passed before the
full build under `flock /tmp/wine-build.lock`. The three small setup modules
match their existing pins; COMCTL32 ordinal 17 still resolves to
`InitCommonControls`. `native-export-check.json` proves API 4603 and explicit
kernel32 ordinal 596 exist and the handler exactly matches repair
`da0919a1d1b9452ab91e31b43771f5c03a1acb09`.

Setup used main `eff3a6aa25d17b2f0666af4cc5cfa8dbdf0061f1`, with an empty
relevant tracked runtime diff. The standard module was 2173782 bytes, SHA-256
`78a9e8d7563c94b1e002a688c5e65d4269946ab8dd9eb68aa3edf271f4cb1c24`.
Both shipped binaries, exact source SHA, relevant binary diff, source hashes
and the small relevant untracked-source patch are retained. Git is the source
archive. The genuine redist pin remains
`f6d191e89a963d7cca34f169d30f49eab99c1ed3bb92da73ec43617caaa1e93f`;
current trust/revocation remain unknown.

## Actual progression and first failure

The single-session recipe adapts the predecessor's evidence-only
adapter around the production runner. It retains actual writes in an owned
target overlay, records baseline/final inventories and registry, and suppresses
whole-media VFS export. It refuses a second setup launch. The genuine DSETUP
entry counter and API tracing observe execution without changing guest state.
Ordinary license acceptance was already authorized; silent license handling
was not visually observed. The actual 73-entry registry was imported once
before execution, never restored afterward. Only inherited tiny logs and their
metadata were seeded into the new target overlay; base media remained in place.

`setup-process.json` and `setup-terminal.json` record the exact production
command, PID 3299214, and host interval
**19:37:22.850961Z–19:37:23.797293Z**. Both `IsNTAdmin` calls returned true;
the genuine DSETUP entry counter at `0x0118806d` recorded one hit. Actual
installer logs show `SetupForDirectX()` and its `Installing on WinXP SP2`
branch.

The first missing lookups remain SFC ordinal 8, ordinal 9 and
`SRSetRestorePoint`, API calls 2013–2015. Setup logs `LoadSfcDLL()` failure
and continues. API 2375 then resolves `GetNativeSystemInfo` to the actual
kernel32 mapped export `0x0143e4b4`. API **2376** immediately queries
`IsWow64Process` and returns zero. CKernel32 initialization fails before calling
the resolved `GetNativeSystemInfo` function; this run proves export resolution,
not a genuine-setup invocation of that handler.

The newly appended error log identifies `IsWow64Process`, error 127, followed
by `IsIA64(): Unable to initialize CKernel32`. Setup finalizes phase 0 with
value -9, internal/unsupported error. Actual guest `ExitProcess(0xfffffff7)`
is -9; host runner exit zero is not installation success.

Only the two inherited logs changed; no file was deleted or installed:

| Actual log | Final bytes | Appended bytes | Final SHA-256 |
| --- | ---: | ---: | --- |
| `directx.log` | 2399 | 1043 | `f19418fcfc60b21aa1da6f09a3366cf0a3a27f2e3f035eeb88b8d6fcf586449a` |
| `dxerror.log` | 1763 | 647 | `8735dee2f2e1e8b8fbfc9869f4e9b4faf7061d9e3ef5bf64313d129477f78f1c` |

Each old log prefix is verified unchanged and each new suffix is retained
separately, preventing the inherited previous failure from being mistaken for
this run's failure. Guest timestamps use the pinned June 1999 clock; the host
interval above identifies the actual session. Registry baseline and final both
have 73 identical entries. There is no pending replacement, registration or
restart delta. No restart, provider check or original AoE3 session ran because
installation failed. I personally inspected `setup-final.png`: a uniform teal
640×480 desktop, without a completion dialog or gameplay.

## Causal API repair and validation

[Microsoft documents IsWow64Process](https://learn.microsoft.com/en-us/windows/win32/api/wow64apiset/nf-wow64apiset-iswow64process)
as a two-argument kernel32 BOOL function: successful queries return nonzero
and write FALSE when the process runs under 32-bit Windows. XP requires
`PROCESS_QUERY_INFORMATION` access. This runtime models native x86 without a
WOW64 layer; the JavaScript/Linux host architecture does not determine the
guest answer. Its handler writes a four-byte FALSE output and returns success
only after process and output validation. It preserves last error on success.

Current pseudo/durable handles use the existing current-process validator;
child/alias identity, access and closed lifetime use the existing host process
authority with access bit `0x400`. Failed access/handle queries return zero,
preserve the output and propagate the authority's error. Unwritable output
ranges use the existing page-access probe and return ERROR_NOACCESS. The
existing model does not track rights/closed lifetime for OpenProcess's current
process durable handle; this repair does not change that authority or claim
broader access accounting. The native x86 result does not synthesize DirectX
installation, version, capability or AttemptToRun state.

API ID **4604** is appended and explicit kernel32 named ordinal **597** is
added without renumbering old ordinals. The API hash, dispatcher and mapped
kernel32 image are regenerated with existing tools. All six production paths
and the new regression are explicitly owned.

`test/test-is-wow64-process.js` first failed at the absent dynamic export,
reproducing the genuine setup failure through the real PE loader. After the
repair it passes in standard and compatibility modes. It resolves the actual
mapped kernel32 x86 JMP, enters the production dispatcher through normal x86
execution, and verifies guest return/stack cleanup. Independent native x86
architecture and poisoned PBOOL assertions distinguish success from FALSE
output, enforce the exact four-byte write with surrounding canaries, and cover
repeated queries, an unaligned x86 destination, pseudo and actual OpenProcess
handles, fabricated identities, valid child/alias queries, XP access denial,
closed aliases, unwritable destinations and unknown-export rejection. Host
process tests assert the exact query operation/right and retain authority
failure controls. No setup was used as a regression retry.

Both regression modules and the failing pre-repair module are retained with
source manifests. `repair-fullbuild.log` passes the required locked full build,
including API/hash/dispatch freshness, handler stack cleanup, kernel32 image
freshness and compiled data overlaps. Both final shipped repair modules are
retained. Exact Git SHA, relevant binary diff and patches for owned new test and
finding files preserve source recovery without archiving the checkout.

Known static imports `GetPrivateProfileSectionNamesA` and
`SystemTimeToTzSpecificLocalTime` remain unsupported until actual reach proves
their effect. Prior SFC ordinal 8/9 and `SRSetRestorePoint` lookup failures
continued; no protection behavior is changed or fabricated. Runner exit zero
was not treated as installation success. Whether the new repair permits
installation remains unknown. The next useful proof requires a separately
authorized genuine setup progression using this actual final target, followed
only on real success by requested restart/provider checks and ordinary original
AoE3 gameplay. This task used its one session and did not retry.

Final independent `cleanup.json` passes: 14 recorded owned PIDs absent,
control port 19765 refused, no profiles created, four locks free, zero heavy
processes, watcher absent and 7411597312 bytes free on /home. Box ID, state and
expiry are N/A; coordinator lifecycle ownership is unchanged. No platform
operation was rejected. The evidence containment checker exits zero; AoE3 has
no corpus candidate entry, so these findings remain in the investigation note.
The exact FINAL board entry releases runtime and all owned files after the
repair and findings are published to main.
