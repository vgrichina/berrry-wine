# Redline publication caller integration, 2026-11-09 (1515)

Delivered a new outer CLI adapter, `tools/redline-publication-caller.cjs`, and
its actual generated-consumer seam tests. Existing providers remain unchanged.
The default command is exactly Node plus `tools/redline-native-trace.cjs
--caller`; explicit argv overrides remain literal argv. Without opt-in, the
adapter forwards the existing executable, arguments and spawn options exactly.

Explicit version `redline-publication-d0a9965a8-d54aa57e3-f977ebf7c-v1` verifies
the published launcher, observer, collector and actual Redline trace provider
before spawning. It selects the published launcher around the **owning caller**,
not around the browser spawn. The original generated browser launch still gets
the actual Chrome argv and owns the actual browser wait. The collector is the
only ptrace/wait consumer for its custody domain. No supervisor PID is presented
as a browser PID or browser exit receipt.

Example selection, after separately preparing existing Redline inputs,
custody-directory lifecycle.json, environment and an independent watchdog:

```sh
node tools/redline-publication-caller.cjs --launch /absolute/custody-run \
  --publication-observer=redline-publication-d0a9965a8-d54aa57e3-f977ebf7c-v1 \
  -- node tools/redline-native-trace.cjs --caller
node tools/redline-publication-caller.cjs --retrieve /absolute/custody-run
```

This is an additional caller path, not a migration of historical pins or an
authorization to run a browser. Existing startup/module preparation refusals
remain. The generated consumer candidate is byte-identical to the actual
`redline-native-trace.cjs.integrate()` result. The adapter does not change the
browser launch flags, readiness, first terminal, input, cleanup or trace JSON
retrieval. It passes lifecycle.browserDeadline unchanged to the published CLI,
whose cleanup deadline remains exactly 30 seconds later. Optional record/byte
bounds are version-gated and stay within the helper's hard bounds.

Separate post-owner retrieval bounds regular-file reads, rejects symlinks and
nonregular evidence, checks compressed and decoded custody limits, and invokes
the verified launcher's raw syscall/custody validator. It revalidates retained
bytes rather than trusting publication-validation.json. Gzip CRC, empty INVALID
evidence, sequence/hash chain, consumed-wait/raw-syscall links, missing footer
and declared observer bounds are distinct checks. Silent raw command output is
reported INVALID evidence without redefining a successful silent command.
Exit-group unreturned calls and observer saturation remain incomplete. Custody
completion never promotes publication, readiness, ancestry or atomicity; these
remain UNKNOWN. Per-stop fsync cost remains unmeasured: no native-ready claim,
deadline waiver or admission waiver follows from this work.

Ownership was read first. Q31475's published `6d966f9d1` RELEASE STOP and exact
UUID `7ec80f03-dd7d-47d5-b90b-a1415f8d3f82` API archive/physical drain were
observed on the board. Its normal stop was `stop_54e758ada497a4ee`, ended
13:53:20.194Z, initial expiry 14:15:28.321Z; final expiry was not returned.
The Q21495 historical/current closure was inspected without module selection
or fresh pin preparation: shared collector is frozen; new adapter paths are
outside that closure. The 1495 worker independently recorded that Redline and
publication providers are absent from its 730-provider closure. All existing
providers, Q2/Q3/CPU/WAT/helper/custody files remain untouched.

Evidence: `scratch/runs/20261109-redline-publication-caller-integration-1515/`.
Exact Git base is `268f279af324aa7eccd6b204ebe1a08443d44a6b`; relevant initial
provider diff is empty. The small owned patch is retained with the run; Git
is the source archive. No source archive, media or module was staged.

The final nine cases execute the adapter's real CLI, the literal generated
Redline Chrome launch statement and literal generated finalize/retrieve
expression, substituting only an inert executable for Chrome. They cover
direct write, temporary rename, ENOTDIR 20, EBADF 9, ENOENT 2, fork/exec and
cancel, plus OFF/ON success and cancellation controls. This is generated
launch/retrieval seam execution, not full browser/CDP or guest qualification.
The inert child writes a real tiny trace file; normal-run actual exit and natural
stream EOF are separately joined. During observer-enabled cancellation the
unchanged collector escalation killed the owning Node process before it saved
its browser wait and generated retrieval. These missing browser receipts stay
UNKNOWN, even though kernel custody completed. OFF/ON owner CLI exit codes match;
normal browser waits match; cancellation browser-level parity is UNKNOWN.
The outer collector records every owned
root/descendant's actual reap; no remaining identity is accepted. Independent
finite watchdogs are observably armed before launch, outside the collector's
P_ALL domain, then actually waited with separate EOF. Deadline and cleanup
metadata are checked. Stale version and all four provider drifts refuse before
spawn; damaged sequence, missing footer, empty/broken gzip and cap negatives
fail retrieval. Final journals retain unreturned-syscall incompleteness.

The first run exposed rejection of a legitimate silent command log and was
corrected. A second run hit its fixed 20-second offline deadline before the
generated seam, retained as failure. Later fresh runs declared 90-second
offline deadlines before launch; no running deadline was extended. A negative
test initially mutated an absent field and was corrected to corrupt the actual
sequence. Earlier default record caps saturated honestly; final tests select
16384 records with the same 4 MiB byte cap and retain the raw final journals.
Earlier iteration journals were losslessly gzip-compressed with SHA/recovery
records to keep /home above 1.5 GB; final raw evidence remains available.

Validation: final adapter CLI suite, four published launcher tests, four helper
tests, 46 kernel custody tests, eight reaper tests, existing startup-boundary
controls and locked build. The boundary controls execute the actual readiness
loop, including unchanged 100 waits / 101 stats / zero reads on absent-port
timeout. Historical startup/PID8107 UNKNOWN is unchanged.

No Box, browser, game, local Chrome, native retry, agent/worker or public
deployment was created. New Box ID/state/expiry/stop receipt:
NOT_CREATED / N/A / N/A / N/A. No inherited Box was contacted. Q21495 remains
sole NEXT runtime. Next work requires separately authorized current Redline
preparation/runtime; this adapter grants no native authorization.
