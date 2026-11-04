# MDK2 readable New Game / white controller observation

Run `scratch/runs/20261104-mdk2-unhighlighted-menu-onward/` repairs the run-only
observation route for the actual readable-but-unhighlighted menu. It does not
establish a new scene or playable readiness. The single remote attempt failed
before Chrome launched; no retry was made.

Personally VIEWED the exact historical `native-selector-76.png` from predecessor
`e3a5812cd`, SHA-256
`52066472b64a5e63e650195bf842ec3221534336121acd7762254c84ccea989e`.
It shows readable New Game and a white controller without the red highlight.
These historical pixels are not fresh authorization. The native state at3200
has startscreen/title, pending scheme=nil, freeze=nil, selected0, current=lang,
showmenu0, Level0/checkpoint0 and consumed Escape/Enter rest.

`unhighlighted-control.cjs` accepts only `observe-unhighlighted-menu`, with
screen=unhighlighted-menu, originalScene=startscreen-readable-newgame-white-controller,
selection=none, controllerIconVisible=true, controllerIconHighlighted=false,
newGameLabelVisible=true, legalOverlayVisible=false, playableReadiness=false,
and no loading/comic/tutorial/unsupported scene. It does not infer animation
from a still image. It requires actual isolated threaded worker identity,
canonical module identity, unchanged native New Game readiness plus the specific
Level0/checkpoint0/current=lang/showmenu0 boundary, and open=true before either
New Game or Medium was attempted.

The route issues exactly state /16 execution slices /capture, zero input or
clock changes. Exact capture SHA, current inspection barrier/session, complete
ACK history, native state equality, clean input and fault/deadline guards remain.
Each new capture invalidates approval. The existing shared comic continuation
ledger retains its540-second anchor,512-slice/96-command/32-quantum bounds; it is
not reset. The stronger native-menu New Game input predicate still requires
red controller highlight. No unsupported guest calls, writes or repaint were
added. `next.py unhighlighted` and `control.py` route to this owned helper;
existing pending/scene phases retain their pinned helpers and phase gate.

## Tests and remote first failure

Same-worker final verification:26 Node controls pass (captured historical3200
state **and exact PNG**, zero-input action/approval invalidation, unchanged Enter
rejection, wrongworker/stale/contradictory/highlight/wrongscene, ACK, short step,
timeout, fault, deadline, budget and shared anchor controls, plus corrected actual
driver top-level dependency execution with main disabled). The exact predecessor
30 pending,5 route and18 scene controls pass. Six adapter route controls also pass.
Earlier failed offline fixture diagnostics are retained: the captured-state test
initially retained the synthetic step/hash in its peer barrier, and a copied
route test initially expected a local pending helper rather than the pinned
sibling path. Neither diagnostic issued remote commands.

A new assignment-bound runtime_io/release RUN was staged for `bx_3bh7zkjy`.
Verified all exact37 adequate-lifetime and40 fresh-pending input size/SHA records
locally and remotely. Actual Puppeteer24.31.0 CJS/ESM imports,432 runtime hashes,
isolated HTTP full hashes and cache98page/12worker graph passed. Process inventory
proved no Chrome before the attempt. Source remained
`1329b1ba6eb00144ff77d4cd92a8513d4fc953ad`, canonical wasm
`cffca869b541e6eff12ae3a6b74c4476977e0a7e23cd43d8ec5ba8faecd4bcee`.
Latest-main legacy ProcessVertices changes were not substituted.

Attempt process19664 started11:04:55.969Z with unchanged600000ms expiry admission
and a fresh350-second closeBy11:10:45.748Z, recoverBy11:21, expiry11:28:13.640.
The wrapper redirected RUN but initially left the preload read bound to RUN.
It failed immediately with ENOENT for the new RUN's `observe-browser.js`, before
main(), Chrome, HTTP, browser directory creation or any command spool existed.
The actual assignment-wrapper preload dependency was missing from the successful
preflight: the predecessor driver dependencies alone were insufficient. This is
the concrete first failure, not guest failure or a new visual observation.
No active browser existed to receive quit. No Chrome was launched, no fresh
capture or input was authorized, and no retry/reload/fault clear occurred.

Recovered the unique attempted wrapper and1195-byte driver log, SHA-256
`4fcac89232c6556ad87e04ff89b8c6d188142292f395d76a877d6053cb512858`.
Remote recovery inventory SHA-verifies every staged file. Driver19664 absent,
browser directory/Chrome absent, HTTP never started;432 pins and exact37/40
sibling inputs remain unchanged. The corrected local wrapper explicitly references
the pinned predecessor preload and passes actual top-level dependency execution
without main/Chrome/API. It was not staged or retried after failure. Remote attempted
and local corrected wrapper versions are separately preserved.

Only this note is committed; helpers/tests and evidence remain in the owned run.
No production code changed, so no full build/local heavy run was needed. Evidence
records Git SHA, relevant binary diff and small owned new-file patches; no source
archives, repeated modules or game media were copied. Predecessor dependencies
are referenced by path/hash. The corrected adapter is a prerequisite for a later
separately assigned replay, including its own actual-wrapper preflight and fresh
VIEW-first reviews. No successor is launched here.

`bx_3bh7zkjy` remains RUNNING (API state idle, health ok, hydrated), expiry
2026-11-04T11:28:13.640Z. No lifecycle operation occurred. Custody and shutdown
return to the coordinator, checkpoint11:23; all unique evidence was recovered
before11:21. Publication status and exact main commit are in the run handoff and
messageboard. This assignment stops at the recovered first failure.
