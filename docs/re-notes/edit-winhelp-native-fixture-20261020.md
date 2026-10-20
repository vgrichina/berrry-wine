# RichEdit / WinHelp public callback fixture — 2026-10-20

Status: **fixture generated and offline validated; fullVM UNEXECUTED**.
Base is fetched `origin/main` `ad6c408234b0eb1c6608ca964b3a0e9e07a6e545`,
which contains the paired callback integration `ee3a71e3398a98a360d02c25d02bfeb544f0e14f`.
The prior 48 source cases / 34 mutation controls and
`scratch/runs/20261020-callback-pair-review/result.json` were read, not rerun.
This delivers the runnable native prerequisite for later Circus qualification;
it does not qualify Circus or the combined main build.

## Public routes and expected observations

`test/test-edit-winhelp-callback-native.js` generates PE32/i386 EXEs and a real
PE DLL. It adapts the existing ICM native fixture's PE writer/assembler and
reuses its dump parser without modifying that fixture. There are no injected
WASM exports, patched modules, synthetic HWNDs, callback tokens, or private
state writes. All observation memory belongs to the EXE at guest VA `0x405000`.
The DLL uses the EXE's resolved IAT and data addresses; its code needs no
preferred DLL load address or relocation.

| Case | Public route and acceptance oracle |
| --- | --- |
| edit-ordinary | `CreateWindowExA("RICHEDIT")`, `SendMessageA(EM_STREAMIN, SF_TEXT, EDITSTREAM*)`; callback supplies `X`, then EOF; result 1, dwError 0, `WM_GETTEXT` returns `X`. |
| edit-nested | Outer callback streams into a second publicly created RichEdit using a separate stream/cookie; both calls return 1 and inner/outer register snapshots match. |
| edit-error | Callback supplies a byte but returns 123; API returns 0, dwError 123, public text is empty. |
| edit-timeout | Callback records entry, clobbers registers, spins; existing 64-slice abandonment must return 0 with dwError 1 and empty text. |
| help-ordinary | `WinHelpA(HELP_COMMAND, RegisterRoutine(...))` loads a real HLP and registers exported `Probe` from generated DLL; `WinHelpA(HELP_COMMAND, Probe(0,4660))` enters real x86. |
| help-nested | DLL calls `WinHelpA` again with `Probe(0,71)`, checks inner restoration, then reads the original outer argument and computes its result. |
| help-timeout | DLL records entry, clobbers registers, spins; existing WinHelp behavior abandons it after 64 slices and returns **accepted (1)**, without a computed result. |

Every scenario checks exact ESP, ECX/EDX/EBX/EBP/ESI/EDI and EAX API result,
a stack canary, resumed caller completion, a second independently seeded call,
and 70 further successful siblings in the same VM. Entry counts distinguish
real callback execution from a silent success API. WinHelp records its first
and last argument/result in EXE memory; its routine EAX (`0x76543210`) is
deliberately different from the API acceptance result. An unknown macro must
return zero without entering the DLL.

Callbacks deliberately clobber even nonvolatile registers to stress this VM's
stronger callback-context isolation contract. They use correct stdcall stack
cleanup (`ret 16` for EDITSTREAMCALLBACK, `ret 8` for `Probe(U,U)`).
This is not a Windows ABI conformance program: hostile nonvolatile clobbers
violate Windows callback etiquette, and the VM provides its native RICHEDIT
class without loading the Windows RichEdit DLL.

The HLP is the existing checked-in `test/binaries/help/freecell.hlp`, pinned
by Git blob SHA-1 `5418925c6c66c548daadd61531ea4c2083288e7a`. The generator
copies it unchanged into a VFS overlay at `c:\ew-native.hlp`. Registration is
made through the public API, not an injected HLP registration table. Subsequent
WinHelp calls pass a null filename to retain that loaded document and binding.
The generated DLL is staged at `c:\ew-native.dll`.

## Reproduction and later execution

