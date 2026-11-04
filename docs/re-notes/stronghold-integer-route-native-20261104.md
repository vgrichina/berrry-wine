# Corrected Stronghold route prepared; bounded launch unavailable

No Chrome was launched and no guest input was sent. Original world/gameplay remains **unobserved**. This worker began at approximately **08:32:23Z**, against the authorized **08:33:00Z hard close**, **08:36:00Z recovery deadline**, and retained box expiry **2026-11-04T08:39:09.954Z**. Complete preflight and personally reviewed navigation could not fit that window. Independently, the unchanged successor requires at least **600000 ms remaining TTL before launch**; the assigned expiry already failed that requirement when this worker started. Neither guard was relaxed. The coordinator subsequently confirmed offline preparation was preferred within the original deadline.

## Prepared and tested

Own namespace: `scratch/runs/20261104-stronghold-integer-route-native/`. The tested `successor-driver.cjs`, corrected `route-driver.cjs`, `integer-route-point.cjs`, menu, presentation and cache helpers were copied from the published `bd7a87370` predecessor. The three corrected route files are byte-identical to that tested candidate. Existing title, native Start, route recognizer and prerequisite helpers remain referenced by retained path and SHA. No source archive, media copy or module copy was made.

The demonstrated transport correction remains integer CSS **(594,520) → native (543,292)**. Expected native coordinates, telemetry ownership, complete ACK/drain, freshness checks, recognizers and the unchanged native Start guard remain intact. The candidate preserves strict ChooseType, right towers (543,292), preset (67,491), routeDispatch boundary queue, strict Zephyr and native Start (718,569). These are prepared route properties, not new live observations.

Fresh `runtime-release.json` records the exact authorization `stronghold-game-crop-freshness user task`, assigned `bx_pu5e3qkn`, original expiry, hard close, recovery deadline and coordinator shutdown ownership. `stage.py` uploaded only seven small own files, and verified their complete hashes. Own pins are `small-stage.json`; actual imported helper graph hashes are `corrected-dependency-graph.json`. Historical source/module/media pins remain unchanged.

Actual remote preflight passed twice, including the complete `preflight.py` subprocess with **check=True**:

- All **2415 historical pins** matched the retained runtime, source commit `1188e9bf57ef35bd3363fb88b7ca0da442ce696d`.
- Own staged hashes and corrected actual helper graph matched.
- Actual Puppeteer CJS and dynamic ESM imports, corrected route/helper imports and successor syntax passed.
- Actual cache graph passed: **98 page scripts / 12 worker scripts**.
- Five HTTP responses passed SHA and COOP/COEP isolation checks; the temporary HTTP server closed.

Offline tests against this namespace passed the production integer mapping regression (including old native543291 rejection before ACK), all **eight route negative guards**, successor **111 checks / 25 modes**, and **five launch sequencing checks**. ACKs and scene changes in these tests are modeled. `integer-route-point.test.cjs` references the retained predecessor geometry capture rather than copying it. The small own launcher adds a local deadline/TTL check after its check=True preflight and before detached driver execution; actual expired closeBy rejection is recorded in `deadline-rejection.txt`. The driver's original TTL and closeBy guards also remain unchanged.

Reproduce preparation checks without Chrome:

```sh
node scratch/runs/20261104-stronghold-integer-route-native/integer-route-point.test.cjs
node scratch/runs/20261104-stronghold-integer-route-native/route-dom.test.cjs
node scratch/runs/20261104-stronghold-integer-route-native/actual-successor.test.cjs
python3 scratch/runs/20261104-stronghold-integer-route-native/launch.test.py
```

## Evidence and handoff

The full preflight returned at **08:34:11.127Z**. The final remote process inventory at **08:34:11.255Z** showed no Chrome or route driver. No browser output directory, runtime PNG, native route boundary, Zephyr, Start execution or gameplay result exists for this task. The prior original ChooseType evidence remains the prior run's evidence only.

`exact-git-sha.txt` records preparation commit `a62801c2f653b738a9ba6fa052c91b9d7c673d52`. `relevant-uncommitted.patch` records relevant tracked source differences; own small helpers and tests are recoverable through `owned-new-helpers.patch`. Closed local artifacts and their full SHA-256 hashes are recorded in `artifact-manifest.json`; `recovery-closed-verified.json` maps staged remote files to identical retained local bytes. No unique remote browser artifacts were created.

Assigned **bx_pu5e3qkn is left RUNNING / API-idle**, healthy and hydrated at its recorded info check, expiry **08:39:09.954Z**. API state `idle` is recorded verbatim in `handoff-box-info.json`. Lifecycle custody returns to the coordinator, who owns shutdown. No stop, resume, delete, allocation, source-box access, local browser/heavy run, worker launch, successor launch, forced guest operation or public deployment occurred. Only this note is committed; production code is unchanged and no production build gate applies.

Next: obtain a separately authorized window and retained runtime with at least ten minutes of TTL remaining at driver entry, copy the tested small candidate into another fresh namespace, regenerate its release and pins, complete actual preflight before Chrome, then execute the original route with personally reviewed fresh PNGs and complete ACK/drain. Do not reuse this expired release or claim gameplay from modeled tests.
