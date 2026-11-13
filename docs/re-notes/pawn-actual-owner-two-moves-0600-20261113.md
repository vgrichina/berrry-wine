# Pawn actual legacy owner guard: prepared, capacity refused

Run `20261113-pawn-actual-owner-two-moves-0600` prepares the correct legacy
bridge consumer contract, but **no original launched and no moves or native AI
replies were observed**. The one fresh launch decision measured 1,483,030,528
bytes available on `/home`, 16,969,473 bytes short of the strict >1,500,000,000
requirement. This is the concrete current blocker. No cleanup of protected
Dense0340, LMarbles0540 or recovery data, polling for capacity, or retry occurred.

Read parent `29eb68d2d` and its note, then traced production wiring:
`test/run.js` supplies `ctx.createD3DRenderWorker`, constructing an actual
`WorkerConsumer` around `lib/d3d-render-worker.js` with the current module,
shared memory and native reclamation callback. `lib/host-imports.js` supplies
that factory as `createSoftwareWorker`. `lib/d3d9-host.js` selects asynchronous
software and retains its consumer at `bridge.workerConsumer`; the per-device
queue closes over that bridge factory. The consumer's init message calls its
protocol `neutral`, but this is the legacy bridge ownership route, not the
per-device shared endpoint. No production change is justified by this evidence.

New run-only helpers were syntax checked and hash frozen before the decision.
`owner-guard.cjs` observes the actual bridge consumer and Worker, requiring
software async mode, a ready nonstopped consumer, a positive Worker thread ID,
matching device ID and generation, nonterminal guest, live visible main window,
and absence of bridge, queue, release, retirement and failure state. Its planned
one-time diagnostic closure retains actual instance, exports, renderer, memory,
buffer, bridge, device, queue, queue consumer, bridge consumer, Worker, canvas,
window and factory references. Later checks require identical references and
stable process, thread, device, generation, window and image identities. Module
identity is pinned externally by SHA and established by the unchanged factory
wiring; the production consumer does not retain a public module property.
The closure creates diagnostic state only and invokes no guest setter, renderer
method, Present, repaint or Worker method.

`actual-owner-checks.js` is prepared to verify the selected real route and use
copies of actual live observation snapshots to refuse changed consumer, Worker,
device, queue, buffer, instance, window, generation, missing consumer and failed
liveness. It never mutates live owners. **These checks and live binding remain
UNEXECUTED**, so actual owner verification is not claimed complete. Syntax checks
and a prepared comparator are not actual consumer proof or a production fix.

The finite drag helper retains fresh personally reviewed full-board and legal
turn requirements, source/media pins, no replay after UNKNOWN, a separately
armed mouse-up process and its actual parent wait, and native AI reply review
before move2. It requires the real legacy owner check rather than faking
sharedWorker or accepting an absent consumer. Its input branches are unexecuted.
The inherited supervisor prearms an observable independent 600-second deadline
before runtime creation, after passing capacity; neither watchdog nor original
was created here. Runtime wait and separate stdout/stderr EOF are N/A, not zero
or success. No guest memory/config/clock/AI changes, chess agent, substitute
board, historical GetDC reinvestigation or startup matrix occurred.

All canonical0450 source and six original media pins matched before freezing
and after the refusal. The current module remains
`04c534192ee3fe39e388536c2ce710c12c47a5cd2ca4d95c19f9d00b1e8f0a17`.
Frozen Git revision is `29eb68d2d5cf61dd9a0ae2014bdb790c11ca4703`
(the shared main advanced afterward; the frozen source pins still matched).
Evidence includes exact relevant binary diff, relevant untracked source patch,
owned helper patch, path/SHA pins, parent references, freeze and decision.
No source archive, media copy or old matrix rerun was made. No production
files changed, so no production focused test or locked build was run or claimed.

Next: after an actual capacity recovery, freeze a fresh namespace from these
helpers, prearm its independent deadline, bind and verify the actual consumer
before input, then personally review the full current board and make two
separate ordinary legal moves, observing each native AI reply. Current two-move
progress and runtime guard behavior remain unproved.

Box ID **none**, state **NOT_CREATED**, expiry **null**, stop receipt **N/A**.
No created runtime or box remains to stop.
