# Private Blockers summary activation, 2026-10-26

Activated only the exact accepted app.js and blocker-model.js on the existing loopback dashboard. Static HTTP bytes match accepted source, all 1357 other runtime files remain unchanged, and the existing service PID remained 2896015. No restart or public deployment occurred.

One real Chromium render used one size-bounded 7,072,688-byte response from the current private API. It displayed **77 distinct blocked task IDs**, **91 blocked rows**, **14 duplicate-ID blocked rows**, and **0 anonymous blocked rows**. Independent counting of the same in-memory snapshot matched the rendered label. The row classification line explicitly says dependent rows / filtered row classifications. The screenshot was inspected: it contains aggregate labels only, with all task contents excluded by crop. No task snapshot or fixture was written or published. The owned browser profile was removed after closing Chromium.

The accepted app still shows raw 91 in its sidebar, and its overview stat uses raw rows. The distinct-count summary gate passes; this does not establish a distinct count in every dashboard surface. Changing those surfaces is outside this task's exact two-file activation scope.

`receipt.json` records identities, browser observations, service PID/RSS samples and rollback path. `evidence-manifest.json` hashes all evidence payloads except this index and the manifest itself. The three RSS observations do not establish long-term stability. Browser aggregate Node+Chrome peak RSS was 1,228,795,904 bytes; this exceeded the provisional estimate but physical admission against the actual measured demand passed. `notes.json` preserves incidents and qualifications; `git-warnings.json` retains the nested-alternates warning. Prior accepted implementation/independent/merged/Telegram acceptance groups were reused without repetition.

Rollback is available locally at `/tmp/blocker-count-private-dashboard-activation-oct26/rollback.py`, with lossless prior-byte backups in its `backups` sibling. Root owns any future service or wider source action. No test box was assigned; lifecycle remains coordinator-owned.
