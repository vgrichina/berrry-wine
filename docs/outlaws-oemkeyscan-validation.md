# OemKeyScan source checkpoint (2026-10-15)

Original OLDEMO startup stopped at batch 0 on OemKeyScan(0), return address
0x43a8f1. Evidence is in scratch/runs/20261015-outlaws-original-startup.
This change implements the API; it does not establish that Outlaws starts.

The [Microsoft API contract](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-oemkeyscan)
places the scan code in the low WORD and modifiers in the high WORD, returning
0xffffffff when a single keystroke cannot produce the character. The runtime
currently exposes a US keyboard and OEM CP437. No extended CP437 character is
available on that keyboard in one keystroke. In particular, the existing
best-fit CP437-to-ANSI conversion table must not turn an unsupported glyph
into a successful question-mark mapping.

[Microsoft's US layout source](https://github.com/microsoft/Windows-driver-samples/blob/main/input/layout/kbdus/kbdus.c)
provides NUL, ETX, LF, FS, GS, RS, US and DEL control mappings.
Existing reverse-mapping preferences for Backspace, Tab, Return and Escape
are preserved; this is not an attempt to infer all reverse-map alias
preferences from forward-table ordering. Other control characters retain
the existing unsupported result. Native Windows reverse-map comparison
has not been performed.

[Wine's OemKeyScan conformance test](https://github.com/wine-mirror/wine/blob/master/dlls/user32/tests/input.c)
tests WORD values through 0x1ff using their low byte. The implementation and
tests preserve that behavior rather than rejecting a nonzero high byte.

MapVirtualKey's existing type-0 mapping is shared with OemKeyScan. The focused
test exposed and corrects its digit 1–9 scan-code offset (subtract 0x2f,
not 0x2e). Backspace and Cancel scan codes are added.

Local validation:

- node test/test-oem-key-scan.js: compiles and executes only the extracted
  production WAT functions and original data in one memory page. Checks every
  printable ASCII key, supported controls, all 128 extended OEM failures,
  WORD aliases, EAX and ESP cleanup, preserved registers, MapVirtualKey types,
  API/hash/dispatch registration and mutated shift/failure negative controls.
- node tools/check-api-table.js
- node tools/gen_dispatch.js --check
- node tools/check-handler-esp.js
- node tools/check-silent-stubs.js
- git diff --check

The focused test belongs to the unit tier by filename convention.
There was no local full build, emulator/game execution, browser, public deploy,
or use of the shared checkout's index/HEAD.

Remote validation remains pending coordinator grant of the sole runtime slot:

1. Review this source checkpoint and record the exact candidate commit.
2. Build in a separate remote candidate directory with all normal build gates.
   Preserve the existing canonical module and record candidate module hashes.
3. Run the focused test and an actual API thunk invocation under the full
   module, checking name lookup, NUL/letter/shift/unmappable output and ESP+8.
4. Only after build/review approval, rerun the original OLDEMO bounded startup
   with its complete original manifest. Record the next blocker or startup
   evidence and an independent no-process/source/payload postflight.

The small WAT fixture proves mapping and handler behavior, not full generated
dispatch execution or guest compatibility. Neither a source checkpoint nor
a passing fixture is a claim of a runnable game.

The integration runner is test/test-oem-key-scan-candidate.js. It takes explicit
prebuilt module and PE paths; it never builds implicitly or executes the PE's
application entry point. It initializes the loader, verifies the runtime hash
lookup, obtains USER32 through GetModuleHandleA and OemKeyScan through
GetProcAddress, then executes the resulting thunk with bounded run calls.
It checks every call's stack cleanup and restores the bootstrap thunk record.
The PE fixture can be the remote canonical test/binaries/calc.exe.
The runner is in the e2e tier; only its JS syntax has been checked locally.

Commands inside the isolated remote candidate checkout after runtime grant:

    bash tools/build.sh
    node test/test-oem-key-scan.js
    node test/test-oem-key-scan-candidate.js --wasm=build/wine-assembly.wasm --fixture=/absolute/canonical/test/binaries/calc.exe

With the same checkout and fixture, the canonical pre-change wasm supplies a
negative control without rebuilding:

    node test/test-oem-key-scan-candidate.js --wasm=/absolute/canonical/build/wine-assembly.wasm --fixture=/absolute/canonical/test/binaries/calc.exe --expect-missing

The build and commands need an outer wall-clock timeout, distinct logs, candidate
commit/module SHA256 receipts, and an unchanged canonical-module postflight.
No native command above has run at this source checkpoint.
