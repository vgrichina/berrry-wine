# Native KERNEL32 module identity: first compatibility stage

2026-10-15, source and isolated WAT tests only. This implements stage 1 of
[the PM/Pro loader investigation](outlaws-pmpro-loader.md), with the explicit
legacy fallback limitation below. It does **not** implement the Win32-to-NE
module lifecycle or QT_Thunk and does not qualify Outlaws for another run.

## Implemented surface

Native KERNEL32 has a permanent, readable 64 KiB guest PE32 image, allocated
once from the guest heap and published under the existing DLL loader lock.
The shared `KERNEL32_MODULE` region holds its guest base and explicit load
reference count. A second WASM instance reads that same process identity.
It is separate from the EXE and from real mapped DLL rows.

The checked-in `src/kernel32-exports.json` explicitly lists 457 named native
APIs plus the existing implemented ordinal 99. Ownership names came from the
Wine KERNEL32 specification URL and exact content SHA256 recorded in that
manifest; no Wine implementation was copied. The initial surface intersects
that ownership list with existing native handlers and excludes handlers with
direct fail-fast calls. It is a bounded surface, not a claim that every
Windows KERNEL32 API, or every mode of each existing handler, is implemented.

Named ordinals 128 and above are this emulator's assigned ABI, **not** a
claimed Windows 98 ordinal mapping. Legacy slots 1–127 remain reserved;
only 99 is populated. In particular, slots 35/36/37 are zero and QT_Thunk
is absent. Adding those requires real NE lifecycle and thunk implementations.

The generated name table is byte-sorted and has its own compact index.
Generation rejects duplicates, unknown API identities and overflow of the
code, EAT, name, ordinal or string areas. Its freshness check runs in the
build and the focused test. Every export points to an in-image x86 JMP to
an ordinary reserved native thunk. Direct EAT lookup and GetProcAddress
return the same in-image address, without synthesizing successful calls.

## Identity consumers and compatibility limits

- GetModuleHandle(NULL) remains the EXE. A real mapped KERNEL32 still wins.
  Native GetModuleHandle acquires no explicit load reference.
- LoadLibrary retains real mapped/file-backed loading precedence and existing
  system-directory admission. A nonexistent private absolute kernel32.dll
  path still fails. Successful native loads increment dedicated shared refs.
- GetProcAddress's outer handle validation admits the permanent native image;
  its resolver uses only that image's export table. It never falls through
  to global APIs or EXE exports. Unsupported names/ordinals return zero.
- GetModuleFileNameA/W return `C:\WINDOWS\SYSTEM\kernel32.dll` for this
  identity (using the existing `KERNEL32.dll` spelling), with bounded output.
  Real DLL and EXE filename paths remain intact.
- FreeLibrary's existing host unload service falls back to
  `release_synthetic_dll_reference` for identities without a dynamic row.
  That existing route now uses KERNEL32's separate count. Draining explicit
  references does not unmap this process module or invalidate its exports.
- Imports continue using the existing import resolver and thunk reservation
  machinery. The builder appends records; it does not replace imported thunks.
- Dynamic DLL pinning, resources, thread notifications and Toolhelp rows still
  describe real dynamic DLLs. This image has no resources or DllMain and is
  not inserted into DLL_TABLE. It is not newly advertised in Toolhelp module
  enumeration. Resource operations cannot accidentally use EXE resources via
  the old KERNEL32 EXE alias; non-row resource handles follow existing errors.

There is one deliberately retained pre-existing compatibility limitation:
unknown **bare DLL** names can still receive `image_base` from LoadLibrary,
and GetProcAddress on that ambiguous legacy handle retains its global API
fallback. Eliminating that behavior needs a separate identity migration for
those other modules. This stage separates KERNEL32 from the EXE but does not
claim to make every GetProcAddress(EXE, missing-name) strict. Actual EXE
exports still take precedence and are tested independently.

The native image is heap-backed; this change does not introduce image-section
VirtualQuery accounting, page protection, or Windows-version-specific named
ordinal compatibility. Neither the external JMP targets nor the existing
native API handlers have been exercised by a full emulator run at this stage.

## Validation and recovery

