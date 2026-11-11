# NFS3 current original: native setup reaches race and driving

The current original starts and drives through the ordinary registered route.
No native timer abort recurred, and no production emulator change was needed.
The historical abort described in
[the timer note](nfs3-native-timer-cause-0724-20261109.md) remains unexplained;
this successful launch supplies no retrospective initializer or clearing-branch trace.

Evidence: `scratch/runs/20261111-nfs3-current-original-race-timer-0850/`.
The canonical `game/nfs3demo.exe` is 1,577,984 bytes, SHA-256
`0defab3eeb22ee4b6e0007a4d5b26a99d868008ba77e2b9bd3ef770e924548ad`.
The staged runtime starts from main `d41587412ac3216bd709474ae50d2e3133561b18`;
the current production WASM is 2,189,565 bytes, SHA-256
`d0481f03459ec4f612864c57a290a12afb1e22fb09cd476a190dca967a829a10`.
All 715 initial runtime/media pins were rechecked unchanged after execution.
Supplemental dependency pins, relevant binary diffs and untracked-file patches
record recovery through Git without a source or media archive.

## Ordinary entry and observed consequence

One fresh browser profile runs `index.html?candidates&threads`, with real guest
Workers. The registered catalogue installer exits 0. The first native setup
invocation selects its own Software default and exits 0. After reload, the second
native setup paints the chooser. Full images were reviewed before each mouse
or keyboard action. The dropdown offers Direct3D Device 1; selecting it,
acknowledging the original unsupported-card warning and clicking setup OK makes
the utility write its native selection and exit 1. Another page reload precedes
the unmodified `nfs3_chosen_renderer` launch.

The ordinary process policy reports `mmTimerThread=true` and
`asyncMultimediaTimer=false`. No readiness, counter, clock, RNG, scene, guest
memory or save state was seeded or edited. No isolated timer fixture was rerun.
The original proceeds through its Corvette loading screen to an actual race.

| Reviewed image | Visible consequence |
| --- | --- |
| `prerace.png` | Cockpit on road, 0 MPH, 0.9k RPM, 0:02.53, lap 1/1, second of two |
| `accelerate.png` | After an 8-second ordinary Up hold and release: 38 MPH, 4.5k RPM, 0:09.78; house and road advance |
| `steer.png` | After a short Up+Left hold and reverse-order releases: steering wheel turned left, changed road alignment, 16 MPH, 0:15.15 |

The retained command ACKs and page input logs record Up down/up and then
Up/Left down followed by Left/Up up. These establish acceleration and visible
steering/track progress; no lap completion, finish, audio or FPS claim is made.

The browser directly executes the released Chrome binary with explicit
SwiftShader flags, without the fingerprinting wrapper. Game D3DIM telemetry
reports a legacy WebGL endpoint, ANGLE SwiftShader, and zero software-D3DIM
fallback completions/errors in the driving snapshots. This is a software GPU
route, with no physical GPU or historical renderer identity acceptance implied.

## Observer boundary and recovery

Startup and all driving captures use no guest Worker attachment, debugger,
import wrapper or block tracing. Ordinary page-level state reads and screenshots
still have observer cost. An optional **post-driving** Worker/module census
later times out at `Runtime.enable`; it exits 1 and is retained as UNKNOWN,
without replay. Browser shutdown followed before that outer census process
was joined. There is no successful executing-module census or native timer
entry/API/counter trace from that attempt. Runtime identity is the pinned served
closure; the identical module is recoverable from the preceding AVP2 run's
`final-module.wasm.gz`, freshly inflated and hash-checked here. Its matching
locked build and focused normal/compat regressions are referenced, not rerun.

All 101 remote artifact paths were downloaded and independently size/SHA-256
checked before stop. PNG CRC and complete IDAT inflation checks pass.
`recovery-map.json` and `duplicate-map.json` preserve byte-identical paths after
deduplicating early capture downloads. Unique logs and the failed census remain.

Chrome exits 0. The runtime owner actually waits for controller exit 0 and both
stdout/stderr EOFs. A separate remote check finds controller/Chrome PIDs absent,
the profile removed and the server port closed. This is browser/runtime disposal,
not a claimed native guest ExitProcess during the race.

The independent watchdog was observable before the fresh private allocation,
with an immutable deadline of **09:36:09 UTC**. After evidence verification,
delegated normal stop completes at **08:58:32 UTC**, forced=false, error=null.
Final box **bx_9nwfkcya** is independently confirmed **ARCHIVED**, expiry null
(initial expiry 2026-11-11T09:36:09.832Z). Stop receipt:
**stop_7be83a65f7c2669c**. The watchdog exits 0 unfired with an actual parent
wait and both EOFs. No box remains billing; no resume, deletion, public
deployment or workers occurred. Next useful work is ordinary race completion;
timer-cause instrumentation is needed only if the native abort recurs.
