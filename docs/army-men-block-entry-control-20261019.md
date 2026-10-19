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
