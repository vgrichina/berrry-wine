# Quake II: shattered window to lower passage, 0537

One fresh original Outer Base run visibly progressed through the shattered
window, around the crates inside its room, and down a floor hatch into a distinct
red-lit lower passage. I personally viewed each fresh decision PNG before issuing
the next command. The final PNG shows the blaster and HP85 in that lower passage.
No guard encounter, operated door, kill, or damage cause is established.

Evidence: `scratch/runs/20261109-quake2-shattered-pane-onward-0537/` (ignored).

## Decisive visual evidence

* Before this run I personally viewed Q20517's panel-fired PNG: projectile,
  shattered pane, HP100. Its final close-wall HP92 image proves neither passage
  nor the cause of damage. Its failed normal shutdown requiring TERM after
  13.493 seconds remains failed.
* Fresh `review/pane-result.png` shows shattered glass and flying fragments at
  HP100. `frame-forward-result.png`, a close wall at HP99, is insufficient alone.
* `review/frame-right-consequence.png`, captured 2026-11-09 05:50:18.378Z
  (completed 18.838), shows the interior side of the window, STROGG crates and a
  corpse at the player's feet, establishing entry into the window room. SHA-256:
  `11463eef03054f69df66969255fbd105d75160bb725fff0199375151d0664bd9`.
* Fresh views then show the floor hatch and ladder. The last command,
  `descend-visible-hatch`, follows the personally reviewed `hatch-overlook.png`.
  `review/hatch-descent-result.png`, captured 05:51:55.007Z (completed 55.377),
  shows the distinct red-lit lower passage, HP85. It is 207599 bytes, SHA-256
  `1b12ba189f58b3eb6a568a4fd1be1e51e99075ed723a71eee6e66d710f433ca5`.

HP fell from 100 to 99, 95 and 85 during traversal; damage cause is UNKNOWN.
Command names describing attempted doorways or ramps are intentions, not proof
of those events. There were no later input commands, captures or runtime retries
after the final reviewed success image.

## Exact production preparation and input

Preparation Git base: `1e0b662f93dab635fa9f17f68e9488c9a6ea3b4f`.
Published sparse reader `6e18a9865db6764b10e6f0becc1b9b951a4dac79`, persistent
caller `1473c5952a52d5d2b4546b93a0d462b64fe5c6cd`, and custody
`4341b87723a7d56bc98223215cca4cdc878fcae2` were pinned explicitly. Later shared
custody edits were not staged into this box. CPU module: 2185596 bytes, SHA-256
`a320d4c85156644fd12b6134d66b11784f3100b9b135756206c087cdacd43295`.

`runtime-pins.json` covers 722 staged providers (110089205 bytes); its SHA-256 is
`a0f1d9d5ff39dbc10cf90bc145acec5122059741dad2093ccb7484d94482604a`.
The production compiled driver passed offline composition/preflight before box
creation. Both strict flags, canonical seven EXEs, owning-memory identity,
pre-CPU/pre-DLLmain zero-entry barriers, all work/ACK/hold/freshness/close caps
were unchanged. Native lifetime remains REVOKED; all-writers and edict ABA remain
UNKNOWN. No guest writes or rebinding were used.

The first actual sparse read before gameplay found Enter13 +attack at 150936080,
Control133 +movedown at 150937392, and Mouse1200 +attack at 150935088. All 354
samples were SNAPSHOT on one memory identity
`c2043b68-3b75-43af-8ac8-f5bc2aca0ad2:9/c2043b68-3b75-43af-8ac8-f5bc2aca0ad2:10`.
These latch snapshots are not event-consumption proof. The visible consequences
come from the personally reviewed images. The run used 47 native holds and two
capture-only loading waits, with 50 capture receipts including startup (51 PNGs
including the additional held-fire image).

The persistent caller retained one stdin PIPE, started concurrent stdout/stderr
drains before start, and kept stdin open throughout gameplay. Transport spawn
was not treated as browser readiness. Actual DevTools readiness took 31975 ms;
Chrome was 151.0.7922.108, JS 15.1.206.16. Original startup was 05:41:10.500Z,
ready 05:41:26.253Z.

