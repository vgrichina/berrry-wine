# Caesar III fresh food attempt: terminal API observation failure, 2026-11-12

Assignment 2 food was **not reached**. The fresh native city ended paused in **July 500 BC, 65 residents**, with the Senate footprint still being cleared. The first concrete execution blocker was `RemoteDisconnected` during capture download-capability retrieval and the following command POST. The latter POST had no observed provider command ID. Gameplay stopped without replay; disposal subsequently recovered its actual native ACK. This is a caller/transport blocker before the food route, not evidence of a food defect.

Evidence root: `scratch/runs/20261112-caesar3-restored-headroom-food-1505/`. The accepted [1135 Victory → Clerk → Assignment 2 result](caesar3-compact-senate-jobs-20261112.md) remains independent and untouched. No prior city, save, or sandbox was continued. The unsaved May/69 city from [1420](caesar3-deadline-safe-quit-food-20261112.md) supplies no continuation.

## Caller and provisioning

Used **`tools/caesar3-native-browser.cjs`**, published by repair **78b4ae2a4**, throughout. No old run-local browser caller was staged or executed. Before allocation, the actual run-specific `control.provision()` function was exercised locally with its emitted closure-verification code: it required the tools caller and the run-specific owner, rather than the obsolete `run/browser.cjs`. `preallocation-closure.json` records success. No production change was needed.

Source base **aa1fc274901d75a26c5a0e946fbbe41f27546209** and `runtime-uncommitted.patch` identify the runtime source. `owned-inputs.patch` retains the small run-specific helpers. Git remains the source archive; no source-tree or media archive was made. The 690 runtime files match the 1420 attempt's non-run inputs exactly. Original EXE SHA-256 remains `d7c73f21d3837b1fc465a6035f4fea6ab5a7eddf62907c72c4dd076a5193d236`; captured module remains `04c534192ee3fe39e388536c2ce710c12c47a5cd2ca4d95c19f9d00b1e8f0a17`.

An independent four-hour watchdog was armed and observed before allocating **bx_j7w9wg8p**. Original expiry: **2026-11-12T19:05:40.387Z**. All 692 provision hashes passed; the actual provision parent joined 0 with both EOFs before browser launch. API command timeouts remained separate from runtime lifetime. Retained observation was enabled, with no command replay or deadline extension.

The tools caller retained reviewed-image hash/freshness checks, live Caesar owner checks and independent input release. Physical actions followed reviewed full native screenshots. Captures were gzip-compressed before transfer, verified against their original PNG hashes and retained incrementally. The local capture helper's process completion was not fully serialized: during `sc23`, the shell yielded while the PNG was already available, and the next action began before the remaining frame metadata transfer finished. This orchestration gap is retained; it does not establish the cause of the API connection closure. Future execution must await the whole capture-helper process, including metadata retrieval, before another command.

## Visible native route

Entered through title → Start new game → approved name C → Assignment 1 → To the city. Paused with native Space and selected native 100% game speed. Placed sixteen initial housing plots and four wells, preserving two service-frontage cells and the Senate reservation beside the original road. First clicks after some tool changes produced no construction; placements were counted from subsequent visible plots and native costs, not from ACKs alone. Trees obstructing the southwest housing plot and two well sites were cleared ordinarily before those buildings were placed.

Immigration reached 59 in February. The first-fire tutorial appeared at 66 in March. After dismissal, the city was paused in April at 61, and two prefectures were built for 20 denarii each. The western prefecture's native panel showed **6 employees / 6 needed, prefect out patrolling** in May at 89 residents (`prefw-panel`). The planned eastern inspection instead encountered the June First collapse tutorial (`prefe-panel`); it is not eastern staffing evidence.

A subsequent native report identified a collapsed **Prefecture**. Housing losses and fires were visible. After dismissing that report, the city was paused in July at 65. An Engineer's Post was built for 20 denarii at the western road frontage; staffing was not inspected. The Senate attempt returned **Must build on cleared land** with red footprint cells (`senate-preview`). The earlier visual judgment that those remaining cells were clear was wrong. Further ordinary clearing incurred 2 denarii per obstructed tile. No Senate was built, and no new Victory, Clerk transition, Assignment 2 entry, granary, wheat production or delivery is claimed.

DemoSave stayed disabled. There were no guest population, resources, food, time, configuration or media writes, forced guest calls, fabricated saves, or inherited-continuation claims.

## Terminal command and recovery

`api-events.jsonl` retains terminal `RemoteDisconnected` records for `POST .../files/download-url` and `POST .../commands`. `command-pending.json` retains `software-sc24` at the command-attempt phase without a provider ID. The original custody state was not cleared. No gameplay was submitted after these failures were observed.

A separate disposal-only path inspected the run and appended one authorized **host-only quit**. `terminal-command-audit.json` recovered native command 100, `sc24`, with its successful ACK; the actual effect happened once. Command 101 was quit. All **102 commands have native ACKs**: 91 physical clicks, seven keys, one launch, two capture-only commands and one quit. No native command-failure output exists. These acknowledgments establish helper completion and balanced release, not an independent audit of every paired DOM mouse event.

Quit closed Chrome with **0 / no signal**. The actual browser parent joined **0 with both EOFs**. Independent inspection found the browser, Chrome and owner PIDs absent, profile removed and server port closed. All **690 runtime hashes** passed again after closure.

Retrieved and reread **540 output members / 536 distinct content hashes**, plus **102 full original PNG captures**. The output-only transport pack hash is `b38a373852ee06450629ec92430e8dad848eee8d1135b811b94ccf2fe5ce546c`; verified members are retained under `recovered/`, without retaining a duplicate pack. `checks.json` verifies captures and output members; `retrieval-verified.json`, `unique-output-manifest.json` and individual transfer records describe recovery. Only this run's raw PNG duplicates were removed after exact gzip decompression reproduced their bytes. Shared free space was about 1.77 GB at preparation and 1.67 GB after recovery; sampled values stayed above the 1.5 GB floor. No RAM gate was used.

Normal stop **stop_4853f28cb3b6606e** completed **2026-11-12T15:31:38.081Z**, unforced, error null. Final box state **archived**, expiry **null**. Actual manager and watchdog parent waits are **0 with both EOFs**. The outer local launcher tool session returned **143** and `launcher-parent-wait.json` is absent; its cause and outer join remain unknown. This limitation does not erase the separately recovered browser/manager/watchdog waits. No box was resumed, deleted, retained, or publicly exposed.

## Validation and next step

Actual emitted caller controls and real owned Chrome/server late teardown passed (`caller-controls.log`). An initial invocation without required `EVIDENCE_DIR` refused before fixture execution; the corrected invocation passed. The first transport suite passed 12/13, failing an 80 ms timing-sensitive assertion that the observation error text was exactly `API absolute deadline`. That test passed in isolation, and the complete repeated suite passed **13/13** with retained control evidence. Both logs remain; no transport-source fix or causal attribution follows from the repeat. Documentation only changed, so no code build was required.

Next: start a fresh city using the accepted compact route and fully serialized capture/helper completion, then earn ordinary Victory → Clerk → Assignment 2 and investigate the visible granary/wheat path. This stopped city is unsaved. The accepted 1135 transition remains the demonstrated transition; this attempt adds no food consequence.