`node test/test-kernel32-image.js` compiles only the actual builder, generated
exports, relevant loader handlers, image resolver, filename writers, string
matcher, shared thunk allocator and loader locks. Allocator, registry and
host dependencies are controlled fixtures. It checks all 458 EAT/name or
ordinal results and their JMP targets/native API IDs; ASCII name ordering;
unsupported legacy ordinals and QT_Thunk; foreign APIs; a separate synthetic
EXE's actual named/ordinal callback; preserved pre-existing import records;
second-instance publication without reallocation; references and repeated
free; system/private paths; A/W filenames; and real mapped DLL precedence.
The two-instance test is sequential and does not claim concurrent Worker
stress coverage or full emulator dispatch execution.

Also passed: generated export and region-map freshness, WAT manifest and
fragment balance, region declarations/owners, JS region-copy census,
logical-and normalization, handler ESP checks, test-tier/timeout membership,
and `git diff --check`. No full build, native fixture, original game,
browser, remote command or public deployment was run.

Everything required to reproduce these source/tiny-WAT checks is tracked;
no ignored binary artifact is needed. Later native conformance should execute
one of the JMP entries, test true concurrent publication/refcounts, and run
the existing loader/refcount suites before merging. The original game remains
blocked on the unimplemented NE/QT stages regardless of this test result.

## Follow-up name-pointer audit

Before native execution, review found a real bug in initial source checkpoint
`5069c3f18841f4e9b80493c45ca8b1649ed24c8f`: the builder copied the old dynamic
GetProcAddress backing-offset idiom without its two-byte import hint. Actual
`win32_dispatch` adds `image_base + record + 2`, then calls `g2w`. Thus the
original direct-heap record shortened `_hread` to `read`; sparse backing would
also be translated twice. The first tiny test checked only the API ID and
therefore did not detect this name-pointer defect.

The builder now materializes a zero hint before each name and stores a guest
RVA in the thunk record. The PE name table points two bytes after the hint.
Generated immediates write the strings into guest memory, adding no literals
to the production 6 KiB WATX string pool. The extended test checks all 458
dispatcher name pointers in direct and nonidentity sparse mapping modes:

```sh
node test/test-kernel32-image.js
node test/test-kernel32-image.js --sparse
```

Both pass. Injecting the initial checkpoint's two builder files into the
extended test fails at `_hread`, with actual `read` (exit 1), establishing a
negative control. The pre-existing generic GetProcAddress backing-offset
path is outside this scoped repair and still deserves its own audit.

Allocation under `DLL_LOAD_LOCK` follows the existing PE loader's documented
outer-loader/inner-virtual-map lock order. `heap_alloc` uses per-instance
arenas and shared reservation/publication; it does not hold a separate heap
lock that later acquires the DLL lock. The new image remains allocated for
process lifetime. Native concurrency and actual execution remain pending;
the source audit is not a substitute for those tests.

## Prepared native validation (not run)

`tools/kernel32-native-fixture.js` deterministically generates an 8704-byte PE
with SHA256 `6c26eefe8a3fed5bd0d8d9b8c7c3fa0de6daeb5e68d86065ef7bcf9098f833c3`.
Its entry point is INT3 and is never executed. It imports the real loader APIs
and exports an EXE-only callback that returns `0x12345678`.

`test/test-kernel32-image-candidate.js` requires an explicit prebuilt WASM and
sealed fixture. Two actual Node Workers instantiate that full module over one
shared memory and initialize separate guest thread contexts/stacks. A barrier
releases both into first KERNEL32 lookup; each takes 32 load references. Each
walks the PE EAT, compares GetProcAddress, then actually executes the in-image
JMP to GetLastError and checks its per-thread result, full dispatch log name
and stdcall ESP cleanup. It also executes the EXE-only callback. A second
barrier checks 64 shared references before both workers free them through
the production JS unload service. The main instance checks zero refs,
over-release, reload and system/private path behavior.

The sparse variant uses bounded real heap allocations to exhaust the low
arena before first lookup; it asserts that the resulting KERNEL32 allocation
actually uses sparse translation. No translator or export result is mocked.
The direct and sparse modes each have an internal 60-second deadline and an
external 90-second timeout plus 5-second kill grace. Existing host UI/thread
creation imports are inert because this fixture creates only its explicitly
owned Node Workers and calls no UI APIs.

