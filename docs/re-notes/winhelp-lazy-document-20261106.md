# Public WinHelp lazy document reads, 2026-11-06

Generated PE execution reproduced premature close of provider-backed HLP and CNT reads through both WinHelpA and WinHelpW on both shipped modules. Before close, the real VFS pending record existed and its handle was open. After public return, the record was closed, the pending slot was empty, exact `fillPendingRead` returned false, and provider request count remained zero. All four eager controls passed. Baseline source commit: `0b154f0578d80a633cc9ec5b092be35d16f3524f`.

The loader now retains its bounded path, handle, byte buffer and count destination across real I/O yield 12. Chunk retries use the identical handle and destinations. It reads both images before parsing, distinguishes absent optional CNT from malformed present CNT, and completes the original public stdcall once. WinHelpW releases its temporary conversion only after the loader owns a copy; command conversion follows completed document loading. Document retry is separate from installed macro callback state. Invocation/root checks fence retirement; same-instance process replacement discards old heap addresses and closes its host handle. Genuine failed replacement still closes the previous help window. Synchronous internal navigation keeps its boolean contract; Win16 is outside this qualification.

Evidence: `scratch/runs/20261106-winhelp-lazy-document/`. Git and the recorded binary diff are the source archive. No browser, game, box or public deployment was used.

Validation on both shipped modules:

- Locked `flock /tmp/wine-build.lock bash tools/build.sh` passed.
- `node test/test-winhelp-document-lazy-native.js`: 88 public API cases passed. Independent delayed HLP/CNT, small-cache chunk retries, eager success, `HELP_CONTENTS` and string `Contents()`, missing HLP/optional CNT, malformed HLP/CNT, cancellation/rejection, parked termination, foreign/same-instance process replacement, canonical path and destination lifetime, exact provider admission, and failed replacement closing an existing window.
- Existing native macro suspension suite passed, including nested callbacks, foreign reads, interrupted Sleep, termination and stale ownership.
- Native ReadFile retry suite: 52 passed; census reconciliation: passed.

The full `test/test-winhelp-wat-parser.js` invocation stopped at its absent external `test/binaries/shareware/HOVER!/HOVER.CNT` fixture (line 1308), before the VFS section. No local HOVER copy was found. Its assertions and failed-replacement test remain unchanged; this is not a full-parser pass. Restore the real HOVER CNT/HLP fixtures and rerun that suite next. The new public PE regression independently covers optional/malformed CNT and failed replacement without skipping any assertions.

Retained development failures: an initial WAT parenthesis error, the expected census review gate, and census-patch formatting errors. They were corrected before the passing build and regressions.
