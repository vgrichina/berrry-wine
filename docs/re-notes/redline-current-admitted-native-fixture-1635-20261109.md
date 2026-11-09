# Redline current admitted startup fixture, 1635

The offline preflight found that the full production fixture called the Git
provenance validator inside the staged runtime. Its generated owning caller
already supported a Git-free stage, but the outer fixture did not.

Published `df913d949` adds an explicit `--staged-fixture` production entry.
The preparing parent authenticates Git provenance and supplies the exact
manifest SHA independently of the staged manifest and seal. The new entry
checks that digest, versions, seal, unique provider bytes, owning caller source
and its closure digest before running the existing full fixture controller.
The same checks run again before the existing publication custody launch.
An altered manifest plus an altered seal cannot retarget the parent digest.
The original entry remains available with its original Git validation.

The full CLI/controller preflight runs with Git forbidden and
`DRIVER_PREFLIGHT=1`, which returns before server or Chrome creation. It
observes the controller's expected missing-ACK terminal after the owning caller
returns, then checks actual custody waits, reaps and separate outer pipe EOF.
Sixteen missing/changed-provider controls and forged-manifest repinning refuse
before spawn. The actual bounded snapshot retrieval also executes. The original
27 current-startup controls and the locked build pass. Fresh preparation's
transitive staged snapshot imports pass; removing each of four Python providers
refuses. These offline observations are not native readiness or browser EOF.

The final 903-provider manifest is
`8b99a1e5fdead1a6af8294c25dce8a3c1190e023fc3080be5b21aa47be8d9f3c`.
All 607 tracked providers match coherent published main. The active Q2 and Q3
provider paths are outside this closure; both preceding lanes also published
their final releases before allocation. The explicit publication selector is
`redline-current-publication-daa44c07c-v1`, and the startup selector is
`redline-startup-3e491c08-v1`. Primary CPU SHA remains `3e491c08…`.
The 20-second admission ceiling, 18.5-second caller cap, immutable browser
deadline, single comma600, independent UP, capture ACK, ordinary joined quit,
and sticky first failure are unchanged.

The retained predecessor's exact API state and completed unforced
`stop_5169faa2b0691980` were verified before allocation. Its retained original
350/350 and fixture 168/168 actual reap receipts, parent waits and physical
drain evidence were independently reread by SHA and size, with gzip CRC.

The sole new box is `bx_ncb2wqug`, UUID
`846740ce-e8a4-4e30-946a-249f07f89376`, created at
`2026-11-09T15:18:13.353Z`, initial expiry
`2026-11-09T15:43:11.205Z`. An independent observable UUID watchdog was
prearmed before allocation against an immutable 25-minute plan. The runtime
lock stays held through its actual join. The remote complete byte barrier
passed before the single native fixture invocation. The publication collector
is the sole ptrace owner; an ordinary remote parent records its own actual
fixture wait and separate pipe EOF.

The one actual fixture failed before recorded browser creation. Invocation was
at `15:19:37.337Z`; the owning caller wrote `execution-window.json` at
`15:38:11.633Z`, leaving 179.912 seconds until the original browser deadline
`15:41:11.545Z`. It never wrote `http-resolver-pins.json`, `process.json`,
`chrome-startup.json`, `startup-boundary.json`, a ready marker, an input ACK or
a capture. The actual startup diagnostic is therefore **NOT_CREATED**, not an
empty diagnostic promoted to proof. Native readiness, current CPU admission in
Chrome, browser EOF and the native startup cause remain **UNKNOWN**. No original
game, period, comma input, capture or retry occurred.

At the immutable boundary the publication custodian received SIGTERM; its
receipt records `supervisor-signal`, root exit `-9`, completion at
`15:41:11.933Z`, and 12/12 actual reaps with complete recorded fork lineage.
The ordinary fixture parent actually waited for controller exit 1 at
`15:41:12.118Z`, joining separate stdout/stderr EOF. The controller joined its
publication child and its own watchdog, both exit 1, with their separate pipe
EOF. Its final stderr is the secondary assertion that this watchdog was not
normally disarmed. The initial caught controller error was not retained;
deadline-triggered controller cancellation is an inference from the unchanged
controller and these timestamps, not a newly observed Chrome error.

The complete snapshot validator independently verifies the custody journal
and actual reap sequences. Its command log is empty and **INVALID**, and its
inner merged command EOF is **UNKNOWN** (`commandLog:null`); separate outer
pipe EOF does not fill that gap. The syscall observer ends incomplete with
`record-cap`, `unreturned-syscall` and `cancellation-sent`. Earlier bounded
snapshots show provider reads before guest entry and advancing custody stops.
They are not complete logs or EOF proof. The run does not measure the total
causal contribution of per-stop fsync or establish why native startup stalled.

Filesystem-only recovery found no live owned identities, runtime FD holders,
profile processes, profile or writer locks. No endpoint port was published, so
there is no independent numbered-port connect probe; this limit is retained.
Twenty logical evidence files (19 distinct stored SHA/size pairs) were compressed
before transfer and independently reread by SHA, size and outer gzip CRC. Valid inner gzip streams were also
checked; four empty artifacts remain **EMPTY_INVALID**, never native proof.
All evidence was verified before delegated normal shutdown was requested at
`15:41:45.542Z`.

Final box state is **ARCHIVED**, same exact ID and UUID. Unforced normal stop
`stop_e0bd4a87ad595fc7` completed at `15:41:47.791Z`, with no stop error.
Initial expiry remains `2026-11-09T15:43:11.205Z`; the final API returns
`archiveAfter:null` and does not return `expiresAt`. The independent box
watchdog actually joined with code 0 and separate stdout/stderr EOF, and the
lifecycle supervisor joined and released its lock. No box remains live for
this task. The first archived-state observation still had a pending stop;
the final exact-UUID read separately confirmed completion.

Evidence is retained under
`scratch/runs/20261109-redline-current-admitted-native-fixture-1635/`, with Git
base and small owned patches rather than source archives. Media and module
bytes are referenced by their existing paths and hashes. Recorded free local `/home`
checks remained above 1.5 GB; no RAM gate, local Chrome, source archive, agent, worker,
original-game attempt or public deployment was created.

Next is offline work on the actual pre-browser production path and its durable
first-error reporting. This task supplies no native retry authorization and
does not propose extending any limit. SingleTaskSTOP.
