# Three retired 0.167.1 host recovery encodings

Resource-only run: `scratch/runs/20261112-three-old-hosts-dense-recovery-2345/`.
The task is restricted to the already retired code-mode-host, exec-server and
voice-host executable recovery gzip archives in the local app-server-daemon
0.167.1 release, plus their journals and restore recipes. The original raw
executables remain absent. No obsolete executable is run.

Recovery metadata and the new lossless encodings remain local and durable;
Git carries this scoped note, not executable bytes or evidence. Each component's
run subdirectory retains the exact prior journal and recipe, their hashes,
the replacement journal, the RAM restore test and a latest `RECOVERY.md` pointer.
The revised in-package journal points to that component's latest recovery note.
Historical journals preserve the original review provenance and superseded
gzip hashes; `encoded_path` and `encoding` identify the current encoding.

All **four** components must restore before any selection of 0.167.1:

| Component | Restore recipe relative to the 0.167.1 release |
| --- | --- |
| Root CLI | `bin/codex.restore-2200.py` |
| Code mode host | `bin/codex-code-mode-host.restore-deusex-2235.py` |
| Exec server | `bin/codex-exec-server.restore-lmarbles-2240.py` |
| Voice host | `codex-resources/voice/bin/codex-voice-host.restore-lmarbles-2240.py` |

The root CLI archive, journal and recipe are read-only inputs to this task.
Its existing XZ is 91,772,324 bytes, SHA-256
`71b7908c527bd757e3d6890f7b89b4ec24697d41b7e86f099a13cb90324a29dd`;
its latest recovery note remains
`scratch/runs/20261112-old-cli-dense-recovery-2255/RECOVERY.md`.
The voice recipe header is corrected to its actual voice/bin location, with a
fresh recipe hash in its journal.

Verification requires original encoded and decoded SHA-256 and sizes, original
recipe hashes and mode/mtime/owner metadata, selector checks and a privileged
read-only process reference scan. Candidates are encoded in RAM using XZ preset
9 extreme. Both Python and a separate `xz -dc` process check the full decoded
hash and size. Durable new archives, directory entries, updated recipes,
journals, prior recipes/hashes and recovery pointers precede unlinking the
larger equivalent gzip. The exact revised recipes restore only in isolated RAM
fixtures, verify mode and nanosecond mtime, and refuse overwrite. Current 0.167.2
file hashes, metadata and symlinks, selectors and root CLI recovery files are
compared before and after. No source code changes or source build are involved.

All checks passed. Only these three gzip encodings were replaced:

| Component | Prior gzip bytes | Durable XZ bytes | Encoded bytes recovered |
| --- | ---: | ---: | ---: |
| Code mode host | 29,059,206 | 19,407,728 | 9,651,478 |
| Exec server | 29,280,811 | 18,290,928 | 10,989,883 |
| Voice host | 12,182,542 | 7,838,920 | 4,343,622 |
| Total | 70,522,559 | 45,537,576 | 24,984,983 |

Filesystem allocation fell by 24,985,600 bytes across the three encodings.
Observed `/home` available space was **1,489,526,784 bytes before** and
**1,513,222,144 bytes after** the operation: an observed increase of 23,695,360
bytes while other workers shared the filesystem. These are point measurements;
they do not assert a continuous floor. The temporary durable overlap with each
gzip was necessary to publish and verify its recovery replacement before unlink.

Full original and new encoded hashes, original decoded hashes/sizes, recipe
hashes, and restore mode/mtime checks are in the run's component journals.
Each separate `xz -dc` decoder exited 0 with both streams complete. Each exact
revised recipe restored the full original bytes, mode 0755 and original
nanosecond mtime in RAM, then exited 1 with `Refuse overwrite` on a second call.
The unchanged root CLI recipe passed the same RAM fixture test. No executable
was restored into the actual old release, and none was executed. Before/after
checks cover all 53 current-release entries, including full hashes of 44 regular
files, selector identities and hashes, and root CLI archive/journal/recipe
identities and hashes. Privileged old-release reference scans were clear.

The run's top-level `RECOVERY.md` indexes each component's latest recovery
instructions; `result.json` records the outcome and exact observations.
`source-head.txt`, `publish.py.patch`, and the note patch record Git provenance
without archiving source trees. No current packages, binaries, selectors,
databases, sessions, cache catalog, reserve or other artifacts were changed.
No boxes were created: box ID/state/expiry and stop receipt are not applicable.

Next: gameplay workers can recheck actual available disk for their next step.
This resource task performs no gameplay, API allocation or deployment.
