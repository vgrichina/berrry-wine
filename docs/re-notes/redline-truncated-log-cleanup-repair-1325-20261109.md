# Redline malformed diagnostic log cleanup, 1325

`tools/redline-terminal-cleanup.py` composes the actual retained 1235/1295
filesystem cleanup and retrieval consumers. It carries the successful 1295
continuation into one small entry point: diagnostic gzip errors cannot skip
physical cleanup or the remaining unique-byte downloads. No browser, process
supervisor, input or startup implementation changes.

The worker read the 1295 note, failed `terminal-cleanup.py fixture` and
`recover.py fixture` commands, their underlying 1235 consumers, and the same-run
`terminal-cleanup-continuation.py` / `finish-retrieval.py` continuation. The
ten-byte incomplete stderr aborted the old consumers. Python accepts zero-byte
gzip as empty output, so the old path also silently failed to distinguish an
empty file from a complete gzip member. The new decoder explicitly rejects it.

The composition leaves custody completion/reap assertions, exact PID/start
identity inspection, profile process checks, closed-port checks, and original
transport SHA-size verification in their existing consumers. It resolves only
the exact retained forwarding syntax, before execution, and keeps `control.py`
bound to the selected run directory. Changed replacement sites are refused.
It adds no process signals, CDP connections or startup allowances. Existing
shutdown JSON and browser EOF remain untouched.

Each present gzip is retained byte for byte and reports `gzipCRC:PASS|INVALID`
and diagnostic `EOF:true|false`. Missing expected browser logs explicitly report
`INVALID`, `EOF:false`, `exists:false`. Invalid gzip does not assert an original
uncompressed SHA match. Retrieval still requires the compressed SHA-size match,
downloads only missing files, and refuses changed existing bytes. Its successful
`passed` value means collection only; `collectionIsNotBrowserEOF:true`,
`fixturePASS:false` and an explicit meaning accompany per-artifact results.
Diagnostic EOF is never browser stream EOF.

Validation: `python3 tools/redline-terminal-cleanup.test.py` executes both actual
old consumers and the new CLI with the actual 1295 forwarding wrappers. Valid,
ten-byte incomplete, zero-byte no-member, corrupt CRC, absent-log and inherited
writer cases pass. Old incomplete/CRC consumers abort before drain/retrieval;
old empty consumers falsely accept no-member bytes. New cases drain the profile,
retain both logs and a final unique artifact, preserve declared browser EOF false,
and skip redownloading verified bytes. Corrupt local bytes, incomplete custody,
remaining/unreaped processes, mismatched reap counts, live profile processes,
open ports and changed wrapper shapes refuse. Real inert children are waited;
an adopted inherited writer has its own actual wait, with root exit preceding
separate stdout/stderr EOF. An independent parent deadline is armed before the
suite. The actual filesystem consumers contain no guest actions.

`tools/redline-fixture-shutdown.test.cjs` also passed, including actual child
waits, stream failures, inherited cleanup obligations and postterminal
input/capture refusal. `flock /tmp/wine-build.lock bash tools/build.sh` passed.

Evidence: `scratch/runs/20261109-redline-truncated-log-cleanup-repair-1325/` holds
exact Git base, relevant small new-file patch, source-provider references,
focused/build logs, fresh test paths and SHA-size/gzip results. Git is the source
archive. No source archives, media/module copies, local Chrome, browser guest,
box, agents or workers were created. `/home` remained above 1.5 GB free.

Recovery: restore the recorded Git base plus `owned.patch` (or use this published
commit). The retained wrapper sources are recoverable from the referenced 1235
and 1295 `owned-inputs.patch` files; their hashes are in `providers.json`. Run
`python3 tools/redline-terminal-cleanup.test.py` for the offline reproduction.
For a separately assigned live run using these exact wrappers, the invocation is
`python3 tools/redline-terminal-cleanup.py cleanup RUN/terminal-cleanup.py fixture`
then `python3 tools/redline-terminal-cleanup.py retrieval RUN/recover.py fixture`.
`RUN` must identify that assigned run's controller directory. Do not rerun these
commands against archived 1295: this task authorizes no remote execution.

No runtime was created or contacted. Inherited 1295 runtime remains recorded as
`bx_vu6j5kxj`, UUID `f67904f5-7a1b-4a7c-8cda-01c869296506`, ARCHIVED and physically
drained; unforced stop `stop_98cac7ffc9693ef9` completed at
2026-11-09T12:23:51.927Z. Initial archive deadline 12:43:26.114Z; final
`archiveAfter:null`, `expiresAt` unreturned. Its receipt was read offline only.
Next: use this composition only with an explicitly assigned run; no input,
capture, startup retry or runtime is authorized here. SingleTaskSTOP.
