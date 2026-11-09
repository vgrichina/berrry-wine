# Redline fixture shutdown repair — 2026-11-09

The 0724 fixture leak is reproduced offline and repaired. Its assertion after
the Chrome-exit wait skipped HTTP-server closure and gzip-stream joins. The
whole retained fixture, recovered from its Git base and small input patch,
returns the timeout error with an actual local HTTP server still listening in
the inert regression. No cause for the native Chrome latency is inferred.

`tools/redline-native-fixture.cjs` now owns the actual ordinary-PE fixture body;
`tools/redline-fixture-shutdown.cjs` owns its lifecycle. Future fixture
orchestration must invoke this tracked tool and pin both files, rather than
execute the historical 0724 evidence copy. The selected CPU, startup helper,
host initialization, fixture EXE/DLL construction and key-consumption checks
are unchanged. The supported private a320 module remains 2,185,596 bytes,
SHA-256 `a320d4c85156644fd12b6134d66b11784f3100b9b135756206c087cdacd43295`.

The lifecycle closes the HTTP server independently, retires ordinary CDP
producers, writes only the isolated browser-close command, and independently
joins actual child exit, both gzip pipelines and pending fixture tasks.
The 10-second actual exit wait remains unchanged. At exhaustion it preserves
`actual Chrome exit missing`, kills the owned direct child and awaits actual
exit; it introduces no additional grace period or custody-deadline extension.
Close-write errors and negative close replies are recorded without blocking
server cleanup. The first failure object survives later cleanup errors.
Cancellation retires pending protocol work and joins the fixture body, including
asynchronous server acquisition, before taking the final resource inventory.
Terminal guards forbid later input, evaluation or capture. Profile removal
requires the direct child wait; this is not an all-writer custody claim.

`node tools/redline-fixture-shutdown.test.cjs` executes the whole old and new
fixture scripts with a CDP seam, real local HTTP, real inert Node children and
real gzip pipelines. The old path fails with a listening-server leak and
unjoined streams. The new path joins cleanup for delayed child exit (including
the actual unchanged 10-second wait), close-write failure, rejected close
reply, earlier body failure, cancellation, gzip-destination failure and normal
completion. It checks first-error identity, independent server closure,
separate actual waits and EOF, and rejection of later protocol work. An
additional cancellation control joins a server acquired after cancellation
without starting a child. These are authored offline lifecycle tests, not
native Chrome/game qualification.

Evidence: `scratch/runs/20261109-redline-fixture-shutdown-repair-0740/`.
Focused regression, existing startup composition/refusal tests, and
`flock /tmp/wine-build.lock bash tools/build.sh` pass. Test command logs are
gzip streams from their first byte. An independent process watchdog is armed
before the test commands; command, watcher and watchdog actual waits and
stdout/stderr EOF are recorded separately. SHA-256, size and gzip CRC checks,
exact Git base and small binary patches preserve recovery without source,
media or module archives. Deliberately failed pipeline destinations are
identified by the test; they are not accepted as complete gzip logs.

No Chrome, game, original entry, box, agent, worker or public deployment was
started. Box ID/state/expiry/stop receipt are respectively null,
`NOT_CREATED`, null and null. Native lifetime remains **REVOKED**;
all-writer coverage and edict ABA remain **UNKNOWN**. Strict pre-CPU,
pre-DLLmain and owning-Worker gates are unchanged. There is no original retry
or whole-native qualification claim. The next step requires separate runtime
authorization; this task stops after publishing the offline repair.
