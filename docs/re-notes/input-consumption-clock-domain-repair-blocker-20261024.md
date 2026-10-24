# Input consumption clock repair: acceptance blocker — 2026-10-24

Status: **BLOCKED before implementation**. The required immutable correctness
command cannot exit 0 under its own assertions. No repair is claimed, and the
clock-domain defect in source candidate `01da39b4471d7f2827be043804b755aa9bb6b141`
remains open. This report branch starts from that exact candidate, whose parent
is accepted main `adb2852f0ad9944625d809fd9b73c50dc3d4514e`. No main integration.

## Exact contradiction

External immutable reproducer:
`/tmp/input-consumption-independent-integrate-oct24/independent-controls.js`

SHA-256: `3026681798630ccbe2b93957ac31b1f40cf83540723c678dbe1fe2e374e059cf`.

Line 118 unconditionally executes:

```js
assert.strictEqual(actualGuestTick,14);assert.strictEqual(reported,1400);
```

Line 120 executes with the required flag:

```js
if(process.argv.includes('--assert-correct-last-tick')) assert.strictEqual(reported,actualGuestTick,'lastGuestTick is not the last guest-visible return');
```

Both values are local constants; `reported` is the primitive Number parsed from
the trace. Passing requires that same value to equal both 1400 and 14. An honest
repair that reports 14 fails line 118; the original that reports 1400 fails line
120. Reporting unavailable also cannot satisfy line 118. Changing guest clock
semantics, altering assertions or intercepting the assertion machinery is outside
the assignment and would invalidate the independent control.

The default invocation intentionally asserts the known defect and is not a
passing correctness criterion. It was not run in this task.

## Exact replay and retained evidence

```sh
node --max-old-space-size=256 /tmp/input-consumption-independent-integrate-oct24/independent-controls.js /tmp/input-consumption-clock-domain-repair-oct24/repo --assert-correct-last-tick
```

Replay of the unchanged candidate exited **1**, at `1400 !== 14`. Output SHA-256
`c79dd2607f4930b0ad75a4821c451c02a066dcc424c9574f9dea3ae8c6b14d94` matches the
previous review's unchanged `control-5.log` byte for byte. This preserves the
original rejecting control rather than substituting a new oracle.

External evidence root: `/tmp/input-consumption-clock-domain-repair-oct24/`.
`admission.json` binds verified candidate blobs and the oracle identity;
`oracle-blocker.json` records the exact command, conflicting source lines, fresh
MemAvailable, result, elapsed time and output identities; `unchanged-oracle.log`
contains its output. CPU and wall limits were 60 seconds, Node old space 256 MiB.
No further acceptance suite was run because no implementation was made.

The production startup wrapper was inspected: `test/run.js:4422` maps both batch
readers, `h.get_ticks = guestClock.ticks` installs the mapped guest source, and
the snapshot at line 4473 reads raw `tickState.lastTick`. The reproduced defect
is real; the blocker concerns accepting its repair, not disputing the defect.

Resume condition: coordinator supplies an independently corrected, explicitly
authorized correctness oracle that stops unconditionally requiring the known
wrong value in correctness mode. Retain the original immutable script and its
reject receipt. This is a concrete contradictory acceptance dependency, not a
request for approval of routine bookkeeping.

Root tracked files/index/refs and donor inputs were read only. Only this focused
report is changed in the private explicit sparse checkout; no tracing or guest
clock source or independent oracle was changed. No compiler, Wasm, guest,
browser, package, download, deployment, worker launch or box operation occurred.
No boxes assigned: ID/state/expiry N/A; all unused, lifecycle coordinator-owned.
