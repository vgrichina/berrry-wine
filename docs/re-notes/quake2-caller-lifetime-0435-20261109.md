# Quake II caller input lifetime, 0435

Fixed offline. The production Q2 caller now requires an explicit start message
over a retained input pipe before remote launch. A shared Q3 input reader
observes EOF while launch, setup or a command is pending. EOF latches the first
terminal UNKNOWN, stops admission, discards queued commands, starts bounded
cleanup and prevents launch completion from resuming the caller.

Evidence: `scratch/runs/20261109-quake2-caller-lifetime-0435/` (R). Exact Git base
`6fe9107fbd7babb6e26c959cb32606b7c330d6e3`; recovery is Git plus the small
`owned.patch`, including new tests and this note. No source tree, game media or
module archives were made. Run artifacts remain ignored, outside the commit.

## Retained defect and scope

Read the 0425 note, both production callers, actual 0425 `control.py`,
`run-command.py`, and `original-client-command.json.gz`. The retained command
invoked `tools/quake2-native-launch-client.py` with task SHA
`074bc79953322718d620f0f3aee2565606aea29875fc166514665351587f9c4d`.
The wrapper used `Popen(command, stdout=PIPE, stderr=PIPE)` with inherited stdin;
it established no persistent input writer. The old production main started the
launch thread before reading stdin. Retained terminal time is
04:25:13.166589Z (`session closed`), followed by six automatic HTTP rows and a
DevTools-ready record. There is no retained strict startup/launch/ready receipt
or guest execution proof. Original execution, live bindings, consumption and
weapon effect remain UNKNOWN. No broader historical cause is inferred.

Killing the local Boat transport did not cancel its remote supervisor. Q2 now
attempts one run-scoped cleanup transport that publishes a sticky
`caller-cancelled.json` marker. This operation cannot send input, capture or
launch another original. A marker predating remote-parent startup prevents
spawning; an existing remote parent observes it and signals its actual
supervisor once. The existing kernel owner and immutable deadlines still own
descendant drain. Parent waits and each stream EOF remain separate receipts.
If the output directory already exists, revocation also publishes an explicitly
caller-sourced first-failure record to wake a pending numbered ACK sender,
preserving any earlier fault. No ACK or guest failure is invented. The cleanup
transport can use the existing two-second local cleanup budget; it receives no
additional budget and cannot block indefinitely.
The driver checks revocation before automatic setup, each HTTP resolver step,
browser spawn, ordinary CDP sends, command execution and capture.

Remote cancellation is asynchronous: no claim is made that a remote operation
already in flight is retroactively prevented at the local EOF timestamp. Failed
delivery or missing drain proof remains UNKNOWN; local cleanup success never
upgrades remote custody. No retry or replay is added. Independent physical
keyUp and Browser.close remain admitted for cleanup after terminal failure.

## Supported controller lifecycle

For a separately authorized fresh run, stage and hash all providers, then use
a controller that retains `Popen(..., stdin=PIPE, stdout=PIPE, stderr=PIPE)`.
Drain stdout and stderr concurrently and retain the process and writer through
setup and commands. Wait for `OWNED_INPUT_READY`, then write and flush exactly:

```json
{"start":true}
```

Wait for `OWNED_LAUNCH_STARTED` before sending ordinary command/review JSON
lines on that same pipe. This message proves local launch-transport spawn, not
remote readiness or guest execution. Inspect the ordinary readiness evidence
before gameplay. Flush every command, keep the writer open between commands,
and continue draining both outputs. Closing the writer is terminal
cancellation; await the caller (status 1), both stream EOFs and the separately
retained remote drain evidence. A one-shot wrapper with inherited stdin, a
finished here-document, or a writer reopened after EOF cannot provide this
lifecycle. The shared Q3 entry requires the same start handshake; its remote
custody remains UNKNOWN and it does not acquire Q2's remote cancellation hook.

## Verification

`lifetime-final-3.log`: six production CLI cases use the actual hash-checked 0425
launch/request branches. A local Boat executable executes real Python children;
only the remote startup barrier and supervisor workload are explicit fixture
adapters. The remote-parent implementation is production code. No network,
browser, box or original is started. Cases cover closed pipe, `/dev/null` EOF,
command without start, EOF during startup, EOF during a real pending Node
request, and an open pipe permitting setup plus a real numbered capture
command/ACK. Actual caller, transport and workload waits, distinct stdout/stderr
EOFs and absent process identities are asserted. Late readiness cannot resume
the cancelled workload. No later numbered command or PNG is produced. A
preexisting marker separately prevents any remote child spawn.
Each local transport must also retain its actual wait and distinct stream EOFs
for the interpreter standing in for remote execution. The request interpreter
executes the real retained `subprocess.run` Node sender and waits it.

The same test executes both old caller/shared-Q3 sources directly from Git in
memory: old main records EOF and still permits the fixture's subsequent
automatic setup. Test-owned revocation then drains it. This is an authored
offline regression, not new historical or guest evidence.

`bootstrap-final.log`: executes actual composed automatic-bootstrap and send
guards with offline adapters. Old code continues all six HTTP steps and reaches
the intercepted spawn site after revocation (expected FAIL). New code prevents
setup entirely when already revoked, or stops after the first in-flight HTTP
step when revocation arrives during setup. Capture and keyDown are rejected;
independent keyUp and Browser.close still complete. UNKNOWN is sticky.

Existing Q2 caller suite: 12 terminal/pending cases, real sender success/failure
and retained wrapper wait/EOF case PASS. Existing Q3 suite: six terminal/pending
cases, two real numbered requests/ACKs, EOF-before-wait and held-pipe incomplete
cleanup controls PASS. A successful launch-transport exit now correctly throws
terminal rather than returning to caller bootstrap; its success test records
that expectation. All 11 existing composed-driver cases PASS, including actual
Node children, 20s work/22s ACK/30s cleanup controls, partial DOWN independent
UP, failed close and pending cancellation. Passive attack reader regression
also PASS. No browser-based tests were invoked.

`flock /tmp/wine-build.lock bash tools/build.sh` PASS (`build-final.log`). Strict
all-caps observation flags and the before-CPU/pre-DllMain zero-entry block remain
unchanged, as do work/ACK/close/hold/freshness limits and cleanup reserves. The
CPU remains 2,185,596 bytes, SHA-256
`a320d4c85156644fd12b6134d66b11784f3100b9b135756206c087cdacd43295`.

No shared custody, Warcraft or Super files changed. Free /home remained above
1.5 GB. No agents/workers, boxes, browser, original, public deployment or guest
writes were used. Box ID/state/expiry/stop receipt: **NOT_CREATED / null / null /
null**. Native source lifetime remains REVOKED; all-writers, edict ABA and
historical cleanup causes remain UNKNOWN. Next is a separately authorized
fresh original using the persistent controller lifecycle above; this task stops
after publishing the fix.
