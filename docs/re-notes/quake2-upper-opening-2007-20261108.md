# Quake II command and browser log repair, 2026-11-08

This task completes the permitted substantive causal repair. No remote box was
created, UUID consumed, Chrome started, original game launched, or native game
input issued. The upper northern opening and first onward threshold remain
unqualified. Historical supervisor 143/cause UNKNOWN remains UNKNOWN; static
187 BSP controls remain preparation only. Full27/parity/audio/FPS remain open.
Evidence is in `scratch/runs/20261108-quake2-upper-opening-2007/`.

The inherited launch compressed its custody journal but unconditionally opened
`kernel-command.log` as a raw file. Its browser consumer also appended raw JSONL
and opened Chrome stdout/stderr as raw files. This could grow local retrieval
storage and repeated the previous run's omitted command-log evidence risk.

`tools/native_kernel_custody.py` now supports `command_compression='gzip'` in
addition to the existing `journal_compression='gzip'`. The supervising parent
drains a blocking child-output pipe using bounded nonblocking reads in its
existing wait loop. It writes gzip directly, hashes/counts original bytes,
and requires actual pipe EOF before complete drain. No logger process, logger
thread across fork, or raw staging file is introduced. Missing EOF cannot be
promoted to completion from ECHILD or terminal waits. The default raw API remains
available for existing consumers; the owned Q2 launch explicitly selects both
gzip options. Its immutable deadlines and terminal adoption checks are retained.

`tools/native-command-log.cjs` writes each append as a complete gzip member,
joins real Chrome stdout/stderr streams, and records original-byte hashes and
sizes. The owned Q2 browser consumes it directly and joins its stream drains
before profile removal or quit ACK. A writer failure keeps cleanup UNKNOWN.
The unchanged readiness and browser-close helpers are imported directly; the
fixed ten-second startup loop is not reused. The run's inventory and retrieval
consumers enumerate every regular artifact without an extension allowlist,
including `kernel-command.log.gz`; changed selected sources, symlinks, corrupt
gzip, transport mismatches and missing original-byte verification fail closed.

Initial helper hashes were explicitly verified: readiness
`9ba9ae8b94ebd8a134045608074403d81f68d3cfdf6c0e3f9dbcb875e0632c1b`,
custody `5fb6488ef45f394ce871507528cb7cce48507b07eb5cf73f25a7becfaedd16b5`,
and close `1f4fe08b501ed27c90f4256e85574a788e7dd8adff60638f2c69d6a3ca2ea9b2`.
The repaired custody hash is
`e36d34990d738e616611ce8a8f4309548abcb751bd5ef5ec119d20e561c49360`;
this is deliberately a new selection, not an unchanged-helper claim. Readiness
and close hashes remain unchanged. The new logging helper is
`979b3a8bbd8625ef6bffb009650778736e20ade2d781918b83f59d9944c88f5e`.
The selected closure contains 706 files / 109,891,849 bytes at Git
`f1e9c852a5688729efc2699d7701e67e35606580` plus retained diffs and owned
input patches. CPU SHA remains
`d8facd0658b7f158c6e60bef2de0936471f438f8bf41e9240fd75635f1d319dc`;
it was hashed, not observed executing. The actual driver preflight validated
every pin and exited before any browser or original launch.

Validation includes 30 custody tests, 24 Node tests covering the helpers and
exact owned browser consumer, three inventory/retrieval controls, and the locked
full build. The exact owned launch ran `/bin/true` and a 262,173-byte binary
stdout/stderr command with real terminal waits, complete custody, independently
verified gzip/original hashes, EOF, and no raw command file. Each launch control
had a prearmed independent observable seven-second PID/start watchdog; neither
fired, both watchdog waits returned zero, and the outer parent had no children
remaining. Bulk output larger than pipe capacity, an adopted writer after root
exit, and real tracer-to-parent adoption with gzip are covered. The exact old
selected custody source rejects the new compression option before fork; the
repaired selected consumer accepts it. Existing wrong-status and third-terminal
receipt refusals remain tested.

Intermediate failures are retained. The first gzip control caught a duplicate
buffered header flushed by the forked child; closing only the inherited file
descriptor fixed it. Those two intermediate compressed artifacts are corrupt
and are identified as such, not treated as valid lossless streams. A later
test incorrectly expected silence from Python's multithreaded-fork fixture;
the logger correctly captured its real DeprecationWarning. The final assertion
verifies the actual original bytes and hash instead. Intentional existing
backward-compatibility fixtures can retain raw logs; no claim is made that these
historical host-test controls used the new gzip mode. New configured consumer
streams and check output use gzip from their first stored bytes.

No archives, source-tree/media/module copies, old-run deletion, old-box actions,
guest writes, handler calls, config/backend/binding/clock/seed changes, workers,
or public deployment occurred. Existing paths and hashes identify media/modules;
Git plus small relevant binary diffs and owned-input patches recover source.
Sampled home free space stayed above 1.5 GB; no continuous-floor claim is made.
Box: NONE / NOT_CREATED, expiry NULL, stop receipt N/A. Next is a separately
assigned fresh remote run selecting this repair, qualifying its lifecycle and
retrieval integration, then using current pixels for short independently
released native input and reviewing displacement before any next input.
