# Aranna title transition investigation, 2026-11-07

The title stall remains unresolved. Retained evidence proves the later Escape
and Enter messages reached the owning guest callback. This run's single fresh
original stopped at EULA because I selected the wrong input command; no
emulator repair, map loading or world movement is established.

Evidence: `scratch/runs/20261107-aranna-title-transition/`.

## What the retained comparison establishes

I read the prerequisite and earlier acquisition notes and inspected their title
and Main Menu captures with matching state. Both originals instantiated observer
WASM `e7d6617cecdf3275db05454763c07cad7e6eb557afc2a14ca3413d960328fd31`.
The prerequisite's slot0/endpoint1 owning CPU was target
`D0F151E322B9C2AEF69B827828CA7496`, session
`D02D7A2E98B9CFFC75E5AE5BB901AE86`. Its title persisted from 04:48:29Z
through 04:52:52Z despite continuing render publications. This is not menu
progress or evidence of a healthy title transition.

`retained-causal-summary.json` adds an input fact beyond balanced DOM receipts.
At 04:51:16.900Z/04:51:16.977Z, Escape WM_KEYDOWN/WM_KEYUP reached HWND
`0x1000e`, tid1, through the observed guest callback at `0x417414` and returned
to `0x41742e`. Invocation IDs are 307 and 324. Enter follows at
04:51:38.625Z/04:51:38.683Z with IDs 336 and 351. All four have matching
invocation ends, returning zero; corresponding WM_CHAR invocations also end.
Thus these keys were not merely generated in the browser and lost before this
guest callback. This does not establish what the title's downstream logic did.

The earlier successful run records the frontend object's actual state store
4→5 at 04:16:17.820Z, then 5→18 at 04:18:24.874Z. The stalled trace has no
such store packet. That absence is qualified: these observer hooks have selective
admission and quotas. It cannot prove no state change, identify a CPU bug, or
justify forcing a state. No trap/render error or new API mismatch is shown.

Read-only disassembly identifies a useful next diagnostic. The frontend root is
referenced at `0x7ace3c`; its `+0x20` current state, `+0x28` immediate request,
`+0x34` delayed request and `+0x40` deadline participate in the transition pump
at `0x521e4f`. The pump compares the clock object referenced by `0x7ace48`
(`+0x10`) with that deadline before promoting a delayed request. The retained
stalled evidence does not contain those values at the title decision. The
prepared diagnostic copies those roots from actual owning Workers and observes
host clock/input calls without writing guest memory or changing instructions.
No timer or x87 semantics discrepancy has yet been demonstrated.

## Fresh attempt and exact blocker

One fresh box `bx_jhrk9tyc` was created at 05:01:04Z with a persisted UUID
Idempotency-Key, 40-minute TTL and original expiry 05:41:04Z. Puppeteer25.7.0,
Chrome151.0.7922.71, rendered smoke and normal smoke closure passed. All1,921
runtime/helper/module/media size/SHA pins passed before the single original.
`base-commit.txt`, `runtime-dirty.patch`, `untracked-wininit.patch` and the
run-input patch preserve source identity without a source/media archive.

The fresh original reached EULA. Its actual slot0/endpoint1 owner was target
`553CBD80343882A7FB01732F83BD9859`, session
`70FB6D9D6AF5B4B783EC2C45626BB082`, with the same verified observer module.
The new read-only Worker diagnostic ran at EULA, where the frontend root was
still zero; it was not exercised at the title.

I submitted `click:173,588` after reviewing the visible Accept button in page
coordinates. This was a worker error: `click` in the retained adapter means
**guest coordinates**, requiring an exclusive viewport/transform. EULA has
neither. The predecessor's correct recipe was
`canvasclick:0.2481,0.7093`. The adapter asserted the missing mapping before
input at 05:02:46.892Z. `action-00.json` records `rejected-terminal` and
`effectsAttempted=0`; no command0 completion receipt exists. The driver exited1
and closed Chrome normally with code0 at 05:02:47Z. No action was replayed and
no second original was launched. A premature response00 retrieval also failed
because no response capture existed; this was not an access/risk rejection.

This concrete harness blocker prevented the causal title diagnostic. The
original title cause remains unknown. No guest/media/configuration/save bytes,
production emulator code or input guards were changed. The case repair
`64823a6ad` remains unverified in a loaded original map.

## Validation and closure

All1,921 post-original pins matched. All34 unique retrieved files matched their
SHA-256 pins. I inspected the fresh EULA, terminal Ready shell, smoke and
historical title/menu captures with their matching state; the historical images
are explicitly labeled and their source/hash recorded. The fresh terminal is
not a successful input transition. Syntax checks passed for both run-owned
JavaScript diagnostic files; retained analysis asserts matching callback ends.
There was no code repair, so no production regression/build claim is made.

Cleanup verified all11 owned PIDs absent, HTTP39587/debug33775 refused, Chrome
profile absent and all four runtime/browser/heavy/build locks free. After unique
evidence retrieval, the explicitly delegated normal stop completed. Final box
state is ARCHIVED, stopped05:03:52Z, forced=false, no active expiry. No box is
handed back running. Local free/home remained above2GB. No deployment, nested
worker, source snapshot or media archive occurred.

Next work must first preflight the exact EULA canvas-click recipe with the
retained adapter on a generated shell, then exercise the prepared frontend
state/clock diagnostic at the title under a separately authorized fresh original.
Do not infer a missing key, timer defect or filename failure from this run.
