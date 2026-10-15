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
