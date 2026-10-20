# MIDI lifecycle independent review — incomplete, 2026-10-20

Candidate: `f0f203b185c633f0e4d9fface4fca8b3aba23c13`,
`origin/task/midi-stream-lifecycle-oct20`.
Read-only candidate directory: `/home/user/wine-midi-lifecycle`.
Verdict: **review blocked by reviewer workspace setup failure; no acceptance
or integration recommendation**. No proven production defect is reported.

## Executed coverage

Read AGENTS.md, CLAUDE.md, recent messageboard entries, candidate change summary,
candidate lifecycle note, full lifecycle test, MIDI host lifecycle implementation,
and WAT audio-handler diff. Independently executed:

```
node /home/user/wine-midi-lifecycle/test/test-midi-stream-lifecycle.js --mutations
```

Output: shared checkout
`scratch/runs/20261020-midi-lifecycle-review/candidate-tests.log`.
All 21 behavioral groups and 13 mutation controls passed. This compiles
extracted production WAT/imports in memory; it is not a full build, native
execution, browser/audio test, or original MadBomber qualification.
The runner checks nonzero mutation exits and AssertionError, but independent
per-mutation failure-location validation was not completed.

Coverage observed includes public Stop hash/dispatch and stdcall cleanup;
queued/playing/paused Stop, Reset and Close drains; DONE flags and function
notification arguments; sibling stream/synth isolation; header ownership;
pause timing; reentrant requeue; old registration identity after close/open;
NULL/window/event notifications; cooperative browser owner admission and wait
restoration; explicit unsupported SysEx/event modes. These are the candidate's
tests rerun independently, not newly authored independent edge-case probes.

Primary Microsoft documentation was inspected for
[Stop](https://learn.microsoft.com/en-us/windows/win32/api/mmeapi/nf-mmeapi-midistreamstop),
[Reset](https://learn.microsoft.com/en-us/windows/win32/api/mmeapi/nf-mmeapi-midioutreset),
[Pause](https://learn.microsoft.com/en-us/windows/win32/api/mmeapi/nf-mmeapi-midistreampause),
and [MIDIEVENT](https://learn.microsoft.com/en-us/windows/win32/api/mmeapi/ns-mmeapi-midievent).
The conformance comparison remains incomplete.

## Reviewer failure and recovery

The first sparse setup did not create the Git worktree `info` directory before
writing `sparse-checkout`. That write failed. The shell lacked `set -e`, so
`read-tree -mu HEAD` continued without the intended exact-file patterns and
materialized approximately 244 MiB. Free disk fell to 1,959,751,680 bytes,
below the required 2,210,398,208-byte floor. This violated the task's expansion
limit and prohibition on a broad checkout. This was a reviewer error, not a
candidate defect or an external access restriction.

Removed only the reviewer's new worktree with `git worktree remove --force`;
free disk recovered to 2,215,993,344 bytes. Stopped substantive review.
Recreated the report worktree with `set -e`, an explicitly created `info`
directory, worktree-local sparse configuration, and the single owned note
pattern before `read-tree`. Its initial footprint was 8 KiB.
The first attempt also set repository-local `core.sparseCheckout=true` and
`core.sparseCheckoutCone=false`; previous values were not captured, so no
claim of unchanged shared Git configuration is made. Shared HEAD and index
were checked unchanged:

* HEAD: `6aaf65235f367beb610931be83b4b1268ef35ad7`
* index SHA-256: `39bcbf945450c9777f637fea65fece292a0776f058226db425ad49e8892014e9`

No candidate production edits, main integration, workers, dependency install,
runtime, or protected laptop session access occurred. The existing test
finished successfully while setup was being recovered.

## Remaining work

A fresh bounded review must complete independent edge-case probes, mutation
failure-location inspection, candidate diff and final worker evidence review
(the worker final.txt was absent at the initial read), and conformance
assessment. In particular, advertised event/window transports, real event
signaling bindings, timing boundaries and fractional tick accumulation,
reused header/handle identities, unsupported input validation, and callback
reentrancy need independent scrutiny.

Even a passing source review would still require a separately authorized
canonical build and public x86 ABI/callback fixture, actual synth/audio
validation, and original MadBomber startup testing. No gameplay claim follows
from the isolated test result.
