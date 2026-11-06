# Disciples II corrected launch, 2026-11-06

**New harness error before Launch. Disciples gameplay remains unverified.**
Evidence: `scratch/runs/20261106-disciples2-corrected-launch/`.

The sole browser opened `index.html?debug&candidates&perf-stream`, correcting
the predecessor's missing query flags. The run-local controller then threw
`ReferenceError: w is not defined` in its prelaunch `page.evaluate` at
`browser.cjs:89`. A broad replacement intended to extend the postlaunch identity
record also inserted `w?._exeName` and `w?._perfLogicalFrame` into the registry-only
prelaunch callback, where `w` is undeclared. Syntax checking passed but did not
exercise that callback. This is a controller defect, before emulator execution.

No Launch click, app selection, Disciples file response, guest Worker, game
input or restart occurred. The prelaunch assertion did not complete; its option
count and selected-value checks are not qualified. The explicit
`WinePerf.start({draw:false})` call was not reached. Personally reviewed shell
and terminal captures show the empty shell; terminal state confirms no running
apps, no modules, and empty counters. Movement, movement points, second ordinary
response, owning module, verifier and audio are unassessed. Notepad remained
the default displayed picker value but was never launched.

Ordered SparseSave1000, KKnDOptions1015 and LegacyMip1035 exact FINAL releases
and independent cleanup passed before acquiring runtime at 11:02:09.437392 UTC;
the immutable deadline was 11:47:09.437392, including cleanup. The browser ran
11:03:42–11:04:07. Source commit was
`6890d0e6d38e0773ec5f06b156b8cae3beb7f407`, with a recorded binary diff and new
helper patches. All 127 support files (170,741,632 bytes) match the retained
preflight; the original EXE was separately SHA-256 pinned. No source archive
or media copy was made.

Locked full standard/compatibility build and HTTP 200/206/HEAD/mismatch controls
passed. All 99 observed HTTP response hashes matched pins; these are shell
resources, not game identity evidence. Built module hashes remain local build
pins only: no module was instantiated. Cleanup independently confirms 60 absent
owned PIDs, one refused port, one absent profile and four free locks, with
4.46 GB free on /home. No boxes were used (ID/state/expiry not applicable).

Stop at the first new failure was honored. No emulator repair was indicated.
The next separately assigned attempt must remove the two out-of-scope `w`
fields from the prelaunch callback, exercise that exact callback before launch,
then retain the exact option/value/EXE checks and postlaunch app/file/owning
Worker identity gate. The tested failing helper is preserved unchanged.
