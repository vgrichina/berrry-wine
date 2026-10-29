# Combined selector/RENAME diagnostic

This branch publishes a diagnostic only. Production backend remains the exact dfbe290db97d4a7efb746538805cee94eaa3f9ad parent (12580 bytes, SHA256 3ff02988e444348fc12ccf9b4e6f16db1918b532a10152538afbafa96b2108bb).

The private combined source in provenance/attempted-combined-backend.py.txt applies only the accepted serve acquisition/selector lifetime delta. Its pin is 12821 bytes / e78b4f06715db96c3403aa821dc2008e7986fa9e9ec9fbacbc3744a8bb7eebc8. handle and all other source sections are unchanged. source.diff records the exact delta.

wire.py freshly passed all 44 cases and rejected both parent-guard mutants on that combined source. Every inherited assertion was retained; only explicit production pins, provenance, compact serialization, and cleanup description changed.

lifetime.py freshly passed supported SETATTR, malformed request, bind/register acquisition cleanup and EOF serial0. Serial1 then failed at control.connect with ConnectionRefusedError after the path appeared. No retry, readiness repair, remaining groups, or no-close mutant was run. The readiness check observes path existence, which does not prove listen readiness; that explanation remains an inference. GC was disabled. The complete failed operation admission sample is in diagnostic.json; original raw stderr remains outside Git at its recorded path.

The lifetime fixture preserves accepted helpers and assertions, adds retained exception ownership and owned FD absence checks, and limits requests to this parent's supported fixtures. The base has no early SETATTR guard. It makes no mount/kernel/CLI/browser/gameplay claims.

Tests retain the attempted candidate pin and intentionally fail their source precheck against the restored parent. These files are diagnostic reproduction inputs, not acceptance of the published backend. A coordinator must assign any continuation; exact combined qualification and fresh independent acceptance remain required.
