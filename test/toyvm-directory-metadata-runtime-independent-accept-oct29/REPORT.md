# Independent directory metadata retained-runtime acceptance

PASS_SCOPED_RETAINED_RUNTIME_ACCEPTANCE for candidate
`5a88ca099b962e946160afd2d4d71a950bf46db3`. This independent offline review
accepts the retained result of exactly one earlier production CLI invocation;
it performed zero new runtime, backend, Boat, browser or guest invocations.

`canonical.json` records all five exact source byte/hash pins, the unchanged
499-byte fixture (SHA-256
`7b452a24219520c527283883861e9c31b48edf83d3aae82d07b7566bcbedd222`),
the original canonical and raw-runtime pins, independently derived source
arithmetic, measured final counters and all 22 rejecting controls.

The first behavioral verification consumed the actual argv and raw production
CLI stdout from the retained record, rather than executing a constructed
runner. The invocation uses `qualify_accounted.py --domain tiny-fixture` with
live/write/file limits 12288/65536/8192, RSS 134217728, CPU 2, wall 5 and output
4096, then `/usr/bin/python3 -B -c` with the byte-exact fixture. CLI and FUSE
process samples establish the relevant execution boundary and unchanged
backend quotas. Recorded remote executable identities match prelaunch evidence;
this task does not claim a fresh remote executable measurement.

The fixture creates D and empty D/A, verifies their types and zero file size,
emits `before-directory-metadata-over-budget`, then attempts D/E. Raw base64
payload and decoded marker agree. Actual CLI exit is 1, accepted=false, with
`filesystem allocation limit`. Measured post-reap counters are live=peak=12288,
written=0, inodes=3, openHandles=0. Every sampled owned PID/start identity is
covered by the final absent/reused observation; the backend receipt's owned
identities match. Unmount exits 0, server exits -15, remaining mounts are empty,
and no external safety cleanup was needed.

Independent AST inspection derives 4096 bytes per inode: root 4096, D 8192,
empty D/A 12288; D/E would need 16384. The create method charges before advancing
the inode allocator, inserting the inode or mutating the parent entry. This
is source inference; intermediate counters and rejection-time counters were
not directly measured. The adapter snapshots after supervised child execution.
No direct errno, instantaneous enforcement latency or realtime claim follows.

The 22 controls reject wrong file/write gates, absent marker, altered argv,
stale source identities, stale/missing PID/start identities, an unreaped process,
a remaining mount, forged acceptance, external safety cleanup and each incorrect
final counter. Source mutations reject late metadata charging, a write gate
substituted for the live gate, unconditional collection and missing metadata
reclamation. These are offline validator/source mutations; no backend was
imported or replayed. RMDIR reuse runtime belongs to another case and is neither
tested nor accepted here. Existing passing prerequisite groups are reused by
unchanged artifact identity, without replay.

All 17 committed artifact pins match. Of 43 historical raw-manifest entries,
42 match and the sole mismatch is the declared `admissions.jsonl` append:
5418 bytes became 12536. Its original 5418-byte prefix still matches the sealed
SHA-256; 17 appended records parse and pass the recorded admission floor and
RAM checks. This append does not alter source, fixture, runtime argv/output,
cleanup, canonical or measured counters, so it does not defeat scoped acceptance.
The original manifest and the declared delta are preserved unchanged. The full
historical raw manifest must not be described as matching.

Original procedural limitations remain: a source-only validation helper had a
globals/locals error corrected before its passing run, and historical diagnostic
files remain preserved. No gameplay, browser or general resource acceptance is
claimed. The exact empty guest-mount configuration is reused (no guest filename
mount argv exists); dedicated trusted Git SSH configuration is verified against
the direct task supervisor. No checkout, fetch or sparse expansion was needed.

The supplied import-safe supervisor was invoked directly, preserving original
infinite DATA hard limit with parent soft128MiB, Python child hard128MiB and Git
child hard256MiB only. CPU90/wall120/file12MiB/capture2MiB/evidence1MiB and
physical parentRSS128/groupRSS512 monitoring remain intact. Each operation
records fresh admission under the transferred 24MiB aggregate allocation.
No Node command ran. Initial root ref digest receipt is reused without capturing
the root ref listing. Only the assigned test directory is changed; root and
predecessor source/evidence are read-only. Main and public deployment are untouched.

Retained coordinator verification identifies `bx_489jsaq6` as stopped with a
completed verified snapshot. Original expiry was 2026-10-29T05:43:31.559Z;
the coordinator retains lifecycle ownership. This worker made no box API calls
and neither resumed nor stopped any box.

Inputs remain at
`/home/user/wine-assembly/scratch/usage-watch/toyvm-directory-metadata-limit-oct29/retained-evidence/`
and `/tmp/toyvm-directory-metadata-limit-oct29/repo/test/toyvm-directory-metadata-limit-oct29/`.
The original task commit `a00220e676723d5b12ed0078ae9a6941ba59938d` and verified
remote ref are bound by the coordinator completion receipt. Reproduction:

```sh
python3 -B /tmp/toyvm-directory-metadata-runtime-independent-accept-oct29/ops.py acceptance python3 -B /tmp/toyvm-directory-metadata-runtime-independent-accept-oct29/repo/test/toyvm-directory-metadata-runtime-independent-accept-oct29/accept.py
```

This command only validates retained evidence and writes this task's canonical
result. The retained raw input census is not copied or rewritten. Operation
receipts are under the task allocation's `e/`; publication and coordinator
messageboard handoff are recorded separately after exact remote SHA verification.
