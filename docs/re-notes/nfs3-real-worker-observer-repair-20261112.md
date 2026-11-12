# NFS3 real Worker timer observer qualified; original and control reach race

The production-Worker observer preflight now passes in real Chrome. The guarded
original and its same-box timer-unobserved control both reach a rendered race.
The earlier INITTIMER abort did **not** recur, so its cause remains **UNKNOWN**.
There is no proved runtime defect, production change or timer-fix claim.

Evidence roots:
`scratch/runs/20261112-nfs3-real-worker-observer-repair-1725/` and
`scratch/runs/20261112-nfs3-real-worker-observer-repair-1725-original/`.
Source anchor: main `9c8c8196e42e60a180401bb5b433e79e48974d77`, plus the
relevant binary diff, new-source patches and run-helper patches. Git is the
source archive; no source-tree or media archive was made.

## Endpoint diagnosis and helper repairs

The [previous preflight](nfs3-original-timer-init-cause-20261112.md) stopped after
five seconds. This run compared the exact successful
[Forsaken bootstrap](forsaken-paused-worker-20261112.md), its emitted attachment
helper, full-bootstrap controls and all 26 Chrome-parent receipts. Unchanged
controls are referenced by path and SHA-256 in `reused-controls.json`.

The new direct-ELF control recorded the actual PID, command line, process state,
wait channel and profile throughout a bounded 45-second endpoint window. Chrome
remained alive, initially with `pipe_read` and an empty profile, then published
its complete DevTools endpoint **15.195 seconds after spawn**. This disproves
permanent Chrome failure inferred from the old five-second timeout. It does not
identify the inner reason for that delay. A later `Page.navigate` became UNKNOWN;
that accepted operation was not replayed. Chrome ultimately exited 0, with both
output EOFs and an actual parent wait.

The working `/usr/bin/google-chrome` launcher was retained. Its actual emitted
process uses `/opt/google/chrome/chrome` with software-rendering, password-store,
language, fingerprint and timezone flags. `actual-guest-worker-lifecycle/` records
the published endpoint, actual `/proc` executable/arguments, allowlisted
environment observation and profile contents. There is no unmodified-Chrome or
uninstrumented-timing claim. Every new local Chrome had an independently observed
90-second watchdog armed **before** spawn, plus actual Chrome/watchdog parent
waits, stdout/stderr EOFs and profile removal.

Fixable preflight errors were corrected and rerun on the synthetic fixture:
missing fixture broker handlers for process/thread sound lifecycle notifications
and exit, then a real observer defect: `TextDecoder.decode` rejected its view of
shared memory. The observer now copies API-name bytes before decoding. It uses a
private, pinned copy of the production region map and pure-JavaScript translator
for guest reads, including sparse translation, without loading duplicate lexical
globals or invoking guest read/translation exports from imported hooks. The
proven `beforeScriptExecution` pause, call-frame evaluation and acknowledged
resume path installs it before actual Worker instantiation. No early paused
`Runtime.evaluate` workaround or forced original routine was used.

`qualification.json`, `all-parents.json` and the qualified observed/baseline
results prove actual `GuestWorkerLink`, production Worker imports and current04
CPU-module instantiation; paired Sleep(0) and ExitProcess(0) arguments/returns;
observation of fixture stores to `0x562ae8` and `0x79a1a4`; no observer error/drop;
and native fixture exit 0. Observed and timer-unobserved fixtures match the full
60 MiB guest-window SHA-256, known stores, exit, and six forwarded hook messages.
A deliberately throwing observer is rejected without resuming its script; the
failure and cleanup controls pass. This PE is only a fixture, not NFS3. Fixture
passivity does not establish identical whole-game scheduling.

## Natural original initializer witnesses

Only after qualification, the final caller's actual data/import branch and two
missing-import negative controls passed against all 133 installed files, exact
original EXE SHA-256
`0defab3eeb22ee4b6e0007a4d5b26a99d868008ba77e2b9bd3ef770e924548ad`
and executing CPU module SHA-256
`04c534192ee3fe39e388536c2ce710c12c47a5cd2ca4d95c19f9d00b1e8f0a17`.
The independent two-hour box watchdog was observed before allocation. Remote
provisioning was actually joined with exit 0 and both EOFs. All 604 final inputs
and the actual data/import branch passed again remotely before either original.
The incremental helper revision adds an explicit timer-unobserved case and
Chrome EOF receipts; its final manifest is `runtime-pins-v2.json`. All 604 files
also pass the final reread after both browsers close.

