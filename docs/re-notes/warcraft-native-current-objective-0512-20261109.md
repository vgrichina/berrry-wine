# Warcraft III current objective attempt, 0512

The sole authorized production attempt failed before renderer qualification or
visible control. No objective/control PNG or ready marker was produced, and the
original was not retried. Evidence is in
`scratch/runs/20261109-warcraft-native-current-objective-0512/`.

At 05:18:32.162 UTC the first qualification request, `Target.getTargetInfo`,
called the composed CDP wrapper. That wrapper called `guard.check()`, which
requires an already completed qualification. The guard latched
`UNKNOWN renderer identity: not qualified` before dispatching that request.
`causal-diagnosis.json` retains the error, request chronology and actual wait
joins. Only independent `Browser.close` was dispatched afterward; no later
game commands, input, capture or retry occurred. The original Warcraft URL
was served, but neither `launch.json` nor `ready.json` was published. Guest CPU
execution and DLL-main progress are unverified.

The minimal offline repair in `native-composition.js` gives the guard's own
bounded metadata/trace requests a private qualification token. The channel
accepts only the qualification protocol methods. Ordinary commands still
require a proof; input and screenshot requests cannot use the channel.
Cancellation, Chrome terminal state and sticky lifetime invalidation guard
both request dispatch and awaited continuation. No renderer/custody shared
implementation, game behavior, deadline or work/ACK budget was changed.

## Preparation and offline checks

Read AGENTS/CLAUDE, WC0500 and WC0445 before preparation. Reopened the final
WC0500 focused/build proofs against their recorded SHA-256 and sizes, including
their actual waits and separate EOF receipts, and verified the tested source
identities. The fresh 626-provider production closure matched final WC0500
exactly. Its 629-provider manifest-derived upload, staging negatives and actual
prepared production preflight passed within this assignment, before creation.
The post-upload local/remote content barriers matched all 161,567,154 bytes.

The pinned CPU module remains
`a320d4c85156644fd12b6134d66b11784f3100b9b135756206c087cdacd43295`;
published custody remains `4341b87723a7d56bc98223215cca4cdc878fcae2`.
The strict lineage/barrier policy, observation flags, immutable 90-second case,
five-second custody extension, work/ACK limits and 14/16/18-second close
schedule are unchanged. WC0445's 53 missing waits and WC0410's creator lineage
remain UNKNOWN. This attempt establishes neither their cause nor that a full
18-second close would have passed WC0445.

The new offline composition regression executes the actual composed
session/send/check closure with the real renderer identity guard. Published
`16c496ca2` reproduces the same first-request failure. The repair qualifies
successfully and rejects ordinary pre-proof commands, qualification-channel
input/capture, navigation invalidation, a reply delivered after invalidation,
cancellation and terminal-state changes. Existing startup/cancellation and
separate-pipe controls, the 38 renderer controls, contracts, staging negatives,
repaired production preflight and locked build are recorded in this run.

An initial offline test adapter lacked the trace expression helper; it was
corrected. An initial Node-only startup-suite invocation used production HTTP
pins against its fake server and failed fetch before startup. It was corrected
to the established Node-only fixture manifest. Earlier errors are retained
separately from the final checks. Neither involved another Chrome or original.

## Actual cleanup and custody

Chrome/151.0.7922.108 returned its version at startup. Independent close ACKed;
Chrome exited code 0 without TERM/KILL, with actual child close and separate
stdout/stderr EOF. Close took 277.447 ms. The browser receipt remains
cancelled=true, normal=false with the first terminal failure retained.

All 143 recorded kernel identities have actual terminal waits, matched to
their before-reap sequences in 1,398 events; command EOF=true and
remaining/unreaped/resume/ptrace sets are empty. Strict custody still reports
complete=false and kernelForkLineageComplete=false: PID10418/start99598 was
registered at sequence887 as an autoattached task without creator custody,
then retired at EXIT and actually reaped at sequence891. Its missing creator
link remains UNKNOWN. This record follows the browser failure and does not
replace that earlier cause. The witness retains 23,094 actual creator scans
and 459 paired actual CONT-before/return records. Later identity absence,
closed ports44105/42859 and no profile FD writers establish physical drain,
not creator lineage or historical missing waits.

## Box lifecycle and retrieval

Observed Super0512's exact `ARCHIVED PHYSICAL_DRAINED` release,
`stop_a75a6c7dd9ff1c8c`, before creating box `bx_53ntm87a`. An independent,
observable watchdog was armed first against immutable UUID
`c7c3a021-16f0-468f-a11b-b1cc53a6b800` and a 25-minute deadline. The box used
TTL1487 with initial expiry 05:42:49.066 UTC. Caller stdin stayed open and
stdout/stderr were concurrently drained.

All 35 unique remote evidence files, 417,475 stored bytes, were retrieved and
independently verified for size/SHA-256 and decoded gzip hashes/GNU gzip CRC
before delegated normal archive. Stop `stop_0eabce2bdda16b24` completed at
05:19:24.802 UTC, forced=false, error=null. Final state is archived,
archiveAfter=null; final expiresAt was not returned. Physical release was
posted at 05:19:58, and Q20517 subsequently acquired the slot. Its box was not
touched. The local lifecycle/watchdog and release watcher have actual wait0
with separate stdout/stderr EOF; the runtime lock was released.

Recovery uses the exact Git base, relevant small dirty/new-file patches and
existing SHA-pinned media/module paths. No tree/media/module archive or
duplicate was made. Free /home above 1.5 GB was the only resource gate. No
agents, workers, local browser or deployment was used.

Next: the qualification repair is validated offline only. Actual renderer
qualification, the unresolved creator link and original visible objective
remain unverified. No further runtime is scheduled by this task. Single task
STOP.
