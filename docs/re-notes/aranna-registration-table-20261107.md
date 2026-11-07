# Aranna registration rejection and missing demangler dependency, 2026-11-07

The sampled registrations are inserted, rejected by signature preparation, and
immediately erased from the same manager. Their signature input is the literal
`Unable to load msvcrt!__unDName`, produced by the unchanged shipped dbghelp DLL.
The pinned browser box lacks msvcrt.dll at the loader's searched locations.
This establishes a concrete dependency/registration boundary; it does not prove
an emulator instruction, API, or memory defect. No production code was changed,
and ordinary menu/world gameplay was not reached.

Evidence is retained under `scratch/runs/20261107-aranna-registration-table/`
(`R` below). This extends the predecessor
[initial descriptor investigation](aranna-first-descriptor-init-20261107.md).
Its actual-name/length, first guard/cache stores and lower_bound evidence were
used as the starting boundary, not repeated as the new finding.

## Positive registration and erase evidence

`registration-events.json`, `registration-steps.json`, and
`registration-causal-check.json` preserve 35 matching transactions: sequences
1–32, 1024, 2048 and 3072 on CPU owner slot 0. Each has manager `086e0034`,
map at manager+20, header `086c00bc`, caller return `452894`, and a consistent
signature pointer. Match keys include owner, sequence, manager and normalized
outer frame: entry's return-address stack pointer is four bytes above the later
saved EBP. The validator checks that relationship rather than asserting equal
raw frame addresses.

| Actual observed PC | Meaning | Map count | Result |
| --- | --- | ---: | --- |
| `4522f8` | registration entry, caller `45288f` | 0 | decorated name and fallback signature |
| `452348` | insertion has returned | 1 | same manager/header |
| `45c5d7` | signature preparation entry | 1 | same transaction |
| `45c5fb`, `45c623`, `45c62a` | preparation/parser stages | 1 | final sampled EAX=1 |
| `4523b6` | matching preparation return | 1 | EAX=1 |
| `452448` | rejection/erase branch | 1 | EAX=1 |
| `454b58` | erase call entry | 1 | same manager/transaction |
| `452457` | matching erase return | 0 | same header |

This is positive table mutation evidence, including the earlier insertion and
its removal. At each of the first two retained callback-initialization entries,
counters report 3,386 registration entries, post-insert stages, preparation
entries/returns and erase entries/calls/returns. This supports the bulk rejection
path; full payloads are retained only for the 35 transactions above.

`registration-tail-disassembly.txt` shows the actual control dependency:
`4523b6` tests EAX and branches to `452448` when nonzero. The bind call at
`4523d0 -> 4512aa` lies beyond that test. Erase returns at `452457`; static
instructions then clear AL and return through `452420`. **Final AL was not
sampled**, so this is not a matched final-return observation. The original
arguments include decorated export name, signature buffer, code key and
preparation object. Caller and parser disassemblies are retained separately.

The observer executes at translated basic-block entries. Several requested
instruction PCs are interior instructions and report zero; those zeros prove
neither missing execution nor missing bind calls. The independent target quota
predicate also tested raw `OnSt`/`OnUp` prefixes, whereas actual exports begin
with `?OnStartChore...` and `?OnUpdate...`. It therefore did not admit those
names. No target-specific registration absence or exact target rejection is
claimed. The 35 positively matched generic transactions and aggregate positive
stage counters are the new evidence.

## Why preparation receives the fallback string

All 35 sampled signatures are `Unable to load msvcrt!__unDName`. For example,
sequence 1's decorated name begins `??_B?1??GetString@AuditorDb@@...`; its caller
passed the same fallback buffer through preparation and erase.

