# Original LBreakout: startup completion deadline before first image

Evidence: `scratch/runs/20261110-lbreakout-first-menu-gameplay-0343/` (ignored).

The single authorized original run failed before its first image. The generated
caller composed `startup_workflow_source(pause_workflow_source(...))` using
`d3651d790` startup admission, `066634cdb` menu completion and `b1dc83b64`
paddle completion. Accepted fixture `4fc62b7d7` was hash-verified unchanged;
there was no native fixture repeat.

Startup armed at `2026-11-10T03:46:11.033Z` with original EXE base `0x400000`,
SDL base `0x5f0000`, generation 1, mapping state 2. The original two-second
deadline was `03:46:13.032Z`. The first failure at `03:46:13.054Z` was
`guest completion deadline`. The retained observer console contains only
`completion-arm`, with no original SDL display-return or menu-manager return.
The saved prior renderer-readiness slice was sequence 42, EIP `0x6108fa`.
That earlier slice does not establish the guest PC at failure. Console reaches
original window title `LBreakout2` and secondary-worker initialization before
arming. The evidence does not establish whether the game stalled or would
eventually display a menu. No screenshot exists; menu, Local Game, level,
paddle, pause/resume, Space and score remain unverified.

The filesystem monitor detected the first failure and sent owning SIGTERM at
`03:46:13.067Z` to Chrome 6725 and launcher 6716. No input, capture, retry,
quit, extension, or later game protocol was sent. The actual launcher parent
recorded wait -15 at `03:46:13.070Z`, with separate stdout and stderr EOFs.
Only passive terminal evidence retrieval and lifecycle operations followed.

Offline inspection found a diagnostic loss in the completion caller: its
deadline check precedes the next observer read, and it discarded the previous
validated snapshot. The repair retains that last snapshot in memory and writes
it locally on the first failure before terminal cancellation, without another
protocol request. Startup snapshots now include the read-only guest EIP.
Terminal reuse cannot overwrite the first diagnostic. This repairs evidence
loss; it does not repair or explain the original startup execution cost.
Duplicate startup composition now explicitly refuses a second startup arm.
The unchanged two-second bound, immutable runtime deadline, clocks, tiers,
instruction budgets and original display conditions remain enforced.

Preallocation validation passed eight startup observer cases, seven full
generated startup controls, nineteen composed menu/paddle controls, actual
generated attached-Worker and host initialization with original Worker
installation and real Wasm, original compiled SDL/menu/paddle controls,
13 inspection tests, pause/explicit level-start regressions and a locked build.
Offline repair validation covers retained last phase/PC on timeout with zero
later protocol, sticky first-failure evidence, duplicate composition refusal,
observer and generated transport controls, installed-instance replacement
refusal and a further locked build. `080064edf` unobserved arrow/combined-play
refusals, reviewed-image binding, explicit `completion:level-start`, and
separate P pause/P resume/Space commands remain intact. Early development test
failures (newline equality and missing duplicate-composition refusal) are
retained in the run; neither caused another native attempt.

The prearmed independent immutable watchdog bound UUID
`04febb56-0ee2-4706-95e7-03794e11e238` to `bx_azpsrme4`, initial API expiry
`2026-11-10T04:10:34.438Z`, deadline epoch `1794283834.9855068`.
After cancellation, 32 references to 30 unique artifacts (2,498,103 bytes)
were retrieved and independently reread for SHA-256 and size. No PNG or gzip
was generated. All 837 runtime pins matched; module SHA-256 was
`4f2c69a1528e01a9ab5127201d5e8a222da2a35236377a1351f444f55fa5a7d9`.
Only after finalized evidence verification did the sole delegate request
unforced normal stop. Receipt `stop_cbe69a7349613dfd` completed at
`2026-11-10T03:46:29.642Z`. Final state is **archived**, expiry **null**.
The watchdog's actual parent wait returned 0 with separate stdout/stderr EOFs;
the immutable deadline hash was rechecked. Other boxes were untouched.

Git plus recorded binary diffs and small helper patches preserve source;
media is referenced by existing paths and hashes. No source archives, evidence
media copies, guest writes, artificial native calls, local Chrome or nested
workers were used. Shared CRT, renderer, startup providers, Nox and Q3 were
read-only. Next is offline original-startup diagnosis using the retained
failure; a further native attempt requires separate authorization. This
single-task worker has stopped.
