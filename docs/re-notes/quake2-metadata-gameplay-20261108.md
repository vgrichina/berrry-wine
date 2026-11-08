# Quake II launch metadata repair and bounded browser verification, 2026-11-08

The stale controls size is repaired and published on main in
`55d976387fe209b1c6344e1cef0697379014e1ba`. The corrected registered launch
reaches an ordinary Game → Easy textured world on WebGL and the main menu on
software GL. **The requested paired gameplay verification is incomplete.**
A worker-authored settle wait exceeded the ACK deadline; the first UNKNOWN
closed gameplay input. This is a new, precisely identified harness failure,
not a demonstrated emulator failure or another stale-metadata blocker.
Full historical27 remains open.

Evidence is retained in `scratch/runs/20261108-quake2-metadata-gameplay/`
(ignored). No source or media archive was made.

## Repair and regression

`lib/app-file-sizes.generated.js` declared 568 for the registered
`lib/quake2-modern-controls.ini`; its actual size is 642. The controls remain
byte-identical, SHA-256
`afb166910b596b204e1c11f93ff4972999804d18299bde134d6380a51587e3b3`.
The metadata was regenerated using `tools/gen-app-file-sizes.js` with a narrow
data root, retaining unrelated entries (including the generator's otherwise
removed obsolete D3DRM fixture entries). An exact comparison verifies that
only the Quake II value changed.

`test/test-app-file-sizes.js` now obtains the stamped Quake II registry entry,
compares it with the tracked controls length, serves the actual file through
the production static server, and runs the full unmodified `host.js`
`loadFiles`/HTTP/VirtualFS path. The stale 568 declaration must reject before
any guest file is mounted; the registered corrected entry must mount exactly
the original bytes. The new test fails on the old map (`568 !== 642`) and
passes after repair. The existing stamping checks and
`test/test-eager-asset-integrity.js` pass. The scoped generator freshness check,
whitespace check, and `flock /tmp/wine-build.lock bash tools/build.sh` pass.
The code commit was immediately pulled and pushed on main.

## Browser evidence and its limits

Both serial sessions use the complete registered 67-file closure: 65 original
fixture files plus the two registry-supplied text files. The original command
line remains `+set vid_ref gl +menu_main`; no guest configuration, state,
clock, media, save or private input handler was changed. The PAK SHA-256 is
`cae257182f34d3913f3d663e1d7cf865d668feda6af393d4ecf3e9e408b48d09`.
All 705 staged pins match before execution and after shutdown, and all 354
successful served reads match pinned bytes. Git source identity is the repair
commit, with the empty relevant tracked diff and retained untracked
`lib/wininit-boot.js` dependency patch. Browser-recovered guest and renderer
modules match the rebuilt current module, 2,182,500 bytes, SHA-256
`f9650607181301b5d2a9990420f437bd9f1ca10d40ac73067339f07499d53121`.

| Route | Personally reviewed result | Actual backend proof |
| --- | --- | --- |
| WebGL | Main menu, Game difficulty menu, then Easy world with textured walls/floor/diagonal support, blaster, crosshair and 100-health HUD. No movement or combat command followed. | Owning render Worker endpoint 1 is GL/WebGL; its live `WebGLBackend` owns a non-lost `WebGLRenderingContext`, WebGL 1, Chrome ANGLE SwiftShader. Both guest and renderer CPU exports report `gl_sw_enabled() == 0`. |
| Software GL | Textured main menu only. No original gameplay input was sent. World and action consequences are unverified. | Owning `OpenGLHostBridge` has backend software, software-consumer true, a software context for HWND 65537, current owner 0/context 1, and exports memory matching its renderer instance. Guest and renderer `gl_sw_enabled() == 1`; guest software presents are 464 at observation. The separate legacy/WebGL endpoint and presentation device do not change that CPU/context proof. |

Chrome is 151.0.7922.71, V8 15.1.206.10, using the native browser viewport
without emulated resize. All four bound captures pass SHA-256, PNG CRC/IDAT,
guest-module and renderer-module checks and were personally inspected.
Neither menu coverage nor one world screenshot establishes movement,
guard/door/pickup consequences, hits, parity, FPS, audio or full playability.

## New causal harness failure and input stop

The reused bound-input and numbered-ACK helpers retain their qualified bytes.
Independent UP was armed before each finite Enter hold. A local slow-observer
test and injected UNKNOWN control confirm release and no replay before box
allocation. Trusted browser blank-page key/type/combo preflights also pass.

The Game command has an exact timely ACK. The worker then requested Easy with
a 750 ms Enter hold followed by `waitMs: 60000`, although `request.py` calls
`transport.request(..., 50000)`. Thus the capture/ACK cannot finish inside
the request window. At **00:45:42.061 UTC**, the client writes sticky
`transport-closed.json`: `ACK deadline; never resend`. The Enter release had
already occurred at **00:44:53.126 UTC**, 750 ms after its down interval began.
The eventual `reply-1.json` identifies Easy exactly and the retained bound
capture shows the world, but that late ACK does not reopen input.

No movement, attack or other original-game input was issued after UNKNOWN;
the Easy command was never replayed. The serial software session receives
only a lifecycle quit command after passive menu/backend inspection. This
preserves the first-UNKNOWN stop requirement but leaves both gameplay action
targets and software world coverage open.

The original frozen request helper is retained. A separate local
`request-safe.py` now rejects oversized settle/hold budgets before publication
and refuses gameplay input once the task's UNKNOWN-stop record exists.
Negative regressions prove the 60-second capture request and post-UNKNOWN
key request create no request record or remote dispatch. This prevention was
tested locally only; it was not used to reopen or replay the original input.
Future original runs must use bounded settle waits below the ACK deadline
and separate passive observations for longer loading periods.

## Retrieval and resource closure

One UUID-created box, **`bx_vr3ymbfy`**, was created at 00:43:56.433 UTC.
The observable detached supervisor, independent 25-minute deadline watchdog,
and delegated normal-stop process were armed before allocation. The immutable
local deadline was 01:08:56.110 UTC; initial provider expiry was
01:08:56.280 UTC.

WebGL Chrome closed normally at 00:46:25.318 UTC; its controller was terminated
after Browser.close because sticky input admission prevented a queued quit.
Software launched only after WebGL Chrome and controller were absent, and
closed normally at 00:47:18.567 UTC. An initial cleanup assertion ran before
the software controller finished draining; a subsequent bounded drain check
confirms all four PIDs absent, all four ports closed, both profiles removed,
and no writer lock. This assertion failure is retained, not a guest failure.

All **86 artifact references / 71 unique contents** were retrieved and
independently SHA-256/size verified before delegated normal stop. Stop
**`stop_d2b83e310fa91eed`** completes at **00:47:54.180 UTC**, forced=false,
error=null. Final box state is **archived**, current expiry null. Both lifecycle
delegates exit zero and the supervisor has no remaining children. No resume,
delete, extra box or public deployment occurred. Local free disk stayed above
5 GB; no RAM gate was used.

Recovery uses Git SHA, relevant binary diff, owned helper/note patches,
untracked dependency patch, retained actual modules and existing media
path/size/hash references. Next work is a fresh authorized bounded run using
the corrected request budget: ordinary Game/Easy on both backends, reviewed
movement, then an observed guard/door/pickup consequence. Do not resume this
stopped box by default.
