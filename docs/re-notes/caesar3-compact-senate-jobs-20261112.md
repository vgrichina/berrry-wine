# Caesar III: population objective and Assignment 2 reached, 2026-11-12

The original registered demo completed Assignment 1's **population-150 objective**, displayed native **Victory / promotion to Clerk**, and, after **Accept promotion**, displayed **Assignment 2 — Esquiline: Feeding the populace**. This is the first demonstrated assignment transition in this evidence chain. The final numeric population was not captured: the last reviewed HUD was 110 in September 500 BC, followed by the native victory and next-assignment briefing. Do not invent an exact peak or completion date from that gap.

Evidence: `scratch/runs/20261112-caesar3-compact-senate-jobs-1135/`. The decisive captures are `branch-growth-15`, `temple-staff-check` (also Victory, despite its planned label), and `accept-promotion`. Parent 1030 RESULT and published `161d6dea0` remain intact, as do the earlier 76-resident and historical 148-resident evidence. This note does not overwrite the root-owned Caesar III overview.

## What changed in the native city

Started a fresh ordinary title → Start new game → approved name C → Assignment 1 → To the city. Used native Space pause and the native speed dialog at 100%. No population, resources, clock, configuration, or media writes; no forced guest calls, Save workaround, emulator patch, or demoSave enablement. This is 2D city gameplay; no GL, FPS, audio, or parity claim follows.

Before housing, cleared a reserved area beside the starter road for the Senate. Its reviewed green preview was placed at physical screenshot coordinate 479,550; the actual southern ground tile at 479,682 opened the Senate panel. The starter road remained intact. No northern bypass was built and no occupied housing was demolished.

Placed sixteen initial housing plots and four wells, reserving road frontage for protection. Immigration reached 65 by March 500 BC. At the April first-fire unlock, built two prefectures; both native panels showed **6 employees / 6 needed, prefect out patrolling**. At the June collapse unlock, built an Engineer's Post. Its panel showed **5 / 5, engineer out working, no downtime**.

Built the Senate in the reservation for 200 denarii. Its first ground-footprint panel had no road-access warning, unlike the parent. Initially 0/30 while paused and still 0/30 at the first July check, it reached **30 employees / 30 needed, working with complete efficiency** in August (`senate-staff-august`). The ground-tile hover showed **10% unemployment** (`senate-employment-hover`), versus the parent's final 62%. Road access and full staffing were therefore demonstrated before further immigration waiting.

Added twelve nearby housing plots while paused. Growth reached 101 and the native Population milestone, then 114 and Pleasing the Gods in September. A later inspected small tent had five occupants, requested gardens, reported high crime, and had not been visited by a taxman. The Labour advisor was unavailable in this assignment. The Engineering submenu still offered only the Engineer's Post; no garden was built. A third-row site reported **Empty land** after live updates, so accepted construction clicks were not treated as permanent occupied capacity.

Built a short western branch off the starter road, ultimately eight new road cells including a two-cell temple connector. Built a Ceres temple for 40 denarii. Its initial native panel explicitly showed **no adjacent road / 0 of 2 employees**. Added the missing ground-road cells before resuming. No subsequent temple employee panel was obtained: the later planned inspection encountered Victory. Do not describe the temple as proven staffed.

Placed twelve plots along the branch and one row behind it, plus a third prefecture, second Engineer's Post, and fifth well. The new protection was built before resuming; its staffing was not separately inspected before victory. Original housing was kept intact. Native fires/collapse had already left losses and rubble; this run does not prove complete walker coverage or eliminate crime/desirability problems.

After resuming from the last reviewed 110-resident September city, the next captured native outcome was **Victory**, then **Assignment 2** after accepting promotion. The population-150 objective is established by the game's own completion/transition, not by a captured HUD at exactly 150. The attempted right-click labeled `temple-staff-check` landed harmlessly on the already displayed victory scene; its label is not temple evidence. The next deliberate action accepted the promotion. The new city was not entered and no save acceptance is claimed.

## Provenance, verification, and recovery

Frozen source base: `8a834a3dc7affc8c6e53245beab56e87a32b81e8`. Original `caesar3_demo` EXE, DLL, and 112 data files were pinned. EXE SHA-256: `d7c73f21d3837b1fc465a6035f4fea6ab5a7eddf62907c72c4dd076a5193d236`. Captured module SHA-256: `04c534192ee3fe39e388536c2ce710c12c47a5cd2ca4d95c19f9d00b1e8f0a17`. Provision parent joined with code 0 and both EOFs before browser launch; 688 frozen file hashes passed remotely before launch and again after play. No production code changed; no build was needed for this documentation-only result.

The 1,500 ms balanced native construction-click helper was derived from the parent's frozen helper. Each reviewed group contained individual clicks and retained full frames. There are 217 balanced-release input acknowledgments, three pointer-only previews, and 22 trusted key events. Console capture records trusted mouse downs; it does not independently show every DOM mouse-up. Release completion is recorded by the CDP helper acknowledgment, so do not relabel that as a full paired DOM-event audit.

Recovered **1,671 unique output files**, plus **241 original PNG captures** already transferred with compressed-before-transfer hashes. The remote output-only gzip transport pack excluded source, media, and duplicate previously recovered captures; it was verified, extracted, and not retained as a duplicate local package. `unique-output-manifest.json` records its SHA-256 and entry hashes. Remote final logs/module were compressed before transfer, with raw and encoded hashes. `capture-pack-0.xz` and its index preserve the first 150 exact PNG byte streams; the remaining 91 PNGs remain individually in `live-review/software/`. `RECOVERY.md`, `checks.json`, `SHA256SUMS`, exact Git base, relevant binary diff, and owned helper patches describe recovery. Git is the source archive; no source tree or game-media archive was made.

Shared disk writes briefly breached the 1.5 GB floor at the 101-resident milestone. Gameplay stayed at the native modal while own captures were losslessly packed and hash-verified; free space recovered above the floor. Verified duplicate gzip transport wrappers were later removed while their exact original PNG bytes were retained. This is a recorded breach, not a claim of continuous disk-floor compliance.

## Sandbox disposition and limits

Fresh private box **`bx_2hre5d5y`**, original expiry **2026-11-12 12:27:41.615 UTC**, had an observable independent watchdog armed before allocation. Browser closed normally with Chrome code 0; the actual runtime parent joined code 0 with both EOFs, all recorded runtime PIDs were absent, profile removed, and server port closed.

After unique recovery and local hash verification, delegated normal stop completed **12:25:27.557 UTC**: box **archived**, expiry null, receipt **`stop_633200e6e2ac8cd5`**, completed, unforced, error null. The independent watchdog observed this confirmed stop and exited; it was subsequently absent.

The original local launcher tool session 99441 returned **143**, and `manager-parent-wait.json` is absent. The manager died and the watchdog was reparented. The cause is unknown; **actual local manager/watchdog parent joins are not proved**. The runtime parent join and successful recovery/normal-stop command are separately retained. This limitation is not erased by the successful gameplay result. No box was retained, resumed, deleted, or publicly deployed.

Next: use the demonstrated Assignment 2 briefing for a fresh authorized continuation through ordinary city entry and its granary/wheat objective. No emulator defect or causal production fix is established by this run.