`tools/run-kernel32-image-native.js` is the coordinator-only controller. It
checks the physical committed source inventory, fixture/module hashes,
external baseline and optional preserved-file hashes, and process occupancy
before work and after each arm. Process evidence contains IDs/names only.
It stops at the first failure and records independent postflight evidence.
Its arms are one normal full build (600 seconds), two tiny tests (30 seconds
each), old-baseline alias control and candidate direct/sparse runs (90 seconds
each), memory-hook tests with a test-export full compile (180 seconds), then
the existing four real-PE DLL lifecycle scenarios (130 seconds).
Those scenarios cover cooperative/Worker execution with final/outstanding
roots, attach/detach, failed initialization rollback, TLS and stale handles.

After a fresh sole-lane grant, from an isolated checkout of the reviewed
task-branch commit (replace the three bracketed values with preflight pins):

```sh
WA_KERNEL32_COMMIT='<reviewed-40-character-commit>' \
WA_KERNEL32_EVIDENCE='/tmp/<fresh-evidence-directory>' \
WA_KERNEL32_BASELINE='/home/user/jedi-knight-checkout/build/wine-assembly.wasm' \
WA_KERNEL32_BASELINE_SHA256='<independently-verified-baseline-sha256>' \
WA_KERNEL32_PRESERVE_JSON='[]' \
timeout --kill-after=5s 1500s node tools/run-kernel32-image-native.js
```

The historical donor module `937466db…` and held IW module `a948a826…` at
their established `/home/user` checkout paths are mandatory immutable pins,
and neither checkout may be used as the candidate root. The source inventory
includes all vendored compiler files, including CHANGELOG/PROVENANCE Markdown,
plus package manifests and CLAUDE.md as well as source/build/test code.
Supply any additional immutable build/file pins in `WA_KERNEL32_PRESERVE_JSON` as
`[{"path":"/absolute/file","sha256":"..."}]` when the lane has such inputs.
The evidence directory must not exist yet. No game data, licence prompt,
original Outlaws execution, browser, deployment or shared worktree is involved.

Source preparation checks passed: JavaScript syntax, PE fixture header/import
layout and SHA256, tiny direct/sparse tests, test membership and diff checks.
No full-module result is claimed yet. `test-process-memory-hooks.js` now runs
its real call-register, call-memory, jump-register and relative-call hook/
restore assertions against both the new PE JMP entry and the underlying raw
native thunk. The dedicated cached-thunk opcode assertion still exercises
the raw thunk; it is not removed or substituted with an unpatched call. The
fixture is generated rather than relying on Notepad bytes. It leaves a patch
in the PE entry before process reload, then checks the fresh JMP and executes
the restored API. Production `load_pe` now clears KERNEL32 publication/refs
beside existing thunk-patch reset, before replacing the guest heap. Without
that reset a reused instance would expose a stale or patched old heap image.
These full-module hook/reload tests are prepared but have not yet run.

### Native validation attempt 1 (2026-10-15)

Source `0d290b10f53339afb963488ceaf67a34404d6fa0` was staged in an isolated
remote checkout and launched under the coordinator's sole-lane grant, with a
1500-second outer timeout. The normal build stopped after 7.5 seconds at the
unchanged toyVM browser-bundle gate: sparse staging omitted tracked
`fonts/Terminal.fon`. No candidate WASM was produced and no native arm ran.
Earlier normal build gates passed. Independent postflight confirmed an idle
runtime lane and unchanged historical donor WASM hashes `937466db…` and
`a948a826…`.

The staging closure must include `src`, `lib`, `tools`, `test`, `docs`, and
`fonts`, with root files (cone sparse checkout includes those automatically).
The controller now verifies every tracked byte in that closure, including
binary fonts/test fixtures, committed toyVM browser bundles, and vendored
compiler provenance. No build gate is disabled. Re-run requires a renewed
coordinator grant. Recovery archive:
`scratch/runs/20261015-outlaws-kernel32-native/attempt1.tar.gz`, SHA-256
`b724fd57c8082e8733f959e170f89d054e5678e1a2ca2b4d3357c729c6781ef2`.
