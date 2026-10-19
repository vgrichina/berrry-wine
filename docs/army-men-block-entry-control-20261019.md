# Block-entry control and next rendering observation

The granted original-free native control passed on bx_rqnkhrnr at 03:08:42 UTC. Command cmd_tnbmfc9le4mn used the historical tested module 7fd02a77ec01e5e18065d112b1da434886a0dba3fcadd7ff043d1e2ddca41f33. A deterministic generated PE and synthetic x86 code demonstrate that an interior ADD breakpoint is not observed (EIP 0, EAX 7, halt 2), whereas a branch-entry breakpoint stops before the ADD (EAX 1, halt 5). Rearming the same breakpoint resumes successfully; starting the cached block again stops at the branch entry.

This validates breakpoint observability, not original-game execution or a rendering diagnosis. The V13 zero-hit observation at interior address 0x407503 remains unavailable evidence about that call.

The bounded controller enforced 60 seconds, 4 MiB raw log, unchanged admission 2847932416 and hard floor 2214592512. Exit 0, no signal/guard, 442 log bytes, minimum free 48312868864, all 1600 bundle hashes and source pins unchanged. Fresh cmd_vqwppgw9uvs9 confirmed controller 38936, child 38946 absent and port 8143 clear. No second native test or original game was run.

Evidence was recovered through the documented Files API to scratch/runs/20261019-army-bp-control-v1. Archive SHA256 f141a1625f1adaf607fd695d657ea3ab5ffc58aa59f40b4c51eb3f074e9426dd was verified before extraction; per-file manifest is retained alongside receipts and raw log.

The source-ready next helper selects 0x4074f1 with an eight-hit limit. The original PE byte check confirms this is the target of JNE at 0x4074e2. Capture occurs before pushes: ECX is destination X, EDX is destination Y, ESP addresses the 16-byte source RECT. Global 0x4744d8 supplies both source and destination surface; the following verified original instruction sequence supplies flags 0x10. The helper captures those registers, RECT, global pointer/wrapper and current/prior rectangles at 0x5d91c4. It retains one ordinary 250ms Numpad6 turn with key-up cleanup and before/after frames.

The expression test extracts the actual historical runner parser and checks register, literal and dereferenced expressions plus original PE image base, branch destination and exact pre-push bytes. It passes without native execution. No core/debugger/renderer changes are needed. The next original capture still requires immutable staging and a separate runtime grant; eight startup hits may exhaust the limit before turn input, which must be reported as incomplete turn evidence.
