# Half-Life 2 captured Next target and controller preflight

Evidence: `scratch/runs/20261117-halflife2-native-next-target-normal-install/result.json`.

The predecessor's Welcome failure was an operator targeting error: frame
`0x1000f` was reviewed instead of native Next BUTTON `0x10011`. Its UNKNOWN
endpoint was never contacted again. No runtime delivery defect follows from
that mistake.

`tools/halflife2-reviewed-next.py` now validates the personally selected captured
BUTTON against the public tree: live generation, class, enabled/visible state,
caption, process/thread owner, complete parent chain, active main/modal and
screen geometry. It delegates to the exact published controller blob and
preserves the existing actor/focus/context/fence, immutable capture, finite
nonce, 500 ms native confirmation, independent 1750 ms UP and 3000 ms aggregate
limits. The wrapper supports installer/quit BUTTON intents; it does not choose
controls or automate installation.

The authored ordinary USER wizard and native DialogBox wizard exercise real
WM_COMMAND behavior. Next changes the title and, in DialogBox, the page text.
The direct route requires `native-button-dispatch-return`; the ordinary route
uses a real owner USER API return. Wrong frame/child/sibling targets, geometry,
owner, lifetime, stale native receipts, reuse, late return and cancellation
are refused without false consumed ACKs. Actual sibling-thread/foreign-actor
refusals and owner PM_NOREMOVE/API-return checks retain matching native proof.

The native adapter reuses the completed predecessor core proof only when the
module and material source identities match. Changed scene freshness and
sealed-source resolver components receive focused fresh tests. Fresh sealed
main/CPUWorker/OSchild inheritance and an actual outer wait with EOF and no
remaining process are mandatory. The chosen published graph remains pinned
through preparation and execution, independently of later main changes.

Exactly one new genuine installer startup used published `8d4973866` (full SHA
and tree SHA are in `published-pin-resolution.json`), freshly compiled module
`5a4178950559d4f677d86aa75403908abee343493805f01a0b8aae8f1df2429a`, and the
unchanged 787701212-byte original EXE, SHA-256
`24205fa8cb6bfab70a82dd713f0addc7cfb0b3c4df40441ebea0320dcb3b441c`.
Compilation, source inheritance, media verification and observable independent
600/620-second deadlines preceded the native clock. Welcome to Steam was
personally reviewed in the complete image. The new preflight correctly bound
Next `0x10011`, owner process 1000/thread 1/generation 17, through child
`0x10010` to Welcome `0x1000f`, at screen coordinate (366,382).

The run then measured a new controller error **before DOWN**: the local intent
name `welcome-next` shadowed the helper filename captured by the source-hash
check, producing `KeyError('welcome-next')`. The endpoint permanently closed.
Its ledger contains only snapshot, immutable capture and bind; there was no
input HTTP request, native DOWN, or held input requiring UP. Native, outer and
watchdog actual waits completed with EOF and no remaining process. Shutdown
was host cleanup, not native Quit or successful installation.

The collision is corrected by keeping `helper_name` separate from finite
intent names. A new full-wrapper authored native regression runs actual
capture → review → bind → arbitrary-name intent, proves the native BUTTON
return and page-text change with independent physical UP, then proves zero
later HTTP after a terminal latch. This tests the CLI wrapper that the earlier
fixture protocol tests had not exercised.

Normal install and authenticated game startup remain unproved; installed-game
invocations are zero and physical installed footprint is null. The 3995 MB
script declaration, decoded package stream sizes, actual VFS backing and host
disk floor remain distinct. No fake quota, larger-disk answer, authentication
bypass, package patch or game-launch success is claimed. The used allowance
permits no retry; continuing requires a separately authorized invocation with
the repaired controller and a new complete personal review. No boxes were
created. All owned runtime processes are stopped.
