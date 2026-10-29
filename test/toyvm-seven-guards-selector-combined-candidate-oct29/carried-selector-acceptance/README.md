Independent acceptance passed against unchanged production backend 12821 bytes,
SHA-256 e78b4f06715db96c3403aa821dc2008e7986fa9e9ec9fbacbc3744a8bb7eebc8.

oracle.py imports the pinned production file and runs its real serve and handle.
Four cases cover EOF and real GETATTR-response EPIPE twice each. GC is disabled;
exceptions, traceback frames, sockets and selectors remain strongly referenced.
Owned fd numbers and identities are recorded; EBADF is required before fixture
cleanup. Every baseline descriptor identity must survive, including inherited
stdio. The peer is borrowed and checked separately before EPIPE cleanup.
Threads must join. A no-op selector close is the negative control: its live
selector must be detected before cleanup. No production source is mutated.

Readiness requires both real registrations, SO_ACCEPTCONN=1, then a real JSON
status exchange. One case pauses listen after bind: path existence cannot signal
readiness. Socket paths are relative, at most 72 bytes, under this test directory.

The 44 RENAME wire cases and two parent guard controls are carried from pinned,
verified artifacts; they were not replayed. preflight.json records all supplied
artifact checks. Original RAM denial and unavailable historical samples remain
historical; this fresh supervisor has its own admitted evidence.

Run only through the task ops.py supervisor using /usr/bin/python3 oracle.py
from the owned repository. This is source/local-wire acceptance, without
mounts, kernel FUSE, CLI, browser, Boat, SIX integration or caller changes.
All five production files and skip-worktree flags are preserved.

acceptance-report.json records the verdict before publication. The authoritative
completion-receipt.json in the task supervisor e/ directory records the final
commit, exact ls-remote verification, source pins and closeout for coordinator
retention. It is outside the commit to avoid self-referential commit hashes.