The call at `4527ce` uses `[007aca4c]`, output capacity 1024 and flags `0800`.
A read-only asynchronous sample resolves that pointer to `00eb0892`, inside
loaded dbghelp base `00e9e000`: RVA `12892`, original address `6d522892`.
`undecorate-disassembly.txt` identifies the unchanged DLL's
UnDecorateSymbolName implementation. It lazily loads `msvcrt.dll`, resolves
`__unDName`, and on a zero cached function pointer copies this exact literal to
the caller's output buffer and returns its string length. This is guest DLL
code, not a string invented by the emulator or observer.

`live-crt-cache.json` records dbghelp's load-attempt guard=1, CRT handle=0 and
function pointer=0 at relocated RVAs `71e78`, `71e74`, `71e70`. These are later
asynchronous reads, not matched LoadLibrary/GetProcAddress returns. The original
`console.log` positively records HTTP 404 for the game-directory msvcrt.dll,
`/binaries/dlls/msvcrt.dll`, `/binaries/plugins/msvcrt.dll` and `/dlls/msvcrt.dll`.
The read-only remote file check confirms both `binaries/dlls/msvcrt.dll` and
`test/binaries/dlls/msvcrt.dll` absent. Neither is in the 2,149-file pinned
closure. The local shared checkout has the existing CRT at both paths:
278,581 bytes, SHA-256
`887eb5ce93edb7192ca3e9220f07f9ca0f94db02af5862ebcbdfcb852db99fd1`.
`lib/dll-registry.js` already maps msvcrt.dll to the former path.

