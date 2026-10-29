Independent repaired production source-loader acceptance, 2026-10-29

ACCEPTED at base 113d554e97e5c23fd229c0f2d8a16640a63bbf73, source identity boundary only.
All five production files retain their supplied byte counts and SHA-256 pins before and after testing. The accepted fuse_backend.py remains the six-guard cc2dc7ab2f9b5d1b84b755c61e7a6ffc3e226d52ffe008edf7ace5310cbdc105 candidate. No RENAME or selector integration is accepted here.

oracle.py is newly written and does not import or run predecessor check_loader.py. It compiles exact pinned production caller bytes, executes the unchanged load_backend boundary first, and independently compares returned function code (marshal representation, including nested code), defaults, keyword defaults, annotations, signature, module file/name/package/cache/HERE/PIN, spec metadata and loader linkage against a separate compile of pinned adapter source bytes with the same filename. Signature.bind checks API acceptance without calling the adapter.

Nine production cases pass: normal source, timestamp-valid stale pyc, unchecked-hash stale pyc, sys.modules poisoning, deterministic replacement immediately after the adapter read, and each of four independently altered dependencies. Each stale cache is retained byte-identical through its check. A nonexecuting ordinary-loader get_code control confirms both caches select the stale code. The replacement check returns the original buffer and overwrites the file before the loader hashes it; code identity still matches the original buffer, and exactly one adapter read occurs. Each dependency tamper raises the exact identity error with zero calls to spec_from_file_location, before adapter import.

The private mutant removes only the two-line source SHA mismatch guard. The identical suite rejects it at the first tampered dependency because it attempts adapter import before rejection. Production was never mutated. Temporary fixtures are cleaned only after all checks, including cache retention assertions.

Reproduce from this task repo with:
/usr/bin/python3 /tmp/toyvm-repaired-source-loader-independent-accept-oct29/ops.py independent-oracle /usr/bin/python3 test/toyvm-repaired-source-loader-independent-accept-oct29/oracle.py

results.json records before/after pins, case results, cache hashes and expected mutant rejection. Input pins were verified against the canonical predecessor receipt before use. An initial artifact-verification helper keyed hashes by basename and collided with a second check_loader.py entry; it was corrected to the exact receipt path before any behavioral test. Original helper failure remains in task evidence. It was not a source or resource failure.

Controls: exact pinned /usr/bin/python3; original task supervisor and limit contract; each operation singly admitted; parent soft DATA128MiB and inherited hard unchanged, Python DATA128MiB, Git-only DATA256MiB, physical parentRSS128/groupRSS512MiB, CPU90s, wall120s, file12MiB, capture2MiB, evidence1MiB, allocation24MiB, trusted SSH configuration. No admission or platform denial occurred. No Node execution or mount configuration was needed. Initial root-ref receipt reused; no root ref mutation requested.

Scope excludes actual adapter calls, child runtime, mounting, kernel, CLI, browser, Boat, public deployment and shared integration. No box assigned. This accepts the repaired source identity boundary only and carries forward the six-guard backend scope; remaining execution and integration gates remain coordinator-owned.
