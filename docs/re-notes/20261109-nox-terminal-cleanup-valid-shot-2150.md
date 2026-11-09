# Nox terminal cleanup repair and native fixture lineage refusal

The Nox-only cleanup repair is published on main in
`9a837dfd21cef4c3f36ee84724402482f9fa9685`. The supported left-click shot
command passed the actual generated consumer before allocation. No native shot
was issued: the sole native fixture failed the final custody lineage gate, so
the conditional original was never launched.

Evidence: `scratch/runs/20261109-nox-terminal-cleanup-valid-shot-2150/`.

## Generated handling and validation

`tools/nox-current-driver.cjs` adds a terminal latch to the generated Nox
consumer. Protocol errors, actual request timeouts, synchronous send failures,
evaluation exceptions, browser exit, observed guest death, and held-input
observation failures stop subsequent protocol sends. Pending requests reject
with the first error. Terminal cleanup skips native-event evaluation and
`Browser.close`; existing bounded OS containment and transport/server closure
remain. Ordinary planned close retains event retrieval and `Browser.close`.
The generated Nox transport also treats a pre-effect stale-scene refusal as
terminal. The underlying identity, age, input bounds, and sticky guards remain.
Shared providers, Redline, Q3, game code, and media were not changed.

The final generated consumer passed 20 controls, including immutable-input and
repinning refusals, startup failures/death, ordinary close, all intended input
forms, unsupported action refusal, stale refusal, held-key identity failure,
and actual 20-second mouse/screenshot request timeouts. The command control
actually admitted `action: click`, `button: left`, a normalized target and
150ms hold; it recorded native mouse press/release and a successful capture.
These offline browser-boundary controls use a Node peer, not local Chrome.

Seven whole-consumer controls ran under real kernel custody. All reaped 18/18
tasks, finalized journals, and completed command EOF. Failure cases recorded
zero protocol sends after the observed terminal boundary; planned completion
retained its normal close. The managed rerun returned 0 with actual parent wait
and separate stdout/stderr EOF. One earlier outer shell ended with signal 143
after producing passing case records; the managed rerun resolves that exit-status
uncertainty (`sealed/terminal-custody-parent-wait.json`).

Unchanged durability controls passed: eight actual CONTs including two EXITs,
the real first-unlinked-EXIT fixture with six CONTs, five sticky-error/bounds/
footer/admission controls, and whole-consumer slow-journal custody. The controlled
12ms-fsync comparison retained 115 versus 65 syncs and 13/13 reaps in both arms.
Three native-input controls, two original-error preservation controls, and
`flock /tmp/wine-build.lock bash tools/build.sh` passed.

## Native discriminating failure

Both phase manifests were independently sealed and reread before allocation:
833 pins per phase. All 837 staged inputs were independently verified remotely.
Exactly one changed native fixture ran on Chrome 151.0.7922.108. Startup retained
the original 100x100ms bound; measured readiness was 5806.793ms / 49 polls.
The consumer returned 0, Chrome exited 0, and the final app-selection boundary
confirmed zero original launches. Its ordinary close preceded the custody failure.

The final drain nevertheless reported `complete: false` and
`kernelForkLineageComplete: false`; the supervisor parent returned 1 with both
EOFs. All 147 owned tasks were reaped, with no remaining tasks, unresolved ptrace
stops, resumes, or exec transfers. Two reaped threads retained unresolved
`kernel-autoattach-stop` lineage: TIDs 6771/6770, TGID 6760, observed parent 6607,
with no parent custodian. Journal sequences 1921–1941 record their unlinked EXIT
retirement and actual reaping. `native-lineage-diagnostic.json` preserves those
rows and the independently checked decoded journal hash.

This is a lineage-proof refusal, not an unreaped-task or port-readiness claim.
No causal attribution to the cleanup repair is established. The first failed
gate was terminal: no original launch, later input/capture/retry/quit, second
fixture, second box, or guard extension. No charge change, shot, or target damage
is claimed. The next native attempt requires a separately assigned repair and
validation of this unresolved thread-lineage case before fixture admission.

## Lifecycle and recovery

Box `bx_mu6t9hnx`; independently observed immutable watchdog UUID
`4ca7989a-f96e-4cbf-9c80-05988a792dd1`, deadline
`2026-11-09T22:34:55.984749Z`; initial box expiry
`2026-11-09T22:35:11.543Z`. All 147 owned process identities were independently
absent, both ports closed, and the profile was absent. Before exactly one
delegated normal stop, 39 artifact entries / 38 unique contents were independently
reread with SHA-256/size and gzip CRC validation. No native PNG was produced.

Stop `stop_183435a5b4a7a5df` completed unforced at
`2026-11-09T22:13:06.479Z`. Independent API state is **archived**, stopped at
22:13:06.462Z, archiveAfter null, expiresAt not returned. The watchdog's actual
wait returned 0 with separate stdout/stderr EOF and unchanged configuration.
No owned live box remains.

Recovery uses the exact Git commit plus `code.patch`, `new-test.patch`, sealed
generated provenance patches, `tested-source.json`, and small run-input patches.
Original media is referenced by existing path and SHA-256. No source/media archive
was created. This single-task worker stops after publication of these findings.