No arguments run **only offline validation**, fitting the repository's
automatic unit-tier filename convention. Node and GNU `objdump` are required.
No module build, browser, Boat operation, or guest runtime is invoked:

```sh
node test/test-edit-winhelp-callback-native.js
node test/fixtures/edit-winhelp-native/validate.js scratch/runs/ew-native-validation
node test/test-edit-winhelp-callback-native.js --generate-only=scratch/runs/ew-native-generated
```

After the coordinator obtains a canonical exact-source build and runtime lease:

```sh
node test/test-edit-winhelp-callback-native.js \
  --artifacts=scratch/runs/ew-native-fullvm \
  --wasm=/absolute/path/wine-assembly.wasm \
  --sha256=EXACT_64_HEX_MODULE_SHA256 \
  --source=EXACT_40_HEX_TESTED_SOURCE_COMMIT
```

Optional `--case=help-timeout` (or any table case) selects one scenario;
`--help-file=/path/freecell.hlp` supports sparse checkouts but still enforces
the pinned blob. Unknown, duplicate, empty, malformed and conflicting options
fail closed. The supplied module hash is checked before launching `test/run.js`.
The source revision is operator-supplied provenance and must be matched to the
build receipt; the fixture cannot infer it from a WASM hash.

The runner always passes `--no-build --wasm=... --no-renderer`, bounds each
process by 120 seconds / 4000 batches plus a 150-second parent timeout, saves
raw logs, and requires normal exit plus complete memory observations.
`runtime-receipt.json` records arguments, process errors/status, EXE hashes,
and per-case verdicts, including a failure receipt if assertions fail.
Use a new artifacts directory per attempt; never overwrite historical runs.
No environment variable silently enables runtime mode.

## Validation delivered

Evidence directory: `scratch/runs/20261020-edit-winhelp-native/`.
`validation/validation.json` and 21 `.asm` files retain independent GNU objdump
decoding of all main/callback/DLL code streams. The offline validator parses
PE import tables independently, walks disassembled control flow, verifies IAT
targets and API stack effects (48/16/16/4 bytes), validates branch boundaries,
balanced stack joins and callback cleanup, and checks code/data separation.
PE headers/imports/export inspection is retained separately in `pe-inspection/`.

Passed: seven generated cases; 14 negative ABI controls (bad cleanup/IAT);
seven invalid argument controls; 14 absent/crashed observation controls;
seven synthetic-log positive controls and 84 altered-result/register/ESP/
canary/completion negative controls. Synthetic logs test only the assertion
reader and are never saved as native `run.log` evidence. Syntax and whitespace
checks also pass. No repeated production-source audit was performed.

## Coverage limits

- WinHelp does not expose the DLL return register, so the public oracle checks
  acceptance separately from guest-recorded computation. It cannot prove the
  helper's private EAX restore in isolation.
- Guest code cannot read or replace invocation child/root/epoch/depth tokens.
  Wrong-token/high-bit/epoch mismatch rejection and acquisition-before-write
  under exhausted capacity remain source-only coverage. This fixture does not
  exercise recursive capacity exhaustion; 70 siblings test retirement/leaks,
  not the capacity trap or post-trap recovery.
- Timeout cases exercise a public nonreturning callback and subsequent siblings;
  they do not prove asynchronous service, parked-frame resumability, thread
  lifetime, SEH, spill pinning, or CRT jump behavior. No jump APIs are enabled.
- This does not add a slice-64-success, mixed RichEdit/WinHelp nesting,
  large RTF, alternate RichEdit version, or native Windows comparison.
  Existing `test-richedit-stream-callback.js` covers stream/RTF semantics via
  private test exports; `test-winhelp-dll-macro.js` covers AoE's actual media
  through host-driven macros. Neither is duplicated or modified.
- FullVM execution is deliberately deferred to the coordinator. Army owns
  `bx_6czhvg6m`; this task neither contacted that runtime nor waited for it.

Only the new fixture script, its uniquely named offline validator, and this
note belong to this branch. No production change or main merge is included.
