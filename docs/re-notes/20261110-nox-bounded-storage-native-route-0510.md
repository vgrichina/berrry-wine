# Nox bounded storage: startup caller readiness repair

Evidence: `scratch/runs/20261110-nox-bounded-storage-native-route-0510/`.

The ordinary Multiplay / Network / Host Game / Conjurer / default Jack / Bunker
staff objective was **not attempted**. The single original reached a usable
Nox “Click to Continue” splash. Its caller then cancelled on a premature local
fetch assertion. The supported repair is an explicit startup readiness barrier;
it has offline validation only. Published bounded completed-command storage
`3af98942f` remains unverified for native command intervals in this run.

## Admission

Fixture `682f77655` and readiness repair `bce2b316f` were reused unchanged,
without another native fixture. Shared providers, runtime source and BG2 were
read-only throughout this task.

The status-source regression now derives the new run root, resolves deduplicated
artifact paths through verified references, and checks the actual final capture
instead of assuming that every retained run ended at startup. It reproduces the
original undedented source failure by omitting the wrapper's `cleandoc` step.
The exact new emitted query compiles and executes against all 174 references
from the finalized 0423 run. SHA-256:
`a012338bc0bf4f60c631880c299736d228b17b4698316d8b442a6312af565c48`.
The same exact query also executes against this run's 37 finalized references.
Only the owned remote run path is mapped; the emitted query is unchanged.

An initial ordinary sweep stopped when the LBreakout owner's production
`src/03-registers.wat` edit changed a source pin. No allocation had occurred.
That file was not edited here. After refreshing the closure against its stable
production bytes, all preallocation requirements passed:

- Eighteen emitted consumer controls, including the actual Worker handler,
  installer, host initialization, canonical launch module and installed
  observation instance. It completed 12,002 command intervals, emitted every
  row in sequence, and retained its final row without renewing the deadline.
- Four emitted CDP attribution controls, four production pointer controls and
  all 27 matching ordinary generated-consumer controls.
- Retained native-module storage A/B in actual Node Workers: old installer
  fails after 3,000 complete CALL/entry/RET intervals / 12,000 rows; repaired
  installer completes 3,001 intervals / 12,004 rows and retains four rows.
- The locked build. The post-repair final locked build also passes.

The refreshed native canonical module is
`79f0842ea1ab5fce5b5651540e726396f4ccbfa6e3cf046e9bc42ad7c4fa650f`
(2,186,163 bytes); observation module
`20934a12751d9d75abbe09435d20e7bee3f006a55ea63f1fa7b94c4f9b5206e0`
(2,186,936 bytes). Both actual returned modules match. Remote verification
checks all 870 staged inputs / 110,421,288 bytes before the one original launch.

Offline invocation mistakes (a missing retained-module path and a relative
pointer-test output path) are retained separately. The corrected invocations
passed before allocation. An unused nested generation was cancelled before any
browser, retaining the canonical run directory for the refreshed generation.

## Exact native first failure

At `05:34:25.150Z`, the exact status query returns normally with no failure,
no parent wait, no `ready.json`, and `latest: null`. This is pending startup,
not a guest defect or a nonresponding query.

The unchanged native driver completes its startup image at
`05:34:26.395Z` and publishes `ready.json` at `05:34:26.402Z`, approximately
1.252 seconds after the status sample. The caller nevertheless invokes
`fetch-live.py` using the cached pending status. At `05:34:31.140Z`, its existing
ready-ACK assertion refuses **locally, before any remote fetch**. The owning
custody SIGTERM is sent at `05:34:31.247Z`, 107 ms after the terminal marker.
The actual parent returns 1 at `05:34:31.592Z`, with separate stdout/stderr EOF.

No game command, input, retry, quit, extension or second native execution was
issued. The only screenshot completed before the first failure and was recovered
with finalized evidence after cancellation. It is fully decoded and individually
model-reviewed: readable Nox demo splash, “Click to Continue”, and top-left
cursor. No dependent input follows it. The command-scoped CDP trace has no rows
because no game command was admitted; an exhaustive startup CDP wire trace is
not available. Native storage snapshot has zero events / zero records and a
null observation deadline, so it does not validate completed-command retention.

## Supported caller repair

`tools/nox-status-source.py` provides the actual caller barrier:

```sh
python3 tools/nox-status-source.py scratch/runs/<new-run>
```

Use it after the original launch and before the existing startup fetch helper.
It uses that run's existing `status.py` and immutable `browserDeadline`.
Responding pending snapshots remain WAIT; the barrier publishes
`startup-status.json` only after the existing ready ACK and startup capture
identity agree. The existing fetch, PNG verification, ownership/freshness checks
and individual model review still follow. Readiness alone does not certify a
usable image.

The first query failure/nonresponse, malformed reply, terminal status or
original deadline cancels owning custody without another query. An existing
status-wrapper cancellation is not repeated. An expired window cannot be
revived by a late READY reply, and a repeated caller invocation is refused.
The barrier neither fetches an image nor sends browser/game protocol. No guest
writes, artificial native calls, clock/tier changes, timeout extensions or
observation limit changes are introduced.

Fifteen focused controls reproduce the old refusal using this run's exact
pending reply, then exercise pending-to-ready using a retained actual ready
reply from 0423. Negative controls cover first failure/nonresponse, malformed
and contradictory replies, ended parent, expired and late replies, and pending
states that cannot renew the deadline. Actual CLI/subprocess peers cover
pending-to-ready publication, query failure, already-cancelled query, expiry,
and repeated invocation refusal. They start no browser or game. These controls
do **not** establish native success of the repaired caller or storage intervals.

## Lifecycle and recovery

Only `bx_mqns2ggw` was created, UUID
`c207a31c-9666-4869-b0c5-71efa7c77992`. The independent watchdog was prearmed
with immutable deadline `2026-11-10T05:58:27.767714Z`; initial API expiry was
`2026-11-10T05:58:28.800Z`. The original browser deadline was not extended.

Custody reaps all 172 owned tasks, with complete kernel fork lineage, no
unresolved lineage or remaining tasks. Independent checks find owned processes
absent and both ports closed. No separate Chrome exit result is claimed.

Before the delegated normal stop, independent rereads verify 37 artifact
references / 35 unique contents / 5,065,437 unique bytes, four finalized gzip
streams and one full PNG (all chunk CRCs, complete zlib stream and scanlines).
The sole unforced stop `stop_808fd4845ba2d740` completes at
`2026-11-10T05:35:05.958Z`. Independent API/receipt reads confirm archived,
expiry null, completed, forced false and no stop error. The watchdog supervisor
records actual wait 0 with separate stdout/stderr EOF; both processes are absent.
No other box was operated on.

Git is the source archive. Exact base SHAs, relevant binary diffs and owned new
file patches are retained, with original media referenced by path and SHA-256.
No source tree archive or evidence media copy is made. The recovery inventory
excludes the status regression's external symlink views from content reuse;
shutdown references resolve inside this run.

Next requires a separately authorized fresh original, using the caller barrier
before startup fetch, followed by individual image review and the ordinary
Jack / Bunker staff route. This task releases its paths and stops after
publication; the objective and native interval-storage validation remain open.
