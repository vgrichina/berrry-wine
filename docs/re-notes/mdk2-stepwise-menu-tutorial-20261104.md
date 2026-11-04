# MDK2 stepwise menu inspection — 2026-11-04

The run-only inspection barrier is repaired and tested. This original-runtime
attempt stopped at its first concrete inspection failure: the selector rejects
an accurately reviewed opening animation because `observe` also requires
`transitioning:false`. **New Game, Medium, comic and tutorial were not reached.**
There is no gameplay screenshot, production defect claim or production change.

Evidence and executable helpers are retained in the ignored directory
`scratch/runs/20261104-mdk2-stepwise-menu-tutorial/`. This follows the observer
integration and operator failure at `4454bdf5f` and selector at `632639d35`.
The per-command and grenade-route/transition notes were read before runtime;
ACKs, disappearance or elapsed steps never substitute for visible readiness.

`inspection-guard.cjs` is installed in the run-only `browser-driver.cjs`.
Every capture writes `inspection-state.json` with `status:"awaiting-inspection"`,
exact capture name, PNG SHA-256, frozen steps, command index and session hash.
The driver refuses steps, tick changes and native selection/input until the
worker provides a matching named personal inspection approval. The guard checks
the successful contiguous prior ACK prefix and unchanged PNG bytes before
allowing dependent commands. A new capture invalidates the preceding approval.
The existing driver failure latch stops further gameplay after an exception;
normal close releases any held controls. State/capture/quit remain observational
or cleanup operations. Approval is an explicit operator attestation, not image
recognition or proof that software itself detects a VIEW tool call.

All **14 fresh captures were personally VIEWed in completed separate tool calls**.
Each subsequent approval explicitly records that image's full SHA and steps in
`inspection-approvals.jsonl`; no tool invocation both displayed an image and
advanced dependent state. `approve.py` writes the attestation only after VIEW;
`control.py` retains one acknowledged command per independent transport.
The selector and its aggregate limits are unchanged.

Before Chrome, six new guard tests passed. They include execution of the actual
driver command function with a mock page: a capture leaves awaiting inspection,
and attempted advance and Enter without approval never reach the page.
Other cases reject stale SHA/steps, a previous capture's approval, changed PNG
bytes and pending/failed/mismatched ACKs; an exact fresh approval permits advance.
All **25 selector controls** passed, along with the actual driver inputSnapshot
integration (missing/undefined/null inactive input normalization and missing
renderer/getter/mask rejection), ACK negatives and independent-transport controls.
These are offline tests; rejected synthetic attempts did not touch the game.

The assigned **bx_wnjq4738** was freshly verified RUNNING/API idle, healthy and
hydrated before use. All 432 already staged runtime pins matched; no source,
media, module or configuration was restaged. Existing Puppeteer/static-server
imports, driver syntax and a real small-file upload/download probe passed.
Only the new run's small driver/observer/selector/guard inputs were uploaded.

One browser segment ran from **04:09:58.978Z to 04:13:31.099Z**, 212.121 seconds.
Startup had its separate maximum 4,096-step/180-second bound; the first native
copyright/title was captured at 3,072 steps, 103.476 seconds after launch.
All startup advances were sequential matching-ACK requests of at most 64 steps.
Each 512-step chunk ended in capture, separate personal VIEW and exact approval.
Earlier captures showed runtime log, gray surface, black surface and BioWare
intro; none established native menu readiness.

At the first inspected copyright/title image, startup chunks stopped immediately
and the tested selector's **16-step observation protocol** began. There was no
extra 512-step startup batch and no readiness inference from historical counts.

| Inspected actual steps | Result and subsequent bounded action |
| --- | --- |
| 3,072 | Copyright/title, legal text, closed icon wells; no New Game label. One selector observation quantum. |
| 3,088 | Same title; legal overlay visible and controller icon absent. The tested `open` review predicates passed; one source-backed Escape envelope, with trusted balanced press/release, was attempted. |
| 3,136–3,200 | Reviewed closed title after the Escape envelope and successive 16-step observations. No second Escape, click or Enter. |
| 3,216 | Icon wells visibly opening; no readable New Game label or selected controller. Review truthfully sets `transitioning:true`. |

The 3,216-step review (`native-selector-77`, PNG SHA-256
`9ee43a94e314eb27558a9e96b90d6d2a90f7094e0606f3ca1c56c82763c7a6a4`)
failed `ready(review,"observe")` with **native transition in progress**.
The helper latched `native-selector-first-error.json` before submitting another
browser command. The only subsequent browser command was orderly quit.
`first-failure.json` and the original failed transport result remain preserved.
No ACK or later image is used to excuse this failed readiness gate.

The Escape gate follows the existing source-backed/tested image predicates:
legal title visible, no controller icon, no inspected animation in progress.
Live Lua freeze/opening flags were not read, so this does not prove the exact
internal Escape branch executed or caused opening. No second opening attempt
or unsupported input correction followed. The later image establishes only
visible opening, not New Game readiness.

Validation passed **81 matching successful ACKs**, sequential receipt ordering,
56 step commands totaling **3,216 steps**, maximum 64. The selector ledger records
**144 steps / 25 commands / 76.029 seconds**, within its unchanged aggregate
512-step / 64-command / 240-second limits and three-minute recovery reserve.
All 14 image hashes and step-bound approvals match; every dependent command
follows its applicable approval. There were two trusted Launch-toolbar events
and two trusted native Escape events, balanced. All observed capture queues
are empty, active input null and mouse mask zero. No driver/browser failure
was logged; all 200 served-file hash checks match. No Enter, movement, aiming,
firing, pickup, cheat, guest write, console or configuration edit occurred.

Original execution source remains
`1329b1ba6eb00144ff77d4cd92a8513d4fc953ad`.

| Retained module | Full SHA-256 |
| --- | --- |
| Canonical | `cffca869b541e6eff12ae3a6b74c4476977e0a7e23cd43d8ec5ba8faecd4bcee` |
| Companion | `580f49f3c78d26e6855efa0beb37046d03ea24690ff98cfcb3e94ce5e6cb1ee3` |

Canonical compilation/instantiation and 2,261 exports are recorded by the
inherited observer. Companion execution was not attempted. The existing
432-entry manifest identifies unchanged original media/modules/configurations.
Exact checkout Git SHA, relevant binary diff, accepted-to-execution patch and
owned new-file patches identify the work; Git remains the source archive.
No source archive or media evidence copy was made. The first evidence metadata
check reported missing dashboard fields; that output is retained, and the
metadata was corrected. The final check has no errors, missing files or invalid
record for this run; its 16 global errors concern existing unrelated runs.
No build was required for
this documentation-only commit and ignored run-only helper changes.

Chrome **13979** and driver **13957** are absent, with port **46249** closed,
verified after normal Chrome exit at 04:13:31.099Z. Two identical post-close
full-hash inventories passed. All **278 recovered unique files / 11,155,622
bytes**, including both actual modules, match their size and full SHA-256;
all **432 pins** remain unchanged. Recovery completed before 04:49Z.

Hand back **bx_wnjq4738 / RUNNING, API idle, health ok, hydrated / expiry
2026-11-04T04:59:39.962Z** to **shutdownOwner=coordinator**. No lifecycle action,
reload, retry, second browser, public deployment or successor was launched.
The next unresolved boundary is an offline-tested observation policy for a
truthfully identified opening animation, while keeping selection forbidden
until a fresh readable highlighted New Game and separately highlighted Medium.
This task stops at the preserved first failure.