Microsoft documents `0800` as 32-bit undecoration, `1000` as name-only output,
and success as output length excluding NUL; failure returns zero.
[UnDecorateSymbolName documentation](https://learn.microsoft.com/en-us/windows/win32/api/dbghelp/nf-dbghelp-undecoratesymbolname).
The old shipped dbghelp's nonzero diagnostic fallback is observed unchanged
code; it is not sufficient evidence to patch our CPU or replace that DLL.

Generated PE fixtures use the synthetic name `?Example@@YAHH@Z`, ordinary
LoadLibraryA/GetProcAddress, and guest cdecl allocation/free callbacks:

- `generated-undname.cjs`: existing real CRT resolves `__unDName`; `1000`
  produces exact `Example`, exit 0 in both shipped baseline CPU modules.
- `generated-undname-full.cjs`: original caller's `0800` produces exact
  `int __cdecl Example(int)`, exit 0 in both modules.
- `generated-undname-missing.cjs` with `hide-crt.cjs`: CRT availability is
  removed only inside the generated child-process harness. Both modules return
  zero for GetProcAddress and the fixture exits 102. The CLI's LoadLibraryA
  returns its built-in module handle in this case; this is explicitly not the
  browser dbghelp cache's matched API result.

These are dependency controls, not a regression rejecting a repaired emulator
implementation. The successful native-CRT calls do not test the full browser
DLL-loading route or every demangled guest symbol. The next useful task is to
make the browser runtime dependency closure complete, admitting a generated
browser demangling fixture with the existing CRT before another original run.
Only then can one test whether real signatures survive preparation/binding and
whether additional emulator divergence prevents menu/world progress. No CRT was
added to the original run and its pinned inputs remained unchanged.

## Controls, presentation and recovery

Before the sole original, final standard and compatibility observer modules
passed generated registration passivity, first-init, cross-owner and nested
reflective dispatch checks. Guest bytes, registers and PC match their retained
baselines. Registration quotas remain independent per owner and stage, and a
generated target is admitted after the generic quota fills. Actual RPC slots
0/1/7/15, immutable identity, unchanged other imports/exports, no added guest
store/flag evaluation, and main/thread rendering signatures pass in
`broker-final-*-check.json` and `host-check.json`. These controls do not grant
unobserved target-specific evidence.

The rendered Chrome 151.0.7922.108 shell smoke was personally inspected before
and after a balanced Start-button click; the menu opens. The original received
normal EULA acceptance, passive captures and one balanced Escape. It rendered
intro imagery and title doors (`response-03.png`). After Escape,
`response-04.png` shows a teal shell while the UI lists one running app, with
no menu/world. The preserved quit review incorrectly called this doors;
`capture-review-correction.json` records the personal inspection correction.
Input logs show balanced Escape down/up. No further gameplay input was issued.
Presentation-change cause remains unknown. Final broker counters report
24,812 records, zero drops; this is not proof of universal trace coverage.

Exact recovery inputs and recipes:

- Checkout at capture `ff012b5b4dccfc371ddb1137b36d2a8aef62dfa0`;
  relevant uncommitted hunks in `runtime-dirty.patch`, predecessor untracked
  recovery in `untracked-wininit.patch`. `owned-inputs.patch` records small new
  run scripts; Git is the source archive. No source/scratch/media archive.
- CPU source `344c54a2cebb0af51858c80b78c18e665dc52080`, closure SHA-256
  `393c95db18c4eb54d055867a661e397d3786549ea341205b90931ae47e903674`;
  runtime closure commit `d14a8e882f9cee83408ba67587591f90bd921957`.
  Reconstruct in memory with `node R/prepare-observer.cjs observer standard`
  and `node R/prepare-observer.cjs observer compat`, expanding R to this run.
  Retained transform dependencies and `runtime-pins.json` identify ancestry.
- Observer standard: 2,221,881 bytes, SHA-256
  `88ff2708a2dec89af430fac2ba778f39857c2716e851299c3ecbfa62fd5e7d1f`,
  matched to the original instantiated module. Compatibility: 2,222,950 bytes,
  SHA-256 `b37f10eb3a79ea54fb53b6b189124100af8165061977ac240b8225d239b337eb`.
- Existing `scratch/game-media/aranna-demo-20261105/extracted/DSLOA.exe`:
  SHA-256 `fced0961231248c09c10d86ff51935569db5f83ed3b2ba2739f0501dbc318589`.
  Existing `DSLOA/Expansion.dsres`: 226,873,456 bytes, SHA-256
  `3ed0688349f33b2dd7b9458c18cfbbc00490353c5888a93cd02c10da7f3c3b10`.
  `restore-media-parts.py` and `media-parts-manifest.json` recover it using 55
  independently hashed parts of at most 4 MiB, then concatenate, whole-hash
  verify and delete temporary parts. No whole-file transfer retry.
- `provision.py` initially hit local argument-size limits; subsequent small
  staging stopped on an edited own-input hash. Read-only missing-pin inventory
  followed by individual final uploads and full preflight established all
  final pins. An early startup fetch found no screenshot yet; status confirmed
  readiness before a new read-only fetch. No uncertain original action replay.
- Run generated checks with `node R/check-registration.cjs` and the retained
  first-init/observer/dispatch/host/broker scripts, selecting compatibility with
  `ARANNA_TEST_MODE=compat`. Demangler fixtures: `node R/generated-undname.cjs`,
  `node R/generated-undname-full.cjs`, `node R/generated-undname-missing.cjs`.
  `python3 R/validate-causality.py` checks matched retained transactions.
- All 2,149 final runtime pins pass pre/post verification. 59 terminal files
  (26,939,741 bytes) and seven root artifacts were retrieved with hashes in
  `terminal-evidence-manifest.json` and `drained-root-manifest.json`.

One persisted-UUID fresh box `bx_cna3zqd3` was created at 06:50:41Z, originally
expiring 07:20:41Z. Browser and supervisor exited 0 at 07:02:50Z. All 11 recorded
processes, both ports, profile and four locks were clear before retrieval and
explicitly delegated normal stop. Stop completed nonforced at 07:03:42.412Z;
box is archived, stopped 07:03:42.392Z, with no remaining expiry. Owned local
watcher and smoke processes/ports are clear; /home stayed above 2 GB. No stopped
box was resumed. No production build is needed for this docs-only result.
Publication and final validation are in `publication.json`,
`local-evidence-validation.json`, and `result.json`, written last.
