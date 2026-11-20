# Hexen II bounded native input observer: first implementation blocker

Evidence: `scratch/runs/20261120-hexen2-bounded-native-poll-causal-observer/`.
This is a source audit, not a qualified observer or an affected-original test.

The prior sealed analysis remains authoritative: final capture and retention
used 381 ms, leaving 55 ms after physical DOWN. Token zero cannot distinguish
busy execution, a host/render wait, publication delay, or PeekMessage cache and
filter behavior. The original observed PM_NOREMOVE; the calibration observed
removing GetMessage. Neither is substituted for the other.

The existing hooks were inspected before proposing another observer:

- `lib/guest-rpc.js:createTimingRecorder` provides a bounded, separate shared
  ring with timestamps and sequence checks. Its own snapshot explicitly says
  UNKNOWN: partial JS boundaries do not establish progress. Records include
  slice/import/wait boundaries, not native USER cache/filter transitions or
  exact input nonce/publication/read cursors. An unmatched slice entry alone
  cannot prove that the CPU was executing throughout the interval.
- `src/09a5-handlers-window.wat` already exports
  `set_user_pump_observation` and `get_user_pump_observation`. These preserve
  the latest call-entry and handler-return scalars with a finite budget.
  They do not retain every transition or expose the pending input cache.
  PeekMessage can satisfy or reject a cached event without calling
  `host_check_input`. Observing only that import therefore misses a relevant
  native boundary, including a filtered PM_NOREMOVE path.
- `lib/guest-worker.js` owns the actual instance, typed timing initialization,
  slice execution, command serialization, and error handling. Its callExport
  and readExports commands execute through the Worker command queue; they are
  not a concurrent prearmed feed. Scheduling another command after UNKNOWN
  would violate the closed runtime scope and cannot recover overwritten
  native observations. Reading the page's shadow instance is not equivalent.

An OVERLAP_REQUEST was appended to the board for the actual consumer lifecycle
hook in `lib/guest-worker.js`. MCM released that file unchanged at 11:47:48 UTC;
this resolves its ownership conflict. Host/render producers remain held and
untouched. The consumer hook must bind the observer to the real
process/thread/endpoint epoch, establish prearm before the exact edge, retain
execution/wait/error transitions without a new busy loop, and terminate its
own observation on cancellation, retirement, or error. Native USER cache and
filter observations must also be retained at their true producer boundaries;
the present latest-value export is insufficient for that history.

The remaining blocker is the required exact module identity. The retained
`ordered-candidate.wasm` was compiled for export inspection only, never
instantiated: its SHA-256 is
`10bdae2c56c79eeb5d0b4ebbc602c8a233e36351380da274a70f7f5e25363564`,
and its length is 2,418,815 bytes. It exports the latest-value USER getter but
no shared native USER cache-transition feed. JS hooks cannot observe a cached
Peek path while Wasm runs without entering an import. Extra post-UNKNOWN
commands cannot repair that gap. Adding a native publication producer changes
this exact module hash; a complete observer therefore needs a revised module
pin for qualification and for the affected original. The task requires the
exact old pin, so this audit does not substitute the current build or silently
patch the module. This is an instrumentation boundary, not a diagnosed cause
of the original failure.

No disconnected observer module was added as a substitute for provenance.
No actual Worker qualification, PM_REMOVE/PM_NOREMOVE equivalence control,
busy/blocked/delayed capture control, affected original, New Game, movement,
enemy consequence, or Quit is claimed. All remain unproved. The next worker
has the exact consumer-file release, but needs a revised native module pin
before implementing and qualifying the complete observation path. It must
preserve the existing deadlines and
first-UNKNOWN closure. There were zero runtime endpoint requests, no replay,
and no test box: ID null, state NOT_CREATED, expiry null, stop receipt null.
