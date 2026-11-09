# Redline retrieval snapshots, 2026-11-09

Fixed an actual retrieval integrity and resource-bound defect in
`tools/redline-publication-caller.cjs`. Previously Node opened bounded regular
files with NOFOLLOW/NONBLOCK and returned hashes of those bytes, then Python
reopened the paths for preflight, artifact hashing, and validation. These reads
could observe different files and a later gzip expansion escaped preflight's
decoded-byte bound.

Retrieval now sends the exact captured buffers over stdin to
`redline-publication-snapshots.py`. This narrow adapter supplies an in-memory
path interface to the published launcher's unchanged validator. It expands
custody gzip once with cap+1, checks overflow, emptiness and CRC/trailer, then
supplies that same decoded buffer to both artifact inspection and custody
validation. Drain metadata can select only the captured custody filename.
There is no evidence-path reopen in Python. Empty command logs retain the
existing explicit `valid=false` / `empty evidence INVALID` result.

Executable reproduction uses the actual adapter CLI and Git-loaded old adapter
in memory (no source copies). Old retrieval returns a command-log artifact hash
that differs from its validation hash after replacement. A second reproduction
changes custody and its drain metadata after the bounded gzip preflight obtains
its bytes: old validation accepts more than 64 MiB of decoded custody. Both are
oldFAIL. Repaired retrieval uses the original snapshots through replacement,
growth, FIFO, symlink, compressed replacement and second-read race controls.
These small synthetic journals prove integrity behavior only, never custody of
a real process. Original inert-child tests separately exercise actual custody.

Evidence: `scratch/runs/20261109-redline-retrieval-snapshot-repair-1545/`.
Exact initial Git base is `de80d8a8739e248c79aabc8fdc15c9ca3678d1b0`;
`owned.patch` includes only this adapter, memory adapter, test, and note.
No source trees, media, or modules are archived.

Validation performed offline:

- New executable snapshot controls: oldFAIL/newPASS races, initial FIFO/symlink/
  oversized files, compressed and expanded caps, concatenated expansion,
  damaged/truncated/empty gzip, damaged observer sequence and uncaptured path.
- Original Redline caller suite: nine generated launch/retrieval scenarios,
  direct/rename/ENOTDIR20/EBADF9/ENOENT2/childexec/cancellation, OFF/ON parity,
  four provider drift refusals, candidate byte identity, damaged journals.
- Four launcher and four observer tests; 46 kernel and eight reaper tests.
- Fourteen startup boundary scenarios, retaining 100 waits/101 stats/zero reads,
  sticky first failure, late-admission refusal, actual wait separate from EOF.
- `flock /tmp/wine-build.lock bash tools/build.sh` passed.

Watchdogs were observably prearmed independent siblings outside custody wait
domains. Owned children and watchdogs were actually waited and streams drained;
kernel reaps are not promoted to browser EOF. The original deadline plus 30s
cleanup, sole ptrace/wait owner, readiness loop, explicit version barriers,
default-OFF argv/spawn options, and generated consumer remain unchanged. Shared
launcher/helper/collector and Q2/Q3/CPU/WAT/host providers were not edited.

Four inherited 1515 stdout/stderr gzip artifacts remain INVALID despite earlier
PASS labels: the two `*inherited*/original/chrome-stdout.gz` files are raw-zero;
the two stderr files are truncated 10-byte gzip headers with no decoded bytes.
Exact paths, sizes and hashes are in `inherited-invalid.json`. They were neither
modified nor promoted. Initial exploratory inventory counted only raw-zero
files; the final inventory explicitly includes all four invalid files.

No native attempt, browser, local Chrome, Box, game, retry, worker, agent, or
deployment was launched. Box ID/state/expiry/stop receipt: NOT_CREATED / N/A.
Historical startup/PID8107 UNKNOWN and cancellation browser-wait UNKNOWN remain
unchanged. Per-stop fsync cost is unmeasured; native readiness is false.
Next work requires separately authorized current Redline preparation, including
the new memory adapter in its staged closure; no native authorization follows
from these offline controls.
