# Recoil compound evidence journal, 2026-11-08

The compound journal removes the measured individual phase-save barriers and
moves durable name creation before the guarded compound window. **Qualification
still fails the unchanged 250 ms fence.** The fastest final trial reached durable
close at source age 230 ms, then the independent census correctly refused at
268 ms. No original, game, Resume, M, input or replay was run. Full27, parity,
audio and FPS remain open.

Evidence R: `scratch/runs/20261108-recoil-compound-journal-1823/`.
Starting Git SHA is in `starting-git-sha.txt`; predecessor is published
`706a23082`, described in `recoil-probe-journal-20261108.md`.
`measured-compound-regression.json` contains the independently audited trials.

## Implementation and unchanged fences

`native-source-retention.cjs` now streams an exclusively created, bounded 32 MiB
version-2 framed journal. Before the compound clock starts, `prepareProbe()`
creates its file, syncs it, syncs/closes its directory and keeps the exclusive
file descriptor. Each admitted frame owns immutable bytes and enters an ordered
asynchronous write queue. Source callbacks and phase saves do not await storage.
Short writes advance only by the reported count; zero/invalid progress refuses.

One complete transaction holds six complete uncached CDP response envelopes,
six matching proofs, the five original phase JSON payloads (entry, owner/read1,
owner/read2, pixels, return), and the actual PNG bytes passed to the sink after
real PNG inspection. The phase payloads retain their original content, including
the embedded pixel data URL. The separate binary PNG must match its inspected
result hash. Frame lengths, payload hashes, record counts and a terminal
whole-transaction hash make partial/truncated/corrupt diagnostic evidence
recognizable. There is no abandoned-journal certification or replay path.

Admission retains the original request/response timestamps; validation still
checks both complete three-lane groups, identities, hashes, byte counts, ordered
unique sequences, original timestamp brackets and uncached success. Final
validation, queued writes, terminal frame, file sync and close all precede the
strict gate's existing final owner/context/instance/script/retirement checks.
The <=250 ms monotonic flush deadline includes validation and preparation of
the seal; explicit elapsed checking also refuses delayed timer callbacks.
Timeout/error awaits writer settlement and close before leaving terminal UNKNOWN.
A complete seal describes content, never durability success or qualification.

The native adapter replaces the driver's individual phase-file save callback
with this journal sink in `responseDirectory` mode. Explicit legacy callbacks
remain available outside that mode. Source lanes retain allSettled drain.
Preparation/census failure also poisons and drains an otherwise unused prepared
journal; it cannot leave an open writer before a later replay. The new physical
driver prepares before calling the guarded probe and drains on guard failure.

The strict gate, clock producer/verifier, kernel custodian and production parent
are unchanged. Both original source reads, both copy ages and PNG freshness
through actual decode/save still face the 250 ms checks. The independent
challenged producer still performs its fresh post-probe census and durable proof
retention, rechecks source/PNG ages, and enforces its original immutable five
second transition. No restamping, cache, tmpfs, alternate clock, relaxed fence or
retirement exception was introduced.

## Actual Chrome comparison

One fresh box ran two finite alternating compound/published-journal comparisons
under the normal kernel and parent custody harness. Both use actual Chrome
Debugger.getScriptSource for the accepted 2,182,663-byte WASM (`6cf120d0`) and
actual decoder/compositor sources (`f468ffce` / `cb21daaf`). Existing module/source
paths and hashes are retained without repeated media. The normal native adapter,
strict Software gate, actual PNG decoder, phase payloads and independent clock
guard execute their real code. Ownership/instance objects and the one-pixel PNG
belong to the causal VM fixture, not an original Recoil run. This measures the
normal helper's evidence path; it does not qualify actual game ownership or HUD.

All eight trials retained six complete envelopes and six proofs: **48 of each**
were independently audited against accepted byte hashes and original uncached
CDP brackets. All four compound journals independently decoded to five phases
and the actual CRC-checked PNG. Every trial refused qualification.

| Run / compound trial | Two-read source window | Final file sync | Oldest source at durable close | Outcome |
| --- | ---: | ---: | ---: | --- |
| remote-a / 1 | 228 ms | 210.94 ms | 455 ms | strict freshness refusal |
| remote-a / 3 | 174 ms | 99.28 ms | 286 ms | strict freshness refusal |
| remote-b / 1 | 176 ms | 41.58 ms | 230 ms | post-census refusal at 268 ms |
| remote-b / 3 | 179 ms | 87.04 ms | 281 ms | strict freshness refusal |

Remote-b uses the final cleanup semantics. Remote-a differs only in prepared
journal cleanup and the baseline fixture loader; exact provider pins and a small
verified recovery patch reconstruct it. The baseline is the exact published
706a23082 journal/native code with unchanged strict gate. Final baseline modules
are reconstructed in memory from current paths plus verified small reverse edits.

