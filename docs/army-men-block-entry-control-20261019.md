# Block-entry control and next rendering observation

The granted original-free native control passed on bx_rqnkhrnr at 03:08:42 UTC. Command cmd_tnbmfc9le4mn used the historical tested module 7fd02a77ec01e5e18065d112b1da434886a0dba3fcadd7ff043d1e2ddca41f33. A deterministic generated PE and synthetic x86 code demonstrate that an interior ADD breakpoint is not observed (EIP 0, EAX 7, halt 2), whereas a branch-entry breakpoint stops before the ADD (EAX 1, halt 5). Rearming the same breakpoint resumes successfully; starting the cached block again stops at the branch entry.

This validates breakpoint observability, not original-game execution or a rendering diagnosis. The V13 zero-hit observation at interior address 0x407503 remains unavailable evidence about that call.

The bounded controller enforced 60 seconds, 4 MiB raw log, unchanged admission 2847932416 and hard floor 2214592512. Exit 0, no signal/guard, 442 log bytes, minimum free 48312868864, all 1600 bundle hashes and source pins unchanged. Fresh cmd_vqwppgw9uvs9 confirmed controller 38936, child 38946 absent and port 8143 clear. No second native test or original game was run.

Evidence was recovered through the documented Files API to scratch/runs/20261019-army-bp-control-v1. Archive SHA256 f141a1625f1adaf607fd695d657ea3ab5ffc58aa59f40b4c51eb3f074e9426dd was verified before extraction; per-file manifest is retained alongside receipts and raw log.

The source-ready next helper selects 0x4074f1 with an eight-hit limit. The original PE byte check confirms this is the target of JNE at 0x4074e2. Capture occurs before pushes: ECX is destination X, EDX is destination Y, ESP addresses the 16-byte source RECT. Global 0x4744d8 supplies both source and destination surface; the following verified original instruction sequence supplies flags 0x10. The helper captures those registers, RECT, global pointer/wrapper and current/prior rectangles at 0x5d91c4. It retains one ordinary 250ms Numpad6 turn with key-up cleanup and before/after frames.

The expression test extracts the actual historical runner parser and checks register, literal and dereferenced expressions plus original PE image base, branch destination and exact pre-push bytes. It passes without native execution. No core/debugger/renderer changes are needed. The next original capture still requires immutable staging and a separate runtime grant; eight startup hits may exhaust the limit before turn input, which must be reported as incomplete turn evidence.

V14 is now staged locally and on bx_rqnkhrnr at /home/user/army-men-local-stage-v14-20261019. Source-only stage command cmd_cxdinbux4zuz verified all predecessor hashes before/after and produced identical manifests on both hosts: 1600 files, 1597 unchanged hardlinks, 282624 added allocated bytes. Only controller/helper/identity changed; original bytes, historical runner and module are unchanged.

- Manifest: 637af36173b6ad5f32c76c212dd0323a4cbaec9198fb04f1df876492acb2d413
- Controller: 7c70e72d68cb2d7c2b184c557178e00892bc2938c84fa6d85c3f38a0ddf6ffa7
- Helper: daa8ae1e556e7f2ca1ff2b718a5934ad3e577f16e1aff215a74bc31c59f77123
- Source transfer archive: 4797 bytes, SHA256 603b6d5175ce5d5517c139cd07abecb08ebabdadae1425f45ffc0db1bf0ec9a5, documented Files API HTTP 200.

Ready command, only after sole-runtime grant and fresh port/lease/pin/admission checks:

```sh
boat exec bx_rqnkhrnr --detach -- node /home/user/army-men-local-stage-v14-20261019/controller.js /home/user/army-men-local-stage-v14-20261019 /home/user/20261019-army-men-scroll-entry-remote-v1 --root-runtime-granted
```

Controller remains 60/75/90 seconds, 28 MiB output, 4 MiB raw log, 512 MiB transient admission reserve, unchanged hard floor and 250ms monitoring. Review actual menu before ordinary BootCamp click; inspect actual scene before invoking the helper with `turn --scene-visually-reviewed`. No forward input. Correlate eight bounded trace events with input timestamps; startup exhaustion cannot establish the turn operation. Source staging did not check port availability while another authorized lane could own it; immediate port/lease checks are required before launch.

## V14 original result

The single granted original observation cmd_k9rfbtdzmhu2 ran 03:15:10–03:15:48 UTC. Reviewed first.png shows the original menu; ordinary BootCamp click batch279 led through a loading frame to the welcome sign. After visually reviewing scene.png, the helper delivered Numpad6 down674/up706, with before670/after713. The turn-after image exposes Sarge/HUD but still severe diagonal terrain striping; clean gameplay remains unqualified.

All eight branch-entry hits occurred during the held turn, batches674–681, rather than being consumed at startup. Each uses surface 0x08221080 as both source and destination. Source RECT/destination pairs in order:

| Batch | Source RECT | Destination |
|---|---|---|
|674|(3,1,640,386)|(0,0)|
|675|(4,1,640,386)|(0,0)|
|676|(5,1,640,386)|(0,0)|
|677|(4,2,640,386)|(0,0)|
|678|(3,2,640,386)|(0,0)|
|679|(2,2,640,386)|(0,0)|
|680|(1,3,640,386)|(0,0)|
|681|(0,3,639,386)|(1,0)|

The verified original following instructions supply source=destination surface and flags0x10. This establishes a relevant same-surface copy path; entry data does not establish HRESULT, Lock pitch or the exact corruption cause. These captured copies move pixels upwards, so a row-direction-only explanation is not established.

Ordinary quit exited0, no signal/guard, 102489 raw-log bytes, minimum free48305770496, all1600pins unchanged, no survivors. Fresh cmd_gcxd8w0ymxvo verified controller42566/child43272 absent and ss showed no8143listener. An earlier plain bind check returned EADDRINUSE despite absent processes; that failed sealing attempt was followed by an explicit listener check, not a runtime retry. The prematurely attempted download returned404 because no archive had yet been made.

Recovered archive2292255bytes SHA25699b95d6fa3218387cc37a53f4b494975a5f6d67741a0affbef9ae1f308c05732 verified before extraction. Local scratch/runs/20261019-army-men-scroll-entry-remote-v1 contains21 artifacts2986693bytes, including raw log, image sequence, input receipt, parsed review, and source/postflight pins; manifest SHA2565d2044f05e592a8896c994eb1c005f025b9c6c4417f590054d239e39437e255a. Runtime is released. Next work is source-only public BltFast overlap/pitch analysis and a representative regression; no speculative renderer change or automatic original retry.

Root independently reviewed turn-after.png and the parsed review: repeated diagonal stripes, visible central soldier tile, legible lower HUD/minimap; eight hits are within keydown674..keyup706. Root agrees the upwards source shift does not establish a downward-row overlap explanation. Gameplay is not qualified.
