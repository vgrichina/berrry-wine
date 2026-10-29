# Accepted seven-guard caller pin candidate

Base: 100cfa89f10e5549086c2294227939d62a0a1850 (accepted repaired byte-safe caller).
Only production changes: exact accepted namespace backend replacement (SHA-256 b8201b2c4a1d0e1fd653bb02fda7870f626d3781bed014657fb974cc24e41c40) and the single corresponding caller SHA entry. Reversing that one entry recovers the exact base caller bytes, including its checked-source loader. Adapter, confine and pinned supervisor remain byte-identical.

Focused acceptance: exact production caller load_backend first, normal source binding, all four tampered pinned paths, private stale backend pin, timestamp/size-valid stale adapter pyc, and disk replacement immediately after checked read. Private legacy cache and reread controls both execute their hostile markers; the production loader returns code compiled from accepted checked bytes. subprocess.Popen is a strict raising sentinel, separately proven armed. The returned adapter is never called; zero actual subprocess attempts occur.

The exact production Backend.handle then receives INIT first, CREATE/MKDIR/RENAME positives and eight representative namespace guard rejections. Every rejection compares all instance fields against a deep snapshot, allowing only operations to increment.

Broader accepted source coverage is retained, not replayed: 133 requests, 71 rejections, 13 mutants detected across two INIT-first sequences. All 12 supplied acceptance artifacts matched their source acceptance receipt hashes before inspection. See source-pins.json for authenticated hashes and retained receipt location. Historical acceptance scripts were not executed.

Run: /usr/bin/python3 test/toyvm-accepted-seven-guards-caller-migration-oct29/accept.py
The task execution used the prescribed ops.py admission/limit wrapper; results.json records scope.

This independent candidate requires fresh acceptance before shared integration. Transitive adapter loader repair and selector integration belong to separate owners. No serve/transport, kernel mount, CLI, browser, Boat, main integration or deployment was exercised. No test box is assigned; lifecycle ownership stays with the coordinator.