In remote-b, published-journal source windows were 226/235 ms and oldest sources
at durable completion were 450/488 ms. Its final owner/pixels/return saves cost
**23.02+15.22+45.98 = 84.22 ms** and **24.74+52.98+73.18 = 150.91 ms**;
the between-read save cost 55.07/69.33 ms. Those per-phase fsyncs are absent from
both compound trials. Preparation (85.28/83.02 ms) precedes the guarded window.
The compound final-source-to-durable-close intervals are now 54/102 ms, versus
224/253 ms for the baseline. This removes the demonstrated phase-save bottleneck
without claiming a stable wall-time speedup from four variable-storage pairs.

The exact remaining fast-trial budget is 176 ms through the final source,
about 12 ms of staging/validation/writer completion, 41.58 ms final sync, then
about 38 ms for the independent final census/retention and checks: **268 ms**.
The second trial's 87.04 ms final sync already expires before that census.
This identifies both the remaining storage service time and the required
post-census margin; bypassing the census would be an invalid correction.

## Durable storage alternatives and safe next correction

`retrieved/durable-volume-measurement.json` records 24 finite storage-only trials
with 7 MiB of random synthetic data. Both `/home` and `/tmp` are durable ext4 on
the **same `/dev/vda1` device** (64769); `/tmp` is not substituted into the gate.
findmnt/lsblk show no separate usable evidence volume attached. The EFI boot
partition is not a candidate evidence volume; tmpfs mounts were excluded.

For `/home`, ordinary final fsyncs measured 22.44–48.41 ms, fdatasync
20.48–39.54 ms, preallocated fsync 19.55–23.02 ms, and preallocated fdatasync
19.81–27.69 ms. `/tmp` ordinary fsync measured 19.90–34.98 ms and preallocated
fsync 22.65–26.50 ms. These serial storage-only samples cannot replace the actual
Chrome syncs of 41.58–210.94 ms, or establish a different physical volume's speed.
No physically different usable durable volume was available to compare.

A concrete safe next code correction is to reserve the bounded file's real
extents with posix_fallocate before compound timing, sync its file/name there,
stream by explicit offsets, then truncate to the exact sealed length and perform
the same final fsync+close before all current checks. It must keep the 32 MiB
bound, crash/partial/error controls and immutable source timestamps. Storage-only
preallocation improved some samples but remains unqualified with Chrome/census;
this change is not implemented or represented as a gameplay-ready generation.
For the measured 176 ms source window, a durable service with <=10 ms final sync
would leave roughly 24 ms margin after the observed 38 ms census and 12 ms other
work; that is a measurement target, not a guarantee. If preallocation cannot meet
the complete fence, attach and measure a separate low-latency durable block
volume with those exact checks. Renaming a same-device path, using tmpfs or
removing producer-proof retention does not address the remaining cause safely.

## Selection, validation and lifecycle

`selected-runtime-pins.json` and its normal `position-runtime-pins.json` alias
contain 1,067 verified providers and 29 relocated physical helpers. Only the
native adapter and retention module change among shared providers. The new
physical driver preserves the prior two-callback patch, adds preparation and
failure drain, and is freshly pinned with its changed closure. Original851,
accepted1066 and the selected1067 predecessor remain immutable. Existing
unchanged source/kernel/clock proofs and accepted module pins were reused.
The current full-build WASM is not substituted for the selected accepted WASM.

Nine focused journal/sink tests pass: actual process crash during a partial
frame; exclusive abandoned-file refusal; immutable phases/PNG/sources; partial,
corrupt and oversized frames; byte/row/time bounds; short/zero writes; open,
write, sync, close and directory errors; late write/close completion; blocked
sync timer races; prepared-census failure; and retirement/context/age faults
through final flush. Native13, strict46, owner28 and lifecycle12+6 controls pass.
Actual Chrome clock controls pass with seven retained independent process proofs
and the final physical driver binding. Runtime selection8, physical closure13
and the final locked full build pass. The first clock invocation lacked its
required driver-path environment; its failure and normal teardown are retained
separately. The corrected final invocation passes.

The local comparison refused all four probes (one compound trial expired after
its first read); it remains distinct from the durable-box comparison. Both
remote runs completed normal kernel drain: **178/178 and 159/159**, exit 0,
remaining empty and unresolved lineage empty. CLONE_UNTRACED was not audited;
these results make no exhaustive lineage/history claim.

Before stop, independent checks found **341** recorded remote PID/start
identities absent, four ports closed, both profiles absent, no runtime FD writers
and the runtime lock free. All **123 remote outputs / 91,224,543 bytes** were
retrieved and independently reopened/hash-verified before delegated normal stop.
Box **bx_c26sux5t** is **ARCHIVED**, current expiry **NULL**, initial expiry
**2026-11-08T18:51:27.138Z**. Normal stop **stop_d1c77c185b83e0c3** completed
**18:31:22.927Z**, forced FALSE, error NULL. The independent observable 25-minute
watchdog preceded the one persisted UUID allocation key; actual ID/expiry
preceded runtime. Local lifecycle roles exited and their supervisor has no
remaining children. Local drain and final independent artifact checks are in R.

Git SHA, relevant binary diff, small owned patches, provider pins and existing
module/source path/hash references provide recovery. No source-tree archive,
media duplication, peer WIP, old box resume/delete, deployment or subworkers were
used. The selected generation is prepared for further causal testing, **not
qualified for gameplay input**; the exact remaining cause is above.
