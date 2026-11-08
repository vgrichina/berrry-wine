# SuperTux short-step attempt: startup refusal and lifecycle fix

One fresh remote original failed before browser readiness. **No game input,
native Pause review, same-life progress, death or exit was observed.** There was
no second browser or original retry. The concrete failure is the retained
SuperTux driver's fixed ten-second `DevToolsActivePort` polling budget.

Evidence: `scratch/runs/20261108-supertux-short-step-progression-2236/`.
The prior [native Pause result](supertux-native-pause-progress-20261108.md),
published in `cabc64e3b`, remains separate evidence. All 4,533 retained remote
references were independently reread against their original SHA/size, decoding
the subsequently compressed files where necessary. No prior captures or
qualification runs were repeated or copied into this run.

## Actual original and failure

The staged browser/runtime source was published
`0e2bd19d802278aacc06dd952e135529c1edad63`, with individually pinned existing
media/module paths and owned driver patches. The staged canonical CPU SHA was
`4b45bda53a90b665896cf3b85d9a157b7c3703563c88b6666e4ee2e4b346bcc3`;
there is no executing game-module claim because readiness was never reached.
The tested custody kernel was published `bcf8c7bd788f2c63668406b11f72652006cde8dc`,
SHA `5371233b12d3a63e13a9768529af43e5a61b7ff1682b2d3c09e4db6a976e12d0`.
The concurrent parent-lineage worker's edits were neither staged nor absorbed.

The actual browser execution window began **22:37:30.533Z**. At
**22:37:40.672Z**, the driver read the still-unavailable `DevToolsActivePort`
after its 100 × 100 ms loop and recorded ENOENT with `noReplay=true`.
Retained Chrome stderr announces an endpoint on port **40365**, but that line
has no host timestamp; its exact publication time is unknown. There was no CDP
connection, accepted action or screenshot. An earlier menu capture request
failed before its writer lock could be created and dispatched no input.

The failure cleanup escalated: Chrome's actual exit was **SIGKILL at
22:37:57.189Z**, rather than normal `Browser.close`. The input completion set
was empty. Kernel journal, outer-launch and runtime-parent terminal waits,
including their stdio EOF, are retained. The initial detached wrapper had
already failed before any runtime because the final staging barrier receipt
was missing. Its stderr was discarded by that wrapper; this evidence gap is
explicit. The missing receipt was subsequently diagnosed without a runtime,
published through the accepted barrier consumer, and the sole actual runtime
was launched with a parent that waited and retained its compressed stream.

## Concrete driver changes and checks

`tools/supertux-native-lifecycle.cjs` now composes the accepted
`native-devtools-ready.cjs` and `native-browser-close.cjs` consumers for this
driver. Readiness waits for a complete endpoint within the lesser of the
original runtime deadline and 120 seconds. It never launches or retries Chrome.
Cleanup requires terminal status **and** stdio drain before profile removal or
quit acknowledgement. The corrected retained `browser-fixed.cjs` calls this
helper at both boundaries; it was syntax checked, not rerun on an original.

Focused controls use three actual Node child fixtures, with an independent
finite cap armed before the first child. A complete endpoint published after
**11 seconds** succeeds; a partial endpoint fails at its unchanged short
deadline; exited/expired children are refused. A pending close-request promise
does not prevent actual child terminal/stdio completion. All children were
waited. These are real accepted-consumer controls, not native game claims.
The required locked build passed after the helper and test were final.

The run-specific input driver also tightens capture freshness from 120 seconds
to **12 seconds**, retains original action/release timestamps, and records real
DOWN/UP promise completions separately from bounded acknowledgements. Its
focused controls passed with pending DOWN, independently prearmed UP, late
completion and sticky UNKNOWN/noReplay. The actual transport consumer accepted
gzip commands and refused subsequent input after an UNKNOWN fixture. These
controls used no Chrome or game. The intended landing/enemy strategy remains
unexecuted: first visibly review landing/ground contact, then use separately
reviewed **100–200 ms** movement/jump phases and inspect the actual native Pause
menu and timer after every accepted active action. An airborne Space pulse is
not evidence of a grounded jump.

## Retrieval, custody and normal box stop

A durable UUID and observable independent immutable 25-minute watchdog preceded
the sole create. Box **bx_nn42bp5z** was created at **22:35:13.268Z** with returned
`archiveAfter=2026-11-08T23:00:08.128Z`, `ttlSeconds=1495`. The service returned
no `expiresAt` field; none is invented.

This actual kernel journal contains **1,297 events**, **127 registered owned
PID/start identities and 127 actual reaps**, with their before-reap witnesses
independently checked. Its recorded `complete=true`, empty remaining/unreaped
and empty unresolved-lineage sets describe this run only. Historical unresolved
clone-parent attribution remains unresolved. CLONE_UNTRACED and nonleader-exec
limitations are retained; an empty process list is not substituted for waits.

Both ports **46525/40365** were closed, the runtime lock was released, input
writer lock absent, and no owned writable FD remained. Chrome recreated a
profile during the early cleanup race; after actual waits and writer drain,
that directory was retired as evidence and the active profile path was absent.
Its unique files were recovered, not silently deleted.

All **35 remote regular artifacts**, **561,573 original bytes**, were covered
by **34 unique gzip payloads, 113,668 stored bytes**; selected immutable source
inputs remain referenced by the pin manifest. Every payload was independently
reread against stored and original SHA/size, including nested gzip CRC checks,
before normal stop. Remote symlinks/special files were enumerated: zero.
Runtime and Chrome streams were compressed from their first stored byte.
Early orchestration command-attempt metadata was initially raw JSON and later
losslessly compressed; it is **not** claimed to meet gzip-first storage.

The box was normally stopped at **22:39:29.490Z**. Final state **archived**,
`archiveAfter=null`; receipt **stop_0d30a65543c5964a** completed at
**22:39:29.518Z**, `forced=false`, `error=null`. This normal box stop is distinct
from Chrome's forced failure cleanup. Normal/watchdog/supervisor actual waits
all completed. Final local inventory covers every regular file and records
symlinks without following them; own small patches and Git/provider references
provide source recovery without tree/media archives.

No old-box resume/delete, public deployment, other runtime, local Chrome, agent,
RAM gate, guest/config/backend/seed/binding repair or prior-run deletion was
used. Local free-space samples stayed above the 1.5 GB resource floor; the new
evidence is small. Full27, parity, audio and FPS remain open.

Next: a separately authorized fresh original should pin the reviewed lifecycle
adapter and refreshed published kernel, require its final staging barrier,
then attempt the landing/enemy strategy. This task stops after its one failed
original and concrete driver repair.