Both fresh profiles used the same native catalogue installer, first setup exit,
reload, native renderer chooser, Direct3D Device 1 selection, original unsupported
card warning, setup OK, reload and registered original launch. Native setup alone
wrote its settings. Both page routes request Software and retain
`mmTimerThread=true`, `asyncMultimediaTimer=false`. No guest-state/configuration,
clock, RNG, AI, readiness or physics override was supplied.

The observed main Worker is target `58C693A76318FAA87226E0682BD85384`, endpoint 1,
slot 0. Its complete first drain has 1,059 rows and zero drops/errors. It records
caller **`0x4f6e2e` → initializer `0x48dad0`** with native EAX=0, then a later
natural initializer call with EAX=128. The retained paired API witnesses are:

| Native action | Return |
| --- | --- |
| First timeGetDevCaps / timeBeginPeriod(1) | 0 / 0 |
| First timeSetEvent(9, 1, 0x48d810, 0, 0) | timer ID 1 |
| Natural reinitialization: timeKillEvent(109) / timeEndPeriod(1) | 0 / 0 |
| Second timeGetDevCaps / timeBeginPeriod(1) | 0 / 0 |
| Second timeSetEvent(6, 1, 0x48d810, 0, 0) | timer ID 110 |

At `0x48dc7b`, callback counters are respectively **2** and **1**, compared with
saved EBX=0; execution reaches successful branch `0x48dc9f`. Ready/active are
100 and 128 respectively, retries stay zero, and the failed-counter branch
`0x48dc84` is absent from the complete main-thread trace. The clearing routine
runs naturally during the second initialization before the new timer succeeds;
this is not an abort-path clearing witness. Static disassembly and
`timer-analysis.json` bind the API return addresses and branch interpretation.

The observed follow-up frame shows Single Race, lap 1/1, 2 MPH, with an owning
Software render endpoint 1/generation 1 and completed draws. The fresh
**timer-unobserved** control also reaches a rendered race/countdown, naturally
choosing Hot Pursuit. Its CPU target is `4832487B0C60BCF00C9F91C5E1651271`; module
bytes, policy and Software render owner are verified. It retains debugger/module
capture and the launcher flags, so it is not a debugger-free timing control.
Different native random race modes are not normalized or overridden. These are
two planned matched cases, not replay of an UNKNOWN operation.

There are 174,607 retained observer rows overall. Later long drain intervals cap
two secondary-thread buffers: their maximum cumulative dropped-row counts are
161,787 and 60,262. The main Worker has 1,217 retained rows and zero drops/errors
throughout. The first startup drains have zero drops; subsequent secondary
callback histories are incomplete. There is no exhaustive callback/timing claim.

## Recovery, disposal and remaining causal gap

`evidence-check.json` verifies 203 recovered run paths, 90 provider logs, 26 whole
PNGs with chunk CRC/full IDAT inflation, and 26 command ACK/review chains. Every
retrieved remote path was independently fetched twice and hash-checked. Executing
module bytes and large logs have exact gzip recovery maps. No original command
became UNKNOWN and no accepted operation was replayed.

There were zero driving inputs. One balanced Escape pulse opened the native
paused menu; its helper had `finally` release but no independent release witness,
so it is not promoted into qualified driving evidence. A native Quit mouse click
did not exit the game. Both browsers were then normally closed; there is no
native guest ExitProcess claim for the originals. Chrome, controller and owner
PIDs are independently absent, profiles removed and server ports closed. Both
Chrome parent waits record exit 0 and both EOFs; both controller owners, the local
manager and independent watchdog have actual successful waits and EOFs.

After hash-verified recovery, delegated normal stop completed at
**2026-11-12 17:35:10.209 UTC**, forced=false, error=null. Independent final state:
box **`bx_prdn62ye` ARCHIVED**, expiry **null**, receipt
**`stop_5f65f1af023db95d`**. No preexisting box was resumed, stopped or deleted.
Actual `/home` samples remained above 1.5 billion free bytes; no RAM gate was used.

The [earlier original abort](nfs3-native-race-lap-20261112.md) remains valid failure
evidence. Its causal blocker is now specific: **a failing natural initializer's
API returns, counter comparison and actual clearing/abort branch are still
missing**. This run supplies successful whole-original startup witnesses and a
qualified observer, not a retroactive cause for the earlier failure. No runtime
fix, build, repaired-original retest, purposeful corner/lap, FPS, audio, parity,
full27 or broad crash-free claim follows. No workers or public deployment were
launched.
