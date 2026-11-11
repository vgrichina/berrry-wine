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

## Follow-up: native Hot Pursuit race ends in arrest

`scratch/runs/20261111-nfs3-native-lap-finish-0910/` reaches a real losing
race outcome: the original game displays **ARRESTED**, then its demo end card.
This establishes native pursuit consequences and race termination, not a
completed lap or finish-line crossing. The last cockpit image still says
lap **1/1**, at **7:48.81**, with tickets **1/2** before the final arrest.

The same catalogue → native setup → Direct3D Device 1 → original warning OK
→ setup OK → reload → `nfs3_chosen_renderer` route was used. The canonical
EXE hash above is unchanged. The served runtime is pinned at main
`6fdf10b4697f1d63de4af581ae9239705692e336`; production WASM SHA-256 is
`5512a65e2ce88cc76b39b3246d35f13919d9df060d3670a9a85cae9c4100f638`.
The intervening Surface7 priority HRESULT fix has matching locked-build and
normal/compat regression evidence in
`20261111-surface7-unmanaged-priority-hresult-0900`. This worker changed no
production code. Served closure pins, Git patches, and retained tested modules
record identity; no executing-Worker/module census was attempted.

Ordinary Up, Left/Right, Down and R controls produce sustained driving,
roadside collisions, a rollover and native road recovery. The first race was
restarted through page reload after a pause-menu navigation attempt stayed in
the menu; those images and input attempts are retained. The second ordinary
launch randomly selected Hot Pursuit without weather. No RNG, guest memory,
clock, readiness, save or race state was edited. The page-only driver never
attached to a guest Worker. Chrome uses the explicit SwiftShader route above.

Review-boundary limitation: twelve R→Up command pairs were dispatched within
one orchestration call. Their intermediate recovery images were inspected
after dispatch, although the generated review annotations say “inspected.”
Those annotations overstate pre-action review; the pairs were based on the
preceding reviewed crash image. `review-audit.json` lists the exact pairs.
The first `prerace` annotation also mistakenly called the introductory exterior
view a cockpit; the following command explicitly corrects it. These limitations
do not change the retained native arrest/end-card images or input ACKs.

| Reviewed image under `recovered/` | Visible consequence |
| --- | --- |
| `drive12.png` | 87 MPH, 0:13.06, lap 1/1, second of two |
| `drive49.png` | “Wild One arrested”; position changes to first of one, 52 MPH, 3:36.96 |
| `drive56.png` | Native **TICKETED** cutscene |
| `ticketsettled.png` | Cockpit resumes, tickets 1/2, 4:18.31, first of one |
| `drive75.png` / `drive76.png` | Rollover, then ordinary R recovery to the road |
| `drive78.png` / `drive79.png` | Lit tunnel traversal, then open road at 82 MPH, 7:11.40 |
| `drive83.png` | Last cockpit context: 7:48.81, 1 MPH, lap 1/1, tickets 1/2 |
| `drive84.png` / `drive85.png` | Native **ARRESTED** cutscene, then demo end card |

No checkpoint counter change, completed lap, win, audio or FPS result is
claimed. No save option was offered on the observed outcome/end card, and no
save was obtained. Enter dismisses the end card to a black image; the page
still reports a running process without a trap. Native ExitProcess after that
dismissal is unverified. Browser/controller disposal subsequently completes
normally; this is a distinct lifecycle observation.

All **666 remote artifact paths** were recovered and size/SHA-256 checked before
box stop; **109 PNGs** pass chunk CRC and complete IDAT inflation checks.
The recovery and lossless-compression maps preserve original paths and hashes.
All **726 runtime/media/driver pins** are unchanged at final recovery. An initial
controller start failed before Chrome because its pin manifest was omitted;
the actual exit was confirmed, the missing manifest uploaded, and a repaired
start used the same fixed deadline. That failed start and the premature
read-only shell check remain preserved without replaying an uncertain action.

Chrome and controller exit 0 with actual parent wait and both EOFs. Independent
checks find their PIDs absent, profile removed and server port closed. The
watchdog was observable before allocation and retained its immutable
**09:48:22 UTC** deadline. Delegated normal stop completes at **09:36:50.990 UTC**,
forced=false, error=null, receipt **stop_13d04591d8c9db0c**. Box
**bx_q9gvknan** is independently confirmed **ARCHIVED**, expiry null
(initial expiry 09:48:23.104 UTC). The watchdog exits 0 unfired with an actual
parent wait and both EOFs. No box remains billing. No workers or public
deployment occurred. Next useful work is a finish-line crossing; lap completion
remains open.
