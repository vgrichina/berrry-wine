# Q3 checkpoint observation: durable owning-caller adapter

Delivered new opt-in `tools/q3-checkpoint-observer.py` and executable offline
integration tests. Existing Q3/Q2 providers, manifests and active pin closure are
unchanged. Q21495 retains sole NEXT runtime. This does not authorize a native
retry or qualify cancellation.

Retained1475 does not establish a causal browser defect. The actual observer
command was submitted at Unix1794232273.634765; remote command started
2026-11-09T13:51:13.704Z and finished13:52:17.472Z with the existing checkpoint
assertion. First local terminal was1794232337.4970028. The raw browser budget
record began1794232303949ms with startupDeadline1794232423949ms and overall
1794232754460ms. Kernel armed supervisor7077/start34224, command7078 and
Chrome7507 are retained separately. No endpoint or admission had been published.
The browser startup deadline remained open. Empty Chrome logs, absent receipts,
and kernel reaps establish neither browser EOF nor historical cause; both remain
UNKNOWN. `retained-review.json` preserves raw records, exact hashes, sizes,
command, custody timestamps and comparisons against the initial Git base.

The original caller polls only checkpoint existence, then reads it. Executing
that exact retained command offline demonstrates false acceptance of partial
JSON, and of a published checkpoint alongside a prior browser failure. These
are concrete observer defects, but are **not** asserted to explain1475's missing
checkpoint. New tests reject both. No historical logs or CDP receipts are created.

The new adapter composes the actual retained task launch branch through existing
separate-stream cancellation composition, refusing unsupported source shapes.
`bind_remote(task, session)` replaces only the generated owning parent's Popen
and drain adapter in memory. A durable exclusive spawn journal records intent
before the actual Popen and a distinct spawn failure. The launch journal records
actual child PID/start, bounded publication snapshots and final actual wait with
independent stdout/stderr EOF. Snapshots label readiness and browserEOF UNKNOWN;
they do not authenticate endpoint/CDP or convert publication into admission.
The final post-drain snapshot closes a fast-exit observation race found in tests.

`observe_checkpoint(task, session, remote)` replaces1475's checkpoint remote
poll, using the same60-second observation and70-second transport caps, with
monotonic elapsed time. It records observer start, publication changes and
missing/partial/damaged/oversize/nonregular state, deadline, cancellation,
prior failure, invalid checkpoint or checkpoint observation. Owning Session
checks bracket the operation. Prior failures and revocation take precedence over
checkpoint presence; physical and cancellation-qualification gates still follow.
No timeout, readiness waiver or first-terminal replacement is introduced.

Reads are nonblocking/no-follow and limited to64KiB compressed and expanded.
Journals are fsynced NDJSON with128-record and1MiB bounds, exclusive creation,
sequence numbers, wall/monotonic timestamps and raw publication hashes. Damage
or cap exhaustion revokes input via the existing sticky cancellation channel;
the existing identity-bound TERM, sole drain and actual wait finish before the
diagnostic failure is raised. A separate failure-wait record preserves those
actual waits. This helper adds no wait consumer or custody process and never
claims browser EOF from kernel reaping.

Tests execute the actual generated caller and actual prelaunch with inert Python
children: normal, missing/partial publication cancellation, damaged journal,
record-cap cancellation, spawn failure; actual remote observer adapter success
and sticky cancellation; original command false-ready controls; deadline,
prior failure, shape, FIFO, symlink, size and gzip damage negatives. Independent
observable75-second sibling watchdogs are armed before tested children, outside
any custody wait domain. All owned children are actually waited; runtime and
prelaunch waits and stdout/stderr EOF are separate. No browser, game, CDP,
network endpoint, Box or native custody is invoked by these tests.

Focused existing caller controls pass, including EOF-before-exit and inherited
writer cleanup. Existing separate-stream regression initially refused its stale
offline fixture manifest (missing current-module provider). Its exact assertions
pass with only that required test input added in memory; original failure is
retained. New integration tests supply the current mandatory provider directly.
Locked `flock /tmp/wine-build.lock bash tools/build.sh` passes. During development
a fast-exit diagnostic assertion exposed the final-snapshot race, now repaired.

Evidence is `scratch/runs/20261109-q3-checkpoint-observation-repair-1525/`:
exact Git base, small owned binary patch, raw retained review, test logs/waits,
watchdog observations, locked-build output and a review-only future caller recipe.
Git remains the source archive; no module/media/source archives are copied.
Free/home remains above1.5GB. No shared custody, CPU/WAT/host, Q2, Redline,
HeroesII or CLAUDE edits; no agents/workers, deployment or native qualification.

Next: a separately authorized future closure must explicitly stage and pin this
new provider and use both adapter entry points; do not mutate existing versioned
manifests or invalidate Q21495's active closure. No runtime attempt is authorized
here. No Box was created or contacted: ID/state/expiry/stop receipt NOT_CREATED/NA.
Inherited1475 bx_5bnxexae remains offline-uncontacted; retained final receipt is
ARCHIVED/PHYSICAL_DRAINED with completed unforced stop_54e758ada497a4ee at
2026-11-09T13:53:20.194Z, initial expiry14:15:28.321Z, final expiry NOT_RETURNED.
