# Redline: durable startup batching and first-EXIT barrier correction

**Redline-only repair published; native startup and side-door gameplay remain
unverified.** Final code is `eb97ea8a4353fe5008f22c6c2ced5363caaa81dd` on main.
Evidence: `scratch/runs/20261109-redline-startup-journal-repair-2110/`.

`tools/redline-bounded-custody.py` authenticates the existing published launcher,
observer and shared custody source before transforming it. Intermediate custody
records now use the existing bounded pending journal. The original executable
release barrier remains. A centralized barrier additionally flushes the complete
journal and observer prefix before **every actual CONT**, including both
irreversible EXIT paths. It runs outside the ESRCH-catching ptrace block, so a
storage exception cannot become an inferred kernel disappearance. Pure syscall
stepping retains the existing bounded diagnostic batching and exhaustion policy.
Identity, lineage, consumed waits, cancellation, sticky journal errors, final
sync, exclusive evidence writers and deadlines retain their existing behavior.

The shared `native_kernel_custody.py`, Q3 and Nox files were not edited. No CPU,
media, startup deadline, stderr admission or provision-label change was made.
The existing `offline-provision-` and `native-provision-` labels both survived.

## Causal evidence and the stronger failure control

Independent rereads of the retained 1702 process, startup, failure and custody
artifacts establish **5.488262 seconds of observed Chrome main-thread ptrace
suspension inside its 10.043-second startup window**. Each interval binds a real
consumed stop to its returned CONT and is clipped to the startup/failure
endpoints. These are wall-journal timestamps with millisecond endpoint precision.
They do not separate storage, scheduling, kernel or other tracer service. The
late unresolved lineage remains unsuitable as proof of startup cause.
See `retained-startup-analysis.json`; original artifacts are referenced by path,
SHA and size rather than copied as an archive.

The initial batching change, `b6f789d08`, passed executable-release, bounded
pressure, sticky/final-sync and generated-consumer controls. It was too weak:
when a new child's initial SIGSTOP is superseded by an irreversible EXIT before
first observation, deferring registration permits the direct retirement CONT
before that child's custody record is durable. A stronger **actual Linux kernel**
control reproduced this: the on-disk custody lookup raises `StopIteration`
before ptrace release. `unlinked-before-actual.log` and `unlinked-before/` retain
the failed control. Its drain is incomplete; subsequent independent /proc checks
found both recorded identities absent after the isolated tracer exited. This
is new discriminating barrier evidence, not a browser-cause claim.

The final adapter fixes that path. The same kernel first-EXIT control now passes,
including delayed parent lineage, actual reaps and no remaining identities.
The durable-prefix test checks every actual CONT against all ordered recorded
rows, including ordinary EXIT; it also exercises syscall stepping and exhaustion
with caps 2 and 64.

Final fork/exec slow-storage control, with **12 ms added per fsync**:

| Redline supervisor | fsync calls | elapsed | owned/reaped |
| --- | ---: | ---: | ---: |
| Previous batching policy | 117 | 1.730 s | 13/13 |
| Final every-CONT batching | 66 | 1.086 s | 13/13 |

This proves a net causal reduction in controlled storage service while retaining
the stronger barriers. It does not prove that storage caused the old native
port-publication failure. `journal-final/pressure.json` records the measurements.

## Preparation, tests and native admission refusal

Preparation initially refused three shared GL files changed by published
`c6094c4ed`. Their exact existing Redline pins are recoverable from that commit's
parent. Preparation and offline transport used authenticated Git bytes in memory;
native provision uploaded those same bytes individually. No provider pin was
relaxed and no shared checkout file was overwritten. The native manifest records
`pinnedGitProviders` for these three unchanged pins. Initial offline harness
errors, including one missing preload inheritance and a test namespace collision,
are retained; corrected runs passed before any runtime launch.

Both phase-local manifest copies, seals, generated caller/bridge paths and all
**904 providers per phase** were independently checked before allocation. Actual
remote provisioning then independently verified the 904 staged provider hashes.
Both provision receipts remain distinct and match their respective generations.

The stronger EXIT review occurred after provisioning the initial candidate but
before launching the fixture. The final repair changes the adapter SHA and makes
that sealed native generation stale. `superseded-native-seal.json` records both
identities; `native-admission-refusal.json` records refusal to substitute a new
manifest after allocation. Consequently **no fixture parent, kernel supervisor,
Chrome, CDP, native input, capture or conditional original was created**. There
was no native startup failure to attribute, no native retry and no second box.
The task's preallocation validation and one-box limits prevent a native trial of
the final candidate in this run. No images were returned for review.

Passed final checks:

- Four startup-journal tests, including actual executable/EXIT prefix ordering,
  first-observed unlinked EXIT, slow-storage comparison, and four reused bounded,
  sticky-service and final-sync controls against the generated adapter.
- Six existing bounded-custody tests, including actual late fork/exec after
  observation exhaustion, cancellation, bounds and source authentication.
- The **actual generated remote parent, staged production controller and owning
  caller**, with DRIVER_PREFLIGHT before server/Chrome. Expected missing ACK
  ends the controller; all seven tasks were actually reaped, parent wait and
  separate stdout/stderr EOF retained. Final generation was tested afresh after
  the every-CONT correction. Offline exact-pinned read seams are explicit;
  this is not a claim of a Git-free local transport or browser emulation.
- Existing current-startup and startup-boundary controls, including unchanged
  100 × 100 ms port bounds, terminal handling and missing/changed pins.
- `flock /tmp/wine-build.lock bash tools/build.sh`, actual final exit 0.

The deliberate final-sync failure model emits a ResourceWarning because the
published finalizer fails before closing its observer; the isolated test process
exits and closes that descriptor. It is retained, not reported as browser EOF.

## Box and evidence closure

Sole box **bx_8bqbwq4n**, UUID
**3d91297f-c3a9-4f7c-ad97-dd89a2bfdd70**, was created only after an independently
observed immutable 25-minute watchdog. Initial expiry:
**2026-11-09T21:43:13.314Z**. Watchdog deadline:
**2026-11-09T21:43:13.584390Z**. Before exactly one delegated normal stop, the
unique provision-only evidence (**43,037 bytes**, SHA
`dfdf0786129a71c23579d49646bc0308e1c63be52254cb3580b6a70efc8e8577`)
was retrieved and independently reread for SHA/size and gzip CRC. It contains
the full remote pin check, barrier, absent runtime markers, process and FD census.

Independent final API state: **ARCHIVED**, `archiveAfter=null`, expiresAt not
returned. Stop **stop_a7e52dd68febe8b0** completed **forced:false** at
**2026-11-09T21:21:38.272Z**. The actual watchdog joined **0**, with separate
stdout/stderr EOF and unchanged configuration hash. No second stop, resume or
delete was issued; no other box was controlled. Free /home stayed above 1.5 GB.

Git plus exact SHAs and small patches is the source archive. `final-code.patch`
and the run-specific inputs preserve recovery without source/media archives.
The final independent local inventory reread covers 720 files / 4,387,506 bytes;
the two malformed gzip streams are expected inherited-writer negative controls,
not valid EOF evidence. The repository evidence audit reports no errors, missing
references or invalid entries for this run; 22 historical containment errors are
untouched. Redline has no candidate-corpus entry, so no unrelated dashboard
candidate was assigned.
Next separately assigned work: seal and independently verify the **final**
every-CONT candidate before allocating its one native fixture; only a passing
fixture can authorize the original side-door route and separate image reviews.
