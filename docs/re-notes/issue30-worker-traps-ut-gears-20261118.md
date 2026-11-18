# Issue 30: mounted private DLL admission, 2026-11-18

Published runtime repair: `d7321705a1480a0c0d9ec8ba63905b8bdf433acd`.
Evidence: `scratch/runs/20261118-issue30-worker-traps-ut-gears/`.

The current normal-browser upload route reproducibly skipped genuine private
DLLs in a complete UT348 demo ZIP, then deliberately trapped on the unresolved
Core export `?appPackage@@YAPBGXZ`. The startup graph admitted registry DLLs
but did not admit otherwise unknown mounted siblings, even though its existing
fetch resolver could read them. The repair admits regular or lazy mounted DLLs
beside the selected EXE, transitively, while preserving the builtin-only policy.
It does not change guest instructions, imports, media, INI, registry, Workers,
renderer selection, or failure stubs.

The one affected upload rerun after publication loaded the genuine Window,
Core, Engine and MSVCRT DLLs and rendered the textured demo splash and the
first-run renderer wizard. It did not establish a running 3D scene. The guest
self-launched another process, whose log subsequently reports ExitProcess(0);
the retained screenshot shows the wizard and splash. The remaining startup
cause is UNKNOWN. This scope is closed without guest input, replay or a later
endpoint request. Issue 30 as a whole remains unconfirmed.

## Identities and actual route

The initial source HEAD was `a2b3d0c71f782a8fb1bb285561ca06a16bd94ecc`.
Initial served WASM SHA256 was
`898d80bcb060102a8c548f8280330e5770432ed2ade2ed963b95c46d0f3a5337`;
affected rerun served
`ef5cd35b711bd15b3df2954a354454c14a8afa48e40f922c3ba171576a44f9b0`.
The retained source manifest, relevant shared-runtime patch and own Git patch
identify the shared checkout; foreign changes were preserved.

Chromium 151.0.7922.108 ran the production page and genuine main guest Worker,
with cross-origin isolation, headless SwiftShader and the normal default
slice100000. The slice announcement alone is not a causal finding. The driver
built a deterministic ZIP in memory from all 599 unchanged regular, non-dot
files of the existing extracted demo, supplied a File through the page's
existing multiple file input using DataTransfer/change, selected the exact
System/UnrealTournament.exe in the real import dialog, and clicked its host UI
button. This exercised the normal upload/import launch code; it was not a
physical OS file-picker action. No ZIP or media copy was retained.

UT348 identities (SHA256):

| Input | SHA256 | Preferred base |
| --- | --- | --- |
| UnrealTournament.exe | `99926741f08b1687278d11467c5731518721339daf31fe2afe9fe9c210e125b0` | 10900000 |
| Window.dll | `cc740570c542dc1b8b47e9a32cd70a9a8e02b7a36a657925cd83e246e4623638` | 11000000 |
| Core.dll | `d4b508d2e1669b752f9deb093b02756f87967455b9a3a32fba876a388a2c6ebf` | 10100000 |
| Engine.dll | `cd4b71ae361da2232dadcfa3b4967d2ada8fe8a1e40f6da0f7962f4e8745cf80` | 10300000 |

The initial upload trap diagnostic retains EIP/prev EIP 10908a16 in the EXE
(`mov [ebp-14],eax`), immediately before `call [10957c14]` at 10908a19.
The import is Core!`?appPackage@@YAPBGXZ`; the stack return is 10908a1f.
The actual served WASM function 4392 ends in call import 5
`host.crash_unimplemented`, followed by opcode 00 (unreachable).
This is the explicit fail-fast helper `$crash_unimplemented` in
`src/10-helpers.wat`, not evidence of an unsupported x86 instruction.
`native-trap-source.txt` is a rejected exploratory func-index mapping: compiler
expansion/reordering makes that textual function-number lookup inaccurate.
Use `trap-wasm-body.json`, the module and the import diagnostic instead.

The separately observed registered `ut348_demo` route reached its textured
menu. Its existing FirstRun/renderer registry overrides distinguish it from
the unmodified upload route. They were left unchanged and were not used to
hide uploaded startup. Selected screenshots were personally reviewed.

## Tests and publication

The focused production-resolver test fails against the old shell and passes
with the repair. It covers lazy private siblings, transitive dependencies,
missing/unrelated files, static-module placeholders, qualified paths,
URL-backed registrations and builtin-only user32/opengl32 rejection.
Builtin execution policy and browser launch-option tests also passed.
The callback ownership review anchors the shell's admission-only change.
`flock /tmp/wine-build.lock bash tools/build.sh` passed after the required
producer review was added. The explicit three-path commit was immediately
strictly pulled and pushed, both exit 0; there was no amend.

The same authored PE control and two private DLLs were executed against the
compiled module directly and through production GuestThreadHost slot 0.
Old admission traps on Ping with result marker 0; new admission attaches both
DLLs once, satisfies their dependency and returns marker 101/ExitProcess(0).
A separate actual browser upload comparison using the exact old shell response
and new shell also shows old Worker trap/marker0 and new Worker marker101/exit0.
The first control-browser instrumentation attempt lost access to memory after
exit and was corrected to retain a read-only reference before launch; its
failed receipt is retained, rather than counted as a runtime regression.

## Reporter and alternate-release limits

No local gears/glxgears EXE was found, including hidden and ignored uploads.
The reported msvcr110 import and EIP402ef8 cannot be mapped without its binary
or release/build identity. The public CalvinHartwell/windows-glxgears source
has VS2012/VS2017 releases but explicitly no binary release assets. The small
university-hosted wglgears.exe lead timed out over both HTTP and HTTPS. No
substitute gears binary was executed or claimed equivalent.

The coordinator retrieved four small genuine GOTY files from exact HTTP206
ISO ranges, without downloading the 649633792-byte full disc. The full-disc
hash supplied by the maintainer was not independently verified. The selected
GOTY EXE SHA256 is
`93846d6b4838bac06a2c4f9691dcc746e51a1c369008f83daab904cec9961e64`.
Its preferred EXE base is 10900000, while Window.dll is 11000000, as in348.
At the reporter's exact 10908bd6 the GOTY EXE contains `mov [ebp-14],eax`,
followed by `call [10958c8c]` resolving Core!`?appPackage@@YAPBGXZ`.
This is strong static corroboration of the same missing-private-DLL pattern,
and suggests the reported module attribution may be wrong. It is not proof
of reporter identity or a GOTY runtime pass. GOTY was not combined with demo
media or run as a misleading incomplete fixture. Whole-disc download would
violate the required free-disk floor with the available headroom.

Needed to reproduce the exact reported variants: EXE/Window.dll or ZIP SHA256,
gears release/source and deployed build ID. That request was put on the shared
board for the coordinator; the owner reports original downloads unavailable.

## Closure and recovery

The original input manifest is a complete hash/size list and ZIP recipe;
recover UT348 through its existing candidate manifests, not from a media copy.
The GOTY selected-file coordinator manifest retains URL, extent, HTTP range,
size and SHA256. Only selected named PNGs and actual served modules are kept.
All owned native scopes use native-supervise with finite cleanup and a separate
finite disk watchdog; actual waits cover both stdout and stderr EOF. The
cleanup audit records receipt leak status, known PID absence and source-media
hash verification. No public input was sent to the guest, so no DOWN/UP receipt
or gameplay confirmation is claimed. There were no boxes, agents, Codex
workers, Wine, Python, deployment, Telegram or GitHub posts. Box ID, expiry
and stop receipt are null; box state is NOT_CREATED.
