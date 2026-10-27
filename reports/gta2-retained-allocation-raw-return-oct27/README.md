# GTA2 raw-return causal result

Observed raw EAX/HRESULT **0x887600ff** at IDirectDrawSurface_GetAttachedSurface API sequence **672**, in the accepted log_api_exit callback before the guest caller resumes. Entry-time DDSCAPS at **0x074ffe34** was **040000000100010030e1950000008f08** (little-endian dwords 0x00000004, 0x00010001, 0x0095e130, 0x088f0000). No initialized-tail assumption is made.

The call used this=0x08221038, vtable=0x006fd7fc, out=0x0087addc, caller return=0x00953275. This invocation resolved Dmavideo at 0x00951000, preferred base0x01000000: offset0x2275, preferred return0x01002275. Raw return is directly observed; the earlier inference is no longer the sole evidence. Displayed mode2 and the separate Vid_SetMode EAX1 are not HRESULT.

Reused all120 staged base groups without retransferring/rebuilding. Verified33 helper pins, actual3828 staged pins, registered71 game files, production runner3370a4e SHA1655b299, compiled1e4fdb06 base module SHA bf707aa4, region9a3bc9149d58209c, imports and exact Node24.22.1 startup. See archived preflight-result.json for full pins, canonical filename parser and comma-bearing filename enumeration. Prior6793 evidence payload checks are reused through coordinator verification.

One invocation, initial frozenzero, serial step250 matched ACKall250 then frozenzero; seven matched controller requests. No input or gameplay acceptance. Controller quit was acknowledged; this is not ordinary in-game Quit. Original stdout/stderr and optional missing-PE warnings are preserved. Guest CPU1.488856s, wall0.403081s, supervised peak168697856B; no owned survivors.

Historical predecessor339529728B projection exceeded335544320B by3985408B before helper transfer, preflight or guest. This was not actual host exhaustion. The explicitly authorized512MiB aggregate continuation charges retained donor once, full WAL once, fresh session/events/Git/control/publication and reserve32MiB. See admissions and API ledger for measurements.

Boat bx_w99qrvz9 remains RUNNING with staged files preserved and zero owned survivors. Expiry2026-10-27T15:47:01.657Z; cutoff15:30, handback15:34, coordinator shutdown15:39 and watcher226049 untouched. No lifecycle mutation. No main/root/index/ref/source changes, rebuild, accepted-test replay, deployment or media acquisition.