## Tests and recovery

No production source was changed. As requested, the exact SHA/source-matched
0517 test/build proofs were reused rather than rebuilding different shared
sources: `offline-preparation.json` records 19 verified size/SHA references,
including the 0505 focused, composed, comparison and locked-build logs and the
0158/0415/0435 supporting proofs. `prior-0517-verified.json` verifies 523 prior
evidence rows, including 279 gzip CRC checks. Fresh controller tests passed the
actual prepared launch/request branches for open-command-then-EOF and EOF while
pending, with retained PIPE, actual waits and distinct stdout/stderr EOF.

`verify.py` passed: all command ACK releases, unchanged barriers, sparse identity,
all 51 PNG chunk CRCs and decompression, capture hashes, command/capture ordering,
retrieval hashes, actual waits and kernel journal reap records were checked.
`gameplay-and-drain-verified.json` records the result. Free /home stayed above
1.5 GB (1985085440 bytes at verification); no RAM gate or old-run deletion.

Recovery uses Git base plus small binary patches and existing media/module
path/SHA references. There are no source, media or module archives. All 667
remote regular-file rows (26292639 stored row bytes, 366 newly stored unique
contents) were retrieved and independently size/SHA checked; gzip streams passed
CRC/decompression before delegated archive. `retrieval-verified.json.gz` maps
every remote path to stored content, including contents already fetched for
personal PNG review.

## Runtime release and actual drain

Super0525's ARCHIVED PHYSICAL_DRAINED release preceded Warcraft0535. The exact
Warcraft0535 release was observed at 05:38:57Z: bx_92fqhutz,
UUID 1bcb6c26-4bd9-48e9-8970-b2ccc39a9734, stop_4c1cd00a31228a2e,
completed 05:38:39.775Z. No peer runtime was modified.

An observable independent watchdog was armed at 05:39:36.983Z, before create,
against immutable UUID `ccedbe56-cc5a-4dbd-a816-69cc1d4b5e5d` and a 25-minute
deadline. Exactly one box was created: **bx_fyfyrenn**, finite TTL1491 seconds,
initial expiry/archiveAfter **2026-11-09T06:04:36.934Z**.

After recording visual success, intentional stdin EOF revoked input. The first
failure receipt is caller input revocation during this cleanup. No subsequent
browser/original input or capture was attempted. This was independent no-input
cleanup, not a successful normal browser-close trial. The kernel-cancelled
launcher exited -9; local caller and remote parent/supervisor actually waited
with status1 and distinct stdout/stderr EOF. No absent terminal receipt is
promoted into a close proof.

Kernel custody records **353 owned / 353 actual reaps**, 3955 journal events,
complete true and command-log EOF true, with no remaining, unreaped or unresolved
ptrace/lineage/resume entries. Each reap was matched to its before-reap record,
PID/start identity and status. Tracked runtime processes, ports42339/42577,
descriptor writers and runtime/input locks drained; the profile directory itself
remained present. Historical all-writers UNKNOWN is not upgraded by a census.

Archive was requested only after retrieval verification, at 05:53:25.895Z.
Final box state **ARCHIVED**, stopped 05:53:26.254Z; receipt
**stop_e280fc7496b4f011**, completed **05:53:26.273Z**, forced false, error null.
Final archiveAfter is null; expiresAt was not returned. Watchdog and lifecycle
supervisor both actually waited status0 with separate stdout/stderr EOF, and
the local lifecycle lock was released. PHYSICAL_DRAINED was posted at 05:53:35Z;
the 05:53:56Z board correction fixes only the two capture subsecond transcriptions.

The auxiliary local messageboard watcher returned status143 without its inner
tail wait/EOF receipt. Its stdout gzip lacks the closing trailer; the original
bytes are preserved and a partial decompressed text recovery is marked
unqualified. No tail wait or separate EOF is inferred from process absence.
This does not affect the independently verified remote runtime retrieval and
actual custody/caller/watchdog/lifecycle waits above.

Done: visible onward passage beyond the pane verified. No further task or runtime
attempt is scheduled; single-task STOP.
